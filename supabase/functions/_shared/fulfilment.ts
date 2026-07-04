import { createPrintroveOrder, findPrintroveOrderByReference, printroveOrderId, printroveOrderStatus, printroveTracking } from "./printrove.ts";

async function linkExistingPrintroveOrder(service: any, order: any, response: any, action: string) {
  const externalId = printroveOrderId(response);
  if (!externalId) return null;
  const tracking = printroveTracking(response);
  const update = await service.from("orders").update({
    fulfilment_status: "printrove_created",
    printrove_order_id: String(externalId),
    printrove_status: printroveOrderStatus(response),
    order_status: "processing",
    ...tracking,
  }).eq("id", order.id);
  if (update.error) throw update.error;
  await service.from("printrove_order_logs").insert({
    order_id: order.id,
    action,
    status: "success",
    response_payload: response,
  });
  return { already_created: action !== "create_order", printrove_order_id: String(externalId), response };
}

export async function fulfilWithPrintrove(service: any, orderId: string) {
  const { data: order, error } = await service.from("orders").select("*,order_items(*)").eq("id", orderId).maybeSingle();
  if (error) throw error;
  if (!order) throw new Error("Order not found");
  if (order.payment_status !== "paid") throw new Error("Only paid orders can be sent to Printrove");
  if (order.admin_hold) throw new Error("This order is on manual hold");
  if (order.printrove_order_id || order.fulfilment_status === "printrove_created") return { already_created: true, order };
  if (!Array.isArray(order.order_items) || !order.order_items.length) throw new Error("Order has no items");

  // A network timeout can hide a successful earlier create. Search by VEYRATH's
  // unique order number before every retry so the same shirt is never ordered twice.
  try {
    const existing = await findPrintroveOrderByReference(order.order_number);
    if (existing) return await linkExistingPrintroveOrder(service, order, existing, "reconcile_by_reference");
  } catch (lookupError) {
    console.warn("Printrove preflight lookup failed; continuing with idempotent reference", lookupError);
  }

  const claim = await service.from("orders").update({ fulfilment_status: "printrove_pending", printrove_status: "sending" })
    .eq("id", orderId).in("fulfilment_status", ["not_sent", "printrove_failed"]).select("id").maybeSingle();
  if (claim.error) throw claim.error;
  if (!claim.data) throw new Error("Order is already being sent to Printrove");

  const orderProducts = order.order_items.map((item: any) => {
    const variantId = Number(item.printrove_variant_id);
    const productId = Number(item.printrove_product_id);
    if (!Number.isInteger(variantId) || variantId <= 0) throw new Error(`Missing Printrove variant mapping for ${item.product_name} (${item.colour} / ${item.size})`);
    return {
      ...(Number.isInteger(productId) && productId > 0 ? { product_id: productId } : {}),
      variant_id: variantId,
      quantity: item.quantity,
      is_plain: false,
    };
  });

  const payload = {
    reference_number: order.order_number,
    retail_price: Number(order.total_amount),
    customer: {
      name: order.customer_name,
      email: order.customer_email,
      number: Number(order.customer_phone),
      address1: order.address_line1.slice(0, 50),
      address2: (order.address_line2 || order.city).slice(0, 50),
      address3: order.address_line2 ? order.city.slice(0, 50) : undefined,
      pincode: Number(order.pincode),
      state: order.state,
      city: order.city,
      country: order.country || "India",
    },
    order_products: orderProducts,
    cod: false,
  };

  try {
    const response = await createPrintroveOrder(payload);
    await service.from("printrove_order_logs").insert({ order_id: orderId, action: "create_order", status: "success", request_payload: payload, response_payload: response });
    const linked = await linkExistingPrintroveOrder(service, order, response, "link_created_order");
    if (!linked) throw new Error("Printrove accepted the request but did not return an order ID");
    return { ...linked, already_created: false };
  } catch (caught) {
    // If Printrove created the order but the response was lost, recover it by
    // reference instead of exposing a retry button that could duplicate it.
    try {
      const recovered = await findPrintroveOrderByReference(order.order_number);
      if (recovered) return await linkExistingPrintroveOrder(service, order, recovered, "recover_after_create_error");
    } catch (recoveryError) {
      console.warn("Printrove recovery lookup failed", recoveryError);
    }
    const message = caught instanceof Error ? caught.message : "Unknown Printrove error";
    await service.from("printrove_order_logs").insert({ order_id: orderId, action: "create_order", status: "failed", request_payload: payload, response_payload: {}, error_message: message });
    await service.from("orders").update({ fulfilment_status: "printrove_failed", printrove_status: message.slice(0, 500) }).eq("id", orderId);
    throw caught;
  }
}
