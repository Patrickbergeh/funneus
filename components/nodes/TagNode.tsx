import { Handle, Position, type NodeProps } from "@xyflow/react";
import { CATALOG_MAP } from "@/lib/catalog";
import NodeActions from "./NodeActions";

export default function TagNode({ id, data, selected }: NodeProps) {
  const key = (data as { key: string }).key;
  const label = (data as { label?: string }).label;
  const item = CATALOG_MAP[key];
  if (!item) return null;

  return (
    <div className={`tag-node${selected ? " sel" : ""}`}>
      <NodeActions id={id} visible={!!selected} />
      <Handle type="source" id="l" position={Position.Left} className="rf-handle" />
      <Handle type="source" id="r" position={Position.Right} className="rf-handle" />
      <Handle type="source" id="t" position={Position.Top} className="rf-handle rf-handle-h" />
      <Handle
        type="source"
        id="b"
        position={Position.Bottom}
        className="rf-handle rf-handle-h"
        style={{ top: "calc(100% + 18px)", bottom: "auto", transform: "translateX(-50%)" }}
      />
      <Handle type="source" id="tl" position={Position.Left} className="rf-handle rf-handle-c" style={{ top: 0 }} />
      <Handle type="source" id="bl" position={Position.Left} className="rf-handle rf-handle-c" style={{ top: "100%" }} />
      <Handle type="source" id="tr" position={Position.Right} className="rf-handle rf-handle-c" style={{ top: 0 }} />
      <Handle type="source" id="br" position={Position.Right} className="rf-handle rf-handle-c" style={{ top: "100%" }} />

      <div className="tag-shape" style={{ background: item.color }}>
        <span className="tag-hole" />
        <span className="tag-text">{label ?? item.label}</span>
      </div>
    </div>
  );
}
