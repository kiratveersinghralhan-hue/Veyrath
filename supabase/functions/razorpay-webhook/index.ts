import { serviceClient } from "../_shared/auth.ts";
import { failure, hmacHex, json, timingSafeEqual } from "../_shared/http.ts";
import { fulfilWithPrintrove } from "../_shared/fulfilment.ts";

Deno.serve(async (req) => {
  if (req.method !== "POST") return failure(req, "Method not allowed", 405);
  try {
    const raw = await req.text();
    const receivedSignature = req.headers.get("x-razorpay-signature") || "";
    const secret = Deno.env.get("RAZORPAY_WEBHOOK_SECRET") || "";
    if (!secret) throw new Error("Razorpay webhook secret is not configured");
    const expected = await hmacHex(raw, secret);
    if (!receivedSignature || !timingSafeEqual(expected, receivedSignature)) return failure(req, "Invalid webhook signature", 401);
    const payload = JSON.parse(raw);
    const eventType = String(payload?.event || "unknown");
    const eventId = req.headers.get("x-razorpay-event-id") || null;
    const payment = payload?.payload?.payment?.entity;
    const razorpayOrder = payload?.payload?.order?.entity;
    const razorpayOrderId = payment?.order_id || razorpayOrder?.id;
    const service = serviceClient();

    if (eventId) {
      const { data: existing } = await service.from("payment_logs").select("id").eq("provider_event_id", eventId).maybeSingle();
      if (existing) return json(req, { success: true, duplicate: true });
    }
    const { data: order } = razorpayOrderId ? await service.from("orders").select("*").eq("razorpay_order_id", razorpayOrderId).maybeSingle() : { data: null };
    await service.from("payment_logs").insert({ order_id: order?.id || null, event_type: eventType, provider_event_id: eventId, status: "received", raw_payload: payload });
    if (!order) return json(req, { success: true, matched: false });

    if ((eventType === "payment.captured" || eventType === "order.paid") && order.payment_status !== "paid") {
      const amount = Number(payment?.amount ?? razorpayOrder?.amount_paid ?? 0);
      const currency = String(payment?.currency ?? razorpayOrder?.currency ?? "");
      if (amount === Math.round(Number(order.total_amount) * 100) && currency === order.currency) {
        await service.from("orders").update({ payment_status: "paid", order_status: "paid", razorpay_payment_id: payment?.id || order.razorpay_payment_id, amount_paid: amount / 100, paid_at: new Date().toISOString() }).eq("id", order.id).neq("payment_status", "paid");
        const { data: commerce } = await service.from("site_settings").select("value").eq("key", "commerce").maybeSingle();
        if (commerce?.value?.auto_send_to_printrove === true) {
          try { await fulfilWithPrintrove(service, order.id); } catch (fulfilmentError) { console.error("razorpay-webhook auto fulfilment", fulfilmentError); }
        }
      }
    } else if (eventType === "payment.failed" && order.payment_status === "pending") {
      await service.from("orders").update({ payment_status: "failed", order_status: "payment_failed", razorpay_payment_id: payment?.id || null }).eq("id", order.id).eq("payment_status", "pending");
    }
    return json(req, { success: true, matched: true });
  } catch (caught) {
    console.error("razorpay-webhook", caught);
    return failure(req, caught instanceof Error ? caught.message : "Webhook processing failed", 500);
  }
});
