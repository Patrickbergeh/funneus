"use client";

import { Handle, Position, useReactFlow, type NodeProps } from "@xyflow/react";
import { CATALOG_MAP } from "@/lib/catalog";
import { ClockIcon } from "@/lib/icons";
import NodeActions from "./NodeActions";
import { useReadOnly } from "@/lib/editorMode";

export default function TimeNode({ id, data, selected }: NodeProps) {
  const { updateNodeData } = useReactFlow();
  const readOnly = useReadOnly();
  const item = CATALOG_MAP[(data as { key: string }).key];
  const label = (data as { label?: string }).label ?? "";

  return (
    <div className={`time-node${selected ? " sel" : ""}`}>
      <NodeActions id={id} visible={!!selected} />
      <Handle type="source" id="l" position={Position.Left} className="rf-handle" />
      <Handle type="source" id="r" position={Position.Right} className="rf-handle" />
      <Handle type="source" id="t" position={Position.Top} className="rf-handle rf-handle-h" />
      <Handle
        type="source"
        id="b"
        position={Position.Bottom}
        className="rf-handle rf-handle-h"
        style={{ top: "calc(100% + 26px)", bottom: "auto", transform: "translateX(-50%)" }}
      />
      <Handle type="source" id="tl" position={Position.Left} className="rf-handle rf-handle-c" style={{ top: 0 }} />
      <Handle type="source" id="bl" position={Position.Left} className="rf-handle rf-handle-c" style={{ top: "100%" }} />
      <Handle type="source" id="tr" position={Position.Right} className="rf-handle rf-handle-c" style={{ top: 0 }} />
      <Handle type="source" id="br" position={Position.Right} className="rf-handle rf-handle-c" style={{ top: "100%" }} />

      <div className="time-circle" style={{ background: item?.color ?? "#0ea5e9" }}>
        <ClockIcon size={28} />
      </div>
      <input
        className="time-label nodrag"
        value={label}
        placeholder="Escreva o tempo…"
        readOnly={readOnly}
        onChange={(e) => updateNodeData(id, { label: e.target.value })}
      />
    </div>
  );
}
