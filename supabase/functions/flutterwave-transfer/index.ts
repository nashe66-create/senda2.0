import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

const TOKEN_URL =
  "https://idp.flutterwave.com/realms/flutterwave/protocol/openid-connect/token";

const FLW_BASE_URL =
  "https://developersandbox-api.flutterwave.com";

function jsonResponse(
  data: Record<string, unknown>,
  status = 200,
) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

/**
 * ---------------------------------------------------------
 * Flutterwave OAuth
 * ---------------------------------------------------------
 */
async function getAccessToken(): Promise<string> {
  const clientId = Deno.env.get("FLW_CLIENT_ID");
  const clientSecret = Deno.env.get("FLW_CLIENT_SECRET");

  if (!clientId) {
    throw new Error("FLW_CLIENT_ID is not configured");
  }

  if (!clientSecret) {
    throw new Error("FLW_CLIENT_SECRET is not configured");
  }

  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type":
        "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "client_credentials",
    }),
  });

  const text = await response.text();

  let data: any = {};

  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = {
      raw_response: text,
    };
  }

  console.log(
    "Flutterwave OAuth:",
    JSON.stringify({
      http_status: response.status,
      authenticated: Boolean(
        data?.access_token,
      ),
      expires_in:
        data?.expires_in ?? null,
    }),
  );

  if (
    !response.ok ||
    !data?.access_token
  ) {
    throw new Error(
      data?.error_description ??
        data?.message ??
        "Flutterwave authentication failed",
    );
  }

  return data.access_token;
}

/**
 * ---------------------------------------------------------
 * Flutterwave API helper
 * ---------------------------------------------------------
 */
async function flutterwaveRequest(
  accessToken: string,
  method: string,
  path: string,
  body?: unknown,
) {
  const headers: Record<string, string> = {
    Authorization:
      `Bearer ${accessToken}`,
    Accept: "application/json",
    "Content-Type":
      "application/json",

    "X-Trace-Id":
      crypto.randomUUID(),
  };

  // POST requests should be idempotent.
  if (method === "POST") {
    headers["X-Idempotency-Key"] =
      crypto.randomUUID();
  }

  const response = await fetch(
    `${FLW_BASE_URL}${path}`,
    {
      method,
      headers,

      ...(body !== undefined
        ? {
            body: JSON.stringify(body),
          }
        : {}),
    },
  );

  const text =
    await response.text();

  let data: any = {};

  try {
    data = text
      ? JSON.parse(text)
      : {};
  } catch {
    data = {
      raw_response: text,
    };
  }

  console.log(
    "Flutterwave API:",
    JSON.stringify({
      method,
      path,
      http_status:
        response.status,
      status:
        data?.status ?? null,
      message:
        data?.message ?? null,
    }),
  );

  return {
    response,
    data,
  };
}

/**
 * ---------------------------------------------------------
 * Main function
 * ---------------------------------------------------------
 */
