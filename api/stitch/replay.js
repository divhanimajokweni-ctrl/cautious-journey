import { db } from "../../lib/db.js";
import { processEvent } from "./webhook.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "method_not_allowed", allowed: ["POST"] });
  }

  try {
    const { limit = 20 } = req.body || {};

    const { data: events, error: selErr } = await db
      .from("webhook_events")
      .select("*")
      .eq("status", "failed")
      .order("received_at", { ascending: true })
      .limit(Number(limit));

    if (selErr) throw selErr;

    let replayed = 0;
    let stillFailed = 0;

    for (const evt of events ?? []) {
      try {
        await processEvent(evt.payload);

        await db.from("webhook_events")
          .update({
            processed: true,
            status: "success",
            processed_at: new Date(),
            error: null,
          })
          .eq("id", evt.id);

        replayed++;
      } catch (err) {
        console.error("Replay failed:", evt.id, err.message);
        await db.from("webhook_events")
          .update({ error: `replay_attempt: ${err.message}` })
          .eq("id", evt.id);
        stillFailed++;
      }
    }

    const { count: failedCount } = await db
      .from("webhook_events")
      .select("*", { count: "exact", head: true })
      .eq("status", "failed");

    return res.json({
      ok: true,
      replayed,
      stillFailed,
      failedRemaining: failedCount ?? 0,
    });
  } catch (err) {
    return res.status(500).json({ error: "replay_failed", detail: err.message });
  }
}
