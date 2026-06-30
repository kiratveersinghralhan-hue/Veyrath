import { createClient } from "npm:@supabase/supabase-js@2";

type Json = Record<string, unknown>;

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const QIKINK_CLIENT_ID = Deno.env.get("QIKINK_CLIENT_ID") ?? "";
const QIKINK_CLIENT_SECRET = Deno.env.get("QIKINK_CLIENT_SECRET") ?? "";
const QIKINK_API_BASE_URL = (Deno.env.get("QIKINK_API_BASE_URL") ?? "https://api.qikink.com").replace(/\/$/, "");
const QIKINK_TOKEN_URL = Deno.env.get("QIKINK_TOKEN_URL") ?? `${QIKINK_API_BASE_URL}/api/v1/auth/token`;
const QIKINK_ORDER_URL = Deno.env.get("QIKINK_ORDER_URL") ?? `${QIKINK_API_BASE_URL}/api/v1/orders`;
const QIKINK_AUTH_MODE = (Deno.env.get("QIKINK_AUTH_MODE") ?? "oauth").toLowerCase();

function corsHeaders(origin: string | null) {
  const configured = (Deno.env.get("ALLOWED_ORIGINS") ?? "").split(",").map((value) => value.trim()).filter(Boolean);
  const allowedOrigin = configured.length === 0 || (origin && configured.includes(origin)) ? (origin ?? "*") : "null";
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

function json(body: Json, status: number, origin: string | null) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(origin), "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });
}

async function responseBody(response: Response): Promise<Json> {
  const text = await response.text();
  if (!text) return {};
  try { return JSON.parse(text) as Json; }
  catch { return { raw: text.slice(0, 12000) }; }
}

function extractToken(payload: Json): string {
  const data = typeof payload.data === "object" && payload.data ? payload.data as Json : {};
  return String(payload.access_token ?? payload.token ?? data.access_token ?? data.token ?? "");
}

async function getQikinkAuthHeaders(): Promise<Record<string, string>> {
  if (QIKINK_AUTH_MODE === "direct") {
    return { "X-Client-Id": QIKINK_CLIENT_ID, "X-Client-Secret": QIKINK_CLIENT_SECRET };
  }

  const form = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: QIKINK_CLIENT_ID,
    client_secret: QIKINK_CLIENT_SECRET,
  });
  let response = await fetch(QIKINK_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", "Accept": "application/json" },
    body: form.toString(),
  });
  let payload = await responseBody(response);

  // Some merchant API versions accept JSON rather than OAuth form encoding.
  if (!response.ok && [400, 404, 415, 422].includes(response.status)) {
    response = await fetch(QIKINK_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify({ client_id: QIKINK_CLIENT_ID, client_secret: QIKINK_CLIENT_SECRET, grant_type: "client_credentials" }),
    });
    payload = await responseBody(response);
  }

  const token = extractToken(payload);
  if (!response.ok || !token) throw new Error(`Qikink authentication failed (${response.status}). Check the merchant API token URL and credentials.`);
  return { "Authorization": `Bearer ${token}` };
}

