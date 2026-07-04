import { serviceClient } from "../_shared/auth.ts";
import { corsHeaders, failure, json, parseJson } from "../_shared/http.ts";
import { fetchPrintroveOrder, printroveOrderStatus, printroveTracking } from "../_shared/printrove.ts";

function digits(value: string) {
  return value.replace(/\D/g, "").slice(-10);
}

function publicOrder(order: any) {
  return {
    order_number: order.order_number,
    payment_status: order.payment_status,
    order_status: order.order_status,
    fulfilment_status: order.fulfilment_status,
    printrove_status: order.printrove_status || "",
    courier_name: order.courier_name || "",
    tracking_number: order.tracking_number || "",
    tracking_url: order.tracking_url || "",
    created_at: order.created_at,
    paid_at: order.paid_at,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(req) });
  if (req.method !== "POST") return failure(req, "Method not allowed", 405);
  try {
    const body = await parseJson<{ order_number?: string; contact?: string }>(req);
    const orderNumber = String(body.order_number || "").trim().toUpperCase();
    const contact = String(body.contact || "").trim();
    if (!/^VYR-[A-Z0-9-]{8,30}$/.test(orderNumber) || contact.length < 3) return failure(req, "Enter a valid VEYRATH order number and checkout contact.", 400);

    const service = serviceClient();
    const { data: order, error } = await service.from("orders").select("*").eq("order_number", orderNumber).maybeSingle();
    if (error) throw error;
    const contactMatches = order && (
      String(order.customer_email || "").toLowerCase() === contact.toLowerCase()
      || digits(String(order.customer_phone || "")) === digits(contact)
    );
    if (!contactMatches) return failure(req, "No matching order found. Check the order number and checkout email or phone.", 404);

    let current = order;
    if (order.printrove_order_id && !["fulfilled", "cancelled"].includes(order.fulfilment_status)) {
      try {
        const response = await fetchPrintroveOrder(order.printrove_order_id);
        const status = printroveOrderStatus(response);
        const tracking = printroveTracking(response);
        const complete = /delivered|fulfilled|completed/i.test(status);
        const update = await service.from("orders").update({
          printrove_status: status,
          ...tracking,
          ...(complete ? { fulfilment_status: "fulfilled", order_status: "fulfilled" } : { order_status: "processing" }),
        }).eq("id", order.id).select("*").single();
        if (!update.error && update.data) current = update.data;
        await service.from("printrove_order_logs").insert({ order_id: order.id, action: "customer_tracking_sync", status: "success", response_payload: response });
      } catch (syncError) {
        console.warn("track-order Printrove refresh", syncError);
      }
    }
    return json(req, { success: true, order: publicOrder(current) });
  } catch (caught) {
    console.error("track-order", caught);
    return failure(req, caught instanceof Error ? caught.message : "Tracking is temporarily unavailable.", 500);
  }
});
