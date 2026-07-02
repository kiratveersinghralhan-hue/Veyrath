function credentials() {
  const keyId = Deno.env.get("RAZORPAY_KEY_ID") || "";
  const keySecret = Deno.env.get("RAZORPAY_KEY_SECRET") || "";
  if (!keyId || !keySecret) throw new Error("Razorpay server secrets are not configured");
  return { keyId, keySecret };
}

async function razorpayRequest(path: string, init: RequestInit = {}) {
  const { keyId, keySecret } = credentials();
  const response = await fetch(`https://api.razorpay.com/v1${path}`, {
    ...init,
    headers: {
      "Authorization": `Basic ${btoa(`${keyId}:${keySecret}`)}`,
      "Content-Type": "application/json",
      "Accept": "application/json",
      ...(init.headers || {}),
    },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.error?.description || payload?.error?.reason || `Razorpay request failed (${response.status})`);
  return payload;
}

export function publicRazorpayKey() {
  return credentials().keyId;
}

export function createRazorpayOrder(input: { amount: number; currency: string; receipt: string; notes?: Record<string, string> }) {
  return razorpayRequest("/orders", { method: "POST", body: JSON.stringify(input) });
}

export function fetchRazorpayPayment(paymentId: string) {
  return razorpayRequest(`/payments/${encodeURIComponent(paymentId)}`, { method: "GET" });
}

