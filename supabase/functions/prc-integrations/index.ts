import { createClient } from "npm:@supabase/supabase-js@2";
import { ErlcClient } from "npm:erlc-api@4.0.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const secretKeysRaw = Deno.env.get("SUPABASE_SECRET_KEYS");
const secretKeys = secretKeysRaw ? JSON.parse(secretKeysRaw) : {};
const SUPABASE_SECRET_KEY = secretKeys.default ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

const admin = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY!);

async function getOfficer(req: Request) {
  const auth = req.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) throw new Error("Not authenticated");
  const token = auth.slice(7);
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) throw new Error("Invalid session");
  const { data: officer, error: officerError } = await admin
    .from("officers")
    .select("id,full_name,callsign,rank,department,role,active")
    .eq("id", data.user.id)
    .maybeSingle();
  if (officerError || !officer || !officer.active) throw new Error("No active officer profile");
  return officer;
}

async function sendDiscordArrest(arrest: Record<string, unknown>, officer: Record<string, unknown>) {
  const webhook = Deno.env.get("DISCORD_ARREST_WEBHOOK");
  if (!webhook) throw new Error("DISCORD_ARREST_WEBHOOK secret is missing");

  const embed = {
    title: "🚔 MET POLICE — ARREST LOG",
    description: "New arrest record created in the PRC.",
    color: 0x1677c8,
    fields: [
      { name: "👮 Officer", value: `${officer.callsign ?? "Unknown"} — ${officer.full_name ?? "Unknown"}`, inline: true },
      { name: "📋 Reference", value: String(arrest.reference ?? "N/A"), inline: true },
      { name: "👤 Subject", value: String(arrest.subject ?? "N/A"), inline: false },
      { name: "⚖ Offence", value: String(arrest.offence ?? "N/A"), inline: false },
      { name: "📍 Location", value: String(arrest.location ?? "N/A"), inline: true },
      { name: "🔒 Custody Status", value: String(arrest.custody_status ?? "N/A"), inline: true },
      { name: "📝 Notes", value: String(arrest.notes || "None"), inline: false },
    ],
    footer: { text: "MET Police PRC • ERLC Roleplay System" },
    timestamp: new Date().toISOString(),
  };

  const response = await fetch(webhook, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "MET Police PRC", embeds: [embed] }),
  });
  if (!response.ok) throw new Error(`Discord returned HTTP ${response.status}`);
}

async function sendErlc(message: string) {
  const serverKey = Deno.env.get("ERLC_SERVER_KEY");
  if (!serverKey) throw new Error("ERLC_SERVER_KEY secret is missing");
  if (message.length > 110) message = message.slice(0, 107) + "...";

  const client = new ErlcClient({ serverKey });
  // :h is an ER:LC Remote Server Management command that displays a server-wide hint.
  // This is an in-game announcement, not a native radio-channel injection.
  const result = await client.commands.execute(`:h ${message}`);
  return { message: result.message ?? "ER:LC command sent" };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ ok: false, error: "POST only" }, 405);

  try {
    const officer = await getOfficer(req);
    const body = await req.json();

    if (body.action === "arrest_created") {
      if (!body.arrest || body.arrest.officer_id !== officer.id) return json({ ok: false, error: "Officer mismatch" }, 403);
      await sendDiscordArrest(body.arrest, officer);
      return json({ ok: true, discord: true });
    }

    if (body.action === "erlc_radio") {
      const type = String(body.type ?? "GENERAL").toUpperCase();
      const message = String(body.message ?? "").trim();
      const callsign = String(body.callsign ?? officer.callsign ?? "").trim();
      if (!message) return json({ ok: false, error: "Message required" }, 400);
      if (callsign !== officer.callsign) return json({ ok: false, error: "Callsign mismatch" }, 403);
      const result = await sendErlc(`[${type}] ${callsign}: ${message}`);
      return json({ ok: true, erlc: result });
    }

    return json({ ok: false, error: "Unknown action" }, 400);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    return json({ ok: false, error: error instanceof Error ? error.message : "Integration failed" }, 500);
  }
});
