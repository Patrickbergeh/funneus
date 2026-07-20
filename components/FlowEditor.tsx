"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Background,
  BackgroundVariant,
  ConnectionMode,
  Controls,
  MarkerType,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  Position,
  ViewportPortal,
  addEdge,
  getBezierPath,
  getSmoothStepPath,
  useEdgesState,
  useNodesState,
  useReactFlow,
  useStoreApi,
  type Connection,
  type ConnectionLineComponentProps,
  type Edge,
  type Node,
  type NodeChange,
  type NodeTypes,
  type ReactFlowInstance,
} from "@xyflow/react";
import IconNode from "./nodes/IconNode";
import PageNode from "./nodes/PageNode";
import DiamondNode from "./nodes/DiamondNode";
import TimeNode from "./nodes/TimeNode";
import ContainerNode from "./nodes/ContainerNode";
import TextNode from "./nodes/TextNode";
import TagNode from "./nodes/TagNode";
import PlaceholderNode from "./nodes/PlaceholderNode";
import ActionEdge, { cornerStraight } from "./edges/ActionEdge";
import Palette from "./Palette";
import ShareModal from "./ShareModal";
import { CATALOG_MAP, type CatalogItem } from "@/lib/catalog";
import { getEdgeStyle, getFunnel, getShares, renameFunnel, saveFlow, type Funnel } from "@/lib/store";
import { computeGuides, type Guides } from "@/lib/helperLines";
import { BackIcon, PlusIcon } from "@/lib/icons";
import { supabase } from "@/lib/supabase";
import { ReadOnlyContext } from "@/lib/editorMode";
import type { RealtimeChannel } from "@supabase/supabase-js";

const nodeTypes: NodeTypes = {
  icon: IconNode,
  page: PageNode,
  diamond: DiamondNode,
  time: TimeNode,
  container: ContainerNode,
  text: TextNode,
  tag: TagNode,
  placeholder: PlaceholderNode,
};

const edgeTypes = {
  action: ActionEdge,
};

const EDGE_BLUE = "#3b82f6";

const defaultEdgeOptions = {
  type: "action",
  animated: false,
  style: { stroke: EDGE_BLUE, strokeWidth: 2.5 },
  markerEnd: { type: "arrowclosed", color: EDGE_BLUE, width: 20, height: 20 } as const,
};

/* Connection preview line — STRAIGHT while it's aligned (horizontal/vertical),
   and switches to a smoothstep curve as soon as it goes off that axis. */
function ConnectionLine({
  fromX,
  fromY,
  toX,
  toY,
  fromPosition,
  toPosition,
  fromHandle,
}: ConnectionLineComponentProps) {
  // Stop just short of the target card.
  const CONN_MARGIN = 12;
  let tx = toX;
  let ty = toY;
  if (toPosition === Position.Left) tx -= CONN_MARGIN;
  else if (toPosition === Position.Right) tx += CONN_MARGIN;
  else if (toPosition === Position.Top) ty -= CONN_MARGIN;
  else if (toPosition === Position.Bottom) ty += CONN_MARGIN;

  const prev = getEdgeStyle(); // preview uses the last chosen color / shape / style
  // Corner (in its diagonal quadrant) and aligned pulls stay straight in both
  // formats; the chosen format only changes the "curved" fallback.
  const straightCorner = cornerStraight(fromHandle?.id, tx - fromX, ty - fromY);
  const ALIGN = 10; // tolerance to consider the line "straight"
  const aligned = Math.abs(ty - fromY) <= ALIGN || Math.abs(tx - fromX) <= ALIGN;
  let path: string;
  if (straightCorner || aligned) {
    path = `M ${fromX},${fromY} L ${tx},${ty}`;
  } else if (prev.shape === "bezier") {
    [path] = getBezierPath({
      sourceX: fromX,
      sourceY: fromY,
      sourcePosition: fromPosition,
      targetX: tx,
      targetY: ty,
      targetPosition: toPosition,
    });
  } else {
    [path] = getSmoothStepPath({
      sourceX: fromX,
      sourceY: fromY,
      sourcePosition: fromPosition,
      targetX: tx,
      targetY: ty,
      targetPosition: toPosition,
      borderRadius: 8,
    });
  }
  return (
    <g>
      <defs>
        <marker
          id="conn-arrow"
          viewBox="0 0 10 10"
          refX="8"
          refY="5"
          markerWidth="7"
          markerHeight="7"
          orient="auto-start-reverse"
        >
          <path d="M0,0 L10,5 L0,10 z" fill={prev.color} />
        </marker>
      </defs>
      <path
        d={path}
        fill="none"
        stroke={prev.color}
        strokeWidth={2.5}
        markerEnd="url(#conn-arrow)"
        style={prev.dashed ? { strokeDasharray: "7 6", animation: "edgedash 0.6s linear infinite" } : undefined}
      />
    </g>
  );
}