function buildQikinkPayload(order: Json, items: Json[]) {
  return {
    order_number: order.order_number,
    order_reference_number: order.order_number,
    shipping_type: "standard",
    payment_mode: "PREPAID",
    order_value: Number(order.total_amount),
    currency: order.currency ?? "INR",
    customer: {
      name: order.customer_name,
      phone: order.customer_phone,
      email: order.customer_email,
    },
    shipping_address: {
      name: order.customer_name,
      phone: order.customer_phone,
      email: order.customer_email,
      address1: order.address_line1,
      address2: order.address_line2 ?? "",
      city: order.city,
      state: order.state,
      pincode: order.postal_code,
      country: "IN",
    },
    line_items: items.map((item) => {
      const designs = [] as Json[];
      if (item.front_design_url) designs.push({ placement: item.print_area_front || "front", url: item.front_design_url });
      if (item.back_design_url) designs.push({ placement: item.print_area_back || "back", url: item.back_design_url });
      return {
        sku: item.qikink_sku,
        product_id: item.qikink_product_id,
        variant_id: item.qikink_variant_id,
        size: item.size,
        color: item.colour,
        quantity: Number(item.quantity),
        print_type: item.print_type,
        designs,
      };
    }),
  };
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("Origin");
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(origin) });
  if (req.method !== "POST") return json({ ok: false, error: "Method not allowed" }, 405, origin);

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) return json({ ok: false, error: "Supabase function environment is incomplete" }, 500, origin);
  if (!QIKINK_CLIENT_ID || !QIKINK_CLIENT_SECRET) return json({ ok: false, error: "Qikink credentials are not configured" }, 500, origin);

  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) return json({ ok: false, error: "Admin authentication required" }, 401, origin);

  const callerClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false } });
  const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: userData, error: userError } = await callerClient.auth.getUser();
  const user = userData?.user;
  if (userError || !user) return json({ ok: false, error: "Invalid or expired admin session" }, 401, origin);
  const { data: adminRow } = await adminClient.from("admin_users").select("user_id").eq("user_id", user.id).eq("is_active", true).maybeSingle();
  if (!adminRow) return json({ ok: false, error: "This account is not an active VEYRATH admin" }, 403, origin);

  let orderId = "";
  let attempt = 1;
  let requestPayload: Json = {};
  let providerAccepted = false;
  let acceptedQikinkOrderId = "";

  try {
    const body = await req.json() as Json;
    orderId = String(body.order_id ?? "");
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(orderId)) return json({ ok: false, error: "A valid internal order ID is required" }, 400, origin);

    const { data: order, error: orderError } = await adminClient.from("orders").select("*, order_items(*)").eq("id", orderId).maybeSingle();
    if (orderError) throw new Error(`Could not load order: ${orderError.message}`);
    if (!order) return json({ ok: false, error: "Order not found" }, 404, origin);
    if (order.payment_status !== "paid") return json({ ok: false, error: "Order payment is not verified as paid" }, 409, origin);
    if (Number(order.amount_paid) < Number(order.total_amount)) return json({ ok: false, error: "Verified amount paid is lower than the order total" }, 409, origin);
    if (order.qikink_status === "qikink_created") return json({ ok: true, already_synced: true, order_id: order.id, qikink_order_id: order.qikink_order_id }, 200, origin);
    if (order.qikink_status === "qikink_pending") return json({ ok: false, error: "This order is already being sent to Qikink" }, 409, origin);

    attempt = Number(order.qikink_attempts || 0) + 1;
    const { data: claimed, error: claimError } = await adminClient.from("orders").update({ status: "qikink_pending", qikink_status: "qikink_pending", qikink_attempts: attempt, qikink_last_error: null }).eq("id", orderId).eq("payment_status", "paid").in("qikink_status", ["not_sent", "qikink_failed"]).select("id").maybeSingle();
    if (claimError) throw new Error(`Could not claim order for sync: ${claimError.message}`);
    if (!claimed) return json({ ok: false, error: "Order sync state changed; refresh and try again" }, 409, origin);

    const items = Array.isArray(order.order_items) ? order.order_items as Json[] : [];
    if (!items.length) throw new Error("Order has no line items");
    const missing = items.filter((item) => !item.qikink_sku || !item.qikink_product_id || !item.qikink_variant_id);
    if (missing.length) throw new Error(`Qikink mapping is incomplete for: ${missing.map((item) => item.product_name).join(", ")}`);
    if (items.some((item) => !item.front_design_url && !item.back_design_url)) throw new Error("Every Qikink item needs at least one print design URL");

    requestPayload = buildQikinkPayload(order as Json, items);
    const authHeaders = await getQikinkAuthHeaders();
    const qikinkResponse = await fetch(QIKINK_ORDER_URL, {
      method: "POST",
      headers: { ...authHeaders, "Content-Type": "application/json", "Accept": "application/json", "Idempotency-Key": String(order.order_number) },
      body: JSON.stringify(requestPayload),
    });
    const qikinkPayload = await responseBody(qikinkResponse);
    if (!qikinkResponse.ok) throw Object.assign(new Error(`Qikink order creation failed (${qikinkResponse.status})`), { responsePayload: qikinkPayload, httpStatus: qikinkResponse.status });

    const resultData = typeof qikinkPayload.data === "object" && qikinkPayload.data ? qikinkPayload.data as Json : {};
    const qikinkOrderId = String(qikinkPayload.order_id ?? qikinkPayload.id ?? resultData.order_id ?? resultData.id ?? "");
    providerAccepted = true;
    acceptedQikinkOrderId = qikinkOrderId;
    await adminClient.from("qikink_order_logs").insert({ order_id: orderId, attempt_number: attempt, action: "create_order", request_payload: requestPayload, response_payload: qikinkPayload, http_status: qikinkResponse.status, success: true });
    const { error: updateError } = await adminClient.from("orders").update({ status: "qikink_created", qikink_status: "qikink_created", qikink_order_id: qikinkOrderId || null, qikink_last_error: null, qikink_synced_at: new Date().toISOString() }).eq("id", orderId);
    if (updateError) throw new Error(`Qikink accepted the order, but local status update failed: ${updateError.message}`);
    return json({ ok: true, order_id: orderId, qikink_order_id: qikinkOrderId || null, status: "qikink_created" }, 200, origin);
  } catch (error) {
    const err = error as Error & { responsePayload?: Json; httpStatus?: number };
    if (orderId) {
      if (providerAccepted) {
        await adminClient.from("orders").update({ status: "qikink_created", qikink_status: "qikink_created", qikink_order_id: acceptedQikinkOrderId || null, qikink_last_error: `Qikink accepted the order; local follow-up warning: ${err.message}`, qikink_synced_at: new Date().toISOString() }).eq("id", orderId);
        return json({ ok: false, provider_accepted: true, error: "Qikink accepted the order, but the local follow-up update needs review. Do not retry blindly.", order_id: orderId, qikink_order_id: acceptedQikinkOrderId || null, status: "qikink_created" }, 500, origin);
      }
      await adminClient.from("qikink_order_logs").insert({ order_id: orderId, attempt_number: attempt, action: "create_order", request_payload: requestPayload, response_payload: err.responsePayload ?? {}, http_status: err.httpStatus ?? null, success: false, error_message: err.message });
      await adminClient.from("orders").update({ status: "qikink_failed", qikink_status: "qikink_failed", qikink_last_error: err.message }).eq("id", orderId);
    }
    return json({ ok: false, error: err.message || "Qikink sync failed", order_id: orderId || null, status: "qikink_failed" }, 502, origin);
  }
});
