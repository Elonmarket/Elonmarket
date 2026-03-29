import { Trophy, ChevronRight, Wallet, RefreshCw, Gem } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { usePlatformData } from "@/hooks/usePlatformData";
import { useOnchainData } from "@/hooks/useOnchainData";
import { usePredictionRound } from "@/hooks/usePredictionRound";
import { useEffect } from "react";

const topPredictors = [
  { rank: 1, address: "0x1a2b...3c4d", wins: 847, earnings: "$124,200", badge: "🏆" },
  { rank: 2, address: "0x5e6f...7g8h", wins: 712, earnings: "$98,400", badge: "🥈" },
  { rank: 3, address: "0x9i0j...1k2l", wins: 689, earnings: "$87,600", badge: "🥉" },
  { rank: 4, address: "0x3m4n...5o6p", wins: 534, earnings: "$62,300", badge: "⭐" },
  { rank: 5, address: "0x7q8r...9s0t", wins: 498, earnings: "$54,100", badge: "⭐" },
];

export const Elonmarket = () => {
  const { payoutStats, walletConfig } = usePlatformData();
  const { data: onchain, loading, refetch } = useOnchainData();
  const { currentRound } = usePredictionRound();

  useEffect(() => {
    refetch();
  }, [currentRound?.status, currentRound?.id, walletConfig?.payout_percentage]);

  const vaultBalanceSOL = onchain?.vault.balance_sol ?? 0;
  const payoutBalanceSOL = onchain?.payout.balance_sol ?? 0;
  const payoutPercentage = onchain?.round_payout.percentage ?? 15;
  const currentPayoutAmount = onchain?.round_payout.estimated_sol ?? 0;
  const totalPaidUSD = payoutStats?.total_paid_usd || 0;
  const vaultAddress = onchain?.vault.address || "";
  const payoutAddress = onchain?.payout.address || "";

  return (
    <section id="market" className="py-12 relative">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Reward Pool Card */}
          <div className="lg:col-span-2">
            <Card className="bg-card border-border">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center justify-between text-base">
                  <div className="flex items-center gap-2 font-display">
                    <Gem className="w-4 h-4 text-neon-green" />
                    <span>Reward Pool</span>
                    <span className="inline-flex items-center gap-1 text-[10px] font-normal text-neon-green bg-neon-green/10 px-1.5 py-0.5 rounded-full">
                      <span className="w-1.5 h-1.5 bg-neon-green rounded-full animate-pulse" />
                      Live On-Chain
                    </span>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-7 px-2" 
                    onClick={() => refetch()}
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Vault Balance</p>
                    <p className="font-display text-2xl font-semibold text-neon-green">
                      {vaultBalanceSOL.toFixed(4)} SOL
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Payout Wallet</p>
                    <p className="font-display text-2xl font-semibold text-neon-cyan">
                      {payoutBalanceSOL.toFixed(4)} SOL
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Total SOL Paid</p>
                    <p className="font-display text-2xl font-semibold text-foreground">
                      ${totalPaidUSD.toLocaleString()}
                    </p>
                  </div>
                </div>

                <div className="h-px bg-border" />

                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground mb-0.5">This Round ({payoutPercentage}%)</p>
                    <p className="font-display text-lg font-semibold text-neon-cyan">
                      {currentPayoutAmount.toFixed(4)} SOL
                    </p>
                  </div>
                  {onchain?.fetched_at && (
                    <p className="text-[10px] text-muted-foreground">
                      Updated {new Date(onchain.fetched_at).toLocaleTimeString()}
                    </p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 p-2.5 rounded-lg bg-muted/50 text-xs">
                    <Wallet className="w-4 h-4 text-muted-foreground shrink-0" />
                    <span className="text-muted-foreground font-mono truncate">
                      Vault: {vaultAddress ? `${vaultAddress.slice(0, 8)}...${vaultAddress.slice(-8)}` : "Not configured"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 p-2.5 rounded-lg bg-muted/50 text-xs">
                    <Wallet className="w-4 h-4 text-muted-foreground shrink-0" />
                    <span className="text-muted-foreground font-mono truncate">
                      Payout: {payoutAddress ? `${payoutAddress.slice(0, 8)}...${payoutAddress.slice(-8)}` : "Not configured"}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Top Predictors */}
          <div>
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Trophy className="w-4 h-4 text-neon-orange" />
                  Top Predictors
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {topPredictors.map((predictor) => (
                  <div
                    key={predictor.rank}
                    className={`flex items-center justify-between p-2.5 rounded-lg ${
                      predictor.rank <= 3 ? "bg-muted/50" : "bg-transparent"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-lg">{predictor.badge}</span>
                      <div>
                        <p className="font-mono text-xs">{predictor.address}</p>
                        <p className="text-xs text-muted-foreground">{predictor.wins} wins</p>
                      </div>
                    </div>
                    <p className="font-semibold text-neon-green text-sm">{predictor.earnings}</p>
                  </div>
                ))}

                <Button variant="ghost" className="w-full mt-1 h-8 text-xs">
                  View Full Leaderboard
                  <ChevronRight className="w-3.5 h-3.5" />
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </section>
  );
};