let idSeq = 0;
const nextId = () => `n_${Date.now().toString(36)}_${idSeq++}`;

// ---- Undo / redo snapshots ----
type Snap = { nodes: Node[]; edges: Edge[]; key: string };

function stripFields<T extends object>(obj: T, keys: string[]): T {
  const c = { ...obj } as Record<string, unknown>;
  for (const k of keys) delete c[k];
  return c as T;
}

// A committed canvas state, with volatile fields (selection/drag/measure)
// stripped so selecting or hovering never counts as an undoable change.
function snapshot(ns: Node[], es: Edge[]): Snap {
  const nodes = ns
    .filter((n) => n.type !== "placeholder")
    .map((n) => stripFields(n, ["selected", "dragging", "measured"]));
  const edges = es
    .filter((e) => e.type !== "placeholder")
    .map((e) => stripFields(e, ["selected"]));
  return { nodes, edges, key: JSON.stringify(nodes) + "|" + JSON.stringify(edges) };
}

const GUIDE = "#f43f5e";

/* Alignment / spacing guides drawn in flow coordinates while dragging. */
function GuidesOverlay({ guides }: { guides: Guides | null }) {
  if (!guides) return null;
  return (
    <ViewportPortal>
      {guides.vertical && (
        <div
          style={{
            position: "absolute",
            left: guides.vertical.x,
            top: Math.min(guides.vertical.y1, guides.vertical.y2),
            width: 1,
            height: Math.abs(guides.vertical.y2 - guides.vertical.y1),
            background: GUIDE,
            pointerEvents: "none",
          }}
        />
      )}
      {guides.horizontal && (
        <div
          style={{
            position: "absolute",
            left: Math.min(guides.horizontal.x1, guides.horizontal.x2),
            top: guides.horizontal.y,
            width: Math.abs(guides.horizontal.x2 - guides.horizontal.x1),
            height: 1,
            background: GUIDE,
            pointerEvents: "none",
          }}
        />
      )}
      {guides.spacing.map((s, i) => {
        const vertical = Math.abs(s.x2 - s.x1) < 0.5;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: Math.min(s.x1, s.x2) - (vertical ? 0 : 0),
              top: Math.min(s.y1, s.y2),
              width: vertical ? 2 : Math.abs(s.x2 - s.x1),
              height: vertical ? Math.abs(s.y2 - s.y1) : 2,
              background: GUIDE,
              opacity: 0.9,
              pointerEvents: "none",
            }}
          />
        );
      })}
    </ViewportPortal>
  );
}

