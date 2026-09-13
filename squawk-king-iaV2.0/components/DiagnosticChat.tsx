"use client";

import { useState } from "react";
import VoiceRecorder from "./VoiceRecorder";
import LogbookCloseoutForm from "./LogbookCloseoutForm";

type Citation = {
  source_type: string;
  regulation_number: string | null;
  section: string | null;
  page: string | null;
  title: string;
};

type Turn =
  | { kind: "clarifying_question"; question: string }
  | { kind: "diagnosis"; answer: string; citations: Citation[] }
  | { kind: "no_sources_found"; message: string };

type Message = { role: "mechanic" | "assistant"; content: string };

export default function DiagnosticChat() {
  const [issue, setIssue] = useState("");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentTurn, setCurrentTurn] = useState<Turn | null>(null);
  const [answerDraft, setAnswerDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [closeoutOpen, setCloseoutOpen] = useState(false);

  async function startDiagnosis() {
    if (!issue.trim()) return;
    setLoading(true);
    setError(null);
    setMessages([{ role: "mechanic", content: issue }]);
    try {
      const res = await fetch("/api/diagnose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "start", issue }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Diagnosis failed.");
      setSessionId(data.sessionId);
      setCurrentTurn(data.result);
      setMessages((m) => [...m, { role: "assistant", content: contentFor(data.result) }]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  async function submitAnswer() {
    if (!sessionId || !answerDraft.trim()) return;
    setLoading(true);
    setError(null);
    const answer = answerDraft;
    setMessages((m) => [...m, { role: "mechanic", content: answer }]);
    setAnswerDraft("");
    try {
      const res = await fetch("/api/diagnose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "answer", sessionId, answer }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Diagnosis failed.");
      setCurrentTurn(data.result);
      setMessages((m) => [...m, { role: "assistant", content: contentFor(data.result) }]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setIssue("");
    setSessionId(null);
    setMessages([]);
    setCurrentTurn(null);
    setAnswerDraft("");
    setError(null);
    setCloseoutOpen(false);
  }

  if (closeoutOpen && currentTurn?.kind === "diagnosis" && sessionId) {
    return (
      <LogbookCloseoutForm
        sessionId={sessionId}
        issueDescription={issue}
        workPerformedSuggestion={currentTurn.answer}
        onDone={reset}
        onCancel={() => setCloseoutOpen(false)}
      />
    );
  }

  return (
    <div className="flex-1 flex flex-col max-w-lg mx-auto w-full p-4 gap-4">
      {!sessionId && (
        <div className="deck-panel p-6 flex flex-col items-center gap-4">
          <h2 className="text-center text-[var(--text-primary)] text-lg leading-snug">
            What&apos;s wrong with the plane?
            <br />
            <span className="text-[var(--text-dim)] text-sm">Describe your issue.</span>
          </h2>
          <VoiceRecorder onTranscript={(text) => setIssue((prev) => (prev ? `${prev} ${text}` : text))} disabled={loading} />
          <textarea
            value={issue}
            onChange={(e) => setIssue(e.target.value)}
            placeholder="e.g. Battery won't hold a charge on the Cessna 172, N12345..."
            rows={3}
            className="w-full bg-[var(--panel-bg)] border border-[var(--panel-edge)] px-3 py-2 readout-mono text-sm focus:outline-none focus:border-[var(--amber)]"
          />
          <button
            onClick={startDiagnosis}
            disabled={loading || !issue.trim()}
            className="w-full bg-[var(--amber)] text-[#1a1300] font-semibold py-2.5 tracking-wide hover:bg-[#ffc542] disabled:opacity-40"
          >
            {loading ? "Searching sources..." : "Diagnose"}
          </button>
        </div>
      )}

      {messages.length > 0 && (
        <div className="deck-panel p-4 flex flex-col gap-3">
          {messages.map((m, i) => (
            <div key={i} className={m.role === "mechanic" ? "text-right" : "text-left"}>
              <span
                className={`inline-block px-3 py-2 text-sm readout-mono max-w-[85%] ${
                  m.role === "mechanic"
                    ? "bg-[var(--amber)]/15 text-[var(--text-primary)] border border-[var(--amber)]/30"
                    : "bg-[var(--panel-bg)] text-[var(--text-primary)] border border-[var(--panel-edge)]"
                }`}
              >
                {m.content}
              </span>
            </div>
          ))}
        </div>
      )}

      {currentTurn?.kind === "diagnosis" && (
        <div className="deck-panel p-4 space-y-3">
          <h3 className="text-xs uppercase tracking-widest text-[var(--green)]">Citations</h3>
          <ul className="space-y-2">
            {currentTurn.citations.map((c, i) => (
              <li key={i} className="readout-mono text-xs text-[var(--text-dim)] border-l-2 border-[var(--green)] pl-2">
                {c.source_type} {c.regulation_number ?? ""} {c.section ?? ""} — {c.title}
              </li>
            ))}
          </ul>
          <button
            onClick={() => setCloseoutOpen(true)}
            className="w-full bg-[var(--green)] text-[#04160d] font-semibold py-2.5 tracking-wide hover:brightness-110"
          >
            Confirm Fix &amp; Draft Logbook Entry
          </button>
          <button onClick={reset} className="w-full readout-mono text-xs text-[var(--text-dim)] py-1">
            Start a new diagnosis
          </button>
        </div>
      )}

      {currentTurn?.kind === "no_sources_found" && (
        <div className="deck-panel p-4 border-[var(--red)]/40 space-y-3">
          <p className="text-sm text-[var(--red)] readout-mono">{currentTurn.message}</p>
          <button onClick={reset} className="w-full readout-mono text-xs text-[var(--text-dim)] py-1 border border-[var(--panel-edge)]">
            Start a new diagnosis
          </button>
        </div>
      )}

      {currentTurn?.kind === "clarifying_question" && (
        <div className="deck-panel p-4 space-y-3">
          <VoiceRecorder onTranscript={(text) => setAnswerDraft((prev) => (prev ? `${prev} ${text}` : text))} disabled={loading} />
          <textarea
            value={answerDraft}
            onChange={(e) => setAnswerDraft(e.target.value)}
            rows={2}
            placeholder="Your answer..."
            className="w-full bg-[var(--panel-bg)] border border-[var(--panel-edge)] px-3 py-2 readout-mono text-sm focus:outline-none focus:border-[var(--amber)]"
          />
          <button
            onClick={submitAnswer}
            disabled={loading || !answerDraft.trim()}
            className="w-full bg-[var(--amber)] text-[#1a1300] font-semibold py-2.5 tracking-wide hover:bg-[#ffc542] disabled:opacity-40"
          >
            {loading ? "Searching sources..." : "Send Answer"}
          </button>
        </div>
      )}

      {error && <p className="readout-mono text-sm text-[var(--red)]">{error}</p>}
    </div>
  );
}

function contentFor(result: Turn): string {
  if (result.kind === "clarifying_question") return result.question;
  if (result.kind === "diagnosis") return result.answer;
  return result.message;
}
