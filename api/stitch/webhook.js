import { db } from "../../lib/db.js";
import crypto from "crypto";
import { createHmac, timingSafeEqual } from "node:crypto";

const ACCEPTED_EVENT_TYPES = new Set([
  "payment_initiation_request.completed",
  "payment_initiation_request.cancelled",
  "payment_initiation_request.expired",
  "payment_initiation_request.pending",
  "payment.paid",
  "payment.completed",
  "payment.cancelled",
  "payment.expired",
  "payment.pending",
  "payment.initiated",
  "payment.created",
  "subscription.paid",
  "subscription.completed",
  "subscription.cancelled",
  "subscription.expired",
  "subscription.pending",
  "link.paid",
  "link.completed",
  "link.cancelled",
  "link.expired",
  "link.pending",
]);

// =========================
// SIGNATURE VERIFY
// =========================

async function readRawBody(req) {
  if (typeof req.rawBody === "string" || Buffer.isBuffer(req.rawBody))
    return Buffer.from(req.rawBody);
  if (typeof req.body === "string" || Buffer.isBuffer(req.body))
    return Buffer.from(req.body);
  const chunks = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks);
}

function safeEqual(left, right) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

function header(req, name) {
  const value = req.headers[name] || req.headers[name.toLowerCase()];
  return Array.isArray(value) ? value[0] : value;
}

function normalizeSecret(secret) {
  return secret.startsWith("whsec_")
    ? Buffer.from(secret.slice(6), "base64")
    : secret;
}

function webhookSecrets() {
  return [process.env.STITCH_WEBHOOK_SECRET, process.env.STITCH_ENDPOINT_SIGNING_SECRET]
    .filter(Boolean);
}

function verifySignature(req, rawBody) {
  const secrets = webhookSecrets();
  if (secrets.length === 0) return { ok: false, error: "missing_webhook_secret" };

  const directSignature =
    header(req, "stitch-signature") ||
    header(req, "x-stitch-signature") ||
    header(req, "x-webhook-signature");

  if (directSignature) {
    const normalized = String(directSignature).replace(/^sha256=/, "");
    for (const secret of secrets) {
      const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
      if (safeEqual(expected, normalized)) return { ok: true };
    }
  }

  const svixId = header(req, "svix-id");
  const svixTimestamp = header(req, "svix-timestamp");
  const svixSignature = header(req, "svix-signature");

  if (svixId && svixTimestamp && svixSignature) {
    const timestampMs = Number(svixTimestamp) * 1000;
    if (
      !Number.isFinite(timestampMs) ||
      Math.abs(Date.now() - timestampMs) > 5 * 60 * 1000
    ) {
      return { ok: false, error: "stale_signature" };
    }

    const signedContent = Buffer.concat([
      Buffer.from(`${svixId}.${svixTimestamp}.`),
      rawBody,
    ]);

    const signatures = String(svixSignature)
      .split(" ")
      .flatMap((entry) => entry.split(","))
      .map((entry) => entry.replace(/^v\d+=/, ""));

    for (const secret of secrets) {
      const expected = createHmac("sha256", normalizeSecret(secret))
        .update(signedContent)
        .digest("base64");
      if (signatures.some((signature) => safeEqual(expected, signature)))
        return { ok: true };
    }
  }

  return { ok: false, error: directSignature ? "invalid_signature" : "missing_signature" };
}

// =========================
// PAYMENT / EVENT EXTRACTION
// =========================

function buildEventType(rawType, status) {
  if (!rawType) return "unknown";
  return `${rawType.toLowerCase()}.${(status || "").toLowerCase() || "unknown"}`;
}

function extractPayment(event) {
  const stripHexPrefix = (v) =>
    String(v).startsWith("0x") ? String(v).slice(2) : v;
  const rawType = event.type || event.eventType || "";
  const isSub = rawType.toLowerCase().includes("subscription");
  const isLink = rawType.toLowerCase().includes("link");
  const payment = event.payment || event.data || event;
  const resolvedStatus =
    payment.status ||
    payment.state?.__typename ||
    payment.state ||
    payment.subscriptionStatus ||
    payment.linkStatus ||
    payment.subscriptionStatus ||
    event.status ||
    rawType ||
    "unknown";
  return {
    type: buildEventType(rawType, resolvedStatus),
    eventResource: rawType || payment.type || "unknown",
    id:
      event.id ||
      payment.id ||
      payment.paymentRequestId ||
      payment.subscriptionId ||
      payment.linkId ||
      stripHexPrefix(event.consentId) ||
      null,
    status: resolvedStatus,
    reference:
      payment.clientReference ||
      payment.payerReference ||
      payment.beneficiaryReference ||
      payment.reference ||
      payment.consentId ||
      event.consentId ||
      payment.id ||
      null,
    amount: isSub || isLink ? payment.amount || event.amount || null : null,
  };
}

