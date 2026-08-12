import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.58.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });

  try {
    const secretHash = Deno.env.get("FLW_SECRET_HASH");
    const incomingHash = req.headers.get("verif-hash");
    if (secretHash && incomingHash !== secretHash) {
      return new Response(JSON.stringify({ error: "Invalid webhook signature" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const event = await req.json();
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) throw new Error("Supabase server configuration is missing");

    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const data = event.data ?? event;
    const reference = data.tx_ref ?? data.reference ?? data.transfer_reference;
    const status = String(data.status ?? "").toLowerCase();

    if (reference && (status === "successful" || status === "completed" || status === "failed")) {
      const transactionStatus = status === "successful" || status === "completed" ? "successful" : "failed";
      await supabase
        .from("transactions")
        .update({
          status: transactionStatus,
          flutterwave_payment_id: String(data.id ?? data.transfer_id ?? ""),
          completed_at: transactionStatus === "successful" ? new Date().toISOString() : null,
        })
        .eq("payment_reference", reference);
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unexpected error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
