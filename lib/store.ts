import type { Edge, Node } from "@xyflow/react";
import { supabase } from "./supabase";

export type Funnel = {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  nodes: Node[];
  edges: Edge[];
  userId: string | null;
};

type FunnelRow = {
  id: string;
  name: string;
  created_at: number;
  updated_at: number;
  nodes: Node[];
  edges: Edge[];
  user_id?: string | null;
};

function rowToFunnel(r: FunnelRow): Funnel {
  return {
    id: r.id,
    name: r.name,
    createdAt: Number(r.created_at),
    updatedAt: Number(r.updated_at),
    nodes: (r.nodes ?? []) as Node[],
    edges: (r.edges ?? []) as Edge[],
    userId: r.user_id ?? null,
  };
}

function newId() {
  const now = Date.now();
  return `f_${now.toString(36)}_${Math.floor(Math.random() * 1e6).toString(36)}`;
}

export async function listFunnels(): Promise<Funnel[]> {
  const { data, error } = await supabase
    .from("funnels")
    .select("*")
    .order("updated_at", { ascending: false });
  if (error) {
    console.error("listFunnels", error);
    return [];
  }
  return (data as FunnelRow[]).map(rowToFunnel);
}

export async function getFunnel(id: string): Promise<Funnel | null> {
  const { data, error } = await supabase
    .from("funnels")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error || !data) return null;
  return rowToFunnel(data as FunnelRow);
}

export async function createFunnel(name: string): Promise<Funnel | null> {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth.user?.id;
  if (!uid) {
    console.error("createFunnel: sem sessão");
    return null;
  }
  const now = Date.now();
  const row: FunnelRow = {
    id: newId(),
    name: name.trim() || "Novo funil",
    created_at: now,
    updated_at: now,
    nodes: [],
    edges: [],
    user_id: uid,
  };
  const { data, error } = await supabase.from("funnels").insert(row).select().single();
  if (error || !data) {
    console.error("createFunnel", error);
    return null;
  }
  return rowToFunnel(data as FunnelRow);
}

export async function renameFunnel(id: string, name: string) {
  const clean = name.trim();
  if (!clean) return;
  await supabase.from("funnels").update({ name: clean, updated_at: Date.now() }).eq("id", id);
}

export async function saveFlow(id: string, nodes: Node[], edges: Edge[]) {
  await supabase
    .from("funnels")
    .update({ nodes, edges, updated_at: Date.now() })
    .eq("id", id);
}

export async function deleteFunnel(id: string) {
  await supabase.from("funnels").delete().eq("id", id);
}

/* ---------- Sharing ---------- */

export type ShareRole = "view" | "edit";
export type Share = { email: string; role: ShareRole };

export async function getShares(funnelId: string): Promise<Share[]> {
  const { data, error } = await supabase
    .from("funnel_shares")
    .select("email, role")
    .eq("funnel_id", funnelId);
  if (error || !data) return [];
  return data.map((s) => ({ email: s.email as string, role: s.role as ShareRole }));
}

export async function setShares(funnelId: string, shares: Share[]) {
  await supabase.from("funnel_shares").delete().eq("funnel_id", funnelId);
  if (shares.length) {
    await supabase
      .from("funnel_shares")
      .insert(shares.map((s) => ({ funnel_id: funnelId, email: s.email, role: s.role })));
  }
}

/* ---------- Edge default style (kept local — UI preference) ---------- */

const EDGE_KEY = "funil-builder:edgeStyle";
export type EdgeShape = "step" | "bezier";
export type EdgeStyle = { color: string; dashed: boolean; shape: EdgeShape };
const DEFAULT_EDGE: EdgeStyle = { color: "#3b82f6", dashed: false, shape: "step" };

export function getEdgeStyle(): EdgeStyle {
  if (typeof window === "undefined") return DEFAULT_EDGE;
  try {
    const raw = localStorage.getItem(EDGE_KEY);
    return raw ? { ...DEFAULT_EDGE, ...JSON.parse(raw) } : DEFAULT_EDGE;
  } catch {
    return DEFAULT_EDGE;
  }
}

export function setEdgeStyle(s: EdgeStyle) {
  try {
    localStorage.setItem(EDGE_KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}
