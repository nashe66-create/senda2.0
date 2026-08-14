import { supabase } from '@/lib/supabase';

import {
  Plan,
  Commitment,
  Recipient,
  Transaction,
  PlanWithCommitments,
  CommitmentWithRecipient,
  FlutterwaveOptions,
} from '@/types/database';

/* =========================================================
   FORMATTING
   ========================================================= */

export function formatGBP(
  amount: number
): string {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatCurrency(
  amount: number,
  currency: string
): string {
  try {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

export function formatDate(
  date: string | null
): string {
  if (!date) return 'Not set';

  return new Date(date).toLocaleDateString(
    'en-GB',
    {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }
  );
}

export function formatDateTime(
  date: string | null
): string {
  if (!date) return '';

  return new Date(date).toLocaleDateString(
    'en-GB',
    {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    }
  );
}

export function timeAgo(
  date: string
): string {
  const diff =
    Date.now() -
    new Date(date).getTime();

  const mins = Math.floor(
    diff / 60000
  );

  const hours = Math.floor(
    diff / 3600000
  );

  const days = Math.floor(
    diff / 86400000
  );

  if (days > 0)
    return `${days}d ago`;

  if (hours > 0)
    return `${hours}h ago`;

  if (mins > 0)
    return `${mins}m ago`;

  return 'just now';
}

/* =========================================================
   PLANS
   ========================================================= */

export async function fetchPlans(): Promise<
  Plan[]
> {
  const {
    data,
    error,
  } = await supabase
    .from('plans')
    .select('*')
    .order('created_at', {
      ascending: false,
    });

  if (error) throw error;

  return (data ?? []) as Plan[];
}

export async function fetchPlanWithCommitments(
  planId: string
): Promise<PlanWithCommitments | null> {
  const {
    data: plan,
    error: planError,
  } = await supabase
    .from('plans')
    .select('*')
    .eq('id', planId)
    .maybeSingle();

  if (planError) throw planError;

  if (!plan) return null;

  const {
    data: commitments,
    error: commitError,
  } = await supabase
    .from('commitments')
    .select(
      '*, recipient:recipients(*)'
    )
    .eq('plan_id', planId)
    .order('created_at', {
      ascending: false,
    });

  if (commitError) throw commitError;

  return {
    ...(plan as Plan),

    commitments:
      (commitments ??
        []) as CommitmentWithRecipient[],
  };
}

export async function createPlan(
  plan: Partial<Plan>
): Promise<Plan> {
  const {
    data,
    error,
  } = await supabase
    .from('plans')
    .insert(plan)
    .select()
    .single();

  if (error) throw error;

  return data as Plan;
}

export async function updatePlan(
  id: string,
  updates: Partial<Plan>
): Promise<Plan> {
  const {
    data,
    error,
  } = await supabase
    .from('plans')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;

  return data as Plan;
}

export async function deletePlan(
  id: string
): Promise<void> {
  const { error } =
    await supabase
      .from('plans')
      .delete()
      .eq('id', id);

  if (error) throw error;
}

/* =========================================================
   RECIPIENTS
   ========================================================= */

export async function fetchRecipients(): Promise<
  Recipient[]
> {
  const {
    data,
    error,
  } = await supabase
    .from('recipients')
    .select('*')
    .order('created_at', {
      ascending: false,
    });

  if (error) throw error;

  return (data ?? []) as Recipient[];
}

export async function fetchRecipient(
  id: string
): Promise<Recipient | null> {
  const {
    data,
    error,
  } = await supabase
    .from('recipients')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;

  return data as Recipient | null;
}

export async function createRecipient(
  recipient: Partial<Recipient>
): Promise<Recipient> {
  const {
    data,
    error,
  } = await supabase
    .from('recipients')
    .insert(recipient)
    .select()
    .single();

  if (error) throw error;

  return data as Recipient;
}

export async function updateRecipient(
  id: string,
  updates: Partial<Recipient>
): Promise<Recipient> {
  const {
    data,
    error,
  } = await supabase
    .from('recipients')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;

  return data as Recipient;
}

export async function deleteRecipient(
  id: string
): Promise<void> {
  const { error } =
    await supabase
      .from('recipients')
      .delete()
      .eq('id', id);

  if (error) throw error;
}

/* =========================================================
   COMMITMENTS
   ========================================================= */

export async function addCommitment(
  commitment: Partial<Commitment>
): Promise<Commitment> {
  const {
    data,
    error,
  } = await supabase
    .from('commitments')
    .insert(commitment)
    .select(
      '*, recipient:recipients(*)'
    )
    .single();

  if (error) throw error;

  return data as Commitment;
}

export async function updateCommitment(
  id: string,
  updates: Partial<Commitment>
): Promise<Commitment> {
  const {
    data,
    error,
  } = await supabase
    .from('commitments')
    .update(updates)
    .eq('id', id)
    .select(
      '*, recipient:recipients(*)'
    )
    .single();

  if (error) throw error;

  return data as Commitment;
}

export async function deleteCommitment(
  id: string
): Promise<void> {
  const { error } =
    await supabase
      .from('commitments')
      .delete()
      .eq('id', id);

  if (error) throw error;
}

/* =========================================================
   PLAN TOTALS
   ========================================================= */

export async function recalcPlanTotals(
  planId: string
): Promise<void> {
  const {
    data: commitments,
    error,
  } = await supabase
    .from('commitments')
    .select(
      'amount_gbp, destination_currency'
    )
    .eq('plan_id', planId);

  if (error) throw error;

  if (!commitments) return;

  const totalGbp =
    commitments.reduce(
      (sum, commitment) =>
        sum +
        Number(
          commitment.amount_gbp
        ),
      0
    );

  const currencies = [
    ...new Set(
      commitments.map(
        (commitment) =>
          commitment.destination_currency
      )
    ),
  ];

  const {
    error: updateError,
  } = await supabase
    .from('plans')
    .update({
      total_gbp: totalGbp,
      total_recipients:
        commitments.length,
      destination_currencies:
        currencies,
    })
    .eq('id', planId);

  if (updateError)
    throw updateError;
}

/* =========================================================
   TRANSACTIONS
   ========================================================= */

export async function createTransaction(
  planId: string,
  amountGbp: number
): Promise<Transaction> {
  const {
    data,
    error,
  } = await supabase
    .from('transactions')
    .insert({
      plan_id: planId,
      amount_gbp: amountGbp,
      status: 'pending',
      payment_reference:
        `SND-${Date.now()}`,
    })
    .select(
      '*, plan:plans(*)'
    )
    .single();

  if (error) throw error;

  return data as Transaction;
}

export async function updateTransaction(
  id: string,
  updates: Partial<Transaction>
): Promise<void> {
  const { error } =
    await supabase
      .from('transactions')
      .update(updates)
      .eq('id', id);

  if (error) throw error;
}

export async function fetchTransactions(): Promise<
  Transaction[]
> {
  const {
    data,
    error,
  } = await supabase
    .from('transactions')
    .select(
      '*, plan:plans(*)'
    )
    .order('created_at', {
      ascending: false,
    });

  if (error) throw error;

  return (data ??
    []) as Transaction[];
}

/* =========================================================
   FLUTTERWAVE HELPERS
   ========================================================= */

function asArray<T = any>(
  value: unknown
): T[] {
  return Array.isArray(value)
    ? (value as T[])
    : [];
}

function normaliseFlutterwaveOptions(
  result: any,
  fallbackCountry?: string
): FlutterwaveOptions {
  let root = result;

  /*
   * Handle:
   *
   * { data: {...} }
   *
   * and:
   *
   * { data: [...] }
   */
  if (
    result?.data &&
    !Array.isArray(result.data) &&
    typeof result.data ===
      'object'
  ) {
    root = result.data;
  }

  /*
   * Some responses may have another
   * nested data object.
   */
  if (
    root?.data &&
    !Array.isArray(root.data) &&
    typeof root.data ===
      'object'
  ) {
    root = root.data;
  }

  return {
    source_country:
      typeof root?.source_country ===
      'string'
        ? root.source_country
        : 'GB',

    source_currency:
      typeof root?.source_currency ===
      'string'
        ? root.source_currency
        : 'GBP',

    country:
      typeof root?.country ===
      'string'
        ? root.country
        : fallbackCountry,

    countries: asArray(
      root?.countries
    ),

    currencies: asArray(
      root?.currencies
    ),

    mobile_networks: asArray(
      root?.mobile_networks
    ),

    banks: asArray(
      root?.banks
    ),

    payout_methods: asArray(
      root?.payout_methods
    ),
  };
}

/* =========================================================
   FLUTTERWAVE PAYOUT OPTIONS
   ========================================================= */

/**
 * Fetch all supported payout destinations
 * from the configured source country.
 *
 * The country list is NOT hard coded here.
 */
export async function fetchFlutterwaveOptions(): Promise<
  FlutterwaveOptions
> {
  const supabaseUrl =
    process.env
      .EXPO_PUBLIC_SUPABASE_URL;

  const supabaseAnonKey =
    process.env
      .EXPO_PUBLIC_SUPABASE_ANON_KEY;

  if (
    !supabaseUrl ||
    !supabaseAnonKey
  ) {
    throw new Error(
      'Missing Supabase configuration'
    );
  }

  try {
    const response =
      await fetch(
        `${supabaseUrl}/functions/v1/flutterwave-payout-options`,
        {
          method: 'GET',

          headers: {
            Accept:
              'application/json',

            Authorization:
              `Bearer ${supabaseAnonKey}`,

            apikey:
              supabaseAnonKey,
          },
        }
      );

    const text =
      await response.text();

    let result: any = {};

    try {
      result = text
        ? JSON.parse(text)
        : {};
    } catch {
      throw new Error(
        `Invalid response from Flutterwave payout options (${response.status})`
      );
    }

    if (!response.ok) {
      throw new Error(
        result?.error ||
          result?.message ||
          `Failed to load Flutterwave options (${response.status})`
      );
    }

    return normaliseFlutterwaveOptions(
      result
    );
  } catch (error: any) {
    console.error(
      'fetchFlutterwaveOptions error:',
      error
    );

    throw new Error(
      error?.message ||
        'Failed to load Flutterwave options'
    );
  }
}

/**
 * Fetch payout options for one
 * destination country.
 */
export async function fetchFlutterwaveCountryOptions(
  country: string
): Promise<FlutterwaveOptions> {
  const supabaseUrl =
    process.env
      .EXPO_PUBLIC_SUPABASE_URL;

  const supabaseAnonKey =
    process.env
      .EXPO_PUBLIC_SUPABASE_ANON_KEY;

  if (
    !supabaseUrl ||
    !supabaseAnonKey
  ) {
    throw new Error(
      'Missing Supabase configuration'
    );
  }

  const cleanCountry =
    String(country ?? '')
      .trim()
      .toUpperCase();

  if (
    !/^[A-Z]{2}$/.test(
      cleanCountry
    )
  ) {
    throw new Error(
      'Invalid country code'
    );
  }

  try {
    const response =
      await fetch(
        `${supabaseUrl}/functions/v1/flutterwave-payout-options?country=${encodeURIComponent(
          cleanCountry
        )}`,
        {
          method: 'GET',

          headers: {
            Accept:
              'application/json',

            Authorization:
              `Bearer ${supabaseAnonKey}`,

            apikey:
              supabaseAnonKey,
          },
        }
      );

    const text =
      await response.text();

    let result: any = {};

    try {
      result = text
        ? JSON.parse(text)
        : {};
    } catch {
      throw new Error(
        `Invalid Flutterwave options response (${response.status})`
      );
    }

    if (!response.ok) {
      throw new Error(
        result?.error ||
          result?.message ||
          `Failed to load Flutterwave options (${response.status})`
      );
    }

    return normaliseFlutterwaveOptions(
      result,
      cleanCountry
    );
  } catch (error: any) {
    console.error(
      'fetchFlutterwaveCountryOptions error:',
      error
    );

    throw new Error(
      error?.message ||
        'Failed to load Flutterwave country options'
    );
  }
}

/* =========================================================
   FLUTTERWAVE LIVE FX
   ========================================================= */

export async function fetchLiveFxRate(
  source: string,
  destination: string
): Promise<number | null> {
  const supabaseUrl =
    process.env
      .EXPO_PUBLIC_SUPABASE_URL;

  const supabaseAnonKey =
    process.env
      .EXPO_PUBLIC_SUPABASE_ANON_KEY;

  if (
    !supabaseUrl ||
    !supabaseAnonKey
  ) {
    return null;
  }

  try {
    const response =
      await fetch(
        `${supabaseUrl}/functions/v1/flutterwave-fx`,
        {
          method: 'POST',

          headers: {
            'Content-Type':
              'application/json',

            Authorization:
              `Bearer ${supabaseAnonKey}`,
          },

          body: JSON.stringify({
            source_currency:
              source,

            destination_currency:
              destination,
          }),
        }
      );

    if (!response.ok) {
      return null;
    }

    const data =
      await response.json();

    const rate = Number(
      data.rate
    );

    return Number.isNaN(rate)
      ? null
      : rate;
  } catch {
    return null;
  }
}

/* =========================================================
   CACHED FX RATE
   ========================================================= */

export async function fetchFxRate(
  source: string,
  destination: string
): Promise<number | null> {
  const {
    data,
    error,
  } = await supabase
    .from('fx_rates')
    .select('*')
    .eq(
      'source_currency',
      source
    )
    .eq(
      'destination_currency',
      destination
    )
    .order('fetched_at', {
      ascending: false,
    })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error(
      'fetchFxRate error:',
      error
    );

    return null;
  }

  if (data) {
    return Number(
      data.rate
    );
  }

  return null;
}

/* =========================================================
   SEND PLAN TRANSFERS
   ========================================================= */

export async function sendPlanTransfers(
  planId: string
): Promise<{
  sent: number;
  failed: number;
  errors: string[];
}> {
  const {
    data: commitments,
    error,
  } = await supabase
    .from('commitments')
    .select(
      '*, recipient:recipients(*)'
    )
    .eq('plan_id', planId);

  if (error) throw error;

  if (
    !commitments ||
    commitments.length === 0
  ) {
    throw new Error(
      'No commitments to send'
    );
  }

  const supabaseUrl =
    process.env
      .EXPO_PUBLIC_SUPABASE_URL;

  const supabaseAnonKey =
    process.env
      .EXPO_PUBLIC_SUPABASE_ANON_KEY;

  if (
    !supabaseUrl ||
    !supabaseAnonKey
  ) {
    throw new Error(
      'Missing Supabase config'
    );
  }

  let sent = 0;
  let failed = 0;

  const errors: string[] = [];

  for (
    const commitment of commitments
  ) {
    const recipient =
      commitment.recipient;

    if (!recipient) {
      failed++;

      errors.push(
        'Missing recipient for a commitment'
      );

      continue;
    }

    try {
      const {
        error:
          processingError,
      } = await supabase
        .from('commitments')
        .update({
          status:
            'processing',
        })
        .eq(
          'id',
          commitment.id
        );

      if (
        processingError
      ) {
        throw processingError;
      }

      const transferPayload: Record<
        string,
        string | number
      > = {
        account_bank:
          recipient.bank_code ||
          'MPS',

        account_number:
          recipient.account_number ||
          recipient.phone,

        amount: Number(
          commitment.amount_gbp
        ),

        currency: 'GBP',

        beneficiary_name:
          recipient.name,

        reference:
          `SND-${planId.slice(
            0,
            8
          )}-${commitment.id.slice(
            0,
            8
          )}`,
      };

      const response =
        await fetch(
          `${supabaseUrl}/functions/v1/flutterwave-transfer`,
          {
            method: 'POST',

            headers: {
              'Content-Type':
                'application/json',

              Authorization:
                `Bearer ${supabaseAnonKey}`,
            },

            body: JSON.stringify(
              transferPayload
            ),
          }
        );

      if (!response.ok) {
        const errBody =
          await response
            .json()
            .catch(
              () => ({})
            );

        throw new Error(
          errBody?.error ||
            errBody?.message ||
            `Transfer failed (${response.status})`
        );
      }

      const result =
        await response.json();

      const transferId =
        result?.data?.id?.toString() ||
        result?.id?.toString() ||
        `FLW-${Date.now()}`;

      const {
        error:
          completedError,
      } = await supabase
        .from('commitments')
        .update({
          status:
            'completed',

          flutterwave_transfer_id:
            transferId,

          failure_reason:
            null,
        })
        .eq(
          'id',
          commitment.id
        );

      if (
        completedError
      ) {
        throw completedError;
      }

      sent++;
    } catch (e: any) {
      failed++;

      const reason =
        e?.message ||
        'Unknown error';

      errors.push(
        `${recipient.name}: ${reason}`
      );

      await supabase
        .from('commitments')
        .update({
          status:
            'failed',

          failure_reason:
            reason,
        })
        .eq(
          'id',
          commitment.id
        );
    }
  }

  return {
    sent,
    failed,
    errors,
  };
}

/* =========================================================
   HELPERS
   ========================================================= */

export function getCountryInfo(
  code: string
) {
  const {
    COUNTRIES,
  } = require('@/lib/theme');

  return COUNTRIES.find(
    (c: {
      code: string;
    }) =>
      c.code === code
  );
}

export function getReceivingMethodLabel(
  method: string
): string {
  const {
    RECEIVING_METHODS,
  } = require('@/lib/theme');

  const m =
    RECEIVING_METHODS.find(
      (r: {
        value: string;
      }) =>
        r.value === method
    );

  return m
    ? m.label
    : method;
}

export function getRecurringLabel(
  type: string
): string {
  const {
    RECURRING_OPTIONS,
  } = require('@/lib/theme');

  const r =
    RECURRING_OPTIONS.find(
      (r: {
        value: string;
      }) =>
        r.value === type
    );

  return r
    ? r.label
    : type;
}