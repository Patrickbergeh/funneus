"use client";

import { useRef, useState } from "react";
import { PencilIcon } from "@/lib/icons";

const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));

function hexToRgb(hex: string) {
  const h = hex.replace("#", "").trim();
  const v = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const n = parseInt(v, 16);
  if (Number.isNaN(n)) return { r: 59, g: 130, b: 246 };
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}
function rgbToHex(r: number, g: number, b: number) {
  const to = (n: number) => clamp(Math.round(n), 0, 255).toString(16).padStart(2, "0");
  return `#${to(r)}${to(g)}${to(b)}`;
}
function rgbToHsv(r: number, g: number, b: number) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  let h = 0;
  if (d) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return { h, s: max ? d / max : 0, v: max };
}
function hsvToRgb(h: number, s: number, v: number) {
  const c = v * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = v - c;
  let r = 0, g = 0, b = 0;
  if (h < 60) { r = c; g = x; }
  else if (h < 120) { r = x; g = c; }
  else if (h < 180) { g = c; b = x; }
  else if (h < 240) { g = x; b = c; }
  else if (h < 300) { r = x; b = c; }
  else { r = c; b = x; }
  return { r: (r + m) * 255, g: (g + m) * 255, b: (b + m) * 255 };
}

export default function ColorPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (hex: string) => void;
}) {
  const [hsv, setHsv] = useState(() => {
    const { r, g, b } = hexToRgb(value);
    return rgbToHsv(r, g, b);
  });
  const svRef = useRef<HTMLDivElement>(null);
  const hueRef = useRef<HTMLDivElement>(null);

  const rgb = hsvToRgb(hsv.h, hsv.s, hsv.v);
  const hex = rgbToHex(rgb.r, rgb.g, rgb.b);

  function emit(next: { h: number; s: number; v: number }) {
    setHsv(next);
    const c = hsvToRgb(next.h, next.s, next.v);
    onChange(rgbToHex(c.r, c.g, c.b));
  }

  function pickSV(e: { clientX: number; clientY: number }) {
    const rect = svRef.current!.getBoundingClientRect();
    const s = clamp((e.clientX - rect.left) / rect.width, 0, 1);
    const v = clamp((e.clientY - rect.top) / rect.height, 0, 1);
    emit({ h: hsv.h, s, v: 1 - v });
  }
  function pickHue(e: { clientX: number }) {
    const rect = hueRef.current!.getBoundingClientRect();
    const h = clamp((e.clientX - rect.left) / rect.width, 0, 1) * 360;
    emit({ ...hsv, h });
  }

  function dragHandler(handler: (e: { clientX: number; clientY: number }) => void) {
    return (e: React.PointerEvent) => {
      e.preventDefault();
      handler(e);
      const move = (ev: PointerEvent) => handler(ev);
      const up = () => {
        document.removeEventListener("pointermove", move);
        document.removeEventListener("pointerup", up);
      };
      document.addEventListener("pointermove", move);
      document.addEventListener("pointerup", up);
    };
  }

  function setHex(text: string) {
    const t = text.startsWith("#") ? text : `#${text}`;
    if (/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(t)) {
      const { r, g, b } = hexToRgb(t);
      emit(rgbToHsv(r, g, b));
    }
  }
  function setChannel(ch: "r" | "g" | "b", val: string) {
    const n = clamp(parseInt(val || "0", 10) || 0, 0, 255);
    const next = { ...rgb, [ch]: n };
    emit(rgbToHsv(next.r, next.g, next.b));
  }

  async function pickFromScreen() {
    const Ctor = (window as unknown as { EyeDropper?: new () => { open: () => Promise<{ sRGBHex: string }> } }).EyeDropper;
    if (!Ctor) return; // not supported in this browser
    try {
      const res = await new Ctor().open();
      if (res?.sRGBHex) setHex(res.sRGBHex);
    } catch {
      /* user cancelled */
    }
  }

  const hueHex = rgbToHex(...(Object.values(hsvToRgb(hsv.h, 1, 1)) as [number, number, number]));

  return (
    <div className="cp" onPointerDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}>
      <div className="cp-head">
        <button
          type="button"
          className="cp-eye"
          title="Escolher cor da tela"
          onClick={pickFromScreen}
        >
          <PencilIcon size={13} />
        </button>
        <span>Cor da linha</span>
      </div>
      <div
        ref={svRef}
        className="cp-sv"
        style={{ background: hueHex }}
        onPointerDown={dragHandler(pickSV)}
      >
        <div className="cp-sv-white" />
        <div className="cp-sv-black" />
        <div
          className="cp-thumb"
          style={{ left: `${hsv.s * 100}%`, top: `${(1 - hsv.v) * 100}%` }}
        />
      </div>
      <div ref={hueRef} className="cp-hue" onPointerDown={dragHandler(pickHue)}>
        <div className="cp-thumb cp-hue-thumb" style={{ left: `${(hsv.h / 360) * 100}%` }} />
      </div>
      <div className="cp-inputs">
        <label className="cp-field cp-hex">
          <span>HEX</span>
          <input value={hex.replace("#", "").toUpperCase()} onChange={(e) => setHex(e.target.value)} />
        </label>
        <label className="cp-field">
          <span>R</span>
          <input value={Math.round(rgb.r)} onChange={(e) => setChannel("r", e.target.value)} />
        </label>
        <label className="cp-field">
          <span>G</span>
          <input value={Math.round(rgb.g)} onChange={(e) => setChannel("g", e.target.value)} />
        </label>
        <label className="cp-field">
          <span>B</span>
          <input value={Math.round(rgb.b)} onChange={(e) => setChannel("b", e.target.value)} />
        </label>
      </div>
    </div>
  );
}
