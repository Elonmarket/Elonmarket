import { CheckCircle, Trophy } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { usePredictionRound } from "@/hooks/usePredictionRound";
import { useAuth } from "@/contexts/AuthContext";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { formatToLocalTime } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

export const ClaimSection = () => {
  const { currentRound, options } = usePredictionRound();
  const { user } = useAuth();
  const [isWinner, setIsWinner] = useState(false);
  const [payoutAmount, setPayoutAmount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [winningTweetTime, setWinningTweetTime] = useState<string | null>(null);

  const isFinalized = currentRound?.status === "finalized" || currentRound?.status === "paid";
  const winningOption = options.find((opt) => opt.is_winner);

  useEffect(() => {
    const checkWinnerStatus = async () => {
      if (!user?.wallet_address || !currentRound?.winning_option_id || !isFinalized) {
        setIsWinner(false);
        return;
      }

      setLoading(true);
      try {
        const { data: profile } = await supabase
          .from("profiles")
          .select("id")
          .eq("wallet_address", user.wallet_address)
          .maybeSingle();

        if (!profile) { setIsWinner(false); setLoading(false); return; }

        const { data: vote } = await supabase
          .from("votes")
          .select("id")
          .eq("round_id", currentRound.id)
          .eq("user_id", profile.id)
          .eq("option_id", currentRound.winning_option_id)
          .maybeSingle();

        setIsWinner(!!vote);
        setPayoutAmount(currentRound.payout_per_winner || 0);
      } catch (error) {
        console.error("Error checking winner status:", error);
      } finally {
        setLoading(false);
      }
    };

    checkWinnerStatus();
  }, [user, currentRound, isFinalized]);

  useEffect(() => {
    const fetchWinningTweet = async () => {
      const tweetId = currentRound?.winning_tweet_id;
      if (!tweetId) return;

      const { data } = await supabase
        .from("tweets")
        .select("created_at_twitter")
        .eq("tweet_id", tweetId)
        .maybeSingle();

      if (data) setWinningTweetTime(data.created_at_twitter);
    };
    fetchWinningTweet();
  }, [currentRound?.winning_tweet_id]);

  if (!isWinner || !isFinalized) return null;

  return (
    <section id="claim" className="py-12 relative overflow-hidden">
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: -20 }}
          className="container mx-auto px-4"
        >
          <div className="max-w-2xl mx-auto">
            <Card variant="neon" className="overflow-hidden border-neon-green/30">
              <CardHeader className="bg-gradient-to-br from-neon-green/10 to-neon-cyan/10 text-center pb-2">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-neon-green to-neon-cyan flex items-center justify-center shadow-[0_0_20px_rgba(34,197,94,0.3)]">
                  <Trophy className="w-8 h-8 text-background" />
                </div>
                <CardTitle className="text-3xl font-display font-bold tracking-tight">
                  CONGRATULATIONS!
                </CardTitle>
                {winningOption && (
                  <p className="text-muted-foreground mt-2 font-medium">
                    Winning category: <span className="text-neon-green font-bold uppercase">{winningOption.label}</span>
                  </p>
                )}
              </CardHeader>

              <CardContent className="p-6 space-y-6">
                {currentRound?.winning_tweet_text && (
                  <div className="p-4 rounded-xl bg-muted/30 border border-border/50 relative group">
                    <div className="absolute inset-0 bg-neon-green/5 opacity-0 group-hover:opacity-100 transition-opacity rounded-xl" />
                    <p className="text-[10px] text-muted-foreground mb-2 uppercase tracking-widest font-bold">Winning Post</p>
                    <p className="text-foreground italic leading-relaxed">"{currentRound.winning_tweet_text}"</p>
                  </div>
                )}

                {loading ? (
                  <div className="flex flex-col items-center py-8">
                    <div className="w-10 h-10 border-2 border-neon-green border-t-transparent rounded-full animate-spin mb-4" />
                    <p className="text-muted-foreground animate-pulse text-sm">Verifying rewards...</p>
                  </div>
                ) : (
                  <div className="p-8 rounded-2xl bg-neon-green/5 border border-neon-green/20 text-center">
                    <CheckCircle className="w-12 h-12 text-neon-green mx-auto mb-4" />
                    <p className="text-neon-green font-display font-bold text-3xl mb-2">
                      {payoutAmount.toFixed(6)} SOL
                    </p>
                    <p className="text-base text-white/80 font-medium">
                      Automatically sent to your wallet
                    </p>
                  </div>
                )}

                {winningTweetTime && (
                  <div className="pt-4 border-t border-border/20 text-center">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold mb-1">
                      Validation Timestamp
                    </p>
                    <p className="text-sm text-neon-cyan font-mono">
                      {formatToLocalTime(winningTweetTime)}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </motion.div>
      </AnimatePresence>
    </section>
  );
};
