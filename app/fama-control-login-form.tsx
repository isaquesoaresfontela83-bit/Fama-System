"use client";

import { FormEvent, useState } from "react";

export function FamaControlLoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.ok) {
        throw new Error(data.message || "Não foi possível entrar no Fama Control.");
      }

      window.location.href = "/";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível entrar no Fama Control.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-8 space-y-4">
      <label className="block">
        <span className="mb-2 block text-sm font-bold text-[#b8cadb]">E-mail</span>
        <input
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
          autoComplete="email"
          className="w-full rounded-2xl border border-[#355f8b] bg-[#071a31] px-4 py-3 text-white outline-none ring-[#29a5ef] focus:ring-2"
        />
      </label>

      <label className="block">
        <span className="mb-2 block text-sm font-bold text-[#b8cadb]">Senha</span>
        <input
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
          autoComplete="current-password"
          className="w-full rounded-2xl border border-[#355f8b] bg-[#071a31] px-4 py-3 text-white outline-none ring-[#29a5ef] focus:ring-2"
        />
      </label>

      {error && (
        <div className="rounded-xl border border-[#81414d] bg-[#3d1824] px-4 py-3 text-sm text-[#ffc4ca]">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="flex w-full items-center justify-center rounded-2xl bg-gradient-to-r from-[#29a5ef] to-[#1685d6] px-5 py-4 text-lg font-extrabold text-white shadow-lg transition hover:brightness-110 disabled:cursor-wait disabled:opacity-60"
      >
        {loading ? "Entrando..." : "Entrar no Fama Control →"}
      </button>
    </form>
  );
}
