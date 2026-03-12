import { Gift, CheckCircle, Clock, AlertCircle, Wallet, Trophy, Activity } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { usePredictionRound } from "@/hooks/usePredictionRound";
import { useClaim } from "@/hooks/useClaim";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { formatToLocalTime } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

interface ClaimInfo {
  amount: number;
  unclaimedRewards: number;
  isWinner: boolean;
  hasClaimed: boolean;
  roundsClaimed: number;
}

export const ClaimSection = () => {
  const { currentRound, options } = usePredictionRound();
  const { claimReward, loading: claimLoading } = useClaim();
  const { connected, publicKey } = useWallet();
  const { setVisible } = useWalletModal();
  const [claimInfo, setClaimInfo] = useState<ClaimInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [winningTweetTime, setWinningTweetTime] = useState<string | null>(null);

  const isFinalized = currentRound?.status === "finalized" || currentRound?.status === "paid";
  const hasUnclaimedRewards = !!(claimInfo && claimInfo.unclaimedRewards > 0);

  useEffect(() => {
    const fetchWinningTweet = async () => {
      let tweetId = currentRound?.winning_tweet_id;

      // If current round isn't finalized but user has rewards, 
      // they likely won the most recently finalized round.
      if (!tweetId && hasUnclaimedRewards) {
        const { data: lastFinalized } = await supabase
          .from("prediction_rounds")
          .select("winning_tweet_id")
          .in("status", ["finalized", "paid"])
          .order("finalized_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        
        if (lastFinalized?.winning_tweet_id) {
          tweetId = lastFinalized.winning_tweet_id;
        }
      }

      if (tweetId) {
        const { data } = await supabase
          .from("tweets")
          .select("created_at_twitter")
          .eq("tweet_id", tweetId)
          .maybeSingle();
        
        if (data) {
          setWinningTweetTime(data.created_at_twitter);
        }
      }
    };
    fetchWinningTweet();
  }, [currentRound?.winning_tweet_id, hasUnclaimedRewards]);

  useEffect(() => {
    const checkClaimStatus = async () => {
      if (!connected || !publicKey) {
        setClaimInfo(null);
        return;
      }

      setLoading(true);
      try {
        // Get user profile with unclaimed rewards
        const { data: profile } = await supabase
          .from("profiles")
          .select("*")
          .eq("wallet_address", publicKey.toBase58())
          .maybeSingle();

        if (!profile) {
          setClaimInfo(null);
          setLoading(false);
          return;
        }

        const unclaimedRewards = (profile as any).unclaimed_rewards_sol || 0;

        // Check if user is a winner in the current or any round
        let isWinner = false;
        if (currentRound?.winning_option_id) {
          const { data: vote } = await supabase
            .from("votes")
            .select("*")
            .eq("round_id", currentRound.id)
            .eq("user_id", profile.id)
            .eq("option_id", currentRound.winning_option_id)
            .maybeSingle();
          
          isWinner = !!vote;
        }

        // Check if already claimed current round
        let hasClaimed = false;
        if (currentRound) {
          const { data: claim } = await supabase
            .from("claims")
            .select("id")
            .eq("round_id", currentRound.id)
            .eq("user_id", profile.id)
            .maybeSingle();
          
          hasClaimed = !!claim;
        }

        setClaimInfo({
          amount: currentRound?.payout_per_winner || 0,
          unclaimedRewards,
          isWinner: isWinner || unclaimedRewards > 0,
          hasClaimed: hasClaimed && unclaimedRewards <= 0,
          roundsClaimed: 0,
        });
      } catch (error) {
        console.error("Error checking claim status:", error);
      } finally {
        setLoading(false);
      }
    };

    checkClaimStatus();
  }, [connected, publicKey, currentRound]);

  const handleClaim = async () => {
    const success = await claimReward(currentRound?.id);
    if (success) {
      // Refresh claim info
      setClaimInfo((prev) => prev ? { ...prev, hasClaimed: true, unclaimedRewards: 0 } : null);
    }
  };

  const winningOption = options.find((opt) => opt.is_winner);

  // ONLY show this section if the user has unclaimed rewards OR is a winner of the finalized round
  if (!hasUnclaimedRewards && !claimInfo?.isWinner) {
    return null;
  }

  return (
    <section id="claim" className="py-12 relative overflow-hidden">
      <AnimatePresence>
        {(hasUnclaimedRewards || claimInfo?.isWinner) && (
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
                  {winningOption && isFinalized && (
                    <p className="text-muted-foreground mt-2 font-medium">
                      Winning category: <span className="text-neon-green font-bold uppercase">{winningOption.label}</span>
                    </p>
                  )}
                </CardHeader>

                <CardContent className="p-6 space-y-6">
                  {currentRound?.winning_tweet_text && isFinalized && (
                    <div className="p-4 rounded-xl bg-muted/30 border border-border/50 relative group">
                      <div className="absolute inset-0 bg-neon-green/5 opacity-0 group-hover:opacity-100 transition-opacity rounded-xl" />
                      <p className="text-[10px] text-muted-foreground mb-2 uppercase tracking-widest font-bold">Winning Post</p>
                      <p className="text-foreground italic leading-relaxed">"{currentRound.winning_tweet_text}"</p>
                    </div>
                  )}

                  {loading ? (
                    <div className="flex flex-col items-center py-8">
                      <div className="w-10 h-10 border-2 border-neon-green border-t-transparent rounded-full animate-spin mb-4" />
                      <p className="text-muted-foreground animate-pulse text-sm">Verifying on-chain rewards...</p>
                    </div>
                  ) : claimInfo?.isWinner && !claimInfo.hasClaimed ? (
                    <div className="p-8 rounded-2xl bg-neon-green/5 border border-neon-green/40 text-center shadow-[inset_0_0_20px_rgba(34,197,94,0.05)]">
                      <div className="relative inline-block mb-4">
                        <Trophy className="w-12 h-12 text-neon-green" />
                        <motion.div 
                          animate={{ scale: [1, 1.5, 1], opacity: [0.5, 0, 0.5] }}
                          transition={{ duration: 2, repeat: Infinity }}
                          className="absolute inset-0 bg-neon-green rounded-full blur-xl"
                        />
                      </div>
                      <p className="text-neon-green font-display font-bold text-3xl mb-2">
                        You won {claimInfo.unclaimedRewards.toFixed(6)} SOL
                      </p>
                      <p className="text-base text-white/80 font-medium">
                        Sent automatically to your wallet address
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-2 italic">
                        (Manual claim available below as backup)
                      </p>
                      
                      <div className="mt-6">
                        <Button
                          variant="neon"
                          className="w-full h-12 text-lg font-bold shadow-[0_0_20px_rgba(34,197,94,0.2)]"
                          onClick={handleClaim}
                          disabled={claimLoading}
                        >
                          {claimLoading ? (
                            <div className="flex items-center gap-2">
                              <div className="w-4 h-4 border-2 border-background border-t-transparent rounded-full animate-spin" />
                              Processing...
                            </div>
                          ) : (
                            "MANUAL CLAIM"
                          )}
                        </Button>
                      </div>

                      {winningTweetTime && (
                        <div className="mt-6 pt-6 border-t border-neon-green/20">
                          <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold mb-1">
                            Validation Timestamp
                          </p>
                          <p className="text-sm text-neon-cyan font-mono">
                            {formatToLocalTime(winningTweetTime)}
                          </p>
                        </div>
                      )}
                    </div>
                  ) : hasUnclaimedRewards ? (
                    <div className="p-8 rounded-2xl bg-neon-cyan/5 border border-neon-cyan/40 text-center">
                      <Activity className="w-12 h-12 text-neon-cyan mx-auto mb-4" />
                      <p className="text-neon-cyan font-display font-bold text-3xl mb-2">
                        {claimInfo.unclaimedRewards.toFixed(6)} Sol
                      </p>
                      <p className="text-base text-white/80">
                        Pending automatic distribution
                      </p>
                    </div>
                  ) : claimInfo?.hasClaimed ? (
                    <div className="p-8 rounded-2xl bg-neon-green/5 border border-neon-green/20 text-center">
                      <CheckCircle className="w-12 h-12 text-neon-green mx-auto mb-4" />
                      <p className="text-neon-green font-display font-bold text-2xl mb-2">ALL REWARDS SECURED</p>
                      <p className="text-muted-foreground">
                        Your winnings have been transferred to your wallet.
                      </p>
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
};
