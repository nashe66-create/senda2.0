import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const body = req.method === "GET" ? {} : await req.json();
    const source = String(body.source_currency ?? "GBP").toUpperCase();
    const destination = String(body.destination_currency ?? "NGN").toUpperCase();
    const secretKey = Deno.env.get("FLW_SECRET_KEY");

    if (!secretKey) {
      return new Response(JSON.stringify({ error: "Flutterwave is not configured" }), {
        status: 503,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const response = await fetch("https://api.flutterwave.com/v3/rates", {
      method: "POST",
      headers: { Authorization: `Bearer ${secretKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ amount: 1, destination_currency: destination, source_currency: source }),
    });
    const data = await response.json();

    if (!response.ok || data.status !== "success") {
      return new Response(JSON.stringify({ error: data.message ?? "Unable to fetch exchange rate" }), {
        status: response.status || 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({
      source_currency: source,
      destination_currency: destination,
      rate: data.data?.rate ?? data.data?.rate_card?.rate,
      provider: "flutterwave",
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unexpected error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
