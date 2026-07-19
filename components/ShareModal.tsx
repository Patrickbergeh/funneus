"use client";

import { useEffect, useState } from "react";
import { getShares, setShares, type Share, type ShareRole } from "@/lib/store";
import { supabase } from "@/lib/supabase";

const ROLES: { v: ShareRole; label: string }[] = [
  { v: "view", label: "Visualizar" },
  { v: "edit", label: "Editar" },
];

function RoleSelect({
  value,
  onChange,
}: {
  value: ShareRole;
  onChange: (r: ShareRole) => void;
}) {
  return (
    <div className="role-seg">
      {ROLES.map((r) => (
        <button
          key={r.v}
          className={`role-opt${value === r.v ? " on" : ""}`}
          onClick={() => onChange(r.v)}
          type="button"
        >
          {r.label}
        </button>
      ))}
    </div>
  );
}

export default function ShareModal({
  funnelId,
  funnelName,
  onClose,
}: {
  funnelId: string;
  funnelName: string;
  onClose: () => void;
}) {
  const [shares, setSharesState] = useState<Share[]>([]);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<ShareRole>("edit");
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState("");

  useEffect(() => {
    let alive = true;
    getShares(funnelId).then((s) => {
      if (alive) setSharesState(s);
    });
    return () => {
      alive = false;
    };
  }, [funnelId]);

  function persist(next: Share[]) {
    setSharesState(next);
    void setShares(funnelId, next);
  }

  async function invite() {
    if (sending) return;
    const e = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) {
      setError("Digite um e-mail válido.");
      return;
    }
    if (shares.some((s) => s.email === e)) {
      setError("Essa pessoa já tem acesso.");
      return;
    }
    setError("");
    setSent("");
    setSending(true);
    // Grava o acesso no banco antes de enviar o convite.
    persist([...shares, { email: e, role }]);
    setEmail("");
    try {
      const { data, error: fnErr } = await supabase.functions.invoke("send-invite", {
        body: {
          email: e,
          role,
          funnelName,
          funnelId,
          origin: typeof window !== "undefined" ? window.location.origin : "",
        },
      });
      if (fnErr || (data && (data as { error?: unknown }).error)) {
        setError("Acesso salvo, mas o e-mail de convite não pôde ser enviado.");
      } else {
        setSent(`Convite enviado para ${e}.`);
      }
    } catch {
      setError("Acesso salvo, mas o e-mail de convite não pôde ser enviado.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="share-modal" onClick={(ev) => ev.stopPropagation()}>
        <div className="share-head">
          <div>
            <h2>Compartilhar</h2>
            <p>
              Convide pessoas para acessar <strong>{funnelName}</strong>.
            </p>
          </div>
          <button className="share-x" onClick={onClose} title="Fechar">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="share-add">
          <input
            className="share-email"
            type="email"
            placeholder="E-mail da pessoa"
            value={email}
            autoFocus
            onChange={(e) => {
              setEmail(e.target.value);
              setError("");
            }}
            onKeyDown={(e) => e.key === "Enter" && invite()}
          />
          <RoleSelect value={role} onChange={setRole} />
          <button
            className="btn-primary share-invite"
            onClick={invite}
            disabled={sending}
          >
            {sending ? "Enviando…" : "Convidar"}
          </button>
        </div>
        {error && <p className="share-error">{error}</p>}
        {sent && <p className="share-ok">{sent}</p>}

        <div className="share-list">
          <div className="share-list-title">
            Pessoas com acesso ({shares.length})
          </div>
          {shares.length === 0 && (
            <p className="share-empty">Ninguém adicionado ainda.</p>
          )}
          {shares.map((s) => (
            <div className="share-row" key={s.email}>
              <span className="share-avatar">{s.email[0]?.toUpperCase()}</span>
              <span className="share-mail">{s.email}</span>
              <RoleSelect
                value={s.role}
                onChange={(r) =>
                  persist(shares.map((x) => (x.email === s.email ? { ...x, role: r } : x)))
                }
              />
              <button
                className="share-remove"
                title="Remover acesso"
                onClick={() => persist(shares.filter((x) => x.email !== s.email))}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </button>
            </div>
          ))}
        </div>

        <div className="share-foot">
          <button className="btn-primary" onClick={onClose}>
            Concluir
          </button>
        </div>
      </div>
    </div>
  );
}
