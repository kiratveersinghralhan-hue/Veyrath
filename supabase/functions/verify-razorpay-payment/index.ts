import { serviceClient } from "../_shared/auth.ts";
import { corsHeaders, failure, hmacHex, isUuid, json, parseJson, timingSafeEqual } from "../_shared/http.ts";
import { fetchRazorpayPayment } from "../_shared/razorpay.ts";
import { fulfilWithPrintrove } from "../_shared/fulfilment.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(req) });
  if (req.method !== "POST") return failure(req, "Method not allowed", 405);
  try {
    const body = await parseJson<{ order_id?: string; razorpay_order_id?: string; razorpay_payment_id?: string; razorpay_signature?: string }>(req);
    if (!isUuid(body.order_id) || !body.razorpay_order_id || !body.razorpay_payment_id || !body.razorpay_signature) return failure(req, "Incomplete payment response");
    const service = serviceClient();
    const { data: order, error } = await service.from("orders").select("*").eq("id", body.order_id).maybeSingle();
    if (error) throw error;
    if (!order) return failure(req, "Order not found", 404);
    if (order.payment_status === "paid") return json(req, { success: true, already_verified: true, order_number: order.order_number });
    if (!order.razorpay_order_id || order.razorpay_order_id !== body.razorpay_order_id) return failure(req, "Razorpay order mismatch", 400);

    const secret = Deno.env.get("RAZORPAY_KEY_SECRET") || "";
    if (!secret) throw new Error("Razorpay server secret is not configured");
    const expected = await hmacHex(`${order.razorpay_order_id}|${body.razorpay_payment_id}`, secret);
    const signatureValid = timingSafeEqual(expected, body.razorpay_signature);
    let payment: any = null;
    try { payment = await fetchRazorpayPayment(body.razorpay_payment_id); } catch (paymentError) {
      await service.from("payment_logs").insert({ order_id: order.id, event_type: "payment_verification_api_error", status: "pending", raw_payload: { message: paymentError instanceof Error ? paymentError.message : "Razorpay fetch failed" } });
      if (signatureValid) return failure(req, "Payment received but capture confirmation is pending. The webhook will update it shortly.", 409);
    }

    const paymentMatches = payment && payment.order_id === order.razorpay_order_id && Number(payment.amount) === Math.round(Number(order.total_amount) * 100) && payment.currency === order.currency;
    if (!signatureValid || !paymentMatches) {
      await service.from("payment_logs").insert({ order_id: order.id, event_type: "payment_verification_failed", status: "rejected", raw_payload: { payment_id: body.razorpay_payment_id, signature_valid: signatureValid, payment_matches: Boolean(paymentMatches) } });
      if (paymentMatches) await service.from("orders").update({ payment_status: "failed", order_status: "payment_failed" }).eq("id", order.id).eq("payment_status", "pending");
      return failure(req, "Payment verification failed", 400);
    }
    if (payment.status !== "captured") {
      await service.from("payment_logs").insert({ order_id: order.id, event_type: "payment_not_captured", status: String(payment.status), raw_payload: payment });
      return failure(req, "Payment is authenticated but not captured yet. Enable automatic capture or wait for the webhook.", 409);
    }

    const paid = await service.from("orders").update({ payment_status: "paid", order_status: "paid", razorpay_payment_id: body.razorpay_payment_id, razorpay_signature: body.razorpay_signature, amount_paid: Number(payment.amount) / 100, paid_at: new Date().toISOString() }).eq("id", order.id).neq("payment_status", "paid").select("id").maybeSingle();
    if (paid.error) throw paid.error;
    await service.from("payment_logs").insert({ order_id: order.id, event_type: "payment_verified", status: "paid", raw_payload: payment });

    let autoFulfilment: unknown = null;
    const { data: commerce } = await service.from("site_settings").select("value").eq("key", "commerce").maybeSingle();
    if (commerce?.value?.auto_send_to_printrove === true) {
      try { autoFulfilment = await fulfilWithPrintrove(service, order.id); }
      catch (fulfilmentError) { autoFulfilment = { error: fulfilmentError instanceof Error ? fulfilmentError.message : "Auto-send failed" }; }
    }
    return json(req, { success: true, order_number: order.order_number, payment_status: "paid", auto_fulfilment: autoFulfilment });
  } catch (caught) {
    console.error("verify-razorpay-payment", caught);
    return failure(req, caught instanceof Error ? caught.message : "Could not verify payment", 500);
  }
});

