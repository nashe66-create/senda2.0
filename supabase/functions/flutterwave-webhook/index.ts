import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.58.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

/**
 * Verify Flutterwave's current webhook signature.
 *
 * Flutterwave signs the RAW request body using HMAC-SHA256
 * with your webhook secret hash and sends the result in:
 *
 * flutterwave-signature
 */
async function verifyFlutterwaveSignature(
  rawBody: string,
  signature: string,
  secretHash: string,
): Promise<boolean> {
  const encoder =
    new TextEncoder();

  const keyData =
    encoder.encode(secretHash);

  const bodyData =
    encoder.encode(rawBody);

  const cryptoKey =
    await crypto.subtle.importKey(
      "raw",
      keyData,
      {
        name: "HMAC",
        hash: "SHA-256",
      },
      false,
      ["sign"],
    );

  const signatureBuffer =
    await crypto.subtle.sign(
      "HMAC",
      cryptoKey,
      bodyData,
    );

  const signatureBytes =
    new Uint8Array(
      signatureBuffer,
    );

  // Convert to Base64
  let binary = "";

  for (
    const byte of signatureBytes
  ) {
    binary += String.fromCharCode(
      byte,
    );
  }

  const expectedSignature =
    btoa(binary);

  return (
    expectedSignature ===
    signature
  );
}

Deno.serve(async (req: Request) => {
  // ========================================================
  // CORS
  // ========================================================

  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  // Flutterwave webhooks should be POST
  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({
        error:
          "Method not allowed",
      }),
      {
        status: 405,
        headers: {
          ...corsHeaders,
          "Content-Type":
            "application/json",
        },
      },
    );
  }

  try {
    // ======================================================
    // STEP 1
    // Read RAW body
    //
    // This is important because the signature is calculated
    // against the raw request body.
    // ======================================================

    const rawBody =
      await req.text();

    if (!rawBody) {
      return new Response(
        JSON.stringify({
          error:
            "Empty webhook body",
        }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type":
              "application/json",
          },
        },
      );
    }

    // ======================================================
    // STEP 2
    // Get webhook secret
    // ======================================================

    const secretHash =
      Deno.env.get(
        "FLW_SECRET_HASH",
      );

    if (!secretHash) {
      console.error(
        "FLW_SECRET_HASH is not configured",
      );

      return new Response(
        JSON.stringify({
          error:
            "Webhook security is not configured",
        }),
        {
          status: 503,
          headers: {
            ...corsHeaders,
            "Content-Type":
              "application/json",
          },
        },
      );
    }

    // ======================================================
    // STEP 3
    // Verify Flutterwave signature
    // ======================================================

    const signature =
      req.headers.get(
        "flutterwave-signature",
      );

    if (!signature) {
      console.error(
        "Missing flutterwave-signature header",
      );

      return new Response(
        JSON.stringify({
          error:
            "Missing webhook signature",
        }),
        {
          status: 401,
          headers: {
            ...corsHeaders,
            "Content-Type":
              "application/json",
          },
        },
      );
    }

    const validSignature =
      await verifyFlutterwaveSignature(
        rawBody,
        signature,
        secretHash,
      );

    if (!validSignature) {
      console.error(
        "Invalid Flutterwave webhook signature",
      );

      return new Response(
        JSON.stringify({
          error:
            "Invalid webhook signature",
        }),
        {
          status: 401,
          headers: {
            ...corsHeaders,
            "Content-Type":
              "application/json",
          },
        },
      );
    }

    // ======================================================
    // STEP 4
    // Parse webhook
    // ======================================================

    let event: any;

    try {
      event =
        JSON.parse(rawBody);
    } catch {
      return new Response(
        JSON.stringify({
          error:
            "Invalid JSON webhook payload",
        }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type":
              "application/json",
          },
        },
      );
    }

    // ======================================================
    // STEP 5
    // Extract event
    // ======================================================

    const eventType =
      String(
        event?.type ?? "",
      ).toLowerCase();

    const webhookId =
      event?.id ??
      event?.webhook_id ??
      null;

    const data =
      event?.data ??
      {};

    const transferId =
      data?.id ??
      data?.transfer_id ??
      null;

    const reference =
      data?.reference ??
      data?.tx_ref ??
      data?.transfer_reference ??
      null;

    const status =
      String(
        data?.status ??
          "",
      ).toUpperCase();

    console.log(
      "Flutterwave webhook received:",
      JSON.stringify({
        event_type:
          eventType,
        webhook_id:
          webhookId,
        transfer_id:
          transferId,
        reference:
          reference,
        status:
          status,
      }),
    );

    // ======================================================
    // STEP 6
    // Supabase
    // ======================================================

    const supabaseUrl =
      Deno.env.get(
        "SUPABASE_URL",
      );

    const serviceRoleKey =
      Deno.env.get(
        "SUPABASE_SERVICE_ROLE_KEY",
      );

    if (
      !supabaseUrl ||
      !serviceRoleKey
    ) {
      throw new Error(
        "Supabase server configuration is missing",
      );
    }

    const supabase =
      createClient(
        supabaseUrl,
        serviceRoleKey,
      );

    // ======================================================
    // STEP 7
    // Handle transfer events
    // ======================================================

    const isTransferEvent =
      eventType ===
        "transfer.disburse" ||
      eventType ===
        "transfer.reversal" ||
      Boolean(
        transferId,
      );

    if (
      isTransferEvent &&
      reference
    ) {
      let transactionStatus:
        | "successful"
        | "failed"
        | null =
        null;

      if (
        status ===
          "SUCCESSFUL" ||
        status ===
          "COMPLETED"
      ) {
        transactionStatus =
          "successful";
      }

      if (
        status ===
          "FAILED" ||
        status ===
          "CANCELLED"
      ) {
        transactionStatus =
          "failed";
      }

      if (
        transactionStatus
      ) {
        const updateData: Record<
          string,
          unknown
        > = {
          status:
            transactionStatus,

          flutterwave_payment_id:
            transferId
              ? String(
                  transferId,
                )
              : null,
        };

        if (
          transactionStatus ===
          "successful"
        ) {
          updateData.completed_at =
            new Date().toISOString();
        }
        
        const {
          error,
        } =
          await supabase
            .from(
              "transactions",
            )
            .update(
              updateData,
            )
            .eq(
              "payment_reference",
              reference,
            );

        if (error) {
          console.error(
            "Failed to update transaction:",
            error,
          );

          throw error;
        }

        console.log(
          "Transaction updated:",
          JSON.stringify({
            reference:
              reference,
            transfer_id:
              transferId,
            status:
              transactionStatus,
          }),
        );
      }
    }

    // ======================================================
    // STEP 8
    // Always acknowledge successfully AFTER processing
    // ======================================================

    return new Response(
      JSON.stringify({
        received: true,
        event_type:
          eventType,
        webhook_id:
          webhookId,
        transfer_id:
          transferId,
        reference:
          reference,
        status:
          status,
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type":
            "application/json",
        },
      },
    );
  } catch (error) {
    console.error(
      "Flutterwave webhook error:",
      error,
    );

    return new Response(
      JSON.stringify({
        error:
          error instanceof Error
            ? error.message
            : "Unexpected error",
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type":
            "application/json",
        },
      },
    );
  }
});