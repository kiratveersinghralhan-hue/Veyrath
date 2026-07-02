import { serviceClient } from "../_shared/auth.ts";
import { corsHeaders, failure, isUuid, json, parseJson } from "../_shared/http.ts";
import { createRazorpayOrder, publicRazorpayKey } from "../_shared/razorpay.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(req) });
  if (req.method !== "POST") return failure(req, "Method not allowed", 405);
  try {
    const { order_id } = await parseJson<{ order_id?: string }>(req);
    if (!isUuid(order_id)) return failure(req, "A valid order_id is required");
    const service = serviceClient();
    const { data: order, error } = await service.from("orders").select("*,order_items(*)").eq("id", order_id).maybeSingle();
    if (error) throw error;
    if (!order) return failure(req, "Order not found", 404);
    if (order.payment_status === "paid") return failure(req, "Order is already paid", 409);
    if (order.payment_status !== "pending") return failure(req, "Order is not payable", 409);
    if (!Array.isArray(order.order_items) || !order.order_items.length) return failure(req, "Order has no items", 409);

    // A repeated request returns the original Razorpay order instead of charging twice.
    if (order.razorpay_order_id) {
      return json(req, { success: true, razorpay_order_id: order.razorpay_order_id, amount: Math.round(Number(order.total_amount) * 100), currency: order.currency, key_id: publicRazorpayKey(), order_number: order.order_number });
    }

    let subtotal = 0;
    let shipping = 0;
    for (const item of order.order_items) {
      const { data: product, error: productError } = await service.from("products").select("price,selling_price,shipping_cost,is_published").eq("id", item.product_id).maybeSingle();
      if (productError || !product || !product.is_published) return failure(req, `Product ${item.product_name} is unavailable`, 409);
      const unitPrice = Number(product.selling_price) > 0 ? Number(product.selling_price) : Number(product.price);
      subtotal += unitPrice * Number(item.quantity);
      shipping = Math.max(shipping, Number(product.shipping_cost) || 0);
      if (Number(item.unit_price) !== unitPrice || Number(item.total_price) !== unitPrice * Number(item.quantity)) {
        const itemUpdate = await service.from("order_items").update({ unit_price: unitPrice, total_price: unitPrice * Number(item.quantity) }).eq("id", item.id);
        if (itemUpdate.error) throw itemUpdate.error;
      }
    }
    const { data: commerce } = await service.from("site_settings").select("value").eq("key", "commerce").maybeSingle();
    const freeThreshold = Number(commerce?.value?.free_shipping_threshold ?? 1999);
    if (subtotal >= freeThreshold) shipping = 0;
    const total = subtotal + shipping;
    const amount = Math.round(total * 100);
    if (!Number.isSafeInteger(amount) || amount < 100) return failure(req, "Order amount is invalid", 409);

    const razorpay = await createRazorpayOrder({
      amount,
      currency: order.currency || "INR",
      receipt: String(order.order_number).slice(0, 40),
      notes: { veyrath_order_id: order.id, veyrath_order_number: order.order_number },
    });
    const update = await service.from("orders").update({ subtotal, shipping_amount: shipping, total_amount: total, razorpay_order_id: razorpay.id, order_status: "payment_verification" }).eq("id", order.id).is("razorpay_order_id", null).select("id").maybeSingle();
    if (update.error) throw update.error;
    if (!update.data) return failure(req, "A payment session was already created. Please retry.", 409);
    await service.from("payment_logs").insert({ order_id: order.id, event_type: "razorpay_order_created", status: "created", raw_payload: razorpay });
    return json(req, { success: true, razorpay_order_id: razorpay.id, amount: razorpay.amount, currency: razorpay.currency, key_id: publicRazorpayKey(), order_number: order.order_number });
  } catch (caught) {
    console.error("create-razorpay-order", caught);
    return failure(req, caught instanceof Error ? caught.message : "Could not create payment order", 500);
  }
});

