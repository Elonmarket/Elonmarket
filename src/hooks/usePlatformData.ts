import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface WalletConfig {
  id: string;
  vault_wallet_address: string;
  payout_wallet_address: string;
  token_contract_address: string;
  min_token_balance: number;
  payout_percentage: number;
  twitter_user_id: string;
  twitter_username: string;
}

export interface PlatformConfig {
  platform_name: string;
  platform_tagline: string;
  prediction_question: string;
  round_duration_hours: number;
  ai_matching_enabled: boolean;
  ai_similarity_threshold: number;
}

export interface PayoutStats {
  total_paid_usd: number;
  total_predictions_made: number;
  total_rounds_completed: number;
}

export interface WalletBalances {
  vault_balance_sol: number;
  payout_balance_sol: number;
  claimable_rewards_sol: number;
  last_updated_at: string;
}

export function usePlatformData() {
  const [walletConfig, setWalletConfig] = useState<WalletConfig | null>(null);
  const [platformConfig, setPlatformConfig] = useState<PlatformConfig | null>(null);
  const [payoutStats, setPayoutStats] = useState<PayoutStats | null>(null);
  const [walletBalances, setWalletBalances] = useState<WalletBalances | null>(null);
  const [playerCount, setPlayerCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      // Fetch player count (only count users who have made at least 1 prediction)
      const { count } = await supabase
        .from("profiles")
        .select("*", { count: "exact", head: true })
        .gt("total_predictions", 0);
      
      if (count !== null) {
        setPlayerCount(count);
      }

      // Fetch wallet config
      const { data: wallet } = await supabase
        .from("wallet_config")
        .select("*")
        .maybeSingle();

      if (wallet) {
        setWalletConfig(wallet as WalletConfig);
      }

      // Fetch platform config
      const { data: config } = await supabase
        .from("platform_config")
        .select("key, value");

      if (config) {
        const configObj: any = {};
        config.forEach((item: any) => {
          try {
            configObj[item.key] = JSON.parse(item.value);
          } catch {
            configObj[item.key] = item.value;
          }
        });
        setPlatformConfig(configObj as PlatformConfig);
      }

      // Fetch payout stats
      const { data: stats } = await supabase
        .from("payout_stats")
        .select("*")
        .maybeSingle();

      if (stats) {
        setPayoutStats(stats as PayoutStats);
      }

      // Fetch wallet balances
      const { data: balances } = await supabase
        .from("wallet_balances")
        .select("*")
        .maybeSingle();

      if (balances) {
        setWalletBalances(balances as WalletBalances);
      }
    } catch (err) {
      console.error("Error fetching platform data:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();

    // Subscribe to realtime updates
    const statsChannel = supabase
      .channel("stats")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "payout_stats" },
        () => fetchData()
      )
      .subscribe();

    const balancesChannel = supabase
      .channel("balances")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "wallet_balances" },
        () => fetchData()
      )
      .subscribe();

    return () => {
      statsChannel.unsubscribe();
      balancesChannel.unsubscribe();
    };
  }, [fetchData]);

  return { walletConfig, platformConfig, payoutStats, walletBalances, playerCount, loading, refetch: fetchData };
}
