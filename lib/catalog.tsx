import React from "react";
import {
  WhatsAppIcon,
  InstagramIcon,
  ReelsIcon,
  EmailIcon,
  CrmIcon,
  ZoomIcon,
  YoutubeIcon,
  GoogleAdsIcon,
  MetaIcon,
  TiktokIcon,
  SalesGlyph,
  VslGlyph,
  CheckoutGlyph,
  ThanksGlyph,
  FormGlyph,
  DollarGlyph,
  CartGlyph,
  XGlyph,
  RefreshIcon,
  UserIcon,
  ClockIcon,
  ManyChatIcon,
  AdIcon,
  TextIcon,
} from "./icons";

export type Family = "page" | "icon" | "diamond" | "time" | "text";

export type CatalogItem = {
  key: string;
  label: string;
  family: Family;
  color: string; // circle/CTA background (may be a CSS gradient)
  solid?: string; // solid fallback (minimap) when color is a gradient
  category: "Páginas" | "Tráfego" | "Comunicação" | "Ferramentas" | "Status" | "Time";
  glyph: (p: { size?: number }) => React.JSX.Element;
  cta?: string; // bottom badge text for page nodes
};

export const CATALOG: CatalogItem[] = [
  // ---------- Páginas (browser mockup nodes) ----------
  { key: "sales", label: "Página de Vendas", family: "page", color: "#3b82f6", category: "Páginas", glyph: SalesGlyph, cta: "COMPRAR AGORA" },
  { key: "vsl", label: "VSL", family: "page", color: "#8b5cf6", category: "Páginas", glyph: VslGlyph, cta: "ASSISTIR" },
  { key: "checkout", label: "Checkout", family: "page", color: "#22c55e", category: "Páginas", glyph: CheckoutGlyph, cta: "FINALIZAR" },
  { key: "obrigado", label: "Página de Obrigado", family: "page", color: "#16a34a", category: "Páginas", glyph: ThanksGlyph, cta: "ACESSAR AGORA" },
  { key: "form", label: "Formulário", family: "page", color: "#06b6d4", category: "Páginas", glyph: FormGlyph, cta: "ENVIAR" },

  // ---------- Tráfego (brand icon nodes) ----------
  { key: "meta", label: "Meta Ads", family: "icon", color: "#0467df", category: "Tráfego", glyph: MetaIcon },
  { key: "google", label: "Anúncio Google", family: "icon", color: "#4285f4", category: "Tráfego", glyph: GoogleAdsIcon },
  { key: "instagram", label: "Instagram", family: "icon", color: "#e1306c", category: "Tráfego", glyph: InstagramIcon },
  { key: "tiktok", label: "TikTok", family: "icon", color: "#000000", category: "Tráfego", glyph: TiktokIcon },
  { key: "youtube", label: "YouTube", family: "icon", color: "#ff0000", category: "Tráfego", glyph: YoutubeIcon },
  { key: "reels", label: "Reels", family: "icon", color: "#e1306c", category: "Tráfego", glyph: ReelsIcon },
  { key: "anuncio", label: "Anúncio", family: "icon", color: "#7c3aed", category: "Tráfego", glyph: AdIcon },

  // ---------- Comunicação ----------
  { key: "whatsapp", label: "WhatsApp", family: "icon", color: "#25d366", category: "Comunicação", glyph: WhatsAppIcon },
  { key: "whatsapp_api", label: "WhatsApp API", family: "icon", color: "#128c7e", category: "Comunicação", glyph: WhatsAppIcon },
  { key: "manychat", label: "ManyChat", family: "icon", color: "#363a44", category: "Comunicação", glyph: ManyChatIcon },
  { key: "email", label: "E-mail", family: "icon", color: "#2563eb", category: "Comunicação", glyph: EmailIcon },
  { key: "zoom", label: "Zoom", family: "icon", color: "#0b5cff", category: "Comunicação", glyph: ZoomIcon },

  // ---------- Ferramentas ----------
  { key: "crm", label: "CRM", family: "icon", color: "#f97316", category: "Ferramentas", glyph: CrmIcon },
  { key: "atualizar", label: "Atualizar Dados", family: "icon", color: "#39ff14", category: "Ferramentas", glyph: RefreshIcon },
  { key: "time", label: "Espera", family: "time", color: "#0ea5e9", category: "Ferramentas", glyph: ClockIcon },
  { key: "texto", label: "Texto", family: "text", color: "#334155", category: "Ferramentas", glyph: TextIcon },

  // ---------- Status (diamond / losango nodes) ----------
  { key: "lead", label: "Lead", family: "diamond", color: "#eab308", category: "Status", glyph: UserIcon },
  { key: "aprovada", label: "Compra Aprovada", family: "diamond", color: "#22c55e", category: "Status", glyph: DollarGlyph },
  { key: "abandonada", label: "Abandonada", family: "diamond", color: "#f97316", category: "Status", glyph: CartGlyph },
  { key: "recusada", label: "Recusada", family: "diamond", color: "#ef4444", category: "Status", glyph: XGlyph },

  // ---------- Time (roles) ----------
  { key: "suporte", label: "Suporte", family: "icon", color: "#6366f1", category: "Time", glyph: UserIcon },
  { key: "marketing", label: "Marketing", family: "icon", color: "#ec4899", category: "Time", glyph: UserIcon },
  { key: "trafego", label: "Gestor de Tráfego", family: "icon", color: "#f59e0b", category: "Time", glyph: UserIcon },
  { key: "closer", label: "Closer", family: "icon", color: "#10b981", category: "Time", glyph: UserIcon },
  { key: "sdr", label: "SDR", family: "icon", color: "#06b6d4", category: "Time", glyph: UserIcon },
  { key: "cs", label: "CS", family: "icon", color: "#8b5cf6", category: "Time", glyph: UserIcon },
  { key: "social", label: "Social Selling", family: "icon", color: "#f43f5e", category: "Time", glyph: UserIcon },
];

export const CATALOG_MAP: Record<string, CatalogItem> = Object.fromEntries(
  CATALOG.map((c) => [c.key, c])
);

export const CATEGORIES: CatalogItem["category"][] = [
  "Páginas",
  "Tráfego",
  "Comunicação",
  "Ferramentas",
  "Status",
  "Time",
];
