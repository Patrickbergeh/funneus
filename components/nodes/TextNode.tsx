"use client";

import { useEffect, useState } from "react";
import { NodeToolbar, Position, useReactFlow, type NodeProps } from "@xyflow/react";
import ColorPicker from "../ColorPicker";
import { TrashIcon } from "@/lib/icons";
import { useReadOnly } from "@/lib/editorMode";

export default function TextNode({ id, data, selected }: NodeProps) {
  const { updateNodeData, setNodes } = useReactFlow();
  const readOnly = useReadOnly();
  const text = (data as { text?: string }).text ?? "";
  const color = (data as { color?: string }).color ?? "#1a1f26";
  const size = (data as { size?: number }).size ?? 19;
  const [editing, setEditing] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);

  const MIN = 12;
  const MAX = 56;
  const step = (d: number) =>
    updateNodeData(id, { size: Math.max(MIN, Math.min(MAX, size + d)) });

  // leaving / deselecting the node closes the color dropdown
  useEffect(() => {
    if (!selected) {
      setPickerOpen(false);
      setEditing(false);
    }
  }, [selected]);

  return (
    <div
      className={`text-node${selected ? " sel" : ""}`}
      onDoubleClick={() => !readOnly && setEditing(true)}
    >
      <NodeToolbar isVisible={!!selected && !readOnly} position={Position.Top} offset={8}>
        <div className="node-toolbar">
          <button
            className={`nt-btn nt-tcol${pickerOpen ? " on" : ""}`}
            title="Cor do texto"
            onClick={() => setPickerOpen((o) => !o)}
          >
            <span className="nt-A">A</span>
            <span className="nt-tbar" style={{ background: color }} />
          </button>
          <span className="nt-sep" />
          <button
            className="nt-btn nt-size"
            title="Diminuir tamanho"
            onClick={() => step(-2)}
            disabled={size <= MIN}
          >
            <span style={{ fontSize: 11, fontWeight: 700 }}>A</span>
          </button>
          <span className="nt-size-val">{size}</span>
          <button
            className="nt-btn nt-size"
            title="Aumentar tamanho"
            onClick={() => step(2)}
            disabled={size >= MAX}
          >
            <span style={{ fontSize: 17, fontWeight: 700 }}>A</span>
          </button>
          <span className="nt-sep" />
          <button
            className="nt-btn danger"
            title="Apagar"
            onClick={() => setNodes((nds) => nds.filter((n) => n.id !== id))}
          >
            <TrashIcon size={14} />
          </button>
        </div>
        {pickerOpen && (
          <div className="cp-pop">
            <ColorPicker value={color} onChange={(c) => updateNodeData(id, { color: c })} />
          </div>
        )}
      </NodeToolbar>

      {editing && !readOnly ? (
        <textarea
          className="text-input nodrag"
          autoFocus
          value={text}
          placeholder="Escreva…"
          style={{ color, fontSize: size }}
          onChange={(e) => updateNodeData(id, { text: e.target.value })}
          onBlur={() => setEditing(false)}
        />
      ) : (
        <div className="text-view" style={{ color, fontSize: size }}>
          {text || "Texto"}
        </div>
      )}
    </div>
  );
}
