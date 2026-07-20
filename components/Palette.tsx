"use client";

import { useEffect, useMemo, useState } from "react";
import { useReactFlow, useViewport } from "@xyflow/react";
import { CATALOG, CATEGORIES, type CatalogItem } from "@/lib/catalog";
import { SearchGlyph } from "@/lib/icons";

export default function Palette({
  open,
  flow,
  clear = false,
  onClose,
  onPick,
}: {
  open: boolean;
  flow: { x: number; y: number } | null;
  clear?: boolean; // keep the anchor point uncovered (opens to the side)
  onClose: () => void;
  onPick: (item: CatalogItem) => void;
}) {
  const { flowToScreenPosition } = useReactFlow();
  useViewport(); // re-render (reposition) whenever the canvas pans / zooms
  const [cat, setCat] = useState<CatalogItem["category"]>(CATEGORIES[0]);
  const [q, setQ] = useState("");

  useEffect(() => {
    if (!open) return;
    setQ("");
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const items = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (term) return CATALOG.filter((c) => c.label.toLowerCase().includes(term));
    return CATALOG.filter((c) => c.category === cat);
  }, [q, cat]);

  if (!open || !flow) return null;

  // anchor to the flow point → it stays put (in canvas space) while panning.
  // Connection drop: the dot sits at the middle of the left edge.
  // "+" add: open to the side so the point (where the card lands) stays clear.
  const p = flowToScreenPosition({ x: flow.x, y: flow.y });

  return (
    <div
      className="palette-pop palette-float"
      style={{ left: p.x + (clear ? 48 : 0), top: p.y, transform: "translateY(-50%)" }}
    >
      <div className="pop-tabs">
        {CATEGORIES.map((c) => (
          <button
            key={c}
            className={`pop-tab${c === cat && !q ? " active" : ""}`}
            onClick={() => {
              setCat(c);
              setQ("");
            }}
          >
            {c}
          </button>
        ))}
      </div>

      <div className="pop-search">
        <SearchGlyph size={15} />
        <input
          placeholder="Buscar elemento…"
          value={q}
          autoFocus
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      <div className="pop-grid">
        {items.map((item) => {
          const Glyph = item.glyph;
          const round = item.family === "icon";
          const diamond = item.family === "diamond";
          const tag = item.family === "tag";
          return (
            <button
              key={item.key}
              className="pop-item"
              onClick={() => onPick(item)}
              title={item.label}
            >
              {tag ? (
                <div className="pop-swatch pop-tag" style={{ background: item.color }}>
                  <span className="pop-tag-hole" />
                  <Glyph size={18} />
                </div>
              ) : diamond ? (
                <div className="pop-swatch dia">
                  <span className="pop-dia" style={{ background: item.color }} />
                  <span className="pop-dia-glyph">
                    <Glyph size={20} />
                  </span>
                </div>
              ) : (
                <div
                  className={`pop-swatch${round ? " round" : ""}`}
                  style={
                    round
                      ? { background: item.color }
                      : { background: "#fff", border: `1.5px solid ${item.color}`, color: item.color }
                  }
                >
                  <Glyph size={round ? 28 : 24} />
                </div>
              )}
              <span className="pop-name">{item.label}</span>
            </button>
          );
        })}
        {items.length === 0 && (
          <div className="pop-empty">Nenhum elemento encontrado</div>
        )}
      </div>

      <div className="pop-foot">Escolha um componente</div>
    </div>
  );
}
