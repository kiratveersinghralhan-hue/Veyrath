import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

function required(name: string) {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing server secret: ${name}`);
  return value;
}

export function serviceClient() {
  return createClient(required("SUPABASE_URL"), required("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function requireAdmin(req: Request) {
  const authorization = req.headers.get("authorization") || "";
  if (!authorization.toLowerCase().startsWith("bearer ")) throw new Error("Admin authentication required");
  const userClient = createClient(required("SUPABASE_URL"), required("SUPABASE_ANON_KEY"), {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData.user) throw new Error("Invalid or expired admin session");
  const service = serviceClient();
  const { data: admin, error } = await service.from("admin_users").select("user_id").eq("user_id", userData.user.id).eq("is_active", true).maybeSingle();
  if (error || !admin) throw new Error("This user is not an active VEYRATH admin");
  return { user: userData.user, service };
}

