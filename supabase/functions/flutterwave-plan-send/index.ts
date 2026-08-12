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
    const secretKey = Deno.env.get("FLW_SECRET_KEY");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!secretKey) {
      throw new Error("Flutterwave is not configured");
    }
    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error("Supabase server configuration is missing");
    }

    const body = await req.json();
    const planId = String(body.planId || body.plan_id || "");
    if (!planId) {
      return new Response(JSON.stringify({ error: "Missing planId" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const { data: plan, error: planError } = await supabase
      .from("plans")
      .select("*, commitments:commitments(*, recipient:recipients(*))")
      .eq("id", planId)
      .maybeSingle();

    if (planError) throw planError;
    if (!plan) {
      return new Response(JSON.stringify({ error: "Plan not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const commitments = Array.isArray(plan.commitments) ? plan.commitments : [];
    if (!commitments.length) {
      return new Response(JSON.stringify({ success: true, total: 0, results: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const paymentReference = `plan_${planId}`;
    await supabase
      .from("transactions")
      .upsert(
        {
          plan_id: planId,
          user_id: plan.user_id,
          amount_gbp: Number(plan.total_gbp || 0),
          status: "pending",
          payment_reference: paymentReference,
        },
        { onConflict: "plan_id" }
      );

    const results: any[] = [];
    for (const commitment of commitments) {
      const recipient = commitment.recipient;
      if (!recipient) {
        throw new Error(`Missing recipient details for commitment ${commitment.id}`);
      }

      const transferAmount = Number(commitment.amount_destination || commitment.amount_gbp || 0);
      if (!recipient.account_number || !recipient.bank_code || !recipient.name || transferAmount <= 0) {
        throw new Error(`Missing transfer details for ${recipient.name || "recipient"}`);
      }

      const reference = `plan_${planId}_${commitment.id}`;
      const response = await fetch("https://api.flutterwave.com/v3/transfers", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${secretKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          account_bank: recipient.bank_code,
          account_number: recipient.account_number,
          amount: Number(transferAmount.toFixed(2)),
          currency: commitment.destination_currency || "NGN",
          beneficiary_name: recipient.name,
          narration: `Senda transfer for ${recipient.name}`,
          reference,
        }),
      });

      const payload = await response.json();
      const providerId = payload?.data?.id ?? payload?.data?.transfer_id ?? null;
      const providerStatus = payload?.data?.status ?? "pending";

      await supabase
        .from("commitments")
        .update({
          status: providerStatus === "successful" || providerStatus === "completed" ? "completed" : providerStatus === "failed" ? "failed" : "processing",
          flutterwave_transfer_id: providerId ? String(providerId) : null,
          failure_reason: providerStatus === "failed" ? payload?.message || "Transfer failed" : null,
        })
        .eq("id", commitment.id);

      results.push({
        commitmentId: commitment.id,
        recipientId: recipient.id,
        providerId,
        status: providerStatus,
        payload,
      });

      if (!response.ok || payload?.status !== "success") {
        await supabase.from("plans").update({ status: "failed" }).eq("id", planId);
      }
    }

    const allSucceeded = results.every((result) => {
      const status = String(result.status || "").toLowerCase();
      return status === "successful" || status === "completed";
    });

    await supabase
      .from("plans")
      .update({ status: allSucceeded ? "processing" : "failed" })
      .eq("id", planId);

    await supabase
      .from("transactions")
      .update({
        status: allSucceeded ? "pending" : "failed",
        payment_reference: paymentReference,
      })
      .eq("plan_id", planId);

    return new Response(JSON.stringify({ success: true, total: results.length, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unexpected error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
