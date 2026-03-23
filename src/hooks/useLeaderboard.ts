import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useWallet } from "@solana/wallet-adapter-react";

export interface LeaderboardEntry {
  id: string;
  user_id: string;
  wallet_address: string;
  display_name: string;
  total_wins: number;
  total_predictions: number;
  win_rate: number;
  total_claimed_usd: number;
  rank: number;
  isYou?: boolean;
}

export interface RecentWinner {
  id: string;
  round_id: string;
  user_id: string;
  wallet_address: string;
  amount: number;
  created_at: string;
  isYou?: boolean;
}

export function useLeaderboard() {
  const { publicKey } = useWallet();
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [recentWinners, setRecentWinners] = useState<RecentWinner[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLeaderboard = useCallback(async () => {
    try {
      const myWallet = publicKey?.toBase58() || "";

      // Fetch profiles that have at least 1 win, ordered by earnings
      const { data: profiles } = await supabase
        .from("profiles")
        .select("*")
        .gt("total_wins", 0)
        .order("total_claimed_usd", { ascending: false })
        .order("total_wins", { ascending: false })
        .order("total_predictions", { ascending: false })
        .limit(50);

      if (profiles) {
        const entries: LeaderboardEntry[] = profiles.map((p: any, index: number) => ({
          id: p.id,
          user_id: p.id,
          wallet_address: p.wallet_address,
          display_name: p.display_name || `${p.wallet_address.slice(0, 4)}...${p.wallet_address.slice(-4)}`,
          total_wins: p.total_wins || 0,
          total_predictions: p.total_predictions || 0,
          win_rate: p.total_predictions > 0 ? (p.total_wins / p.total_predictions) * 100 : 0,
          total_claimed_usd: p.total_claimed_usd || 0,
          rank: index + 1,
          isYou: p.wallet_address === myWallet,
        }));
        setLeaderboard(entries);
      }

      // Fetch recent winners - ordered by round_number desc
      const { data: winners } = await supabase
        .from("recent_winners")
        .select("*, prediction_rounds(round_number)")
        .order("created_at", { ascending: false })
        .limit(10);

      if (winners) {
        setRecentWinners(
          (winners as any[]).map((w) => ({
            ...w,
            isYou: w.wallet_address === myWallet,
          })) as RecentWinner[]
        );
      }
    } catch (err) {
      console.error("Error fetching leaderboard:", err);
    } finally {
      setLoading(false);
    }
  }, [publicKey]);

  useEffect(() => {
    fetchLeaderboard();

    const channel = supabase
      .channel("leaderboard")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "recent_winners" },
        () => fetchLeaderboard()
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [fetchLeaderboard]);

  return { leaderboard, recentWinners, loading, refetch: fetchLeaderboard };
}
