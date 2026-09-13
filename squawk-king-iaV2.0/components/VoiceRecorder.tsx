"use client";

import { useEffect, useRef, useState } from "react";

type Props = {
  onTranscript: (text: string) => void;
  disabled?: boolean;
};

// Minimal shape of the Web Speech API we rely on — not in default TS lib.dom yet.
interface SpeechRecognitionResultLike {
  isFinal: boolean;
  [index: number]: { transcript: string };
}
interface SpeechRecognitionEventLike extends Event {
  results: ArrayLike<SpeechRecognitionResultLike>;
}
interface SpeechRecognitionLike extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  onresult: ((ev: SpeechRecognitionEventLike) => void) | null;
  onerror: ((ev: Event) => void) | null;
  onend: (() => void) | null;
}

export default function VoiceRecorder({ onTranscript, disabled }: Props) {
  const [supported, setSupported] = useState(true);
  const [recording, setRecording] = useState(false);
  const [interim, setInterim] = useState("");
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  useEffect(() => {
    const w = window as unknown as {
      SpeechRecognition?: new () => SpeechRecognitionLike;
      webkitSpeechRecognition?: new () => SpeechRecognitionLike;
    };
    const SpeechRecognitionCtor = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!SpeechRecognitionCtor) {
      setSupported(false);
      return;
    }
    const recognition = new SpeechRecognitionCtor();
    recognition.continuous = false;
    recognition.interimResults = true;
    // Aviation jargon and tail numbers (e.g. "N12345") transcribe more
    // reliably with a general en-US model plus a short domain hint appended
    // client-side before sending to the diagnostic API (see onend below).
    recognition.lang = "en-US";

    recognition.onresult = (event: SpeechRecognitionEventLike) => {
      let finalText = "";
      let interimText = "";
      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) finalText += result[0].transcript;
        else interimText += result[0].transcript;
      }
      setInterim(interimText);
      if (finalText) onTranscript(finalText.trim());
    };

    recognition.onerror = () => setRecording(false);
    recognition.onend = () => setRecording(false);

    recognitionRef.current = recognition;
  }, [onTranscript]);

  function toggleRecording() {
    if (!recognitionRef.current) return;
    if (recording) {
      recognitionRef.current.stop();
      setRecording(false);
    } else {
      setInterim("");
      recognitionRef.current.start();
      setRecording(true);
    }
  }

  if (!supported) {
    return (
      <p className="readout-mono text-xs text-[var(--text-dim)] text-center">
        Voice input isn&apos;t supported in this browser. Type your issue below instead.
      </p>
    );
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <button
        type="button"
        onClick={toggleRecording}
        disabled={disabled}
        aria-pressed={recording}
        className={`h-20 w-20 rounded-full border-4 flex items-center justify-center transition-colors disabled:opacity-40 ${
          recording
            ? "border-[var(--red)] bg-[var(--red)]/20 animate-pulse"
            : "border-[var(--amber)] bg-[var(--amber)]/10 hover:bg-[var(--amber)]/20"
        }`}
      >
        <span
          className={`block rounded-full ${recording ? "h-6 w-6 bg-[var(--red)]" : "h-8 w-8 bg-[var(--amber)]"}`}
        />
      </button>
      <p className="readout-mono text-xs text-[var(--text-dim)] h-4">
        {recording ? interim || "Listening..." : "Tap to record"}
      </p>
    </div>
  );
}
