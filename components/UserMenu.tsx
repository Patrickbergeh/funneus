"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

export default function UserMenu({ email }: { email: string }) {
  const router = useRouter();
  const ref = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [changing, setChanging] = useState(false);
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");

  const initial = email?.[0]?.toUpperCase() ?? "?";

  // Close on outside click / Escape.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as HTMLElement)) close();
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function close() {
    setOpen(false);
    setChanging(false);
    setPw("");
    setPw2("");
    setError("");
    setOk("");
  }

  async function changePassword() {
    if (busy) return;
    setError("");
    setOk("");
    if (pw.length < 6) {
      setError("A senha precisa ter ao menos 6 caracteres.");
      return;
    }
    if (pw !== pw2) {
      setError("As senhas não coincidem.");
      return;
    }
    setBusy(true);
    const { error: err } = await supabase.auth.updateUser({ password: pw });
    setBusy(false);
    if (err) {
      setError(
        err.message.toLowerCase().includes("different")
          ? "A nova senha precisa ser diferente da atual."
          : "Não foi possível alterar a senha. Tente novamente."
      );
      return;
    }
    setPw("");
    setPw2("");
    setChanging(false);
    setOk("Senha alterada com sucesso!");
  }

  async function handleSignOut() {
    await signOut();
    router.replace("/login");
  }

  return (
    <div className="user-menu" ref={ref}>
      <button
        className="user-avatar-btn"
        onClick={() => (open ? close() : setOpen(true))}
        title="Sua conta"
      >
        {initial}
      </button>

      {open && (
        <div className="user-pop">
          <div className="user-pop-head">
            <span className="user-pop-avatar">{initial}</span>
            <div className="user-pop-id">
              <div className="user-pop-title">Minha conta</div>
              <div className="user-pop-email" title={email}>
                {email}
              </div>
            </div>
          </div>

          <div className="user-pop-sep" />

          {!changing ? (
            <>
              <button className="user-pop-item" onClick={() => setChanging(true)}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <rect x="4" y="10" width="16" height="10" rx="2" stroke="currentColor" strokeWidth="1.8" />
                  <path d="M8 10V7a4 4 0 0 1 8 0v3" stroke="currentColor" strokeWidth="1.8" />
                </svg>
                Alterar senha
              </button>
              {ok && <p className="user-pop-ok">{ok}</p>}
            </>
          ) : (
            <div className="user-pop-form">
              <input
                type="password"
                autoComplete="new-password"
                placeholder="Nova senha"
                value={pw}
                autoFocus
                onChange={(e) => {
                  setPw(e.target.value);
                  setError("");
                }}
              />
              <input
                type="password"
                autoComplete="new-password"
                placeholder="Confirmar nova senha"
                value={pw2}
                onChange={(e) => {
                  setPw2(e.target.value);
                  setError("");
                }}
                onKeyDown={(e) => e.key === "Enter" && changePassword()}
              />
              {error && <p className="user-pop-error">{error}</p>}
              <div className="user-pop-actions">
                <button
                  className="btn-ghost"
                  onClick={() => {
                    setChanging(false);
                    setPw("");
                    setPw2("");
                    setError("");
                  }}
                >
                  Cancelar
                </button>
                <button className="btn-primary" onClick={changePassword} disabled={busy}>
                  {busy ? "Salvando…" : "Salvar"}
                </button>
              </div>
            </div>
          )}

          <div className="user-pop-sep" />

          <button className="user-pop-item danger" onClick={handleSignOut}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M15 4h3a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              <path d="M10 8l-4 4 4 4M6 12h9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Sair
          </button>
        </div>
      )}
    </div>
  );
}
