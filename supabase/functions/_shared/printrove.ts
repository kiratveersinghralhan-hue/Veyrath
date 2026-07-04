async function responseJson(response: Response) {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.message || payload?.error || `Printrove request failed (${response.status})`);
  return payload;
}

export async function printroveToken() {
  const staticToken = Deno.env.get("PRINTROVE_API_TOKEN") || Deno.env.get("PRINTROVE_API_KEY");
  if (staticToken) return staticToken;
  const email = Deno.env.get("PRINTROVE_EMAIL") || "";
  const password = Deno.env.get("PRINTROVE_PASSWORD") || "";
  if (!email || !password) throw new Error("Set PRINTROVE_API_TOKEN or PRINTROVE_EMAIL and PRINTROVE_PASSWORD");
  const response = await fetch("https://api.printrove.com/api/external/token", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Accept": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const payload = await responseJson(response);
  const token = payload?.access_token || payload?.token || payload?.data?.token || payload?.data?.access_token;
  if (!token) throw new Error("Printrove token response did not contain an access token");
  return String(token);
}

export async function createPrintroveOrder(payload: Record<string, unknown>) {
  const token = await printroveToken();
  const response = await fetch("https://api.printrove.com/api/external/orders", {
    method: "POST",
    headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json", "Accept": "application/json" },
    body: JSON.stringify(payload),
  });
  return responseJson(response);
}

export async function fetchPrintroveOrder(orderId: string) {
  const token = await printroveToken();
  const response = await fetch(`https://api.printrove.com/api/external/orders/${encodeURIComponent(orderId)}`, {
    headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json", "Accept": "application/json" },
  });
  return responseJson(response);
}

export async function findPrintroveOrderByReference(referenceNumber: string) {
  const token = await printroveToken();
  const url = new URL("https://api.printrove.com/api/external/orders");
  url.searchParams.set("reference_number", referenceNumber);
  url.searchParams.set("per_page", "20");
  const response = await fetch(url, {
    headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json", "Accept": "application/json" },
  });
  const payload = await responseJson(response);
  const candidates = [
    ...(Array.isArray(payload) ? payload : []),
    ...(Array.isArray(payload?.data) ? payload.data : []),
    ...(Array.isArray(payload?.data?.data) ? payload.data.data : []),
    ...(Array.isArray(payload?.orders) ? payload.orders : []),
    ...(Array.isArray(payload?.data?.orders) ? payload.data.orders : []),
  ];
  return candidates.find((item: any) => String(item?.reference_number || item?.reference || "").toUpperCase() === referenceNumber.toUpperCase()) || null;
}

function deepValue(payload: any, keys: string[], depth = 0): unknown {
  if (!payload || typeof payload !== "object" || depth > 6) return undefined;
  for (const key of keys) {
    const value = payload[key];
    if (value !== undefined && value !== null && value !== "") return value;
  }
  for (const value of Object.values(payload)) {
    if (value && typeof value === "object") {
      const found = deepValue(value, keys, depth + 1);
      if (found !== undefined) return found;
    }
  }
  return undefined;
}

export function printroveOrderId(payload: any) {
  return payload?.id || payload?.order_id || payload?.data?.id || payload?.data?.order_id || payload?.order?.id || deepValue(payload, ["order_id", "id"]) || null;
}

export function printroveOrderStatus(payload: any) {
  return String(deepValue(payload, ["order_status", "status_name", "current_status", "fulfilment_status", "fulfillment_status", "status"]) || "received");
}

export function printroveTracking(payload: any) {
  return {
    tracking_number: String(deepValue(payload, ["tracking_number", "tracking_id", "awb", "awb_number"]) || ""),
    tracking_url: String(deepValue(payload, ["tracking_url", "tracking_link", "track_url"]) || ""),
    courier_name: String(deepValue(payload, ["courier_name", "courier_company", "shipping_partner", "carrier_name"]) || ""),
  };
}
