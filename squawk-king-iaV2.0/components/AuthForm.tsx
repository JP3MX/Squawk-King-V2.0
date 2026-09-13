"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Mode = "login" | "register";

export default function AuthForm({ mode }: { mode: Mode }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"mechanic" | "admin" | "owner">("mechanic");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(mode === "register" ? { name, email, password, role } : { email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Something went wrong.");
        setLoading(false);
        return;
      }
      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("Network error. Check your connection and try again.");
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="deck-panel w-full max-w-sm p-6 space-y-4">
      <div>
        <h1 className="text-2xl tracking-wide text-[var(--amber)] font-semibold">
          {mode === "login" ? "Squawk King IA" : "Create Account"}
        </h1>
        <p className="text-sm text-[var(--text-dim)] mt-1 readout-mono">
          {mode === "login" ? "Sign in to your logbook" : "Register a mechanic account"}
        </p>
      </div>

      {mode === "register" && (
        <div>
          <label className="block text-xs uppercase tracking-widest text-[var(--text-dim)] mb-1">Name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="w-full bg-[var(--panel-bg)] border border-[var(--panel-edge)] px-3 py-2 text-[var(--text-primary)] readout-mono focus:outline-none focus:border-[var(--amber)]"
          />
        </div>
      )}

      <div>
        <label className="block text-xs uppercase tracking-widest text-[var(--text-dim)] mb-1">Email</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="w-full bg-[var(--panel-bg)] border border-[var(--panel-edge)] px-3 py-2 text-[var(--text-primary)] readout-mono focus:outline-none focus:border-[var(--amber)]"
        />
      </div>

      <div>
        <label className="block text-xs uppercase tracking-widest text-[var(--text-dim)] mb-1">Password</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={8}
          className="w-full bg-[var(--panel-bg)] border border-[var(--panel-edge)] px-3 py-2 text-[var(--text-primary)] readout-mono focus:outline-none focus:border-[var(--amber)]"
        />
      </div>

      {mode === "register" && (
        <div>
          <label className="block text-xs uppercase tracking-widest text-[var(--text-dim)] mb-1">Role</label>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as typeof role)}
            className="w-full bg-[var(--panel-bg)] border border-[var(--panel-edge)] px-3 py-2 text-[var(--text-primary)] readout-mono focus:outline-none focus:border-[var(--amber)]"
          >
            <option value="mechanic">Mechanic</option>
            <option value="admin">Admin</option>
            <option value="owner">Owner</option>
          </select>
        </div>
      )}

      {error && (
        <p className="text-sm text-[var(--red)] readout-mono border border-[var(--red)]/40 bg-[var(--red)]/10 px-3 py-2">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-[var(--amber)] text-[#1a1300] font-semibold py-2.5 tracking-wide hover:bg-[#ffc542] disabled:opacity-50 transition-colors"
      >
        {loading ? "Working..." : mode === "login" ? "Sign In" : "Create Account"}
      </button>

      <p className="text-xs text-center text-[var(--text-dim)]">
        {mode === "login" ? (
          <>
            No account? <a href="/register" className="text-[var(--amber)]">Register</a>
          </>
        ) : (
          <>
            Have an account? <a href="/login" className="text-[var(--amber)]">Sign in</a>
          </>
        )}
      </p>
    </form>
  );
}
