import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
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
    isWinner: boolean;
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

      let isWinner = false;
      let winningOptionLabel = null;

      if (latestRound.winning_option_id) {
        const { data: option } = await supabase
          .from("prediction_options")
          .select("label")
          .eq("id", latestRound.winning_option_id)
          .maybeSingle();
        if (option) winningOptionLabel = option.label;
      }

      if (user?.id) {
        const { data: vote } = await supabase
          .from("votes")
          .select("option_id")
          .eq("round_id", latestRound.id)
          .eq("user_id", user.id)
          .maybeSingle();

        if (vote) {
          if (latestRound.status !== "no_winner" && vote.option_id === latestRound.winning_option_id) {
            isWinner = true;
          }
        }
      }

      setResult({
        roundId: latestRound.id,
        roundNumber: latestRound.round_number,
        status: latestRound.status,
        isWinner,
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

  const isNoWinner = result.status === "no_winner";
  const themeColor = result.isWinner ? "text-neon-green" : isNoWinner ? "text-neon-orange" : "text-neon-cyan";
  const glowColor = result.isWinner ? "rgba(34,197,94,0.4)" : isNoWinner ? "rgba(249,115,22,0.4)" : "rgba(34,211,238,0.4)";

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="sm:max-w-[440px] border border-white/10 bg-[#070b14]/90 backdrop-blur-2xl p-0 overflow-hidden rounded-[2rem] shadow-[0_0_50px_rgba(0,0,0,0.5)]">
        <div className="relative p-8 flex flex-col items-center">
          {/* Subtle Background Glow */}
          <div 
            className="absolute -top-24 left-1/2 -translate-x-1/2 w-64 h-64 blur-[100px] rounded-full opacity-20 pointer-events-none"
            style={{ backgroundColor: glowColor }}
          />

          {/* Top Status Icon */}
          <motion.div 
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="relative mb-8"
          >
            <div 
              className="absolute inset-0 blur-2xl rounded-full scale-150"
              style={{ backgroundColor: glowColor }}
            />
            <div className="relative w-20 h-20 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md flex items-center justify-center rotate-3 hover:rotate-0 transition-transform duration-500">
              {result.isWinner ? (
                <Gift className="w-10 h-10 text-neon-green" />
              ) : isNoWinner ? (
                <AlertCircle className="w-10 h-10 text-neon-orange" />
              ) : (
                <Trophy className="w-10 h-10 text-neon-cyan" />
              )}
            </div>
          </motion.div>

          {/* Header */}
          <div className="text-center space-y-1.5 mb-8">
            <h2 className="text-sm font-bold uppercase tracking-[0.2em] text-muted-foreground/60">
              Round #{result.roundNumber} Complete
            </h2>
            <div className="text-2xl font-display font-bold text-white tracking-tight flex items-center justify-center gap-2">
              Winning Category: 
              <span className={`${themeColor} uppercase`}>
                {result.winningOptionLabel || "None"}
              </span>
            </div>
          </div>

          {/* Winning Post Content */}
          <div className="w-full bg-white/[0.03] border border-white/5 rounded-2xl p-6 mb-8 group relative overflow-hidden">
            <Quote className="absolute -top-2 -right-2 w-12 h-12 text-white/5 -rotate-12" />
            <p className="text-[10px] text-muted-foreground/50 uppercase tracking-widest font-black mb-3">
              Verified Post
            </p>
            <p className="text-white/80 italic leading-relaxed text-base">
              "{result.winningTweetText || "The round concluded without a matching trigger post."}"
            </p>
          </div>

          {/* Statistics Grid */}
          <div className="grid grid-cols-2 w-full mb-10 relative">
            <div className="text-center py-2">
              <p className="text-2xl font-bold text-white tabular-nums">
                {result.totalWinners}
              </p>
              <p className="text-[10px] text-muted-foreground uppercase tracking-[0.15em] font-bold">
                Winners
              </p>
            </div>
            {/* Divider */}
            <div className="absolute left-1/2 top-1/2 -translate-y-1/2 w-px h-8 bg-white/10" />
            <div className="text-center py-2">
              <p className={`text-2xl font-bold ${themeColor} tabular-nums`}>
                {result.payoutAmount.toFixed(4)} <span className="text-sm">SOL</span>
              </p>
              <p className="text-[10px] text-muted-foreground uppercase tracking-[0.15em] font-bold">
                Per Winner
              </p>
            </div>
          </div>

          {/* Action Button Section */}
          <div className="w-full space-y-4">
            <Button 
              className={`w-full h-14 rounded-xl font-black text-sm uppercase tracking-widest transition-all duration-300 hover:scale-[1.01] active:scale-[0.98] border-none shadow-xl
                ${result.isWinner 
                  ? "bg-neon-green text-black hover:bg-neon-green/90 shadow-neon-green/20" 
                  : "bg-white/10 text-white hover:bg-white/20"
                }`}
              onClick={handleClose}
            >
              {result.isWinner ? "Reward Secured" : "Back to Markets"}
            </Button>
            
            <AnimatePresence>
              {result.isWinner && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center justify-center gap-2 text-neon-green"
                >
                  <CheckCircle2 className="w-3 h-3" />
                  <span className="text-[10px] font-bold uppercase tracking-wider">
                    Automatic transfer completed
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


