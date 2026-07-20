// Supabase Edge Function — sends a funnel invite email via Resend.
// Deploy: supabase functions deploy send-invite --no-verify-jwt
// Secret:  supabase secrets set RESEND_API_KEY=...

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
// Sender — requires the atyvo.com.br domain to be verified in Resend.
const FROM = "Funneus <funneus@atyvo.com.br>";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });

function buildEmail(funnelName: string, roleLabel: string, link: string): string {
  const font =
    "'Instrument Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
  const safeName = funnelName.replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
  </head>
  <body style="margin:0;padding:0;background:#f4f6f8;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;">Você foi convidado para acessar o funil ${safeName}.</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f8;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="width:480px;max-width:100%;background:#ffffff;border:1px solid #e6eaef;border-radius:18px;overflow:hidden;font-family:${font};">
            <tr>
              <td style="height:8px;background:#e0ff92;"></td>
            </tr>
            <tr>
              <td style="padding:32px 40px 0;">
                <span style="font-size:18px;font-weight:600;color:#1a1f26;letter-spacing:-0.02em;">Funneus</span>
              </td>
            </tr>
            <tr>
              <td style="padding:20px 40px 8px;">
                <div style="display:inline-block;background:#e0ff92;color:#33420a;font-size:13px;font-weight:600;padding:7px 14px;border-radius:999px;">Convite</div>
                <h1 style="margin:22px 0 10px;font-size:24px;line-height:1.25;font-weight:600;color:#1a1f26;letter-spacing:-0.01em;">Você foi convidado para um funil</h1>
                <p style="margin:0;font-size:15px;line-height:1.6;color:#4a545f;">
                  Você recebeu acesso para <strong style="color:#1a1f26;">${roleLabel.toLowerCase()}</strong> o funil
                  <strong style="color:#1a1f26;">"${safeName}"</strong>. Clique no botão abaixo para abrir.
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:24px 40px 8px;">
                <a href="${link}" style="display:inline-block;background:#e0ff92;color:#33420a;font-size:15px;font-weight:600;text-decoration:none;padding:14px 26px;border-radius:12px;">Acessar funil</a>
              </td>
            </tr>
            <tr>
              <td style="padding:16px 40px 34px;">
                <p style="margin:0;font-size:12.5px;line-height:1.6;color:#8a95a3;">
                  Se o botão não funcionar, copie e cole este link no navegador:<br />
                  <a href="${link}" style="color:#4a545f;word-break:break-all;">${link}</a>
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:18px 40px;border-top:1px solid #e6eaef;">
                <p style="margin:0;font-size:12px;color:#b4bcc7;">
                  Enviado por <strong style="color:#8a95a3;">Funneus</strong> — você recebeu este email porque foi convidado a colaborar em um funil. Se não esperava por isso, pode ignorar.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Método inválido" }, 405);

  try {
    const { email, role, funnelName, funnelId, origin } = await req.json();
    if (!email || !funnelName) return json({ error: "Dados incompletos" }, 400);

    const roleLabel = role === "view" ? "Visualizar" : "Editar";
    const base = (origin || "").replace(/\/$/, "");
    // ?c=<email> identifica o convidado para o app aplicar Visualizar/Editar.
    const link = `${base}/funnel/${funnelId ?? ""}?c=${encodeURIComponent(email)}`;
    const html = buildEmail(funnelName, roleLabel, link);

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM,
        to: [email],
        subject: `Convite para o funil "${funnelName}"`,
        html,
      }),
    });

    const data = await res.json();
    if (!res.ok) return json({ error: data }, 502);
    return json({ ok: true, id: data.id });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
