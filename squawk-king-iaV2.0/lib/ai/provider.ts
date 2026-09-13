/**
 * Squawk King IA — AI provider interface.
 *
 * Non-negotiable: the rest of the app talks ONLY to this interface, never to
 * a specific vendor SDK. Swapping providers means writing one new file that
 * implements AIProvider and changing one line in getAIProvider() below.
 */

export type Citation = {
  source_type: string; // 'FAR' | 'AC' | 'AD' | 'SB' | 'IPC' | 'logbook'
  regulation_number: string | null;
  section: string | null;
  page: string | null;
  title: string;
};

export type DiagnosticSource = {
  id: string;
  origin: "logbook" | "faa_guidance";
  ata_chapter: string | null;
  title: string;
  content: string;
  citation: Citation;
};

export type DiagnosticTurnRequest = {
  issue: string;
  conversationHistory: { role: "mechanic" | "assistant"; content: string }[];
  sources: DiagnosticSource[];
  questionsAskedSoFar: number;
};

export type DiagnosticTurnResponse =
  | {
      kind: "clarifying_question";
      question: string;
    }
  | {
      kind: "diagnosis";
      answer: string;
      citations: Citation[];
    }
  | {
      kind: "no_sources_found";
      message: string;
    };

export interface AIProvider {
  /** Transcribes a voice recording to text. */
  transcribe(audio: Blob | ArrayBuffer): Promise<string>;

  /**
   * Given the issue, conversation so far, and retrieved sources, either asks
   * one more clarifying question, returns a cited diagnosis, or reports that
   * no sources were found. Must NEVER return a diagnosis without at least
   * one citation drawn from `sources` — that constraint is enforced by the
   * provider implementation's prompt/parsing, not by the caller.
   */
  runDiagnosticTurn(req: DiagnosticTurnRequest): Promise<DiagnosticTurnResponse>;
}
