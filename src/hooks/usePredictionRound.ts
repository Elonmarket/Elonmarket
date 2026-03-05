import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { parseToUTC } from "@/lib/utils";

export interface PredictionOption {
  id: string;
  round_id: string;
  label: string;
  keywords: string[];
  vote_count: number;
  is_winner: boolean;
  color: string;
  icon: string;
}

export interface PredictionRound {
  id: string;
  round_number: number;
  question: string;
  start_time: string;
  end_time: string;
  prediction_start_time?: string;
  vote_lock_minutes?: number;
  status: "upcoming" | "open" | "finalizing" | "finalized" | "paid" | "no_winner";
  winning_option_id?: string;
  winning_tweet_id?: string;
  winning_tweet_text?: string;
  vault_balance_snapshot?: number;
  payout_amount?: number;
  payout_per_winner?: number;
  total_winners: number;
  total_votes: number;
  refill_completed: boolean;
  accumulated_from_previous: number;
  prediction_options?: PredictionOption[];
}

export function usePredictionRound() {
  const [currentRound, setCurrentRound] = useState<PredictionRound | null>(null);
  const [options, setOptions] = useState<PredictionOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isDetectingRef = useRef(false);

  const fetchCurrentRound = useCallback(async () => {
    try {
      setLoading(true);

      // Get current open round - pick the one with highest round_number if multiple are open
      const { data: openRound } = await supabase
        .from("prediction_rounds")
        .select("*")
        .eq("status", "open")
        .order("round_number", { ascending: false })
        .limit(1)
        .maybeSingle();

      let round = openRound;

      if (!round) {
        // Try upcoming round - pick the one starting soonest
        const { data: upcomingRound } = await supabase
          .from("prediction_rounds")
          .select("*")
          .eq("status", "upcoming")
          .order("start_time", { ascending: true })
          .limit(1)
          .maybeSingle();

        round = upcomingRound;
      }

      if (!round) {
        // Get latest finalized round by round_number
        const { data: latestRound } = await supabase
          .from("prediction_rounds")
          .select("*")
          .in("status", ["finalized", "paid", "no_winner"])
          .order("round_number", { ascending: false })
          .limit(1)
          .maybeSingle();

        round = latestRound;
      }

      if (round) {
        setCurrentRound(round as PredictionRound);

        // If the round is still marked as open but the end time has passed,
        // trigger the winner detection function to finalize it as 'no_winner'
        const endTime = parseToUTC(round.end_time);
        if (round.status === "open" && endTime <= new Date() && !isDetectingRef.current) {
          console.log("Round end time reached, triggering winner detection...");
          isDetectingRef.current = true;
          supabase.functions.invoke("detect-winner", {
            body: { force_finalize: true, triggered_by: "client_timer" }
          }).then(({ data, error }) => {
            if (error) console.error("Error triggering winner detection:", error);
            else console.log("Winner detection triggered:", data);
            // Refetch to get the updated status
            fetchCurrentRound();
          }).finally(() => {
            isDetectingRef.current = false;
          });
        }

        // Fetch options for this round
        const { data: optionsData } = await supabase
          .from("prediction_options")
          .select("*")
          .eq("round_id", round.id)
          .order("vote_count", { ascending: false });

        setOptions((optionsData as PredictionOption[]) || []);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCurrentRound();

    const roundsChannel = supabase
      .channel("rounds")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "prediction_rounds" },
        () => fetchCurrentRound()
      )
      .subscribe();

    const optionsChannel = supabase
      .channel("options")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "prediction_options" },
        () => fetchCurrentRound()
      )
      .subscribe();

    return () => {
      roundsChannel.unsubscribe();
      optionsChannel.unsubscribe();
    };
  }, [fetchCurrentRound]);

  return { currentRound, options, loading, error, refetch: fetchCurrentRound };
}
