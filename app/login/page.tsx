"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { signIn, signUp, useAuth } from "@/lib/auth";

type Mode = "login" | "signup";

export default function LoginPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // Already signed in → go to the panel.
  useEffect(() => {
    if (!loading && user) router.replace("/");
  }, [loading, user, router]);

  async function submit() {
    if (busy) return;
    setError("");
    const mail = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail)) {
      setError("Digite um e-mail válido.");
      return;
    }
    if (password.length < 6) {
      setError("A senha precisa ter ao menos 6 caracteres.");
      return;
    }
    setBusy(true);
    const { error: err } =
      mode === "login" ? await signIn(mail, password) : await signUp(mail, password);
    setBusy(false);
    if (err) {
      setError(
        mode === "login"
          ? "E-mail ou senha incorretos."
          : err.message.includes("registered")
            ? "Esse e-mail já tem conta. Entre com sua senha."
            : "Não foi possível criar a conta. Tente outro e-mail."
      );
      return;
    }
    router.replace("/");
  }

  return (
    <main className="auth">
      <div className="auth-card">
        <div className="auth-brand">Funneus</div>
        <h1>{mode === "login" ? "Entrar" : "Criar conta"}</h1>
        <p className="auth-sub">
          {mode === "login"
            ? "Acesse seus funis."
            : "Comece a montar seus funis em segundos."}
        </p>

        <label className="auth-field">
          <span>E-mail</span>
          <input
            type="email"
            autoComplete="email"
            placeholder="voce@email.com"
            value={email}
            autoFocus
            onChange={(e) => {
              setEmail(e.target.value);
              setError("");
            }}
            onKeyDown={(e) => e.key === "Enter" && submit()}
          />
        </label>

        <label className="auth-field">
          <span>Senha</span>
          <input
            type="password"
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            placeholder="••••••••"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setError("");
            }}
            onKeyDown={(e) => e.key === "Enter" && submit()}
          />
        </label>

        {error && <p className="auth-error">{error}</p>}

        <button className="btn-primary auth-submit" onClick={submit} disabled={busy}>
          {busy ? "Aguarde…" : mode === "login" ? "Entrar" : "Criar conta"}
        </button>

        <p className="auth-switch">
          {mode === "login" ? "Ainda não tem conta?" : "Já tem uma conta?"}{" "}
          <button
            onClick={() => {
              setMode(mode === "login" ? "signup" : "login");
              setError("");
            }}
          >
            {mode === "login" ? "Criar conta" : "Entrar"}
          </button>
        </p>
      </div>
    </main>
  );
}
