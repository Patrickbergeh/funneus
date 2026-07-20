import { Handle, Position, type NodeProps } from "@xyflow/react";
import { CATALOG_MAP } from "@/lib/catalog";
import NodeActions from "./NodeActions";

export default function PageNode({ id, data, selected }: NodeProps) {
  const key = (data as { key: string }).key;
  const label = (data as { label?: string }).label;
  const item = CATALOG_MAP[key];
  if (!item) return null;
  const Glyph = item.glyph;

  const cta = (
    <button
      className="pg-cta"
      style={{ color: item.color, borderColor: item.color }}
    >
      {item.cta}
    </button>
  );

  let body: React.ReactNode;

  if (item.key === "form") {
    body = (
      <div className="page-body form-body">
        {["Nome", "Email", "Telefone", "Instagram"].map((f) => (
          <label className="pg-field" key={f}>
            <span className="pg-flabel">{f}</span>
            <span className="pg-input" />
          </label>
        ))}
        {cta}
      </div>
    );
  } else if (item.key === "checkout") {
    body = (
      <div className="page-body checkout-body">
        <div className="ck-summary">
          <span className="ck-thumb" style={{ background: item.color }} />
          <span className="ck-sum-lines">
            <span className="ck-sum-title" />
            <span className="ck-sum-sub" />
          </span>
          <span className="ck-price" style={{ color: item.color }}>
            R$ 197
          </span>
        </div>
        {["Nome", "Email", "CPF"].map((f) => (
          <label className="pg-field" key={f}>
            <span className="pg-flabel">{f}</span>
            <span className="pg-input" />
          </label>
        ))}
        <div className="pg-pays">
          {["Pix", "Cartão", "Boleto"].map((p, i) => (
            <span
              className={`pg-pay${i === 0 ? " sel" : ""}`}
              key={p}
              style={i === 0 ? { borderColor: item.color, color: item.color } : undefined}
            >
              {p}
            </span>
          ))}
        </div>
        <div className="ck-total">
          <span className="ck-total-label">Total</span>
          <span className="ck-total-val" style={{ color: item.color }}>
            R$ 197
          </span>
        </div>
        {cta}
      </div>
    );
  } else if (item.key === "obrigado") {
    body = (
      <div className="page-body thanks-body">
        <div className="pg-hero th-hero">
          <span className="th-badge" style={{ background: item.color }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M5 12.5l4.5 4.5L19 7.5" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
        </div>
        <div className="sl-title th-title" />
        <div className="pg-line" style={{ width: "100%" }} />
        <div className="pg-line" style={{ width: "68%" }} />
        <div className="sl-benefits">
          {["78%", "62%"].map((w, i) => (
            <span className="sl-benefit" key={i}>
              <span className="sl-check" style={{ background: item.color }} />
              <span className="sl-bl" style={{ width: w }} />
            </span>
          ))}
        </div>
        {cta}
      </div>
    );
  } else if (item.key === "vsl") {
    body = (
      <div className="page-body vsl-body">
        <div className="pg-video">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="11" fill="rgba(255,255,255,0.16)" />
            <path d="M10 8.5v7l6-3.5-6-3.5Z" fill="#fff" />
          </svg>
        </div>
        <div className="pg-line" style={{ width: "100%" }} />
        <div className="pg-line" style={{ width: "78%" }} />
        {cta}
      </div>
    );
  } else {
    body = (
      <div className="page-body sales-body">
        <div className="pg-hero">
          <Glyph size={30} />
        </div>
        <div className="sl-title" />
        <div className="pg-line" style={{ width: "100%" }} />
        <div className="pg-line" style={{ width: "82%" }} />
        <div className="sl-benefits">
          {["72%", "84%", "62%"].map((w, i) => (
            <span className="sl-benefit" key={i}>
              <span className="sl-check" style={{ background: item.color }} />
              <span className="sl-bl" style={{ width: w }} />
            </span>
          ))}
        </div>
        <div className="sl-price">
          <span className="sl-old" />
          <span className="sl-now" style={{ color: item.color }}>
            R$ 197
          </span>
        </div>
        {cta}
      </div>
    );
  }

  return (
    <div className={`page-node${selected ? " sel" : ""}`}>
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
      <div className="page-card">
        <div className="page-bar">
          <i style={{ background: "#ff5f57" }} />
          <i style={{ background: "#febc2e" }} />
          <i style={{ background: "#28c840" }} />
          <div className="page-url">
            <b />
            <span />
          </div>
        </div>
        {body}
      </div>
      <div className="node-label">{label ?? item.label}</div>
    </div>
  );
}
