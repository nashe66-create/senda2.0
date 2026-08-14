import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

const TOKEN_URL =
  "https://idp.flutterwave.com/realms/flutterwave/protocol/openid-connect/token";

const FLW_BASE_URL =
  "https://developersandbox-api.flutterwave.com";

/*
 * These are ISO country codes we can test against Flutterwave.
 *
 * IMPORTANT:
 * This is NOT the list shown to the user.
 *
 * It is only the server-side discovery pool used to ask
 * Flutterwave which countries currently have payout routes.
 *
 * Countries only reach the app if Flutterwave confirms
 * at least one payout route.
 */
const COUNTRY_DISCOVERY_CODES = [
  "AO",
  "BF",
  "BI",
  "CM",
  "CI",
  "CD",
  "CG",
  "EG",
  "ET",
  "GH",
  "GN",
  "KE",
  "LR",
  "MW",
  "ML",
  "MZ",
  "NG",
  "RW",
  "SN",
  "SL",
  "SO",
  "ZA",
  "TZ",
  "UG",
  "ZM",
];

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

function extractArray(
  value: any,
): any[] {
  if (Array.isArray(value)) {
    return value;
  }

  if (
    value &&
    Array.isArray(value.data)
  ) {
    return value.data;
  }

  return [];
}

async function getAccessToken(
  clientId: string,
  clientSecret: string,
) {
  const response = await fetch(
    TOKEN_URL,
    {
      method: "POST",
      headers: {
        "Content-Type":
          "application/x-www-form-urlencoded",
        Accept:
          "application/json",
      },
      body: new URLSearchParams({
        client_id: clientId,
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

async function flutterwaveGet(
  path: string,
  accessToken: string,
) {
  const traceId =
    crypto.randomUUID();

  const response =
    await fetch(
      `${FLW_BASE_URL}${path}`,
      {
        method: "GET",
        headers: {
          Authorization:
            `Bearer ${accessToken}`,
          Accept:
            "application/json",
          "Content-Type":
            "application/json",
          "X-Trace-Id":
            traceId,
        },
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

  return {
    ok: response.ok,
    status:
      response.status,
    data,
    traceId,
  };
}

/*
 * Get banks for a country.
 */
async function getBanks(
  country: string,
  accessToken: string,
) {
  return flutterwaveGet(
    `/banks?country=${encodeURIComponent(
      country,
    )}`,
    accessToken,
  );
}

/*
 * Get mobile networks for a country.
 */
async function getMobileNetworks(
  country: string,
  accessToken: string,
) {
  return flutterwaveGet(
    `/mobile-networks?country=${encodeURIComponent(
      country,
    )}`,
    accessToken,
  );
}

/*
 * Normalise a bank returned by Flutterwave.
 *
 * We deliberately create a stable internal ID.
 *
 * This prevents React duplicate-key problems where
 * several banks/networks have missing IDs or duplicate
 * codes.
 */
function normaliseBank(
  bank: any,
  index: number,
) {
  const code =
    String(
      bank?.code ??
        bank?.bank_code ??
        "",
    ).trim();

  const name =
    String(
      bank?.name ??
        bank?.bank_name ??
        `Bank ${index + 1}`,
    ).trim();

  const id =
    String(
      bank?.id ??
        `${code}-${name}-${index}`,
    );

  return {
    id,
    code,
    name,
    currency:
      bank?.currency ??
      null,
  };
}

function normaliseNetwork(
  network: any,
  index: number,
) {
  const code =
    String(
      network?.code ??
        network?.network ??
        network?.provider_code ??
        "",
    ).trim();

  const name =
    String(
      network?.name ??
        network?.network_name ??
        network?.provider ??
        `Mobile network ${index + 1}`,
    ).trim();

  const id =
    String(
      network?.id ??
        `${code}-${name}-${index}`,
    );

  return {
    id,
    code,
    name,
    currency:
      network?.currency ??
      network?.currency_code ??
      null,
  };
}

/*
 * Extract currencies from the actual destination data.
 *
 * Flutterwave's bank/mobile responses don't always expose
 * currency in exactly the same field, so we collect whatever
 * is actually returned.
 */
function collectCurrencies(
  banks: any[],
  networks: any[],
) {
  const result =
    new Map<
      string,
      {
        code: string;
        name: string;
      }
    >();

  for (const item of [
    ...banks,
    ...networks,
  ]) {
    const rawCurrency =
      item?.currency ??
      item?.currency_code;

    if (!rawCurrency) {
      continue;
    }

    const code =
      String(
        rawCurrency,
      )
        .trim()
        .toUpperCase();

    if (!code) {
      continue;
    }

    if (!result.has(code)) {
      result.set(code, {
        code,
        name: code,
      });
    }
  }

  return Array.from(
    result.values(),
  );
}

/*
 * Fetch complete options for one destination.
 */
async function getCountryOptions(
  country: string,
  accessToken: string,
) {
  const [
    bankResponse,
    networkResponse,
  ] = await Promise.all([
    getBanks(
      country,
      accessToken,
    ),
    getMobileNetworks(
      country,
      accessToken,
    ),
  ]);

  const rawBanks =
    bankResponse.ok
      ? extractArray(
          bankResponse.data,
        )
      : [];

  const rawNetworks =
    networkResponse.ok
      ? extractArray(
          networkResponse.data,
        )
      : [];

  const banks =
    rawBanks.map(
      normaliseBank,
    );

  const mobileNetworks =
    rawNetworks.map(
      normaliseNetwork,
    );

  const currencies =
    collectCurrencies(
      rawBanks,
      rawNetworks,
    );

  const payoutMethods: string[] =
    [];

  if (banks.length > 0) {
    payoutMethods.push(
      "bank_account",
    );
  }

  if (
    mobileNetworks.length > 0
  ) {
    payoutMethods.push(
      "mobile_money",
    );
  }

  return {
    country,

    currencies,

    banks,

    mobile_networks:
      mobileNetworks,

    payout_methods:
      payoutMethods,

    meta: {
      bank_status:
        bankResponse.status,

      mobile_network_status:
        networkResponse.status,

      banks_count:
        banks.length,

      mobile_networks_count:
        mobileNetworks.length,
    },
  };
}

Deno.serve(
  async (req: Request) => {
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

    if (
      req.method !== "GET"
    ) {
      return jsonResponse(
        {
          success: false,
          error:
            "Method not allowed",
        },
        405,
      );
    }

    try {
      const clientId =
        Deno.env.get(
          "FLW_CLIENT_ID",
        );

      const clientSecret =
        Deno.env.get(
          "FLW_CLIENT_SECRET",
        );

      if (!clientId) {
        return jsonResponse(
          {
            success: false,
            error:
              "FLW_CLIENT_ID is not configured",
          },
          503,
        );
      }

      if (!clientSecret) {
        return jsonResponse(
          {
            success: false,
            error:
              "FLW_CLIENT_SECRET is not configured",
          },
          503,
        );
      }

      const accessToken =
        await getAccessToken(
          clientId,
          clientSecret,
        );

      const url =
        new URL(req.url);

      const country =
        String(
          url.searchParams.get(
            "country",
          ) ?? "",
        )
          .trim()
          .toUpperCase();

      /*
       * =====================================================
       * COUNTRY-SPECIFIC REQUEST
       * =====================================================
       */

      if (country) {
        if (
          !/^[A-Z]{2}$/.test(
            country,
          )
        ) {
          return jsonResponse(
            {
              success: false,
              error:
                "Invalid country code",
            },
            400,
          );
        }

        const options =
          await getCountryOptions(
            country,
            accessToken,
          );

        /*
         * Do not consider a country supported merely because
         * Flutterwave returned HTTP 200.
         *
         * It must have at least one actual destination.
         */
        if (
          options.banks.length ===
            0 &&
          options.mobile_networks
            .length === 0
        ) {
          return jsonResponse(
            {
              success: false,
              error:
                "No payout destinations are currently available for this country",
              country,
              currencies:
                [],
              banks: [],
              mobile_networks:
                [],
              payout_methods:
                [],
            },
            404,
          );
        }

        return jsonResponse({
          success: true,
          source_country:
            "GB",
          source_currency:
            "GBP",
          country:
            options.country,
          currencies:
            options.currencies,
          banks:
            options.banks,
          mobile_networks:
            options.mobile_networks,
          payout_methods:
            options.payout_methods,
          meta:
            options.meta,
        });
      }

      /*
       * =====================================================
       * DESTINATION DISCOVERY
       * =====================================================
       *
       * We test each country against Flutterwave.
       *
       * A country is returned ONLY if:
       *
       * banks.length > 0
       *
       * OR
       *
       * mobile_networks.length > 0
       *
       * This means the app never decides that a country is
       * supported based on our old hard-coded UI list.
       */

      const countries: any[] =
        [];

      /*
       * Run in small batches instead of firing every
       * Flutterwave request simultaneously.
       */
      const batchSize = 5;

      for (
        let i = 0;
        i <
        COUNTRY_DISCOVERY_CODES.length;
        i += batchSize
      ) {
        const batch =
          COUNTRY_DISCOVERY_CODES.slice(
            i,
            i + batchSize,
          );

        const results =
          await Promise.all(
            batch.map(
              async (
                code,
              ) => {
                try {
                  const options =
                    await getCountryOptions(
                      code,
                      accessToken,
                    );

                  if (
                    options.banks
                      .length ===
                      0 &&
                    options
                      .mobile_networks
                      .length ===
                      0
                  ) {
                    return null;
                  }

                  return {
                    code,
                    currencies:
                      options.currencies,
                    payout_methods:
                      options.payout_methods,
                  };
                } catch (
                  error
                ) {
                  console.error(
                    `Country discovery failed for ${code}:`,
                    error,
                  );

                  return null;
                }
              },
            ),
          );

        for (
          const result of results
        ) {
          if (result) {
            countries.push(
              result,
            );
          }
        }
      }

      /*
       * De-duplicate countries.
       */
      const uniqueCountries =
        Array.from(
          new Map(
            countries.map(
              (country) => [
                country.code,
                country,
              ],
            ),
          ).values(),
        );

      return jsonResponse({
        success: true,

        source_country:
          "GB",

        source_currency:
          "GBP",

        countries:
          uniqueCountries,

        /*
         * These are deliberately empty at discovery level.
         *
         * Banks/networks belong to the selected country.
         */
        currencies: [],

        banks: [],

        mobile_networks: [],

        payout_methods: [],
      });
    } catch (error) {
      console.error(
        "Payout options function error:",
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