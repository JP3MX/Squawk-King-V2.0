import type {
  AIProvider,
  DiagnosticTurnRequest,
  DiagnosticTurnResponse,
  Citation,
} from "./provider";

const SYSTEM_PROMPT = `You are the diagnostic reasoning core of Squawk King IA, a tool for aircraft mechanics.

Rules you must follow exactly:
1. You may ONLY use the "sources" provided to you in the user message. You must never invent, assume, or recall facts from general knowledge about aircraft maintenance.
2. If the sources are sufficient to answer, respond with a diagnosis and cite every claim using the exact source titles and regulation numbers given to you. Do not make any claim that isn't directly backed by a provided source.
3. If the sources are insufficient, you may ask ONE clarifying question that would help narrow down which source applies (e.g. asking about symptoms, aircraft model, conditions). You have a maximum of 3 clarifying questions total across this conversation.
4. If you have already asked 3 clarifying questions and still cannot find a sufficient source, you must respond that no available sources were found and recommend consulting an A&P mechanic or the aircraft manufacturer. Never guess at this point.
5. Never fabricate a citation. If you cannot point to a specific provided source, say so.

Respond ONLY with a JSON object, no other text, in exactly one of these three shapes:
{"kind": "clarifying_question", "question": "..."}
{"kind": "diagnosis", "answer": "...", "citations": [{"source_type": "...", "regulation_number": "...", "section": "...", "page": "...", "title": "..."}]}
{"kind": "no_sources_found", "message": "..."}`;

function buildUserMessage(req: DiagnosticTurnRequest): string {
  const sourcesBlock = req.sources.length
    ? req.sources
        .map(
          (s, i) =>
            `[Source ${i + 1}] (${s.origin}, ATA ${s.ata_chapter ?? "n/a"})\nTitle: ${s.title}\nCitation: ${s.citation.source_type} ${s.citation.regulation_number ?? ""} ${s.citation.section ?? ""}\nContent: ${s.content}`
        )
        .join("\n\n")
    : "No matching sources were found in the logbook or FAA guidance database for this query.";

  const historyBlock = req.conversationHistory
    .map((h) => `${h.role === "mechanic" ? "Mechanic" : "Assistant"}: ${h.content}`)
    .join("\n");

  return `Reported issue: "${req.issue}"

Conversation so far:
${historyBlock || "(none yet)"}

Clarifying questions already asked: ${req.questionsAskedSoFar} of 3 maximum.

Available sources:
${sourcesBlock}

Based ONLY on the sources above, respond with the appropriate JSON object.`;
}

export class AnthropicProvider implements AIProvider {
  private apiKey: string;
  private model = "claude-sonnet-4-6";

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async transcribe(): Promise<string> {
    // Voice transcription is handled client-side via the Web Speech API in
    // this build (see components/VoiceRecorder.tsx). This method exists so
    // a future server-side transcription provider (e.g. Whisper) can be
    // swapped in without touching any caller.
    throw new Error(
      "Server-side transcription is not wired up for AnthropicProvider. Use the browser's Web Speech API on the client, or implement transcribe() with a speech-to-text provider."
    );
  }

  async runDiagnosticTurn(req: DiagnosticTurnRequest): Promise<DiagnosticTurnResponse> {
    if (!this.apiKey) {
      // No key configured: fail safe into "no sources found" rather than
      // silently fabricating anything.
      return {
        kind: "no_sources_found",
        message:
          "The diagnostic AI is not configured (missing ANTHROPIC_API_KEY). No available sources found — consult an A&P mechanic or the aircraft manufacturer.",
      };
    }

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": this.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: 1024,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: buildUserMessage(req) }],
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Anthropic API error: ${response.status} ${text}`);
    }

    const data = await response.json();
    const textBlock = data.content?.find((b: { type: string }) => b.type === "text");
    if (!textBlock) {
      throw new Error("Anthropic response contained no text content.");
    }

    let parsed: DiagnosticTurnResponse;
    try {
      const cleaned = textBlock.text.replace(/```json|```/g, "").trim();
      parsed = JSON.parse(cleaned);
    } catch {
      throw new Error("Failed to parse AI response as JSON: " + textBlock.text);
    }

    // Hard safety net: a "diagnosis" with zero citations is never allowed
    // through, no matter what the model returned.
    if (parsed.kind === "diagnosis" && (!parsed.citations || parsed.citations.length === 0)) {
      return {
        kind: "no_sources_found",
        message:
          "No available sources found to support a diagnosis. Consult an A&P mechanic or the aircraft manufacturer.",
      };
    }

    return parsed;
  }
}

export type { Citation };
