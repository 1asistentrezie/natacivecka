// Natáčecí den – rozeslání upozornění (Web Push) na iPhony a Apple Watch.
// Supabase → Edge Functions → Deploy a new function → Via Editor → název "notify" → vložit tento kód → Deploy.
// V nastavení funkce vypnout "Verify JWT" (oprávnění editora si funkce ověřuje sama).
// Secrets: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (např. mailto:vas@email.cz)
import webpush from "npm:web-push@3.6.7";
import { createClient } from "npm:@supabase/supabase-js@2.49.4";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (o: unknown, status = 200) =>
  new Response(JSON.stringify(o), { status, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const jwt = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    const { data: u } = await admin.auth.getUser(jwt);
    const email = u?.user?.email;
    if (!email) return json({ error: "not signed in" }, 401);
    const { data: ed } = await admin.from("editors").select("email").eq("email", email).maybeSingle();
    if (!ed) return json({ error: "not an editor" }, 403);

    const { title, body, tag, url } = await req.json();
    webpush.setVapidDetails(
      Deno.env.get("VAPID_SUBJECT") || "mailto:info@example.com",
      Deno.env.get("VAPID_PUBLIC_KEY")!,
      Deno.env.get("VAPID_PRIVATE_KEY")!,
    );
    const { data: subs } = await admin.from("push_subs").select("endpoint, sub");
    const payload = JSON.stringify({ title, body, tag, url });
    let sent = 0;
    const gone: string[] = [];
    await Promise.all((subs || []).map(async (s: { endpoint: string; sub: webpush.PushSubscription }) => {
      try {
        await webpush.sendNotification(s.sub, payload, { TTL: 900, urgency: "high" });
        sent++;
      } catch (e) {
        const code = (e as { statusCode?: number }).statusCode;
        if (code === 404 || code === 410) gone.push(s.endpoint);
      }
    }));
    if (gone.length) await admin.from("push_subs").delete().in("endpoint", gone);
    return json({ sent, removed: gone.length, total: (subs || []).length });
  } catch (e) {
    return json({ error: String((e as Error)?.message || e) }, 500);
  }
});
