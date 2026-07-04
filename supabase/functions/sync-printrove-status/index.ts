import { requireAdmin } from "../_shared/auth.ts";
import { corsHeaders, failure, isUuid, json, parseJson } from "../_shared/http.ts";
import { fetchPrintroveOrder, printroveOrderStatus, printroveTracking } from "../_shared/printrove.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(req) });
  if (req.method !== "POST") return failure(req, "Method not allowed", 405);
  try {
    const { service } = await requireAdmin(req);
    const { order_id } = await parseJson<{ order_id?: string }>(req);
    if (!isUuid(order_id)) return failure(req, "A valid order_id is required");
    const { data: order, error } = await service.from("orders").select("id,printrove_order_id").eq("id", order_id).maybeSingle();
    if (error) throw error;
    if (!order?.printrove_order_id) return failure(req, "This order has not been created in Printrove", 409);
    const response = await fetchPrintroveOrder(order.printrove_order_id);
    const status = String(printroveOrderStatus(response));
    const tracking = printroveTracking(response);
    const complete = /delivered|fulfilled|completed/i.test(status);
    const update = await service.from("orders").update({
      printrove_status: status,
      ...tracking,
      ...(complete ? { fulfilment_status: "fulfilled", order_status: "fulfilled" } : { order_status: "processing" }),
    }).eq("id", order.id);
    if (update.error) throw update.error;
    await service.from("printrove_order_logs").insert({ order_id: order.id, action: "sync_status", status: "success", response_payload: response });
    return json(req, { success: true, printrove_status: status, tracking, response });
  } catch (caught) {
    console.error("sync-printrove-status", caught);
    const message = caught instanceof Error ? caught.message : "Could not sync Printrove status";
    return failure(req, message, /auth|admin session|active VEYRATH admin/i.test(message) ? 401 : 400);
  }
});
