import { requireAdmin } from "../_shared/auth.ts";
import { corsHeaders, failure, isUuid, json, parseJson } from "../_shared/http.ts";
import { fetchPrintroveOrder, printroveOrderStatus } from "../_shared/printrove.ts";
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
    if (!order?.printrove_order_id) return failure(req, "This order has not been created in Printrove", 409);
    const response = await fetchPrintroveOrder(order.printrove_order_id);
    const status = String(printroveOrderStatus(response));
    const complete = /delivered|fulfilled|completed/i.test(status);
    const dispatched = /shipped|dispatch|in transit|out for delivery/i.test(status);
    const data = response?.data || response || {};
    const trackingNumber = String(data?.tracking_number || data?.awb || data?.awb_number || data?.tracking?.number || "");
    const trackingUrl = String(data?.tracking_url || data?.tracking?.url || "");
    const courier = String(data?.courier_name || data?.courier || data?.shipping_partner || "");
    const update = await service.from("orders").update({
      printrove_status: status,
      ...(trackingNumber ? { tracking_number: trackingNumber } : {}),
      ...(trackingUrl ? { tracking_url: trackingUrl } : {}),
      ...(courier ? { courier_name: courier } : {}),
      ...(dispatched ? { dispatched_at: order.dispatched_at || new Date().toISOString(), fulfilment_status: "printrove_created", order_status: "processing" } : {}),
      ...(complete ? { delivered_at: order.delivered_at || new Date().toISOString(), fulfilment_status: "fulfilled", order_status: "fulfilled" } : {})
    }).eq("id", order.id);
    if (update.error) throw update.error;
    if (trackingNumber || trackingUrl) await sendOrderEmail(service, { ...order, courier_name: courier || order.courier_name, tracking_number: trackingNumber || order.tracking_number, tracking_url: trackingUrl || order.tracking_url }, "tracking_available");
    await service.from("printrove_order_logs").insert({ order_id: order.id, action: "sync_status", status: "success", response_payload: response });
    return json(req, { success: true, printrove_status: status, response });
  } catch (caught) {
    console.error("sync-printrove-status", caught);
    const message = caught instanceof Error ? caught.message : "Could not sync Printrove status";
    return failure(req, message, /auth|admin session|active VEYRATH admin/i.test(message) ? 401 : 400);
  }
});
