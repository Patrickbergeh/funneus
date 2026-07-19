"use client";

import { NodeToolbar, Position, useReactFlow, type Node } from "@xyflow/react";
import { CopyIcon, TrashIcon } from "@/lib/icons";

let dupSeq = 0;
const newId = () => `n_${Date.now().toString(36)}_${dupSeq++}`;

export default function NodeActions({
  id,
  visible,
}: {
  id: string;
  visible: boolean;
}) {
  const { setNodes, setEdges, getNode } = useReactFlow();

  function duplicate() {
    const node = getNode(id);
    if (!node) return;
    const copy: Node = {
      ...node,
      id: newId(),
      position: { x: node.position.x + 36, y: node.position.y + 36 },
      selected: false,
      dragging: false,
      data: { ...node.data },
    };
    setNodes((nds) => [...nds.map((n) => ({ ...n, selected: false })), copy]);
  }

  function remove() {
    setNodes((nds) => nds.filter((n) => n.id !== id));
    setEdges((eds) => eds.filter((e) => e.source !== id && e.target !== id));
  }

  return (
    <NodeToolbar isVisible={visible} position={Position.Top} offset={12}>
      <div className="node-toolbar">
        <button className="nt-btn" onClick={duplicate} title="Duplicar">
          <CopyIcon size={16} />
        </button>
        <span className="nt-sep" />
        <button className="nt-btn danger" onClick={remove} title="Apagar">
          <TrashIcon size={16} />
        </button>
      </div>
    </NodeToolbar>
  );
}
