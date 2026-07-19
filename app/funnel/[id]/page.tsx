"use client";

import dynamic from "next/dynamic";
import { useParams } from "next/navigation";

const FlowEditor = dynamic(() => import("@/components/FlowEditor"), {
  ssr: false,
});

export default function FunnelPage() {
  const params = useParams();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  if (!id) return null;
  return <FlowEditor funnelId={id} />;
}