Deno.serve(async (req: Request) => {
  // -------------------------------------------------------
  // CORS
  // -------------------------------------------------------
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  try {
    const url = new URL(req.url);

    /*
     * Supported operations:
     *
     * POST /flutterwave-transfer?action=create-recipient
     *
     * POST /flutterwave-transfer?action=create-sender
     *
     * POST /flutterwave-transfer?action=create
     *
     * GET  /flutterwave-transfer?action=list
     *
     * GET  /flutterwave-transfer?action=get&id=...
     *
     * POST /flutterwave-transfer?action=retry&id=...
     */

    const action =
      url.searchParams.get(
        "action",
      );

    if (!action) {
      return jsonResponse(
        {
          success: false,
          error:
            "Missing action",
          supported_actions: [
            "create-recipient",
            "create-sender",
            "create",
            "list",
            "get",
            "retry",
          ],
        },
        400,
      );
    }

    // -------------------------------------------------------
    // Authenticate once
    // -------------------------------------------------------
    const accessToken =
      await getAccessToken();

    // =======================================================
    // CREATE RECIPIENT
    //
    // POST /transfers/recipients
    // =======================================================
    if (
      req.method === "POST" &&
      action ===
        "create-recipient"
    ) {
      let payload: Record<
        string,
        unknown
      >;

      try {
        payload =
          await req.json();
      } catch {
        return jsonResponse(
          {
            success: false,
            error:
              "Invalid JSON request body",
          },
          400,
        );
      }

      /*
       * Flutterwave v4 requires:
       *
       * name
       * national_identification
       * phone
       * address
       * bank
       *
       * We pass the payload through
       * so the frontend/backend can
       * supply the exact bank structure.
       */

      const required = [
        "name",
        "national_identification",
        "phone",
        "address",
        "bank",
      ];

      const missing =
        required.filter(
          (field) =>
            payload[field] ===
              undefined ||
            payload[field] ===
              null,
        );

      if (missing.length > 0) {
        return jsonResponse(
          {
            success: false,
            error:
              `Missing recipient fields: ${missing.join(", ")}`,
          },
          400,
        );
      }

      const {
        response,
        data,
      } =
        await flutterwaveRequest(
          accessToken,
          "POST",
          "/transfers/recipients",
          payload,
        );

      return jsonResponse(
        {
          success:
            response.ok,

          recipient:
            data?.data ??
            null,

          flutterwave_response:
            data,
        },
        response.status,
      );
    }

    // =======================================================
    // CREATE SENDER
    //
    // POST /transfers/senders
    //
    // NOTE:
    // This is intentionally included in the architecture.
    // The exact sender payload should match the Flutterwave
    // sender reference for your supported currency.
    // =======================================================
    if (
      req.method === "POST" &&
      action ===
        "create-sender"
    ) {
      let payload: Record<
        string,
        unknown
      >;

      try {
        payload =
          await req.json();
      } catch {
        return jsonResponse(
          {
            success: false,
            error:
              "Invalid JSON request body",
          },
          400,
        );
      }

      const {
        response,
        data,
      } =
        await flutterwaveRequest(
          accessToken,
          "POST",
          "/transfers/senders",
          payload,
        );

      return jsonResponse(
        {
          success:
            response.ok,

          sender:
            data?.data ??
            null,

          flutterwave_response:
            data,
        },
        response.status,
      );
    }

    // =======================================================
    // CREATE TRANSFER
    //
    // POST /transfers
    // =======================================================
    if (
      req.method === "POST" &&
      action === "create"
    ) {
      let payload: Record<
        string,
        any
      >;

      try {
        payload =
          await req.json();
      } catch {
        return jsonResponse(
          {
            success: false,
            error:
              "Invalid JSON request body",
          },
          400,
        );
      }

      // -----------------------------------------------------
      // Required top-level fields
      // -----------------------------------------------------
      if (!payload.action) {
        return jsonResponse(
          {
            success: false,
            error:
              "Missing transfer field: action",
          },
          400,
        );
      }

      if (
        ![
          "instant",
          "deferred",
          "scheduled",
        ].includes(
          payload.action,
        )
      ) {
        return jsonResponse(
          {
            success: false,
            error:
              "action must be instant, deferred, or scheduled",
          },
          400,
        );
      }

      if (!payload.reference) {
        return jsonResponse(
          {
            success: false,
            error:
              "Missing transfer field: reference",
          },
          400,
        );
      }

      if (
        !/^[a-zA-Z0-9-]{6,42}$/.test(
          payload.reference,
        )
      ) {
        return jsonResponse(
          {
            success: false,
            error:
              "reference must be 6-42 characters and contain only letters, numbers, and hyphens",
          },
          400,
        );
      }

      if (
        !payload.payment_instruction
      ) {
        return jsonResponse(
          {
            success: false,
            error:
              "Missing payment_instruction",
          },
          400,
        );
      }

      const instruction =
        payload.payment_instruction;

      // -----------------------------------------------------
      // Required payment instruction fields
      // -----------------------------------------------------
      if (
        !instruction
          .source_currency
      ) {
        return jsonResponse(
          {
            success: false,
            error:
              "Missing payment_instruction.source_currency",
          },
          400,
        );
      }

      if (
        instruction.amount ===
          undefined ||
        instruction.amount ===
          null
      ) {
        return jsonResponse(
          {
            success: false,
            error:
              "Missing payment_instruction.amount",
          },
          400,
        );
      }

      if (
        !instruction
          .recipient_id
      ) {
        return jsonResponse(
          {
            success: false,
            error:
              "Missing payment_instruction.recipient_id",
          },
          400,
        );
      }

      /*
       * sender_id is required for the
       * applicable transfer currencies.
       *
       * We don't blindly force it here because
       * Flutterwave supports different transfer
       * scenarios.
       */

      const {
        response,
        data,
      } =
        await flutterwaveRequest(
          accessToken,
          "POST",
          "/transfers",
          payload,
        );

      return jsonResponse(
        {
          success:
            response.ok,

          transfer:
            data?.data ??
            null,

          flutterwave_response:
            data,
        },
        response.status,
      );
    }

    // =======================================================
    // LIST TRANSFERS
    //
    // GET /transfers
    // =======================================================
    if (
      req.method === "GET" &&
      action === "list"
    ) {
      const params =
        new URLSearchParams();

      /*
       * Forward supported query
       * parameters without exposing
       * arbitrary URLs.
       */

      const allowedParams = [
        "next",
        "previous",
        "size",
        "bulk_id",
        "recipient_id",
        "sender_id",
        "destination_currency",
        "source_currency",
        "action",
        "type",
        "status",
        "from",
        "to",
      ];

      for (
        const name of
          allowedParams
      ) {
        const value =
          url.searchParams.get(
            name,
          );

        if (value) {
          params.set(
            name,
            value,
          );
        }
      }

      const query =
        params.toString();

      const path =
        query
          ? `/transfers?${query}`
          : "/transfers";

      const {
        response,
        data,
      } =
        await flutterwaveRequest(
          accessToken,
          "GET",
          path,
        );

      return jsonResponse(
        {
          success:
            response.ok,

          transfers:
            data?.data ??
            null,

          flutterwave_response:
            data,
        },
        response.status,
      );
    }

    // =======================================================
    // GET TRANSFER
    //
    // GET /transfers/{id}
    // =======================================================
    if (
      req.method === "GET" &&
      action === "get"
    ) {
      const id =
        url.searchParams.get(
          "id",
        );

      if (!id) {
        return jsonResponse(
          {
            success: false,
            error:
              "Transfer ID is required",
          },
          400,
        );
      }

      const {
        response,
        data,
      } =
        await flutterwaveRequest(
          accessToken,
          "GET",
          `/transfers/${encodeURIComponent(id)}`,
        );

      return jsonResponse(
        {
          success:
            response.ok,

          transfer:
            data?.data ??
            null,

          flutterwave_response:
            data,
        },
        response.status,
      );
    }

    // =======================================================
    // RETRY TRANSFER
    //
    // POST /transfers/{id}/retries
    // =======================================================
    if (
      req.method === "POST" &&
      action === "retry"
    ) {
      const id =
        url.searchParams.get(
          "id",
        );

      if (!id) {
        return jsonResponse(
          {
            success: false,
            error:
              "Transfer ID is required",
          },
          400,
        );
      }

      let payload: Record<
        string,
        unknown
      >;

      try {
        payload =
          await req.json();
      } catch {
        return jsonResponse(
          {
            success: false,
            error:
              "Invalid JSON request body",
          },
          400,
        );
      }

      if (!payload.reference) {
        return jsonResponse(
          {
            success: false,
            error:
              "Missing retry reference",
          },
          400,
        );
      }

      const {
        response,
        data,
      } =
        await flutterwaveRequest(
          accessToken,
          "POST",
          `/transfers/${encodeURIComponent(id)}/retries`,
          payload,
        );

      return jsonResponse(
        {
          success:
            response.ok,

          transfer:
            data?.data ??
            null,

          flutterwave_response:
            data,
        },
        response.status,
      );
    }

    // =======================================================
    // UNKNOWN ACTION
    // =======================================================
    return jsonResponse(
      {
        success: false,
        error:
          "Unsupported transfer operation",

        supported_actions: [
          "create-recipient",
          "create-sender",
          "create",
          "list",
          "get",
          "retry",
        ],
      },
      400,
    );
  } catch (error) {
    console.error(
      "Flutterwave transfer function error:",
      error,
    );

    return jsonResponse(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Unexpected error",
      },
      500,
    );
  }
});