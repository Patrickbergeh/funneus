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
import PlaceholderNode from "./nodes/PlaceholderNode";
import ActionEdge, { cornerStraight } from "./edges/ActionEdge";
import Palette from "./Palette";
import ShareModal from "./ShareModal";
import { CATALOG_MAP, type CatalogItem } from "@/lib/catalog";
import { getEdgeStyle, getFunnel, renameFunnel, saveFlow, type Funnel } from "@/lib/store";
import { computeGuides, type Guides } from "@/lib/helperLines";
import { BackIcon, PlusIcon } from "@/lib/icons";

const nodeTypes: NodeTypes = {
  icon: IconNode,
  page: PageNode,
  diamond: DiamondNode,
  time: TimeNode,
  container: ContainerNode,
  text: TextNode,
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

function Editor({ funnel }: { funnel: Funnel }) {
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

  // Debounced autosave whenever nodes/edges change
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    setSaving(true);
    const t = setTimeout(() => {
      // never persist the temporary placeholder node / its link
      const phIds = new Set(
        nodes.filter((n) => n.type === "placeholder").map((n) => n.id)
      );
      const cleanNodes = nodes.filter((n) => n.type !== "placeholder");
      const cleanEdges = edges.filter(
        (e) => !phIds.has(e.target) && !phIds.has(e.source)
      );
      saveFlow(funnel.id, cleanNodes, cleanEdges);
      setSaving(false);
    }, 500);
    return () => clearTimeout(t);
  }, [nodes, edges, funnel.id]);

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
    if (!wrap) return;
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
  }, [rf, setNodes]);

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
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
    [rf, rfInstance, setNodes]
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
          onChange={(e) => setName(e.target.value)}
          onBlur={(e) => commitName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          }}
        />
        <div className="spacer" />
        <button className="share-btn" onClick={() => setShareOpen(true)}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <circle cx="18" cy="5" r="2.4" stroke="currentColor" strokeWidth="1.9" />
            <circle cx="6" cy="12" r="2.4" stroke="currentColor" strokeWidth="1.9" />
            <circle cx="18" cy="19" r="2.4" stroke="currentColor" strokeWidth="1.9" />
            <path d="m8.1 10.9 7.8-4.5M8.1 13.1l7.8 4.5" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
          </svg>
          Compartilhar
        </button>
      </header>

      {shareOpen && (
        <ShareModal
          funnelId={funnel.id}
          funnelName={name}
          onClose={() => setShareOpen(false)}
        />
      )}

      <div className="stage">
        <div className="canvas-wrap" ref={wrapperRef}>
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
            fitView
            fitViewOptions={{ padding: 0.4, maxZoom: 1 }}
            minZoom={0.2}
            maxZoom={2}
            proOptions={{ hideAttribution: true }}
            deleteKeyCode={["Backspace", "Delete"]}
            onNodeDragStop={() => setGuides(null)}
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

          {nodes.length === 0 && (
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
            open={!!picker}
            flow={picker ? { x: picker.flowX, y: picker.flowY } : null}
            clear={picker ? picker.pendingId === null : false}
            onClose={closePicker}
            onPick={pickComponent}
          />
        </div>
      </div>
    </div>
  );
}

export default function FlowEditor({ funnelId }: { funnelId: string }) {
  const router = useRouter();
  const [funnel, setFunnel] = useState<Funnel | null | undefined>(undefined);

  useEffect(() => {
    let alive = true;
    getFunnel(funnelId).then((f) => {
      if (alive) setFunnel(f);
    });
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
        <Editor funnel={funnel} />
      </ReactFlowProvider>
    );
  }, [funnel, router]);

  return content;
}
