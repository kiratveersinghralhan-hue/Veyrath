export const allowedOrigins = new Set([
  "https://kiratveersinghralhan-hue.github.io",
  "http://localhost:5500",
  "http://127.0.0.1:5500",
  "http://localhost:8000",
  "http://127.0.0.1:8000",
]);

export function corsHeaders(req: Request) {
  const origin = req.headers.get("origin") || "";
  const configured = (Deno.env.get("SITE_URL") || "").replace(/\/$/, "");
  const allowed = allowedOrigins.has(origin) || (configured && origin === configured);
  return {
    "Access-Control-Allow-Origin": allowed ? origin : "https://kiratveersinghralhan-hue.github.io",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-razorpay-signature, x-razorpay-event-id",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  };
}

export function json(req: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(req), "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });
}

export function failure(req: Request, message: string, status = 400, details?: unknown) {
  return json(req, { success: false, error: message, ...(details ? { details } : {}) }, status);
}

export async function parseJson<T = Record<string, unknown>>(req: Request): Promise<T> {
  try { return await req.json(); } catch { throw new Error("Invalid JSON request body"); }
}

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export async function hmacHex(message: string, secret: string) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const bytes = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message)));
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function timingSafeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i += 1) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return mismatch === 0;
}