// =========================
// BUSINESS LOGIC — exported for replay endpoint
// =========================
export async function processEvent(event) {
  const rawType = event.type || event.eventType || "";
  const payment = event.payment || event.data || event;
  const resourceId =
    event.id ||
    payment.id ||
    payment.paymentRequestId ||
    payment.subscriptionId ||
    payment.linkId ||
    null;

  if (
    rawType.toLowerCase().includes("subscription") ||
    rawType.toLowerCase() === "subscription"
  ) {
    await db.from("subscriptions").upsert(
      {
        stitch_id: resourceId,
        status: "active",
        user_id: payment.userId || payment.user_id || null,
      },
      { onConflict: "stitk_id" }
    );
  }

  if (rawType.toLowerCase().startsWith("payment") || rawType.toLowerCase().includes("payment")) {
    const isSuccess =
      ["success", "paid", "completed"].includes(
        (payment.status || "").toLowerCase()
      );
    await db.from("payments").insert({
      stitch_payment_id: resourceId,
      amount: payment.amount || null,
      currency: payment.currency || null,
      status: payment.status || rawType || "unknown",
    });
  }

  return "processed";
}

// =========================
// MAIN HANDLER
// =========================

export const config = {
  api: { bodyParser: false },
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res
      .status(405)
      .json({ ok: false, error: "method_not_allowed", allowed: ["POST"] });
  }

  let rawBody;
  try {
    rawBody = await readRawBody(req);
  } catch {
    return res.status(400).json({ ok: false, error: "cannot_read_body" });
  }

  // ── Signature check
  const verification = verifySignature(req, rawBody);
  if (!verification.ok)
    return res.status(401).json({ ok: false, error: verification.error });

  let event;
  try {
    event = JSON.parse(rawBody.toString("utf8") || "{}");
  } catch {
    return res.status(400).json({ ok: false, error: "invalid_json" });
  }

  // ── Extract event fingerprint
  const svixId = header(req, "svix-id") || crypto.randomUUID();
  const rawType = event.type || event.eventType || "";
  const paymentMeta = extractPayment(event);

  // ── Persist event first (idempotent on eventId)
  try {
    const { data: existing } = await db
      .from("webhook_events")
      .select("id, processed, status")
      .eq("id", svixId)
      .single();

    if (existing?.processed) {
      return res.status(200).json({
        ok: true,
        rail: "stitch",
        duplicate: true,
        eventId: svixId,
      });
    }

    if (!existing) {
      await db.from("webhook_events").insert({
        id: svixId,
        event_type: rawType,
        payload: event,
        status: "pending",
      });
    }

    // ── Persist payment row inline
    if (
      rawType.toLowerCase().startsWith("payment") ||
      rawType.toLowerCase().includes("payment")
    ) {
      const resourceId =
        event.id ||
        (event.payment || event.data || {}).id ||
        (event.payment || event.data || {}).paymentRequestId ||
        null;
      try {
        await db.from("payments").insert({
          stitch_payment_id: resourceId,
          amount: (event.payment || event.data || {}).amount || null,
          currency: (event.payment || event.data || {}).currency || null,
          status: (event.payment || event.data || {}).status || rawType || "unknown",
        });
      } catch {
        // duplicate key / unique violation — safe to ignore
      }
    }
  } catch (dbErr) {
    console.error("DB write failed:", dbErr);
  }

  // ── Route acceptance
  const accepted =
    ACCEPTED_EVENT_TYPES.has(paymentMeta.type) ||
    paymentMeta.type.startsWith("payment");
  if (!accepted) {
    try {
      await db.from("webhook_events").update({
        processed: true,
        processed_at: new Date(),
        status: "skipped",
      }).eq("id", svixId);
    } catch {}

    return res.status(202).json({
      ok: true,
      rail: "stitch",
      received: true,
      ignored: true,
      eventType: paymentMeta.eventResource || paymentMeta.type,
    });
  }

  // ── Process business logic
  let status = "success";
  try {
    await processEvent(event);
  } catch (procErr) {
    console.error("Processing failed:", procErr);
    status = "failed";
  }

  // ── Update event record
  try {
    await db.from("webhook_events")
      .update({
        processed: true,
        processed_at: new Date(),
        status,
        error: status === "failed" ? "processing_error" : null,
      })
      .eq("id", svixId);
  } catch {}

  return res.status(202).json({
    ok: true,
    rail: "stitch",
    received: true,
    processed: status === "success",
    eventType: paymentMeta.type,
    eventResource: paymentMeta.eventResource,
    paymentId: paymentMeta.id,
    status: paymentMeta.status,
    reference: paymentMeta.reference,
    idempotencyKey: paymentMeta.id || paymentMeta.reference,
    ...(paymentMeta.amount ? { amount: paymentMeta.amount } : {}),
  });
}
