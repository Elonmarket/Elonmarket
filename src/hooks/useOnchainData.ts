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
const DEFAULT_PAYOUT_PERCENTAGE = 15;

let cachedOnchainData: OnchainData | null = null;

async function loadFromDatabase(): Promise<OnchainData | null> {
  try {
    const { data: balances } = await supabase
      .from("wallet_balances")
      .select("vault_balance_sol, payout_balance_sol, claimable_rewards_sol, last_updated_at")
      .maybeSingle();

    if (!balances) return null;

    const vaultBalance = Number(balances.vault_balance_sol ?? 0);
    const payoutPercentage = cachedOnchainData?.round_payout.percentage ?? DEFAULT_PAYOUT_PERCENTAGE;

    return {
      vault: {
        address: cachedOnchainData?.vault.address ?? "",
        balance_sol: vaultBalance,
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
        estimated_sol: vaultBalance * (payoutPercentage / 100),
      },
      fetched_at: balances.last_updated_at ?? new Date().toISOString(),
    };
  } catch (err) {
    console.error("Failed to load wallet balances:", err);
    return cachedOnchainData;
  }
}

async function tryEdgeFunction(): Promise<OnchainData | null> {
  try {
    const { data, error } = await supabase.functions.invoke("onchain-data", {
      method: "POST",
      body: {},
    });

    if (error) return null;

    return data as OnchainData;
  } catch {
    return null;
  }
}

async function fetchOnchainData(): Promise<OnchainData | null> {
  // Always load from DB first (reliable)
  const dbData = await loadFromDatabase();
  if (dbData) {
    cachedOnchainData = dbData;
  }

  // Try edge function in background for fresh data (may fail in some environments)
  tryEdgeFunction().then((edgeData) => {
    if (edgeData) {
      cachedOnchainData = edgeData;
    }
  });

  return cachedOnchainData;
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
