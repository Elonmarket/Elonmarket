import { Gift, CheckCircle, Clock, AlertCircle, Wallet, Trophy } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { usePredictionRound } from "@/hooks/usePredictionRound";
import { useClaim } from "@/hooks/useClaim";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

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

  const isFinalized = currentRound?.status === "finalized" || currentRound?.status === "paid";
  const winningOption = options.find((opt) => opt.is_winner);
  const hasUnclaimedRewards = claimInfo && claimInfo.unclaimedRewards > 0;

  // Show claim section if round is finalized OR user has unclaimed rewards from any round
  if (!isFinalized && !hasUnclaimedRewards) {
    return null;
  }

  return (
    <section id="claim" className="py-16 relative">
      <div className="container mx-auto px-4">
        <div className="max-w-2xl mx-auto">
          <Card variant="neon" className="overflow-hidden">
            <CardHeader className="bg-gradient-to-br from-neon-green/20 to-neon-cyan/20 text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-neon-green to-neon-cyan flex items-center justify-center">
                <Gift className="w-8 h-8 text-background" />
              </div>
              <CardTitle className="text-2xl">
                {hasUnclaimedRewards ? "Claim Your Rewards!" : `Round #${currentRound?.round_number} Complete!`}
              </CardTitle>
              {winningOption && isFinalized && (
                <p className="text-muted-foreground mt-2">
                  Winning category: <span className="text-neon-green font-bold">{winningOption.label}</span>
                </p>
              )}
            </CardHeader>

            <CardContent className="p-6 space-y-6">
              {currentRound?.winning_tweet_text && isFinalized && (
                <div className="p-4 rounded-lg bg-muted/50 border border-border">
                  <p className="text-sm text-muted-foreground mb-2">Winning Post:</p>
                  <p className="text-foreground italic">"{currentRound.winning_tweet_text}"</p>
                </div>
              )}

              {isFinalized && (
                <div className="grid grid-cols-2 gap-4 text-center">
                  <div className="p-4 rounded-lg bg-card">
                    <p className="text-2xl font-display font-bold text-neon-green">
                      {currentRound?.total_winners || 0}
                    </p>
                    <p className="text-sm text-muted-foreground">Winners</p>
                  </div>
                  <div className="p-4 rounded-lg bg-card">
                    <p className="text-2xl font-display font-bold text-neon-cyan">
                      {currentRound?.payout_per_winner?.toFixed(4) || "0"} SOL
                    </p>
                    <p className="text-sm text-muted-foreground">Per Winner</p>
                  </div>
                </div>
              )}

              {/* Accumulated rewards display */}
              {hasUnclaimedRewards && (
                <div className="p-4 rounded-lg bg-neon-green/10 border border-neon-green/30 text-center">
                  <Trophy className="w-6 h-6 text-neon-green mx-auto mb-2" />
                  <p className="text-lg font-display font-bold text-neon-green">
                    {claimInfo.unclaimedRewards.toFixed(6)} SOL
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Total accumulated unclaimed rewards
                  </p>
                </div>
              )}

              {!connected ? (
                <Button variant="neon" size="lg" className="w-full" onClick={() => setVisible(true)}>
                  <Wallet className="w-4 h-4" />
                  Connect Wallet to Check
                </Button>
              ) : loading ? (
                <Button variant="glass" size="lg" className="w-full" disabled>
                  <Clock className="w-4 h-4 animate-spin" />
                  Checking status...
                </Button>
              ) : claimInfo?.isWinner && !claimInfo.hasClaimed ? (
                <div className="p-4 rounded-lg bg-neon-green/10 border border-neon-green/50 text-center">
                  <Trophy className="w-8 h-8 text-neon-green mx-auto mb-2" />
                  <p className="text-neon-green font-bold text-lg">
                    You Won {claimInfo.unclaimedRewards.toFixed(6)} SOL
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Sent automatically to your wallet address
                  </p>
                </div>
              ) : claimInfo?.hasClaimed ? (
                <div className="p-4 rounded-lg bg-neon-green/10 border border-neon-green/50 text-center">
                  <CheckCircle className="w-8 h-8 text-neon-green mx-auto mb-2" />
                  <p className="text-neon-green font-bold text-lg">All Rewards Claimed!</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Check your wallet for the SOL transfer.
                  </p>
                </div>
              ) : (
                <div className="p-4 rounded-lg bg-muted/50 border border-border text-center">
                  <AlertCircle className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-muted-foreground">You didn't win this round</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Better luck next time! Try again in the next round.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
};
