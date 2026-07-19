import type { Node, NodePositionChange } from "@xyflow/react";

const dim = (n: Node) => ({
  w: (n.measured?.width ?? (n.width as number) ?? 0) || 0,
  h: (n.measured?.height ?? (n.height as number) ?? 0) || 0,
});

export type Seg = { x1: number; y1: number; x2: number; y2: number };

export type Guides = {
  vertical?: { x: number; y1: number; y2: number };
  horizontal?: { y: number; x1: number; x2: number };
  spacing: Seg[];
  snapX?: number;
  snapY?: number;
};

/**
 * Smart alignment + equal-spacing guides for the node being dragged.
 * Compares the dragged node against every other node and returns the guide
 * lines to draw plus the snapped position.
 */
export function computeGuides(
  change: NodePositionChange,
  nodes: Node[],
  threshold = 6
): Guides {
  const out: Guides = { spacing: [] };
  const self = nodes.find((n) => n.id === change.id);
  if (!self || !change.position) return out;

  const { w: aw, h: ah } = dim(self);
  const ax = change.position.x;
  const ay = change.position.y;
  const a = {
    left: ax, right: ax + aw, cx: ax + aw / 2,
    top: ay, bottom: ay + ah, cy: ay + ah / 2,
  };

  const others = nodes.filter((n) => n.id !== change.id);
  const boxes = others.map((n) => {
    const { w, h } = dim(n);
    return {
      left: n.position.x, right: n.position.x + w, cx: n.position.x + w / 2,
      top: n.position.y, bottom: n.position.y + h, cy: n.position.y + h / 2,
    };
  });

  // ---------- Edge / center alignment ----------
  let bestV = threshold;
  let bestH = threshold;
  for (const b of boxes) {
    const vChecks: { aVal: number; target: number; lineX: number }[] = [
      { aVal: a.left, target: b.left, lineX: b.left },
      { aVal: a.right, target: b.right, lineX: b.right },
      { aVal: a.cx, target: b.cx, lineX: b.cx },
      { aVal: a.left, target: b.right, lineX: b.right },
      { aVal: a.right, target: b.left, lineX: b.left },
    ];
    for (const c of vChecks) {
      const d = Math.abs(c.aVal - c.target);
      if (d < bestV) {
        bestV = d;
        out.snapX = ax + (c.target - c.aVal);
        out.vertical = {
          x: c.lineX,
          y1: Math.min(a.top, b.top),
          y2: Math.max(a.bottom, b.bottom),
        };
      }
    }
    const hChecks: { aVal: number; target: number; lineY: number }[] = [
      { aVal: a.top, target: b.top, lineY: b.top },
      { aVal: a.bottom, target: b.bottom, lineY: b.bottom },
      { aVal: a.cy, target: b.cy, lineY: b.cy },
      { aVal: a.top, target: b.bottom, lineY: b.bottom },
      { aVal: a.bottom, target: b.top, lineY: b.top },
    ];
    for (const c of hChecks) {
      const d = Math.abs(c.aVal - c.target);
      if (d < bestH) {
        bestH = d;
        out.snapY = ay + (c.target - c.aVal);
        out.horizontal = {
          y: c.lineY,
          x1: Math.min(a.left, b.left),
          x2: Math.max(a.right, b.right),
        };
      }
    }
  }

  // ---------- Equal spacing (vertical stacks) ----------
  // nodes whose X range overlaps the dragged node → same column
  const col = boxes
    .filter((b) => b.right > a.left && b.left < a.right)
    .map((b) => ({ ...b }));
  const colCx = out.snapX != null ? out.snapX + aw / 2 : a.cx;

  const aboveV = col.filter((b) => b.cy < a.cy).sort((p, q) => q.cy - p.cy);
  const belowV = col.filter((b) => b.cy > a.cy).sort((p, q) => p.cy - q.cy);
  if (out.snapY == null) {
    if (aboveV.length >= 2) {
      const n1 = aboveV[0], n0 = aboveV[1];
      const refGap = n1.top - n0.bottom;
      const targetTop = n1.bottom + refGap;
      if (refGap > 0 && Math.abs(a.top - targetTop) < threshold) {
        out.snapY = ay + (targetTop - a.top);
        out.spacing.push(
          { x1: colCx, y1: n0.bottom, x2: colCx, y2: n1.top },
          { x1: colCx, y1: n1.bottom, x2: colCx, y2: targetTop }
        );
      }
    } else if (belowV.length >= 2) {
      const n1 = belowV[0], n0 = belowV[1];
      const refGap = n0.top - n1.bottom;
      const targetBottom = n1.top - refGap;
      if (refGap > 0 && Math.abs(a.bottom - targetBottom) < threshold) {
        out.snapY = ay + (targetBottom - a.bottom);
        out.spacing.push(
          { x1: colCx, y1: n1.top, x2: colCx, y2: n0.top - (n0.top - n1.bottom) },
          { x1: colCx, y1: targetBottom, x2: colCx, y2: n1.top }
        );
      }
    } else if (aboveV.length >= 1 && belowV.length >= 1) {
      const up = aboveV[0], dn = belowV[0];
      const space = dn.top - up.bottom - ah;
      const targetTop = up.bottom + space / 2;
      if (space > 0 && Math.abs(a.top - targetTop) < threshold) {
        out.snapY = ay + (targetTop - a.top);
        out.spacing.push(
          { x1: colCx, y1: up.bottom, x2: colCx, y2: targetTop },
          { x1: colCx, y1: targetTop + ah, x2: colCx, y2: dn.top }
        );
      }
    }
  }

  // ---------- Equal spacing (horizontal rows) ----------
  const row = boxes
    .filter((b) => b.bottom > a.top && b.top < a.bottom)
    .map((b) => ({ ...b }));
  const rowCy = out.snapY != null ? out.snapY + ah / 2 : a.cy;
  const leftR = row.filter((b) => b.cx < a.cx).sort((p, q) => q.cx - p.cx);
  const rightR = row.filter((b) => b.cx > a.cx).sort((p, q) => p.cx - q.cx);
  if (out.snapX == null) {
    if (leftR.length >= 2) {
      const n1 = leftR[0], n0 = leftR[1];
      const refGap = n1.left - n0.right;
      const targetLeft = n1.right + refGap;
      if (refGap > 0 && Math.abs(a.left - targetLeft) < threshold) {
        out.snapX = ax + (targetLeft - a.left);
        out.spacing.push(
          { x1: n0.right, y1: rowCy, x2: n1.left, y2: rowCy },
          { x1: n1.right, y1: rowCy, x2: targetLeft, y2: rowCy }
        );
      }
    } else if (rightR.length >= 2) {
      const n1 = rightR[0], n0 = rightR[1];
      const refGap = n0.left - n1.right;
      const targetRight = n1.left - refGap;
      if (refGap > 0 && Math.abs(a.right - targetRight) < threshold) {
        out.snapX = ax + (targetRight - a.right);
        out.spacing.push(
          { x1: n1.right, y1: rowCy, x2: n0.left, y2: rowCy },
          { x1: targetRight, y1: rowCy, x2: n1.left, y2: rowCy }
        );
      }
    } else if (leftR.length >= 1 && rightR.length >= 1) {
      const lft = leftR[0], rgt = rightR[0];
      const space = rgt.left - lft.right - aw;
      const targetLeft = lft.right + space / 2;
      if (space > 0 && Math.abs(a.left - targetLeft) < threshold) {
        out.snapX = ax + (targetLeft - a.left);
        out.spacing.push(
          { x1: lft.right, y1: rowCy, x2: targetLeft, y2: rowCy },
          { x1: targetLeft + aw, y1: rowCy, x2: rgt.left, y2: rowCy }
        );
      }
    }
  }

  return out;
}
