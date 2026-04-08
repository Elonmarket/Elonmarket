import React, { useEffect, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Trophy, AlertCircle, Gift, Quote, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { motion, AnimatePresence } from "framer-motion";

const STORAGE_KEY = "last_seen_round_id";

export const RoundResultDialog = () => {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState<{
    roundId: string;
    roundNumber: number;
    status: string;
    isPersonalWinner: boolean;
    userVoted: boolean;
    hasWinner: boolean;
    winningOptionLabel: string | null;
    payoutAmount: number;
    totalWinners: number;
    winningTweetText: string | null;
  } | null>(null);

  useEffect(() => {
    const checkLatestRound = async () => {
      const { data: latestRound, error } = await supabase
        .from("prediction_rounds")
        .select("id, round_number, status, winning_option_id, payout_per_winner, winning_tweet_text, total_winners")
        .in("status", ["finalized", "paid", "no_winner"])
        .order("round_number", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error || !latestRound) return;

      const lastSeenId = localStorage.getItem(STORAGE_KEY);
      if (lastSeenId === latestRound.id) return;

      const hasWinner = !!latestRound.winning_option_id;
      const isNoWinner = !hasWinner;
      let isPersonalWinner = false;
      let winningOptionLabel: string | null = null;

      if (latestRound.winning_option_id) {
        const { data: option } = await supabase
          .from("prediction_options")
          .select("label")
          .eq("id", latestRound.winning_option_id)
          .maybeSingle();

        if (option) {
          winningOptionLabel = option.label;
        }
      }

      let userVoted = false;
      if (user?.id) {
        const { data: vote } = await supabase
          .from("votes")
          .select("option_id")
          .eq("round_id", latestRound.id)
          .eq("user_id", user.id)
          .maybeSingle();

        userVoted = !!vote;
        if (hasWinner && vote) {
          isPersonalWinner = vote.option_id === latestRound.winning_option_id;
        }
      }

      setResult({
        roundId: latestRound.id,
        roundNumber: latestRound.round_number,
        status: latestRound.status,
        isPersonalWinner,
        userVoted,
        hasWinner,
        winningOptionLabel,
        payoutAmount: latestRound.payout_per_winner || 0,
        totalWinners: latestRound.total_winners || 0,
        winningTweetText: latestRound.winning_tweet_text || null,
      });
      setOpen(true);
    };

    checkLatestRound();

    const channel = supabase
      .channel("round-results")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "prediction_rounds" },
        (payload) => {
          if (["finalized", "paid", "no_winner"].includes(payload.new.status)) {
            checkLatestRound();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  const handleClose = () => {
    if (result) {
      localStorage.setItem(STORAGE_KEY, result.roundId);
    }
    setOpen(false);
  };

  if (!result) return null;

  // Use hasWinner (presence of winning_option_id) as the source of truth, not just status
  const isNoWinner = !result.hasWinner;
  const userVotedAndLost = result.userVoted && !result.isPersonalWinner && result.hasWinner;
  const iconToneClass = isNoWinner ? "text-neon-orange" : userVotedAndLost ? "text-neon-orange" : "text-neon-cyan";
  const glowColor = isNoWinner ? "rgba(249,115,22,0.32)" : userVotedAndLost ? "rgba(249,115,22,0.28)" : "rgba(34,211,238,0.28)";
  const summaryText = isNoWinner
    ? "No winners this round. No matching post was detected before the round closed."
    : result.isPersonalWinner
      ? "You picked the winning category. Rewards are being sent automatically from the vault."
      : userVotedAndLost
        ? `Winning category: ${result.winningOptionLabel || "Unknown"}. You didn't win this round. Try again and good luck next time!`
        : `Winning category: ${result.winningOptionLabel || "Unknown"}. Automatic rewards were sent to the correct winner wallets.`;

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && handleClose()}>
      <DialogContent className="max-w-[85vw] sm:max-w-[320px] border border-white/10 bg-[#070b14]/90 backdrop-blur-2xl p-0 overflow-hidden rounded-[1rem] shadow-[0_0_50px_rgba(0,0,0,0.5)]">
        <div className="relative p-4 flex flex-col items-center">
          <div
            className="absolute -top-16 left-1/2 -translate-x-1/2 w-40 h-40 blur-[80px] rounded-full opacity-20 pointer-events-none"
            style={{ backgroundColor: glowColor }}
          />

          <motion.div
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="relative mb-3"
          >
            <div
              className="absolute inset-0 blur-xl rounded-full scale-150"
              style={{ backgroundColor: glowColor }}
            />
            <div className="relative w-10 h-10 rounded-lg bg-white/5 border border-white/10 backdrop-blur-md flex items-center justify-center rotate-3 hover:rotate-0 transition-transform duration-500">
              {isNoWinner ? (
                <AlertCircle className="w-5 h-5 text-neon-orange" />
              ) : result.isPersonalWinner ? (
                <Gift className="w-5 h-5 text-neon-green" />
              ) : userVotedAndLost ? (
                <AlertCircle className="w-5 h-5 text-neon-orange" />
              ) : (
                <Trophy className="w-5 h-5 text-neon-cyan" />
              )}
            </div>
          </motion.div>

          <div className="text-center space-y-1 mb-3">
            <h2 className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/60">
              Round #{result.roundNumber} Complete
            </h2>
            <div className="text-sm sm:text-base font-display font-bold text-white tracking-tight flex flex-wrap items-center justify-center gap-1.5">
              {isNoWinner ? "No Winner" : "Winning Category:"}
              {!isNoWinner && (
                <span className={`${iconToneClass} uppercase`}>
                  {result.winningOptionLabel || "Unknown"}
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground max-w-[260px] mx-auto leading-relaxed">
              {summaryText}
            </p>
            {result.isPersonalWinner && !isNoWinner && (
              <p className="text-neon-green text-xs font-bold mt-1">You predicted correctly!</p>
            )}
            {userVotedAndLost && (
              <p className="text-neon-orange text-xs font-bold mt-1">You didn't win this round. Good luck next time!</p>
            )}
          </div>

          <div className="w-full bg-white/[0.03] border border-white/5 rounded-lg p-3 mb-3 group relative overflow-hidden">
            <Quote className="absolute -top-2 -right-2 w-8 h-8 text-white/5 -rotate-12" />
            <p className="text-[9px] text-muted-foreground/50 uppercase tracking-widest font-black mb-1.5">
              {isNoWinner ? "Round Summary" : "Verified Post"}
            </p>
            <p className="text-white/80 italic leading-relaxed text-xs">
              "{result.winningTweetText || (isNoWinner ? "No matching post was detected during this round." : "The round ended after a verified winning post was matched.")}"
            </p>
          </div>

          {!isNoWinner && (
            <div className="grid grid-cols-2 w-full mb-4 relative">
              <div className="text-center py-1">
                <p className="text-lg font-bold text-white tabular-nums">
                  {result.totalWinners}
                </p>
                <p className="text-[9px] text-muted-foreground uppercase tracking-[0.15em] font-bold">
                  Winners
                </p>
              </div>
              <div className="absolute left-1/2 top-1/2 -translate-y-1/2 w-px h-6 bg-white/10" />
              <div className="text-center py-1">
                <p className={`text-lg font-bold ${result.isPersonalWinner ? "text-neon-green" : "text-neon-cyan"} tabular-nums`}>
                  {result.payoutAmount.toFixed(4)} <span className="text-xs">SOL</span>
                </p>
                <p className="text-[9px] text-muted-foreground uppercase tracking-[0.15em] font-bold">
                  Per Winner
                </p>
              </div>
            </div>
          )}

          <div className="w-full space-y-2">
            <Button
              className={`w-full h-9 rounded-lg font-black text-[10px] uppercase tracking-widest transition-all duration-300 hover:scale-[1.01] active:scale-[0.98] border-none shadow-xl ${
                result.isPersonalWinner
                  ? "bg-neon-green text-black hover:bg-neon-green/90 shadow-neon-green/20"
                  : "bg-white/10 text-white hover:bg-white/20"
              }`}
              onClick={handleClose}
            >
              Close Results
            </Button>

            <AnimatePresence>
              {result.isPersonalWinner && !isNoWinner && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center justify-center gap-1.5 text-neon-green"
                >
                  <CheckCircle2 className="w-2.5 h-2.5" />
                  <span className="text-[9px] font-bold uppercase tracking-wider">
                    Automatic transfer sent to winners
                  </span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};