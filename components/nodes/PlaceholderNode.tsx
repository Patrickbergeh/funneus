import { Handle, Position } from "@xyflow/react";

/* Temporary target where a dropped connection lands while the user picks the
   next component. It becomes a real node once a component is chosen. */
export default function PlaceholderNode() {
  return (
    <div className="ph-node">
      <Handle type="target" id="l" position={Position.Left} className="rf-handle" />
      <Handle type="target" id="r" position={Position.Right} className="rf-handle" />
      <Handle type="target" id="t" position={Position.Top} className="rf-handle rf-handle-h" />
      <Handle type="target" id="b" position={Position.Bottom} className="rf-handle rf-handle-h" />
      <span className="ph-dot" />
    </div>
  );
}
