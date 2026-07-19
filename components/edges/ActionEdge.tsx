"use client";

import { useEffect, useRef, useState } from "react";
import {
  BaseEdge,
  EdgeLabelRenderer,
  Position,
  getBezierPath,
  getSmoothStepPath,
  useReactFlow,
  useStore,
  type EdgeProps,
} from "@xyflow/react";
import { CurveLineIcon, DashIcon, StepLineIcon, UnlinkIcon } from "@/lib/icons";
import { setEdgeStyle, type EdgeShape } from "@/lib/store";
import ColorPicker from "../ColorPicker";

const BLUE = "#3b82f6";
const STEM = 34; // trunk between a card and its junction dot
const TGT_STEM = 64; // longer trunk from the convergence dot to the card
const MARGIN = 15; // gap between the dot and the arrow
const ALEN = 9; // arrow length before the line starts
const R = 8; // corner radius

function dirOf(pos: Position): [number, number] {
  if (pos === Position.Left) return [-1, 0];
  if (pos === Position.Top) return [0, -1];
  if (pos === Position.Bottom) return [0, 1];
  return [1, 0]; // Right
}

type Pt = { x: number; y: number };

// unit vector from a to b (angle in degrees) — lets the dot arrow rotate to
// point exactly along the line as cards move.
function unit(a: Pt, b: Pt): { x: number; y: number; deg: number } {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  const x = dx / len;
  const y = dy / len;
  return { x, y, deg: (Math.atan2(y, x) * 180) / Math.PI };
}

// vertical-first elbow: leaves `a` vertically, arrives at `b` horizontally
function elbowV(a: Pt, b: Pt): string {
  if (Math.abs(b.y - a.y) < 3) return `M ${a.x},${a.y} L ${b.x},${b.y}`;
  const dy = b.y > a.y ? 1 : -1;
  const dx = b.x > a.x ? 1 : -1;
  return `M ${a.x},${a.y} L ${a.x},${b.y - dy * R} Q ${a.x},${b.y} ${a.x + dx * R},${b.y} L ${b.x},${b.y}`;
}

// horizontal-first elbow: leaves `a` horizontally, arrives at `b` vertically
function elbowH(a: Pt, b: Pt): string {
  if (Math.abs(b.x - a.x) < 3) return `M ${a.x},${a.y} L ${b.x},${b.y}`;
  const dx = b.x > a.x ? 1 : -1;
  const dy = b.y > a.y ? 1 : -1;
  return `M ${a.x},${a.y} L ${b.x - dx * R},${a.y} Q ${b.x},${a.y} ${b.x},${a.y + dy * R} L ${b.x},${b.y}`;
}

// S-bend: leaves `a` vertically and arrives at `b` vertically
function orthoVV(a: Pt, b: Pt): string {
  const my = (a.y + b.y) / 2;
  return `M ${a.x},${a.y} L ${a.x},${my} L ${b.x},${my} L ${b.x},${b.y}`;
}

// A corner handle stays straight only while the target is in its diagonal
// quadrant; leave that quadrant (e.g. go straight down) and it should bend.
export function cornerStraight(id: string | null | undefined, dx: number, dy: number): boolean {
  const M = 6; // small tolerance so a near-vertical/horizontal pull bends
  switch (id) {
    case "tr": return dx > M && dy < -M;
    case "tl": return dx < -M && dy < -M;
    case "br": return dx > M && dy > M;
    case "bl": return dx < -M && dy > M;
    default: return false;
  }
}

function Arrow({ x, y, rot, color }: { x: number; y: number; rot: number; color: string }) {
  return (
    <polygon
      points="0,-4.5 8,0 0,4.5"
      fill={color}
      transform={`translate(${x}, ${y}) rotate(${rot})`}
      style={{ pointerEvents: "none" }}
    />
  );
}

// Fraction (0..1) along a path closest to a point — where the user clicked.
function nearestRatio(d: string, pt: Pt): number {
  try {
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", d);
    const len = path.getTotalLength();
    if (!len) return 0.5;
    const steps = Math.max(24, Math.floor(len / 5));
    let best = 0.5;
    let bestDist = Infinity;
    for (let i = 0; i <= steps; i++) {
      const q = path.getPointAtLength((len * i) / steps);
      const dd = (q.x - pt.x) ** 2 + (q.y - pt.y) ** 2;
      if (dd < bestDist) {
        bestDist = dd;
        best = i / steps;
      }
    }
    return best;
  } catch {
    return 0.5;
  }
}

// Point on a path at a given fraction — always sits exactly on the line.
function pointAtRatio(d: string, r: number): Pt | null {
  try {
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", d);
    const len = path.getTotalLength();
    if (!len) return null;
    const q = path.getPointAtLength(len * Math.min(1, Math.max(0, r)));
    return { x: q.x, y: q.y };
  } catch {
    return null;
  }
}

