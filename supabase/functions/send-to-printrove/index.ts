import { requireAdmin } from "../_shared/auth.ts";
import { corsHeaders, failure, isUuid, json, parseJson } from "../_shared/http.ts";
import { fulfilWithPrintrove } from "../_shared/fulfilment.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(req) });
  if (req.method !== "POST") return failure(req, "Method not allowed", 405);
  try {
    const { service } = await requireAdmin(req);
    const { order_id } = await parseJson<{ order_id?: string }>(req);
    if (!isUuid(order_id)) return failure(req, "A valid order_id is required");
    const result = await fulfilWithPrintrove(service, order_id);
    return json(req, { success: true, ...result });
  } catch (caught) {
    console.error("send-to-printrove", caught);
    const message = caught instanceof Error ? caught.message : "Could not send order to Printrove";
    return failure(req, message, /auth|admin session|active VEYRATH admin/i.test(message) ? 401 : 400);
  }
});

