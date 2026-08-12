import { supabase } from '@/lib/supabase';
import {
  Plan,
  Commitment,
  Recipient,
  Transaction,
  PlanWithCommitments,
  CommitmentWithRecipient,
} from '@/types/database';

export function formatGBP(amount: number): string {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatCurrency(amount: number, currency: string): string {
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

export function formatDate(date: string | null): string {
  if (!date) return 'Not set';
  return new Date(date).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function formatDateTime(date: string | null): string {
  if (!date) return '';
  return new Date(date).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function timeAgo(date: string): string {
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (mins > 0) return `${mins}m ago`;
  return 'just now';
}

export async function fetchPlans(): Promise<Plan[]> {
  const { data, error } = await supabase
    .from('plans')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data as Plan[];
}

export async function fetchPlanWithCommitments(planId: string): Promise<PlanWithCommitments | null> {
  const { data: plan, error: planError } = await supabase
    .from('plans')
    .select('*')
    .eq('id', planId)
    .maybeSingle();
  if (planError) throw planError;
  if (!plan) return null;

  const { data: commitments, error: commitError } = await supabase
    .from('commitments')
    .select('*, recipient:recipients(*)')
    .eq('plan_id', planId)
    .order('created_at', { ascending: false });
  if (commitError) throw commitError;

  return {
    ...(plan as Plan),
    commitments: (commitments ?? []) as CommitmentWithRecipient[],
  };
}

export async function fetchRecipients(): Promise<Recipient[]> {
  const { data, error } = await supabase
    .from('recipients')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data as Recipient[];
}

export async function fetchRecipient(id: string): Promise<Recipient | null> {
  const { data, error } = await supabase
    .from('recipients')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data as Recipient | null;
}

export async function createRecipient(recipient: Partial<Recipient>): Promise<Recipient> {
  const { data, error } = await supabase
    .from('recipients')
    .insert(recipient)
    .select()
    .single();
  if (error) throw error;
  return data as Recipient;
}

export async function updateRecipient(id: string, updates: Partial<Recipient>): Promise<Recipient> {
  const { data, error } = await supabase
    .from('recipients')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data as Recipient;
}

export async function deleteRecipient(id: string): Promise<void> {
  const { error } = await supabase.from('recipients').delete().eq('id', id);
  if (error) throw error;
}

export async function createPlan(plan: Partial<Plan>): Promise<Plan> {
  const { data, error } = await supabase
    .from('plans')
    .insert(plan)
    .select()
    .single();
  if (error) throw error;
  return data as Plan;
}

export async function updatePlan(id: string, updates: Partial<Plan>): Promise<Plan> {
  const { data, error } = await supabase
    .from('plans')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data as Plan;
}

export async function deletePlan(id: string): Promise<void> {
  const { error } = await supabase.from('plans').delete().eq('id', id);
  if (error) throw error;
}

export async function addCommitment(commitment: Partial<Commitment>): Promise<Commitment> {
  const { data, error } = await supabase
    .from('commitments')
    .insert(commitment)
    .select('*, recipient:recipients(*)')
    .single();
  if (error) throw error;
  return data as Commitment;
}

export async function updateCommitment(id: string, updates: Partial<Commitment>): Promise<Commitment> {
  const { data, error } = await supabase
    .from('commitments')
    .update(updates)
    .eq('id', id)
    .select('*, recipient:recipients(*)')
    .single();
  if (error) throw error;
  return data as Commitment;
}

export async function deleteCommitment(id: string): Promise<void> {
  const { error } = await supabase.from('commitments').delete().eq('id', id);
  if (error) throw error;
}

export async function recalcPlanTotals(planId: string): Promise<void> {
  const { data: commitments } = await supabase
    .from('commitments')
    .select('amount_gbp, destination_currency')
    .eq('plan_id', planId);

  if (!commitments) return;

  const totalGbp = commitments.reduce((sum, c) => sum + Number(c.amount_gbp), 0);
  const currencies = [...new Set(commitments.map((c) => c.destination_currency))];

  await supabase
    .from('plans')
    .update({
      total_gbp: totalGbp,
      total_recipients: commitments.length,
      destination_currencies: currencies,
    })
    .eq('id', planId);
}

export async function fetchTransactions(): Promise<Transaction[]> {
  const { data, error } = await supabase
    .from('transactions')
    .select('*, plan:plans(*)')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data as Transaction[];
}

export async function fetchFxRate(source: string, destination: string): Promise<number | null> {
  const { data } = await supabase
    .from('fx_rates')
    .select('*')
    .eq('source_currency', source)
    .eq('destination_currency', destination)
    .order('fetched_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (data) return Number(data.rate);
  return null;
}

export function getCountryInfo(code: string) {
  const { COUNTRIES } = require('@/lib/theme');
  return COUNTRIES.find((c: { code: string }) => c.code === code);
}

export function getReceivingMethodLabel(method: string): string {
  const { RECEIVING_METHODS } = require('@/lib/theme');
  const m = RECEIVING_METHODS.find((r: { value: string }) => r.value === method);
  return m ? m.label : method;
}

export function getRecurringLabel(type: string): string {
  const { RECURRING_OPTIONS } = require('@/lib/theme');
  const r = RECURRING_OPTIONS.find((r: { value: string }) => r.value === type);
  return r ? r.label : type;
}
