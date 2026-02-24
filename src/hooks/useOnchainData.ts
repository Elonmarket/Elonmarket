import { useState, useEffect, useCallback } from "react";

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

const POLL_INTERVAL = 30_000; // 30 seconds

export function useOnchainData() {
  const [data, setData] = useState<OnchainData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/onchain-data`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({}),
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const result = await res.json();
      setData(result);
      setError(null);
    } catch (err) {
      console.error("Failed to fetch on-chain data:", err);
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
