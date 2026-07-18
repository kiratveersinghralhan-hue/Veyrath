type MailOrder = {
  id: string;
  order_number: string;
  customer_name: string;
  customer_email: string;
  total_amount?: number;
  currency?: string;
  courier_name?: string | null;
  tracking_number?: string | null;
  tracking_url?: string | null;
};

const escapeHtml = (value: unknown) => String(value ?? "").replace(/[&<>"']/g, (character) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
}[character] || character));

function mailContent(order: MailOrder, kind: "payment_confirmed" | "tracking_available") {
  const name = escapeHtml(order.customer_name || "there");
  const number = escapeHtml(order.order_number);
  if (kind === "tracking_available") {
    const carrier = escapeHtml(order.courier_name || "the courier");
    const tracking = escapeHtml(order.tracking_number || "");
    const rawUrl = String(order.tracking_url || "");
    const url = /^https:\/\//i.test(rawUrl) ? rawUrl : "";
    const link = url ? `<p style="margin:24px 0"><a href="${escapeHtml(url)}" style="display:inline-block;padding:13px 18px;background:#caa966;color:#111;text-decoration:none;font-weight:700">Track your order</a></p>` : "";
    return {
      subject: `Your VEYRATH order ${order.order_number} is on its way`,
      text: `Hi ${order.customer_name}, your VEYRATH order ${order.order_number} is with ${order.courier_name || "the courier"}.${order.tracking_number ? ` Tracking: ${order.tracking_number}.` : ""}${url ? ` Track: ${url}` : ""}`,
      html: `<main style="max-width:560px;margin:auto;padding:34px;font-family:Arial,sans-serif;background:#101010;color:#f4f0e8"><p style="letter-spacing:3px;font-size:11px;color:#caa966">VEYRATH / BORN AFTER DARK</p><h1 style="font-family:Georgia,serif;font-size:32px">It is on its way.</h1><p>Hi ${name}, your order <strong>${number}</strong> is now with ${carrier}.</p>${tracking ? `<p>Tracking number: <strong>${tracking}</strong></p>` : ""}${link}<p style="color:#bdb8ae;font-size:13px">Thank you for moving after dark with VEYRATH.</p></main>`
    };
  }
  return {
    subject: `VEYRATH order ${order.order_number} is confirmed`,
    text: `Hi ${order.customer_name}, payment for VEYRATH order ${order.order_number} is confirmed. Your piece is being prepared. We will email tracking when it is dispatched.`,
    html: `<main style="max-width:560px;margin:auto;padding:34px;font-family:Arial,sans-serif;background:#101010;color:#f4f0e8"><p style="letter-spacing:3px;font-size:11px;color:#caa966">VEYRATH / BORN AFTER DARK</p><h1 style="font-family:Georgia,serif;font-size:32px">Your signal is confirmed.</h1><p>Hi ${name}, payment for order <strong>${number}</strong> is confirmed.</p><p>Your piece is being prepared. We will email you tracking as soon as it is dispatched.</p><p style="color:#bdb8ae;font-size:13px">Thank you for choosing VEYRATH.</p></main>`
  };
}

export async function sendOrderEmail(service: any, order: MailOrder, kind: "payment_confirmed" | "tracking_available") {
  const apiKey = Deno.env.get("RESEND_API_KEY") || "";
  const from = Deno.env.get("ORDER_EMAIL_FROM") || "";
  const replyTo = Deno.env.get("ORDER_EMAIL_REPLY_TO") || "";
  if (!order.customer_email || !apiKey || !from) {
    try { await service.from("order_notification_logs").insert({ order_id: order.id, kind, recipient_email: order.customer_email || "unknown", status: "skipped", error_message: "Email provider is not configured" }); } catch (_) { /* launch SQL may not be installed yet */ }
    return { sent: false, skipped: true };
  }
  try {
    const existing = await service.from("order_notification_logs").select("id").eq("order_id", order.id).eq("kind", kind).eq("status", "sent").limit(1);
    if (existing.data?.length) return { sent: false, duplicate: true };
    const content = mailContent(order, kind);
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: [order.customer_email], ...(replyTo ? { reply_to: replyTo } : {}), subject: content.subject, html: content.html, text: content.text })
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(String(payload?.message || `Email provider returned ${response.status}`));
    await service.from("order_notification_logs").insert({ order_id: order.id, kind, recipient_email: order.customer_email, provider_message_id: payload?.id || null, status: "sent" });
    return { sent: true };
  } catch (error) {
    try { await service.from("order_notification_logs").insert({ order_id: order.id, kind, recipient_email: order.customer_email, status: "failed", error_message: error instanceof Error ? error.message.slice(0, 500) : "Email failed" }); } catch (_) { /* do not block payment */ }
    console.error("order email", error);
    return { sent: false, failed: true };
  }
}
