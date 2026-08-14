/* =========================================================
   FLUTTERWAVE
   ========================================================= */

export interface FlutterwaveCurrency {
  code: string;
  name?: string | null;
  symbol?: string | null;
  currency?: string | null;

  [key: string]: any;
}

export interface FlutterwaveMobileNetwork {
  id?: string | number | null;
  code?: string | null;
  name?: string | null;
  currency?: string | null;
  country?: string | null;

  [key: string]: any;
}

export interface FlutterwaveBank {
  id?: string | number | null;
  code?: string | null;
  name?: string | null;
  currency?: string | null;
  country?: string | null;

  [key: string]: any;
}

export interface FlutterwaveCountry {
  id?: string | number | null;
  code?: string | null;
  name?: string | null;
  currency?: string | null;
  flag?: string | null;

  payout_methods?: string[];

  [key: string]: any;
}

export interface FlutterwaveOptions {
  source_country: string;
  source_currency: string;

  country?: string;

  countries: FlutterwaveCountry[];

  currencies: FlutterwaveCurrency[];

  mobile_networks: FlutterwaveMobileNetwork[];

  banks: FlutterwaveBank[];

  payout_methods: string[];

  [key: string]: any;
}