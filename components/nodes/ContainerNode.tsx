"use client";

import { useEffect, useState } from "react";
import {
  Handle,
  NodeResizer,
  NodeToolbar,
  Position,
  useReactFlow,
  type NodeProps,
} from "@xyflow/react";
import ColorPicker from "../ColorPicker";
import { TrashIcon } from "@/lib/icons";

export default function ContainerNode({ id, data, selected }: NodeProps) {
  const { updateNodeData, setNodes } = useReactFlow();
  const color = (data as { color?: string }).color ?? "#e9eef5";
  const textColor = (data as { textColor?: string }).textColor ?? "#1a1f26";
  const text = (data as { text?: string }).text ?? "";
  const [editing, setEditing] = useState(false);
  const [openPicker, setOpenPicker] = useState<"bg" | "text" | null>(null);

  // leaving / deselecting the container closes the color dropdown & editing
  useEffect(() => {
    if (!selected) {
      setOpenPicker(null);
      setEditing(false);
    }
  }, [selected]);

  return (
    <div
      className={`container-node${selected ? " sel" : ""}`}
      style={{ background: color }}
      onDoubleClick={() => setEditing(true)}
    >
      <NodeResizer
        minWidth={140}
        minHeight={90}
        isVisible={!!selected}
        lineClassName="cn-line"
        handleClassName="cn-handle"
      />

      <Handle type="source" id="l" position={Position.Left} className="rf-handle rf-handle-cont" />
      <Handle type="source" id="r" position={Position.Right} className="rf-handle rf-handle-cont" />
      <Handle type="source" id="t" position={Position.Top} className="rf-handle rf-handle-cont" />
      <Handle type="source" id="b" position={Position.Bottom} className="rf-handle rf-handle-cont" />

      <NodeToolbar isVisible={!!selected} position={Position.Top} offset={10}>
        <div className="node-toolbar">
          <button
            className={`nt-btn${openPicker === "bg" ? " on" : ""}`}
            title="Cor de fundo"
            onClick={() => setOpenPicker((o) => (o === "bg" ? null : "bg"))}
          >
            <span className="nt-swatch" style={{ background: color }} />
          </button>
          <span className="nt-sep" />
          <button
            className={`nt-btn nt-tcol${openPicker === "text" ? " on" : ""}`}
            title="Cor do texto"
            onClick={() => setOpenPicker((o) => (o === "text" ? null : "text"))}
          >
            <span className="nt-A">A</span>
            <span className="nt-tbar" style={{ background: textColor }} />
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
        {openPicker === "bg" && (
          <div className="cp-pop">
            <ColorPicker value={color} onChange={(c) => updateNodeData(id, { color: c })} />
          </div>
        )}
        {openPicker === "text" && (
          <div className="cp-pop">
            <ColorPicker value={textColor} onChange={(c) => updateNodeData(id, { textColor: c })} />
          </div>
        )}
      </NodeToolbar>

      {editing ? (
        <textarea
          className="cn-text nodrag"
          autoFocus
          value={text}
          placeholder="Escreva algo…"
          style={{ color: textColor }}
          onChange={(e) => updateNodeData(id, { text: e.target.value })}
          onBlur={() => setEditing(false)}
        />
      ) : (
        <div className="cn-text cn-text-view" style={{ color: textColor }}>
          {text}
        </div>
      )}
    </div>
  );
}
