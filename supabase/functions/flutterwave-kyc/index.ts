import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods":
    "GET, POST, PUT, OPTIONS",
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
  return new Response(
    JSON.stringify(data),
    {
      status,
      headers: {
        ...corsHeaders,
        "Content-Type":
          "application/json",
      },
    },
  );
}

/**
 * =========================================================
 * Get Flutterwave OAuth access token
 * =========================================================
 */
async function getAccessToken(): Promise<string> {
  const clientId =
    Deno.env.get("FLW_CLIENT_ID");

  const clientSecret =
    Deno.env.get(
      "FLW_CLIENT_SECRET",
    );

  if (!clientId) {
    throw new Error(
      "FLW_CLIENT_ID is not configured",
    );
  }

  if (!clientSecret) {
    throw new Error(
      "FLW_CLIENT_SECRET is not configured",
    );
  }

  const response =
    await fetch(
      TOKEN_URL,
      {
        method: "POST",

        headers: {
          "Content-Type":
            "application/x-www-form-urlencoded",
          Accept:
            "application/json",
        },

        body:
          new URLSearchParams({
            client_id:
              clientId,

            client_secret:
              clientSecret,

            grant_type:
              "client_credentials",
          }),
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
    "Flutterwave OAuth:",
    JSON.stringify({
      http_status:
        response.status,

      authenticated:
        Boolean(
          data?.access_token,
        ),

      expires_in:
        data?.expires_in ??
        null,
    }),
  );

  if (
    !response.ok ||
    !data?.access_token
  ) {
    console.error(
      "Flutterwave OAuth failed:",
      JSON.stringify({
        status:
          response.status,

        response: data,
      }),
    );

    throw new Error(
      data?.error_description ??
        data?.message ??
        "Flutterwave authentication failed",
    );
  }

  return data.access_token;
}

/**
 * =========================================================
 * Flutterwave API request helper
 * =========================================================
 */
async function flutterwaveRequest(
  accessToken: string,
  method: string,
  path: string,
  body?: unknown,
) {
  const headers: Record<
    string,
    string
  > = {
    Authorization:
      `Bearer ${accessToken}`,

    Accept:
      "application/json",

    "Content-Type":
      "application/json",

    "X-Trace-Id":
      crypto.randomUUID(),
  };

  /*
   * Customer creation is a write operation.
   * Idempotency prevents accidental duplicate
   * customer creation if the request is retried.
   */
  if (method === "POST") {
    headers[
      "X-Idempotency-Key"
    ] = crypto.randomUUID();
  }

  const response =
    await fetch(
      `${FLW_BASE_URL}${path}`,
      {
        method,
        headers,

        ...(body !== undefined
          ? {
              body:
                JSON.stringify(
                  body,
                ),
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
    "Flutterwave Customer API:",
    JSON.stringify({
      method,
      path,
      http_status:
        response.status,

      status:
        data?.status ??
        null,

      message:
        data?.message ??
        null,
    }),
  );

  return {
    response,
    data,
  };
}

/**
 * =========================================================
 * Main Edge Function
 * =========================================================
 *
 * Supported operations:
 *
 * POST ?action=create
 * GET  ?action=get&id=cus_...
 * PUT  ?action=update&id=cus_...
 *
 * =========================================================
 */
Deno.serve(
  async (req: Request) => {
    // -------------------------------------------------------
    // CORS
    // -------------------------------------------------------

    if (
      req.method ===
      "OPTIONS"
    ) {
      return new Response(
        null,
        {
          status: 204,
          headers:
            corsHeaders,
        },
      );
    }

    try {
      const url =
        new URL(req.url);

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
              "create",
              "get",
              "update",
            ],
          },
          400,
        );
      }

      // -----------------------------------------------------
      // Authenticate
      // -----------------------------------------------------

      const accessToken =
        await getAccessToken();

      // =====================================================
      // CREATE CUSTOMER
      //
      // POST /customers
      // =====================================================

      if (
        req.method ===
          "POST" &&
        action === "create"
      ) {
        let payload:
          Record<
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
         * Flutterwave requires email.
         *
         * The other customer objects are:
         *
         * name
         * phone
         * address
         * meta
         */

        if (
          !payload.email
        ) {
          return jsonResponse(
            {
              success: false,

              error:
                "Missing customer email",
            },
            400,
          );
        }

        if (
          typeof payload.email !==
          "string"
        ) {
          return jsonResponse(
            {
              success: false,

              error:
                "Customer email must be a string",
            },
            400,
          );
        }

        const email =
          payload.email.trim();

        /*
         * Basic email validation.
         * Flutterwave performs its own validation too.
         */
        if (
          !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
            email,
          )
        ) {
          return jsonResponse(
            {
              success: false,

              error:
                "Invalid customer email",
            },
            400,
          );
        }

        /*
         * Keep the payload structure expected by
         * Flutterwave rather than transforming it
         * unnecessarily.
         */
        const customerPayload =
          {
            ...payload,
            email,
          };

        const {
          response,
          data,
        } =
          await flutterwaveRequest(
            accessToken,

            "POST",

            "/customers",

            customerPayload,
          );

        return jsonResponse(
          {
            success:
              response.ok,

            customer:
              data?.data ??
              null,

            flutterwave_response:
              data,
          },

          response.status,
        );
      }

      // =====================================================
      // GET CUSTOMER
      //
      // GET /customers/{id}
      // =====================================================

      if (
        req.method ===
          "GET" &&
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
                "Customer ID is required",
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

            `/customers/${encodeURIComponent(
              id,
            )}`,
          );

        return jsonResponse(
          {
            success:
              response.ok,

            customer:
              data?.data ??
              null,

            flutterwave_response:
              data,
          },

          response.status,
        );
      }

      // =====================================================
      // UPDATE CUSTOMER
      //
      // PUT /customers/{id}
      // =====================================================

      if (
        req.method ===
          "PUT" &&
        action === "update"
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
                "Customer ID is required",
            },
            400,
          );
        }

        let payload:
          Record<
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
         * The update endpoint accepts:
         *
         * address
         * meta
         * name
         * phone
         *
         * We don't force all of them because
         * this is an update operation.
         */
        const allowedFields = [
          "address",
          "meta",
          "name",
          "phone",
        ];

        const updatePayload:
          Record<
            string,
            unknown
          > = {};

        for (
          const field of
            allowedFields
        ) {
          if (
            payload[field] !==
            undefined
          ) {
            updatePayload[
              field
            ] =
              payload[field];
          }
        }

        if (
          Object.keys(
            updatePayload,
          ).length === 0
        ) {
          return jsonResponse(
            {
              success: false,

              error:
                "No customer fields supplied for update",

              allowed_fields:
                allowedFields,
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

            "PUT",

            `/customers/${encodeURIComponent(
              id,
            )}`,

            updatePayload,
          );

        return jsonResponse(
          {
            success:
              response.ok,

            customer:
              data?.data ??
              null,

            flutterwave_response:
              data,
          },

          response.status,
        );
      }

      // =====================================================
      // UNSUPPORTED OPERATION
      // =====================================================

      return jsonResponse(
        {
          success: false,

          error:
            "Unsupported customer operation",

          supported_actions: [
            "create",
            "get",
            "update",
          ],
        },
        400,
      );
    } catch (error) {
      console.error(
        "Flutterwave KYC/customer error:",
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
  },
);