export default function ActionEdge({
  id,
  source,
  target,
  sourceHandleId,
  targetHandleId,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  markerEnd,
  style,
  data,
  selected,
}: EdgeProps) {
  const { setEdges, screenToFlowPosition } = useReactFlow();
  const [ratio, setRatio] = useState<number | null>(null);
  const [tick, setTick] = useState(0);
  const [pickerOpen, setPickerOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // The unique part of this edge's line to center the button on.
  const centerPathRef = useRef<string>("");

  const color = (style?.stroke as string) || "#3b82f6";
  const meta = data as { dashed?: boolean; shape?: EdgeShape } | undefined;
  const dashed = !!meta?.dashed;
  const shape: EdgeShape = meta?.shape === "bezier" ? "bezier" : "step";
  const dashStyle: React.CSSProperties = dashed
    ? { strokeDasharray: "7 6", animation: "edgedash 0.6s linear infinite" }
    : {};

  function setColor(hex: string) {
    setEdges((eds) =>
      eds.map((e) =>
        e.id === id
          ? {
              ...e,
              style: { ...e.style, stroke: hex },
              markerEnd:
                e.markerEnd && typeof e.markerEnd === "object"
                  ? { ...e.markerEnd, color: hex }
                  : e.markerEnd,
            }
          : e
      )
    );
    setEdgeStyle({ color: hex, dashed, shape });
  }

  function toggleDash() {
    const next = !dashed;
    setEdges((eds) =>
      eds.map((e) =>
        e.id === id ? { ...e, data: { ...e.data, dashed: next } } : e
      )
    );
    setEdgeStyle({ color, dashed: next, shape });
  }

  function setShape(next: EdgeShape) {
    setEdges((eds) =>
      eds.map((e) =>
        e.id === id ? { ...e, data: { ...e.data, shape: next } } : e
      )
    );
    setEdgeStyle({ color, dashed, shape: next });
  }

  const srcCount = useStore(
    (s) =>
      s.edges.filter(
        (e) =>
          e.source === source &&
          (e.sourceHandle ?? null) === (sourceHandleId ?? null)
      ).length
  );
  const tgtCount = useStore(
    (s) =>
      s.edges.filter(
        (e) =>
          e.target === target &&
          (e.targetHandle ?? null) === (targetHandleId ?? null)
      ).length
  );
  const srcBranched = srcCount > 1;
  const tgtBranched = tgtCount > 1;

  const stroke = (style?.stroke as string) || BLUE;
  const strokeWidth = (style?.strokeWidth as number) || 2.5;

  const [fullPath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    borderRadius: R,
  });

  useEffect(() => {
    if (!selected) {
      setRatio(null);
      setPickerOpen(false);
      return;
    }
    if (pickerOpen) return; // don't auto-hide while picking a color
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      setEdges((eds) =>
        eds.map((e) => (e.id === id ? { ...e, selected: false } : e))
      );
    }, 5000);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [selected, tick, pickerOpen, id, setEdges]);

  function onEdgeClick(e: React.MouseEvent) {
    const click = screenToFlowPosition({ x: e.clientX, y: e.clientY });
    // Remember where along this edge's own line the user clicked (0..1).
    setRatio(centerPathRef.current ? nearestRatio(centerPathRef.current, click) : 0.5);
    setTick((t) => t + 1);
  }

  // Button always sits exactly on the line, at the clicked fraction (or middle).
  function renderToolbar(centerPath: string) {
    if (!selected) return null;
    const point =
      pointAtRatio(centerPath, ratio ?? 0.5) ?? { x: labelX, y: labelY };
    return (
      <EdgeLabelRenderer>
        <div
          className="edge-toolbar"
          style={{
            transform: `translate(-50%, -50%) translate(${point.x}px, ${point.y}px)`,
          }}
          onMouseMove={() => setTick((t) => t + 1)}
          onMouseEnter={() => setTick((t) => t + 1)}
        >
          <button
            className={`nt-btn${pickerOpen ? " on" : ""}`}
            title="Cor da linha"
            onClick={() => setPickerOpen((o) => !o)}
          >
            <span className="nt-swatch" style={{ background: color }} />
          </button>
          <span className="nt-sep" />
          <button
            className={`nt-btn${shape === "step" ? " on" : ""}`}
            title="Cantos arredondados"
            onClick={() => setShape("step")}
          >
            <StepLineIcon size={14} />
          </button>
          <button
            className={`nt-btn${shape === "bezier" ? " on" : ""}`}
            title="Curva suave"
            onClick={() => setShape("bezier")}
          >
            <CurveLineIcon size={14} />
          </button>
          <span className="nt-sep" />
          <button
            className={`nt-btn${dashed ? " on" : ""}`}
            title="Linha animada (tracejada)"
            onClick={toggleDash}
          >
            <DashIcon size={13} />
          </button>
          <span className="nt-sep" />
          <button
            className="nt-btn danger"
            title="Desconectar"
            onClick={() => setEdges((eds) => eds.filter((e) => e.id !== id))}
          >
            <UnlinkIcon size={13} />
          </button>

          {pickerOpen && (
            <div className="cp-pop">
              <ColorPicker value={color} onChange={setColor} />
            </div>
          )}
        </div>
      </EdgeLabelRenderer>
    );
  }

  if (!srcBranched && !tgtBranched) {
    const dx = targetX - sourceX;
    const dy = targetY - sourceY;
    // Corner (in its diagonal quadrant) and aligned cards stay straight in both
    // formats; the chosen format only changes the "curved" fallback.
    const straightCorner =
      cornerStraight(sourceHandleId, dx, dy) ||
      cornerStraight(targetHandleId, -dx, -dy);
    const aligned = Math.abs(dy) <= 10 || Math.abs(dx) <= 10;
    let simplePath: string;
    if (straightCorner || aligned) {
      simplePath = `M ${sourceX},${sourceY} L ${targetX},${targetY}`;
    } else if (shape === "bezier") {
      [simplePath] = getBezierPath({
        sourceX,
        sourceY,
        sourcePosition,
        targetX,
        targetY,
        targetPosition,
      });
    } else {
      simplePath = fullPath;
    }
    centerPathRef.current = simplePath;
    return (
      <>
        <BaseEdge id={id} path={simplePath} markerEnd={markerEnd} style={{ ...style, ...dashStyle }} />
        <path
          d={simplePath}
          fill="none"
          stroke="transparent"
          strokeWidth={22}
          style={{ cursor: "default", pointerEvents: "stroke" }}
          onClick={onEdgeClick}
        />
        {renderToolbar(simplePath)}
      </>
    );
  }

  const [sdx, sdy] = dirOf(sourcePosition);
  const [tdx, tdy] = dirOf(targetPosition);
  const S: Pt = srcBranched ? { x: sourceX + STEM * sdx, y: sourceY + STEM * sdy } : { x: sourceX, y: sourceY };
  const T: Pt = tgtBranched ? { x: targetX + TGT_STEM * tdx, y: targetY + TGT_STEM * tdy } : { x: targetX, y: targetY };

  // ---- source side: a visible line leaves the dot with the arrow sitting on
  // it, `MARGIN` away from the dot. The line stays continuous from the dot. ----
  const midStart: Pt = S;
  let srcArrow: React.ReactNode = null;
  if (srcBranched) {
    const level = Math.abs(T.y - S.y) < 6;
    if (level) {
      srcArrow = <Arrow x={S.x + MARGIN} y={S.y} rot={0} color={stroke} />;
    } else {
      const dy = T.y > S.y ? 1 : -1;
      srcArrow = <Arrow x={S.x} y={S.y + MARGIN * dy} rot={dy > 0 ? 90 : -90} color={stroke} />;
    }
  }

  // ---- target side: lines converge at the dot → single line → arrow at the card ----
  const midEnd: Pt = T; // every incoming line ends at the dot
  let tgtStemD = "";
  if (tgtBranched) {
    tgtStemD = `M ${T.x},${T.y} L ${targetX},${targetY}`;
  }

  // ---- middle travelling line: smooth curve or orthogonal elbow ----
  let midD: string;
  if (shape === "bezier") {
    [midD] = getBezierPath({
      sourceX: midStart.x,
      sourceY: midStart.y,
      sourcePosition,
      targetX: midEnd.x,
      targetY: midEnd.y,
      targetPosition,
    });
  } else if (srcBranched && tgtBranched) midD = orthoVV(midStart, midEnd);
  else if (srcBranched) midD = elbowV(midStart, midEnd);
  else if (tgtBranched) midD = elbowH(midStart, midEnd);
  else
    midD = getSmoothStepPath({
      sourceX,
      sourceY,
      sourcePosition,
      targetX: midEnd.x,
      targetY: midEnd.y,
      targetPosition,
      borderRadius: R,
    })[0];

  const srcStemD = srcBranched ? `M ${sourceX},${sourceY} L ${S.x},${S.y}` : "";
  const hitD = [srcStemD, midD, tgtStemD].filter(Boolean).join(" ");
  // Center the button on the unique middle line (never on the shared trunk).
  centerPathRef.current = midD;

  return (
    <>
      {srcBranched && <path d={srcStemD} fill="none" stroke={stroke} strokeWidth={strokeWidth} style={dashStyle} />}
      {/* arrow at the target card when the line reaches it directly */}
      <path
        d={midD}
        fill="none"
        stroke={stroke}
        strokeWidth={strokeWidth}
        markerEnd={tgtBranched ? undefined : markerEnd}
        style={dashStyle}
      />
      {tgtBranched && (
        <path
          d={tgtStemD}
          fill="none"
          stroke={stroke}
          strokeWidth={strokeWidth}
          markerEnd={markerEnd}
          style={dashStyle}
        />
      )}
      {srcArrow}
      {srcBranched && <circle cx={S.x} cy={S.y} r={5} fill={stroke} stroke="#fff" strokeWidth={1.5} />}
      {tgtBranched && <circle cx={T.x} cy={T.y} r={5} fill={stroke} stroke="#fff" strokeWidth={1.5} />}
      <path d={hitD} fill="none" stroke="transparent" strokeWidth={22} style={{ cursor: "default", pointerEvents: "stroke" }} onClick={onEdgeClick} />
      {renderToolbar(midD)}
    </>
  );
}
