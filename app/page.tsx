"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createFunnel, deleteFunnel, listFunnels, type Funnel } from "@/lib/store";
import { PlusIcon, TrashIcon } from "@/lib/icons";
import { signOut, useAuth } from "@/lib/auth";

function timeAgo(ts: number) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return "agora";
  const m = Math.floor(s / 60);
  if (m < 60) return `há ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `há ${h} h`;
  const d = Math.floor(h / 24);
  return `há ${d} d`;
}

export default function HomePage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [funnels, setFunnels] = useState<Funnel[]>([]);
  const [modal, setModal] = useState(false);
  const [name, setName] = useState("");
  const [ready, setReady] = useState(false);
  const [toDelete, setToDelete] = useState<Funnel | null>(null);
  const [creating, setCreating] = useState(false);

  // Require auth: send anyone not signed in to the login screen.
  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

  useEffect(() => {
    if (!user) return;
    listFunnels().then((fs) => {
      setFunnels(fs);
      setReady(true);
    });
  }, [user]);

  async function handleSignOut() {
    await signOut();
    router.replace("/login");
  }

  if (loading || !user) {
    return <main className="home" />;
  }

  async function handleCreate() {
    if (creating) return;
    setCreating(true);
    const f = await createFunnel(name);
    if (f) router.push(`/funnel/${f.id}`);
    else setCreating(false);
  }

  function askDelete(e: React.MouseEvent, funnel: Funnel) {
    e.stopPropagation();
    setToDelete(funnel);
  }

  async function confirmDelete() {
    if (!toDelete) return;
    await deleteFunnel(toDelete.id);
    setFunnels(await listFunnels());
    setToDelete(null);
  }

  return (
    <main className="home">
      <div className="home-inner">
        <header className="home-hero">
          <div>
            <h1>Seus funis</h1>
          </div>
          <div className="home-actions">
            <div className="home-user" title={user.email ?? ""}>
              <span className="home-avatar">
                {user.email?.[0]?.toUpperCase() ?? "?"}
              </span>
              <span className="home-email">{user.email}</span>
            </div>
            <button className="btn-ghost home-signout" onClick={handleSignOut}>
              Sair
            </button>
            <button className="btn-primary" onClick={() => setModal(true)}>
              <PlusIcon size={18} /> Novo funil
            </button>
          </div>
        </header>

        <section className="grid">
          <button className="card card-new" onClick={() => setModal(true)}>
            <span className="plus-ring">
              <PlusIcon size={24} />
            </span>
            <span className="medium">Criar novo funil</span>
          </button>

          {ready &&
            funnels.map((f) => (
              <div
                key={f.id}
                className="card"
                onClick={() => router.push(`/funnel/${f.id}`)}
              >
                <button
                  className="card-del"
                  title="Excluir"
                  onClick={(e) => askDelete(e, f)}
                >
                  <TrashIcon />
                </button>
                <div className="card-thumb">
                  <span className="dot-node" />
                  <span className="dot-link" />
                  <span className="dot-node" />
                  <span className="dot-link" />
                  <span className="dot-node" />
                </div>
                <h3>{f.name}</h3>
                <p className="meta">
                  {f.nodes.length} elemento{f.nodes.length === 1 ? "" : "s"} ·
                  editado {timeAgo(f.updatedAt)}
                </p>
              </div>
            ))}

          {ready && funnels.length === 0 && (
            <p className="empty">Nenhum funil ainda — comece criando o primeiro.</p>
          )}
        </section>
      </div>

      {modal && (
        <div className="modal-backdrop" onClick={() => setModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Nomear seu funil</h2>
            <p>Dê um nome para identificar este funil no seu painel.</p>
            <input
              className="field"
              placeholder="Ex.: Lançamento Black Friday"
              value={name}
              autoFocus
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            />
            <div className="modal-actions">
              <button className="btn-ghost" onClick={() => setModal(false)}>
                Cancelar
              </button>
              <button className="btn-primary" onClick={handleCreate}>
                Criar e abrir
              </button>
            </div>
          </div>
        </div>
      )}

      {toDelete && (
        <div className="modal-backdrop" onClick={() => setToDelete(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Excluir funil</h2>
            <p>
              Tem certeza que deseja excluir <strong>“{toDelete.name}”</strong>?
              Essa ação não pode ser desfeita.
            </p>
            <div className="modal-actions">
              <button className="btn-ghost" onClick={() => setToDelete(null)}>
                Cancelar
              </button>
              <button className="btn-danger" onClick={confirmDelete}>
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