function Editor({ funnel, readOnly }: { funnel: Funnel; readOnly: boolean }) {
  const router = useRouter();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [rfInstance, setRfInstance] = useState<ReactFlowInstance | null>(null);

  // Drop any leftover placeholder nodes/edges that might have been saved.
  const phInit = new Set(
    funnel.nodes.filter((n) => n.type === "placeholder").map((n) => n.id)
  );
  const [nodes, setNodes, onNodesChangeRaw] = useNodesState<Node>(
    funnel.nodes.filter((n) => n.type !== "placeholder")
  );
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(
    funnel.edges
      .filter((e) => !phInit.has(e.target) && !phInit.has(e.source))
      .map((e) => ({ ...e, type: "action" }))
  );
  const [name, setName] = useState(funnel.name);
  const [saving, setSaving] = useState(false);
  const [guides, setGuides] = useState<Guides | null>(null);
  const [shareOpen, setShareOpen] = useState(false);

  // Component picker: opens on the empty-canvas "+" or when a connection is
  // dropped on empty space (then the picked node lands there, already linked).
  const [picker, setPicker] = useState<{
    flowX: number;
    flowY: number;
    pendingId: string | null; // placeholder node id when dropped from a link
  } | null>(null);
  const connectingRef = useRef<{ source: string; sourceHandle: string | null } | null>(null);
  // Ctrl + drag on empty canvas draws a container.
  const [drawing, setDrawing] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(null);

  // Smart alignment guides: while dragging a single node, snap it to other
  // cards' edges/centers and equal spacing, and draw the guide lines.
  const onNodesChange = useCallback(
    (changes: NodeChange<Node>[]) => {
      const drag =
        changes.length === 1 &&
        changes[0].type === "position" &&
        changes[0].dragging &&
        changes[0].position;
      if (drag) {
        const change = changes[0] as Extract<NodeChange<Node>, { type: "position" }>;
        const g = computeGuides(change, nodes);
        if (change.position) {
          if (g.snapX != null) change.position.x = g.snapX;
          if (g.snapY != null) change.position.y = g.snapY;
        }
        setGuides(g.vertical || g.horizontal || g.spacing.length ? g : null);
      } else {
        setGuides(null);
      }
      onNodesChangeRaw(changes);
    },
    [nodes, onNodesChangeRaw]
  );

  const rf = useReactFlow();
  const store = useStoreApi();

  // ---- Realtime collaboration (Supabase broadcast) ----
  const channelRef = useRef<RealtimeChannel | null>(null);
  const applyingRemote = useRef(false); // true while applying a peer's update
  const draggingRef = useRef(false); // ignore incoming while we drag locally
  const lastBroadcast = useRef(0);
  const trailingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const channel = supabase.channel(`funnel:${funnel.id}`, {
      config: { broadcast: { self: false } },
    });
    channel.on("broadcast", { event: "sync" }, (msg) => {
      const p = msg.payload as { nodes?: Node[]; edges?: Edge[]; name?: string };
      // Don't let an incoming update fight a drag we're in the middle of.
      if (draggingRef.current) return;
      applyingRemote.current = true;
      if (p.nodes) setNodes(p.nodes);
      if (p.edges) setEdges(p.edges);
      if (typeof p.name === "string") setName(p.name);
    });
    channel.subscribe();
    channelRef.current = channel;
    return () => {
      channelRef.current = null;
      if (trailingTimer.current) clearTimeout(trailingTimer.current);
      supabase.removeChannel(channel);
    };
  }, [funnel.id, setNodes, setEdges]);

  // Broadcast (throttled ~90ms) + debounced DB autosave on every local change.
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    // A change that came from a peer must not be echoed back or re-saved.
    if (applyingRemote.current) {
      applyingRemote.current = false;
      return;
    }
    // Viewers never write or broadcast.
    if (readOnly) return;

    // never persist the temporary placeholder node / its link
    const phIds = new Set(
      nodes.filter((n) => n.type === "placeholder").map((n) => n.id)
    );
    const cleanNodes = nodes.filter((n) => n.type !== "placeholder");
    const cleanEdges = edges.filter(
      (e) => !phIds.has(e.target) && !phIds.has(e.source)
    );

    // Live broadcast to other people on this funnel.
    const send = () => {
      lastBroadcast.current = Date.now();
      channelRef.current?.send({
        type: "broadcast",
        event: "sync",
        payload: { nodes: cleanNodes, edges: cleanEdges, name },
      });
    };
    const now = Date.now();
    if (trailingTimer.current) clearTimeout(trailingTimer.current);
    if (now - lastBroadcast.current >= 90) send();
    else trailingTimer.current = setTimeout(send, 90 - (now - lastBroadcast.current));

    // Debounced persistence.
    setSaving(true);
    const t = setTimeout(() => {
      saveFlow(funnel.id, cleanNodes, cleanEdges);
      setSaving(false);
    }, 500);
    return () => clearTimeout(t);
  }, [nodes, edges, name, funnel.id, readOnly]);

  const onConnect = useCallback(
    (conn: Connection) => {
      if (conn.source === conn.target) return; // no self-loops
      const def = getEdgeStyle(); // reuse the last chosen color / line style
      const edge: Edge = {
        ...conn,
        id: `e_${Date.now().toString(36)}_${idSeq++}`,
        type: "action",
        style: { stroke: def.color, strokeWidth: 2.5 },
        markerEnd: { type: MarkerType.ArrowClosed, color: def.color, width: 20, height: 20 },
        data: { dashed: def.dashed, shape: def.shape },
      };
      setEdges((eds) => addEdge(edge, eds));
    },
    [setEdges]
  );

  const onConnectStart = useCallback(
    (_e: unknown, params: { nodeId: string | null; handleId: string | null }) => {
      connectingRef.current = { source: params.nodeId ?? "", sourceHandle: params.handleId };
    },
    []
  );

  // Dropped a connection on empty space → drop a placeholder there, link to it,
  // and open the picker so the user chooses what that node becomes.
  const onConnectEnd = useCallback(
    (event: MouseEvent | TouchEvent, state: { isValid: boolean | null }) => {
      const src = connectingRef.current;
      connectingRef.current = null;
      if (state.isValid || !src?.source) return;

      const pt = "changedTouches" in event ? event.changedTouches[0] : event;
      const flow = rf.screenToFlowPosition({ x: pt.clientX, y: pt.clientY });

      const phId = nextId();
      setNodes((nds) =>
        nds.concat({
          id: phId,
          type: "placeholder",
          position: { x: flow.x - 11, y: flow.y - 11 },
          data: {},
          selectable: false,
          draggable: false,
        })
      );

      // pick the target handle facing the source
      const srcNode = rf.getNode(src.source);
      let targetHandle = "l";
      if (srcNode) {
        const w = srcNode.measured?.width ?? 60;
        const h = srcNode.measured?.height ?? 60;
        const dx = flow.x - (srcNode.position.x + w / 2);
        const dy = flow.y - (srcNode.position.y + h / 2);
        if (Math.abs(dx) >= Math.abs(dy)) targetHandle = dx >= 0 ? "l" : "r";
        else targetHandle = dy >= 0 ? "t" : "b";
      }

      const def = getEdgeStyle();
      const edge: Edge = {
        id: `e_${Date.now().toString(36)}_${idSeq++}`,
        source: src.source,
        sourceHandle: src.sourceHandle,
        target: phId,
        targetHandle,
        type: "action",
        style: { stroke: def.color, strokeWidth: 2.5 },
        markerEnd: { type: MarkerType.ArrowClosed, color: def.color, width: 20, height: 20 },
        data: { dashed: def.dashed, shape: def.shape },
      };
      setEdges((eds) => addEdge(edge, eds));

      setPicker({ flowX: flow.x, flowY: flow.y, pendingId: phId });
    },
    [rf, setNodes, setEdges]
  );

  function openPickerCenter() {
    const wrap = wrapperRef.current?.getBoundingClientRect();
    if (!wrap) return;
    const flow = rf.screenToFlowPosition({
      x: wrap.left + wrap.width / 2,
      y: wrap.top + wrap.height / 2,
    });
    setPicker({ flowX: flow.x, flowY: flow.y, pendingId: null });
  }

  const pickComponent = useCallback(
    (item: CatalogItem) => {
      if (!picker) return;
      if (picker.pendingId) {
        // turn the placeholder into the chosen component
        setNodes((nds) =>
          nds.map((n) =>
            n.id === picker.pendingId
              ? {
                  ...n,
                  type: item.family,
                  selectable: true,
                  draggable: true,
                  data: { key: item.key, label: item.label },
                }
              : n
          )
        );
      } else {
        setNodes((nds) =>
          nds.concat({
            id: nextId(),
            type: item.family,
            position: { x: picker.flowX - 31, y: picker.flowY - 31 },
            data: { key: item.key, label: item.label },
          })
        );
      }
      setPicker(null);
    },
    [picker, setNodes]
  );

  const closePicker = useCallback(() => {
    setPicker((cur) => {
      if (cur?.pendingId) {
        const phId = cur.pendingId;
        setNodes((nds) => nds.filter((n) => n.id !== phId));
        setEdges((eds) => eds.filter((e) => e.target !== phId && e.source !== phId));
      }
      return null;
    });
  }, [setNodes, setEdges]);

  // Alt/Option + drag on the empty canvas draws a resizable container.
  // (Ctrl is avoided — on macOS Ctrl+click triggers the right-click menu.)
  useEffect(() => {
    const wrap = wrapperRef.current;
    if (!wrap || readOnly) return;
    const onDown = (e: MouseEvent) => {
      if (!e.altKey || e.button !== 0) return;
      const target = e.target as HTMLElement;
      if (!target.classList.contains("react-flow__pane")) return;
      e.preventDefault();
      e.stopPropagation();
      const rect = wrap.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      const startFlow = rf.screenToFlowPosition({ x: e.clientX, y: e.clientY });
      setDrawing({ x0: sx, y0: sy, x1: sx, y1: sy });
      const onMove = (ev: MouseEvent) => {
        setDrawing({ x0: sx, y0: sy, x1: ev.clientX - rect.left, y1: ev.clientY - rect.top });
      };
      const onUp = (ev: MouseEvent) => {
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp, true);
        setDrawing(null);
        const endFlow = rf.screenToFlowPosition({ x: ev.clientX, y: ev.clientY });
        const w = Math.round(Math.abs(endFlow.x - startFlow.x));
        const h = Math.round(Math.abs(endFlow.y - startFlow.y));
        if (w > 40 && h > 40) {
          setNodes((nds) =>
            nds.concat({
              id: nextId(),
              type: "container",
              position: {
                x: Math.min(startFlow.x, endFlow.x),
                y: Math.min(startFlow.y, endFlow.y),
              },
              width: w,
              height: h,
              data: { color: "#e9eef5", text: "" },
              zIndex: -1,
            })
          );
        }
      };
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp, true);
    };
    wrap.addEventListener("mousedown", onDown, true);
    return () => wrap.removeEventListener("mousedown", onDown, true);
  }, [rf, setNodes, readOnly]);

  // Copy / paste + undo / redo. Ignored while typing in a field or read-only.
  const clipboardRef = useRef<{ nodes: Node[]; edges: Edge[]; ox: number; oy: number } | null>(null);
  const pasteCountRef = useRef(0);
  const mouseRef = useRef<{ x: number; y: number } | null>(null);

  // Undo / redo history (kept in refs to avoid re-renders).
  const pastRef = useRef<Snap[]>([]);
  const futureRef = useRef<Snap[]>([]);
  const committedRef = useRef<Snap>(snapshot(funnel.nodes, funnel.edges));

  // Commit a snapshot once the canvas settles (400ms), skipping selection-only
  // changes and the states we just restored through undo/redo.
  useEffect(() => {
    if (readOnly) return;
    const t = setTimeout(() => {
      const snap = snapshot(nodes, edges);
      if (snap.key === committedRef.current.key) return;
      pastRef.current.push(committedRef.current);
      if (pastRef.current.length > 120) pastRef.current.shift();
      futureRef.current = [];
      committedRef.current = snap;
    }, 400);
    return () => clearTimeout(t);
  }, [nodes, edges, readOnly]);

  useEffect(() => {
    if (readOnly) return;

    const applySnap = (s: Snap) => {
      committedRef.current = s;
      setNodes(s.nodes.map((n) => ({ ...n })));
      setEdges(s.edges.map((e) => ({ ...e })));
    };
    const undo = () => {
      if (!pastRef.current.length) return;
      futureRef.current.push(committedRef.current);
      applySnap(pastRef.current.pop() as Snap);
    };
    const redo = () => {
      if (!futureRef.current.length) return;
      pastRef.current.push(committedRef.current);
      applySnap(futureRef.current.pop() as Snap);
    };

    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return;
      const t = e.target as HTMLElement | null;
      const typing =
        !!t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable);
      if (typing) return;
      const key = e.key.toLowerCase();

      if (key === "a") {
        e.preventDefault();
        setNodes((nds) =>
          nds.map((n) => (n.type === "placeholder" ? n : { ...n, selected: true }))
        );
        if (nodes.filter((n) => n.type !== "placeholder").length > 1) {
          store.setState({ nodesSelectionActive: true });
        }
      } else if (key === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if (key === "y" || (key === "z" && e.shiftKey)) {
        e.preventDefault();
        redo();
      } else if (key === "c") {
        const sel = nodes.filter((n) => n.selected && n.type !== "placeholder");
        if (!sel.length) return;
        const ids = new Set(sel.map((n) => n.id));
        clipboardRef.current = {
          nodes: sel.map((n) => ({ ...n, data: { ...n.data } })),
          edges: edges
            .filter((ed) => ids.has(ed.source) && ids.has(ed.target))
            .map((ed) => ({ ...ed })),
          ox: Math.min(...sel.map((n) => n.position.x)),
          oy: Math.min(...sel.map((n) => n.position.y)),
        };
        pasteCountRef.current = 0;
      } else if (key === "v") {
        const clip = clipboardRef.current;
        if (!clip?.nodes.length) return;
        e.preventDefault();

        // Paste anchored to the cursor (group's top-left lands there); fall
        // back to a growing diagonal offset if the cursor isn't over the canvas.
        let dx: number;
        let dy: number;
        if (mouseRef.current) {
          const p = rf.screenToFlowPosition(mouseRef.current);
          dx = p.x - clip.ox;
          dy = p.y - clip.oy;
        } else {
          pasteCountRef.current += 1;
          dx = dy = 36 * pasteCountRef.current;
        }

        const idMap = new Map<string, string>();
        const newNodes = clip.nodes.map((n) => {
          const nid = nextId();
          idMap.set(n.id, nid);
          return {
            ...n,
            id: nid,
            position: { x: n.position.x + dx, y: n.position.y + dy },
            selected: true,
            dragging: false,
            data: { ...n.data },
          } as Node;
        });
        const newEdges = clip.edges.map(
          (ed) =>
            ({
              ...ed,
              id: `e_${Date.now().toString(36)}_${idSeq++}`,
              source: idMap.get(ed.source) ?? ed.source,
              target: idMap.get(ed.target) ?? ed.target,
              selected: false,
            }) as Edge
        );
        setNodes((nds) => [...nds.map((n) => ({ ...n, selected: false })), ...newNodes]);
        if (newEdges.length) setEdges((eds) => [...eds, ...newEdges]);
        // Show the draggable group box (same state as a shift-drag selection).
        if (newNodes.length > 1) store.setState({ nodesSelectionActive: true });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [nodes, edges, readOnly, setNodes, setEdges, rf, store]);

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      if (readOnly) return;
      const key = e.dataTransfer.getData("application/funnel-node");
      const item = CATALOG_MAP[key];
      if (!item || !rfInstance) return;

      const position = rf.screenToFlowPosition({ x: e.clientX, y: e.clientY });
      const newNode: Node = {
        id: nextId(),
        type: item.family, // "icon" | "page"
        position,
        data: { key: item.key, label: item.label },
      };
      setNodes((nds) => nds.concat(newNode));
    },
    [rf, rfInstance, setNodes, readOnly]
  );

  function commitName(v: string) {
    const clean = v.trim() || funnel.name;
    setName(clean);
    renameFunnel(funnel.id, clean);
  }

  const minimapColor = useCallback((n: Node) => {
    const item = CATALOG_MAP[(n.data as { key: string }).key];
    return item?.solid ?? item?.color ?? "#c7d0dc";
  }, []);

  return (
   <ReadOnlyContext.Provider value={readOnly}>
    <div className="editor">
      <header className="topbar">
        <button
          className="icon-btn"
          title="Voltar"
          onClick={() => router.push("/")}
        >
          <BackIcon />
        </button>
        <input
          className="name-input"
          value={name}
          readOnly={readOnly}
          onChange={(e) => setName(e.target.value)}
          onBlur={(e) => !readOnly && commitName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          }}
        />
        <div className="spacer" />
        {readOnly ? (
          <span className="view-badge">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
              <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" stroke="currentColor" strokeWidth="1.9" />
              <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.9" />
            </svg>
            Somente leitura
          </span>
        ) : (
          <button className="share-btn" onClick={() => setShareOpen(true)}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <circle cx="18" cy="5" r="2.4" stroke="currentColor" strokeWidth="1.9" />
              <circle cx="6" cy="12" r="2.4" stroke="currentColor" strokeWidth="1.9" />
              <circle cx="18" cy="19" r="2.4" stroke="currentColor" strokeWidth="1.9" />
              <path d="m8.1 10.9 7.8-4.5M8.1 13.1l7.8 4.5" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
            </svg>
            Compartilhar
          </button>
        )}
      </header>

      {shareOpen && (
        <ShareModal
          funnelId={funnel.id}
          funnelName={name}
          onClose={() => setShareOpen(false)}
        />
      )}

      <div className="stage">
        <div
          className="canvas-wrap"
          ref={wrapperRef}
          onMouseMove={(e) => {
            mouseRef.current = { x: e.clientX, y: e.clientY };
          }}
        >
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onConnectStart={onConnectStart}
            onConnectEnd={onConnectEnd}
            onInit={setRfInstance}
            onDrop={onDrop}
            onDragOver={onDragOver}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            defaultEdgeOptions={defaultEdgeOptions}
            connectionMode={ConnectionMode.Loose}
            connectionLineComponent={ConnectionLine}
            connectionRadius={22}
            multiSelectionKeyCode={null}
            nodesDraggable={!readOnly}
            nodesConnectable={!readOnly}
            elementsSelectable={!readOnly}
            fitView
            fitViewOptions={{ padding: 0.4, maxZoom: 1 }}
            minZoom={0.2}
            maxZoom={2}
            proOptions={{ hideAttribution: true }}
            deleteKeyCode={readOnly ? null : ["Backspace", "Delete"]}
            onNodeDragStart={() => {
              draggingRef.current = true;
            }}
            onNodeDragStop={() => {
              draggingRef.current = false;
              setGuides(null);
            }}
            onPaneClick={() => picker && closePicker()}
          >
            <Background
              variant={BackgroundVariant.Dots}
              gap={22}
              size={1.6}
              color="#d3dae2"
            />
            <GuidesOverlay guides={guides} />
            <Controls showInteractive={false} />
            <MiniMap
              pannable
              zoomable
              nodeColor={minimapColor}
              nodeStrokeWidth={0}
              maskColor="rgba(238,241,245,0.7)"
            />
          </ReactFlow>

          {nodes.length === 0 && !readOnly && (
            <div className="canvas-add">
              <button onClick={openPickerCenter}>
                <span className="ring">
                  <PlusIcon size={28} />
                </span>
                <span>Adicionar primeiro card</span>
              </button>
            </div>
          )}

          {drawing && (
            <div
              className="container-draw"
              style={{
                left: Math.min(drawing.x0, drawing.x1),
                top: Math.min(drawing.y0, drawing.y1),
                width: Math.abs(drawing.x1 - drawing.x0),
                height: Math.abs(drawing.y1 - drawing.y0),
              }}
            />
          )}

          <Palette
            open={!!picker && !readOnly}
            flow={picker ? { x: picker.flowX, y: picker.flowY } : null}
            clear={picker ? picker.pendingId === null : false}
            onClose={closePicker}
            onPick={pickComponent}
          />
        </div>
      </div>
    </div>
   </ReadOnlyContext.Provider>
  );
}

