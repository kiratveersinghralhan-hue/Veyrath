import { requireAdmin } from "../_shared/auth.ts";
import { corsHeaders, failure, isUuid, json, parseJson } from "../_shared/http.ts";
import { sendOrderEmail } from "../_shared/email.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(req) });
  if (req.method !== "POST") return failure(req, "Method not allowed", 405);
  try {
    const { service } = await requireAdmin(req);
    const { order_id } = await parseJson<{ order_id?: string }>(req);
    if (!isUuid(order_id)) return failure(req, "A valid order_id is required");
    const { data: order, error } = await service.from("orders").select("*").eq("id", order_id).maybeSingle();
    if (error) throw error;
    if (!order) return failure(req, "Order not found", 404);
    if (order.payment_status !== "paid") return failure(req, "Only paid orders can receive tracking updates", 409);
    if (!order.tracking_number && !order.tracking_url) return failure(req, "Add a tracking number or link first", 409);
    const result = await sendOrderEmail(service, order, "tracking_available");
    return json(req, { success: true, email: result });
  } catch (caught) {
    console.error("notify-order-tracking", caught);
    const message = caught instanceof Error ? caught.message : "Could not send the tracking update";
    return failure(req, message, /auth|admin session|active VEYRATH admin/i.test(message) ? 401 : 400);
  }
});
