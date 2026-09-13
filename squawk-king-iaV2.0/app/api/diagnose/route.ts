import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { pool } from "@/lib/db/pool";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getAIProvider } from "@/lib/ai";
import { retrieveSources } from "@/lib/ai/retrieval";

const StartSchema = z.object({
  action: z.literal("start"),
  issue: z.string().min(3),
});

const AnswerSchema = z.object({
  action: z.literal("answer"),
  sessionId: z.string().uuid(),
  answer: z.string().min(1),
});

const RequestSchema = z.discriminatedUnion("action", [StartSchema, AnswerSchema]);

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const body = await req.json();
  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const ai = getAIProvider();

  if (parsed.data.action === "start") {
    const { issue } = parsed.data;
    const { sources, ataChapter } = await retrieveSources(user.userId, issue);

    const turnResult = await ai.runDiagnosticTurn({
      issue,
      conversationHistory: [],
      sources,
      questionsAskedSoFar: 0,
    });

    const conversation = [{ role: "mechanic", content: issue }, describeTurn(turnResult)];

    const session = await pool.query(
      `INSERT INTO diagnostic_sessions (user_id, initial_issue, ata_chapter, questions_asked, status, conversation, final_citations)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id`,
      [
        user.userId,
        issue,
        ataChapter,
        turnResult.kind === "clarifying_question" ? 1 : 0,
        statusFor(turnResult),
        JSON.stringify(conversation),
        turnResult.kind === "diagnosis" ? JSON.stringify(turnResult.citations) : null,
      ]
    );

    return NextResponse.json({ sessionId: session.rows[0].id, result: turnResult });
  }

  // action === "answer"
  const { sessionId, answer } = parsed.data;
  const sessionRow = await pool.query(
    `SELECT * FROM diagnostic_sessions WHERE id = $1 AND user_id = $2`,
    [sessionId, user.userId]
  );
  const session = sessionRow.rows[0];
  if (!session) {
    return NextResponse.json({ error: "Session not found." }, { status: 404 });
  }
  if (session.status !== "active") {
    return NextResponse.json({ error: "This diagnostic session has already concluded." }, { status: 409 });
  }

  const combinedQuery = `${session.initial_issue} ${answer}`;
  const { sources, ataChapter } = await retrieveSources(user.userId, combinedQuery);

  const priorConversation = session.conversation as { role: string; content: string }[];
  const conversationHistory = priorConversation.map((c) => ({
    role: c.role as "mechanic" | "assistant",
    content: c.content,
  }));
  conversationHistory.push({ role: "mechanic", content: answer });

  const turnResult = await ai.runDiagnosticTurn({
    issue: session.initial_issue,
    conversationHistory,
    sources,
    questionsAskedSoFar: session.questions_asked,
  });

  // Hard cap: if the model tries to ask a 4th clarifying question, force
  // a no-sources-found outcome instead of trusting the model's own count.
  const finalResult =
    turnResult.kind === "clarifying_question" && session.questions_asked >= 3
      ? ({
          kind: "no_sources_found",
          message:
            "No available sources found after three clarifying questions. Consult an A&P mechanic or the aircraft manufacturer.",
        } as const)
      : turnResult;

  const newConversation = [
    ...priorConversation,
    { role: "mechanic", content: answer },
    describeTurn(finalResult),
  ];

  await pool.query(
    `UPDATE diagnostic_sessions
     SET questions_asked = $1, status = $2, conversation = $3, final_citations = $4,
         ata_chapter = COALESCE(ata_chapter, $5), updated_at = now()
     WHERE id = $6`,
    [
      finalResult.kind === "clarifying_question" ? session.questions_asked + 1 : session.questions_asked,
      statusFor(finalResult),
      JSON.stringify(newConversation),
      finalResult.kind === "diagnosis" ? JSON.stringify(finalResult.citations) : null,
      ataChapter,
      sessionId,
    ]
  );

  return NextResponse.json({ sessionId, result: finalResult });
}

function statusFor(result: { kind: string }) {
  if (result.kind === "diagnosis") return "resolved";
  if (result.kind === "no_sources_found") return "no_sources_found";
  return "active";
}

function describeTurn(result: { kind: string; question?: string; answer?: string; message?: string }) {
  const content =
    result.kind === "clarifying_question"
      ? result.question
      : result.kind === "diagnosis"
      ? result.answer
      : result.message;
  return { role: "assistant", content };
}
