"use client";

import { useState } from "react";

type Props = {
  sessionId: string;
  issueDescription: string;
  workPerformedSuggestion: string;
  onDone: () => void;
  onCancel: () => void;
};

export default function LogbookCloseoutForm({
  sessionId,
  issueDescription,
  workPerformedSuggestion,
  onDone,
  onCancel,
}: Props) {
  const [aircraftMake, setAircraftMake] = useState("");
  const [aircraftModel, setAircraftModel] = useState("");
  const [registration, setRegistration] = useState("");
  const [totalTime, setTotalTime] = useState("");
  const [workPerformed, setWorkPerformed] = useState(workPerformedSuggestion);
  const [partNumbers, setPartNumbers] = useState("");
  const [signatureName, setSignatureName] = useState("");
  const [signatureCert, setSignatureCert] = useState("");
  const [saved, setSaved] = useState<{ id: string; entry_date: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSign(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/logbook", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          aircraft_make: aircraftMake,
          aircraft_model: aircraftModel,
          registration_number: registration,
          total_time: totalTime ? Number(totalTime) : null,
          issue_description: issueDescription,
          work_performed: workPerformed,
          part_numbers: partNumbers
            .split(",")
            .map((p) => p.trim())
            .filter(Boolean),
          signature_name: signatureName,
          signature_cert: signatureCert,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not save entry.");
      setSaved(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setSaving(false);
    }
  }

  if (saved) {
    return (
      <div className="flex-1 flex flex-col max-w-lg mx-auto w-full p-4 gap-4">
        <div className="deck-panel p-6 space-y-3 text-center">
          <p className="text-[var(--green)] readout-mono text-sm">
            Logbook entry saved · {saved.entry_date}
          </p>
          <button
            onClick={() => window.print()}
            className="w-full border border-[var(--panel-edge)] text-[var(--text-primary)] py-2 readout-mono text-xs"
          >
            Print entry
          </button>
          <button
            onClick={onDone}
            className="w-full bg-[var(--amber)] text-[#1a1300] font-semibold py-2.5 tracking-wide hover:bg-[#ffc542]"
          >
            Done
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSign} className="flex-1 flex flex-col max-w-lg mx-auto w-full p-4 gap-4 print:p-0">
      <div className="deck-panel p-5 space-y-4 print:border-0">
        <div>
          <h2 className="text-[var(--amber)] tracking-wide text-lg">Maintenance Record Entry</h2>
          <p className="readout-mono text-[10px] text-[var(--text-dim)]">14 CFR 43.9 — review and edit before signing</p>
        </div>

        <Field label="Aircraft Make" value={aircraftMake} onChange={setAircraftMake} required />
        <Field label="Aircraft Model" value={aircraftModel} onChange={setAircraftModel} required />
        <Field label="Registration Number" value={registration} onChange={setRegistration} required />
        <Field label="Total Time (hrs)" value={totalTime} onChange={setTotalTime} type="number" />

        <div>
          <label className="block text-xs uppercase tracking-widest text-[var(--text-dim)] mb-1">Issue Reported</label>
          <p className="readout-mono text-sm text-[var(--text-primary)] bg-[var(--panel-bg)] border border-[var(--panel-edge)] px-3 py-2">
            {issueDescription}
          </p>
        </div>

        <div>
          <label className="block text-xs uppercase tracking-widest text-[var(--text-dim)] mb-1">Work Performed</label>
          <textarea
            value={workPerformed}
            onChange={(e) => setWorkPerformed(e.target.value)}
            required
            rows={4}
            className="w-full bg-[var(--panel-bg)] border border-[var(--panel-edge)] px-3 py-2 readout-mono text-sm focus:outline-none focus:border-[var(--amber)]"
          />
        </div>

        <Field
          label="Part Numbers (comma-separated, if replaced)"
          value={partNumbers}
          onChange={setPartNumbers}
        />

        <div className="border-t border-[var(--panel-edge)] pt-4 space-y-4">
          <p className="readout-mono text-[10px] text-[var(--text-dim)] uppercase tracking-widest">Signature Block</p>
          <Field label="Mechanic Name" value={signatureName} onChange={setSignatureName} required />
          <Field label="A&amp;P / IA Certificate Number" value={signatureCert} onChange={setSignatureCert} required />
        </div>

        {error && <p className="readout-mono text-sm text-[var(--red)]">{error}</p>}

        <div className="flex gap-3 print:hidden">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 border border-[var(--panel-edge)] text-[var(--text-dim)] py-2.5 readout-mono text-xs"
          >
            Back
          </button>
          <button
            type="submit"
            disabled={saving}
            className="flex-1 bg-[var(--green)] text-[#04160d] font-semibold py-2.5 tracking-wide hover:brightness-110 disabled:opacity-40"
          >
            {saving ? "Signing..." : "Sign & Save Entry"}
          </button>
        </div>
      </div>
    </form>
  );
}

function Field({
  label,
  value,
  onChange,
  required,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  type?: string;
}) {
  return (
    <div>
      <label className="block text-xs uppercase tracking-widest text-[var(--text-dim)] mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        className="w-full bg-[var(--panel-bg)] border border-[var(--panel-edge)] px-3 py-2 readout-mono text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--amber)]"
      />
    </div>
  );
}