export default function FlowEditor({ funnelId }: { funnelId: string }) {
  const router = useRouter();
  const [funnel, setFunnel] = useState<Funnel | null | undefined>(undefined);
  const [readOnly, setReadOnly] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      const f = await getFunnel(funnelId);
      if (!alive) return;
      setFunnel(f);
      // A guest opens via ?c=<email>. Their role (view/edit) comes from the DB.
      // No ?c= → treated as the owner (full edit). Real per-user enforcement
      // will come with authentication.
      const guest = new URLSearchParams(window.location.search)
        .get("c")
        ?.trim()
        .toLowerCase();
      if (guest && f) {
        const shares = await getShares(funnelId);
        const mine = shares.find((s) => s.email === guest);
        // Unknown/revoked guest → safest is read-only.
        if (alive) setReadOnly((mine?.role ?? "view") === "view");
      }
    })();
    return () => {
      alive = false;
    };
  }, [funnelId]);

  const content = useMemo(() => {
    if (funnel === undefined) return null;
    if (funnel === null) {
      return (
        <div className="home">
          <div className="home-inner">
            <h1 style={{ fontWeight: 500 }}>Funil não encontrado</h1>
            <p style={{ color: "var(--ink-2)", marginTop: 8 }}>
              Ele pode ter sido removido.
            </p>
            <button
              className="btn-primary"
              style={{ marginTop: 20 }}
              onClick={() => router.push("/")}
            >
              Voltar ao painel
            </button>
          </div>
        </div>
      );
    }
    return (
      <ReactFlowProvider>
        <Editor funnel={funnel} readOnly={readOnly} />
      </ReactFlowProvider>
    );
  }, [funnel, router, readOnly]);

  return content;
}
