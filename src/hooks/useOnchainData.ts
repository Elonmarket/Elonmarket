import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface OnchainData {
  vault: {
    address: string;
    balance_sol: number;
  };
  payout: {
    address: string;
    balance_sol: number;
  };
  token: {
    address: string;
    total_supply: number;
    decimals: number;
    holder_count: number;
  };
  round_payout: {
    percentage: number;
    estimated_sol: number;
  };
  fetched_at: string;
}

const POLL_INTERVAL = 30_000;
const REQUEST_DEDUPE_WINDOW = 5_000;
const DEFAULT_PAYOUT_PERCENTAGE = 15;

let cachedOnchainData: OnchainData | null = null;
let inFlightRequest: Promise<OnchainData | null> | null = null;
let lastFetchStartedAt = 0;

async function getCachedWalletBalancesFallback(): Promise<OnchainData | null> {
  const { data: balances } = await supabase
    .from("wallet_balances")
    .select("vault_balance_sol, payout_balance_sol, last_updated_at")
    .maybeSingle();

  if (!balances) {
    return cachedOnchainData;
  }

  const payoutPercentage = cachedOnchainData?.round_payout.percentage ?? DEFAULT_PAYOUT_PERCENTAGE;

  return {
    vault: {
      address: cachedOnchainData?.vault.address ?? "",
      balance_sol: Number(balances.vault_balance_sol ?? 0),
    },
    payout: {
      address: cachedOnchainData?.payout.address ?? "",
      balance_sol: Number(balances.payout_balance_sol ?? 0),
    },
    token: cachedOnchainData?.token ?? {
      address: "",
      total_supply: 0,
      decimals: 0,
      holder_count: 0,
    },
    round_payout: {
      percentage: payoutPercentage,
      estimated_sol: Number(balances.vault_balance_sol ?? 0) * (payoutPercentage / 100),
    },
    fetched_at: balances.last_updated_at ?? new Date().toISOString(),
  };
}

async function fetchOnchainData(): Promise<OnchainData | null> {
  const now = Date.now();

  if (inFlightRequest) {
    return inFlightRequest;
  }

  if (cachedOnchainData && now - lastFetchStartedAt < REQUEST_DEDUPE_WINDOW) {
    return cachedOnchainData;
  }

  lastFetchStartedAt = now;

  inFlightRequest = (async () => {
    try {
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/onchain-data`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({}),
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const result = (await res.json()) as OnchainData;
      cachedOnchainData = result;
      return result;
    } catch (err) {
      console.error("Failed to fetch on-chain data:", err);
      const fallback = await getCachedWalletBalancesFallback();
      if (fallback) {
        cachedOnchainData = fallback;
      }
      return fallback;
    } finally {
      inFlightRequest = null;
    }
  })();

  return inFlightRequest;
}

export function useOnchainData() {
  const [data, setData] = useState<OnchainData | null>(cachedOnchainData);
  const [loading, setLoading] = useState(!cachedOnchainData);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading((prev) => prev || !cachedOnchainData);

    try {
      const result = await fetchOnchainData();
      if (result) {
        setData(result);
        setError(null);
      } else {
        setError("Unable to load on-chain data");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchData]);

  return { data, loading, error, refetch: fetchData };
}
