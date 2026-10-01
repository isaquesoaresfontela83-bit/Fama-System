"use client";

import { FormEvent, useState } from "react";

export function LoginForm() {
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
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "same-origin",
        body: JSON.stringify({
          email,
          password,
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok || !data.ok) {
        throw new Error(
          data.message || "Não foi possível entrar.",
        );
      }

      window.location.href = "/";
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Não foi possível entrar.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <form
      id="login"
      onSubmit={submit}
      style={{
        marginTop: 24,
        padding: 24,
        borderRadius: 20,
        background: "#0d284c",
        border: "1px solid #244d78",
        maxWidth: 460,
      }}
    >
      <div
        style={{
          fontSize: 12,
          fontWeight: 800,
          letterSpacing: ".12em",
          color: "#74def5",
          marginBottom: 8,
        }}
      >
        CONTA FAMA
      </div>

      <h2 style={{ margin: "0 0 6px" }}>
        Entrar no sistema
      </h2>

      <p
        style={{
          margin: "0 0 18px",
          opacity: 0.75,
          fontSize: 14,
        }}
      >
        Use seu e-mail e senha cadastrados.
      </p>

      <label
        style={{
          display: "block",
          marginBottom: 14,
        }}
      >
        <span
          style={{
            display: "block",
            marginBottom: 6,
            fontSize: 13,
          }}
        >
          E-mail
        </span>

        <input
          type="email"
          value={email}
          onChange={(event) =>
            setEmail(event.target.value)
          }
          required
          autoComplete="email"
          style={{
            width: "100%",
            boxSizing: "border-box",
            padding: "12px 14px",
            borderRadius: 10,
            border: "1px solid #365d85",
            background: "#071a31",
            color: "white",
          }}
        />
      </label>

      <label
        style={{
          display: "block",
          marginBottom: 16,
        }}
      >
        <span
          style={{
            display: "block",
            marginBottom: 6,
            fontSize: 13,
          }}
        >
          Senha
        </span>

        <input
          type="password"
          value={password}
          onChange={(event) =>
            setPassword(event.target.value)
          }
          required
          autoComplete="current-password"
          style={{
            width: "100%",
            boxSizing: "border-box",
            padding: "12px 14px",
            borderRadius: 10,
            border: "1px solid #365d85",
            background: "#071a31",
            color: "white",
          }}
        />
      </label>

      {error && (
        <div
          style={{
            marginBottom: 14,
            color: "#ff9fa9",
            fontSize: 13,
          }}
        >
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        style={{
          width: "100%",
          padding: "13px 18px",
          border: 0,
          borderRadius: 11,
          cursor: loading ? "wait" : "pointer",
          fontWeight: 800,
          background:
            "linear-gradient(90deg,#0F92E2,#056AC6)",
          color: "white",
        }}
      >
        {loading
          ? "Entrando..."
          : "Entrar no Fama System"}
      </button>
    </form>
  );
}
