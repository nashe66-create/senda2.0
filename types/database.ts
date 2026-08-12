export type KycStatus = 'unverified' | 'pending' | 'verified' | 'rejected';
export type ReceivingMethod = 'mobile_money' | 'bank_account' | 'cash_pickup' | 'bill_payment';
export type PlanStatus = 'draft' | 'approved' | 'confirmed' | 'processing' | 'completed' | 'failed';
export type CommitmentStatus = 'pending' | 'processing' | 'completed' | 'failed';
export type TransactionStatus = 'pending' | 'successful' | 'failed' | 'refunded';
export type RecurringType = 'one_off' | 'weekly' | 'biweekly' | 'monthly';

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  phone: string;
  kyc_status: KycStatus;
  flutterwave_customer_id: string | null;
  country: string;
  created_at: string;
}

export interface Recipient {
  id: string;
  user_id: string;
  name: string;
  country: string;
  receiving_method: ReceivingMethod;
  phone: string;
  mobile_money_provider: string;
  bank_code: string;
  account_number: string;
  bill_type: string;
  relationship: string;
  notes: string;
  created_at: string;
}

export interface Plan {
  id: string;
  user_id: string;
  name: string;
  status: PlanStatus;
  total_gbp: number;
  total_recipients: number;
  destination_currencies: string[];
  next_run_date: string | null;
  recurring: RecurringType;
  created_at: string;
  updated_at: string;
}

export interface Commitment {
  id: string;
  plan_id: string;
  recipient_id: string | null;
  user_id: string;
  amount_gbp: number;
  destination_currency: string;
  amount_destination: number;
  fx_rate: number;
  receiving_method: ReceivingMethod;
  status: CommitmentStatus;
  flutterwave_transfer_id: string | null;
  failure_reason: string | null;
  created_at: string;
  recipient?: Recipient | null;
}

export interface Transaction {
  id: string;
  plan_id: string;
  user_id: string;
  amount_gbp: number;
  status: TransactionStatus;
  payment_reference: string | null;
  flutterwave_payment_id: string | null;
  created_at: string;
  completed_at: string | null;
  plan?: Plan;
}

export interface FxRate {
  id: string;
  source_currency: string;
  destination_currency: string;
  rate: number;
  fetched_at: string;
}

export type CommitmentWithRecipient = Omit<Commitment, 'recipient'> & {
  recipient: Recipient | null;
};

export interface PlanWithCommitments extends Plan {
  commitments: CommitmentWithRecipient[];
}
