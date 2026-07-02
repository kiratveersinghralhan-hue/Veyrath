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

export function printroveOrderId(payload: any) {
  return payload?.id || payload?.order_id || payload?.data?.id || payload?.data?.order_id || payload?.order?.id || null;
}

export function printroveOrderStatus(payload: any) {
  return payload?.status || payload?.data?.status || payload?.order?.status || "created";
}

