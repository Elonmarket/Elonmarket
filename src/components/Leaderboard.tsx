import { useState } from "react";
import { Trophy, Medal, TrendingUp, Wallet, ChevronDown, ChevronUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useLeaderboard } from "@/hooks/useLeaderboard";
import { formatDistanceToNow } from "date-fns";

export const Leaderboard = () => {
  const { leaderboard, recentWinners, loading } = useLeaderboard();
  const [showAllLeaderboard, setShowAllLeaderboard] = useState(false);
  const [showAllWinners, setShowAllWinners] = useState(false);

  const formatAddress = (address: string) => {
    return `${address.slice(0, 4)}...${address.slice(-4)}`;
  };

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return <Trophy className="w-5 h-5 text-yellow-500" />;
      case 2:
        return <Medal className="w-5 h-5 text-gray-400" />;
      case 3:
        return <Medal className="w-5 h-5 text-amber-600" />;
      default:
        return <span className="w-5 h-5 flex items-center justify-center text-muted-foreground font-bold">{rank}</span>;
    }
  };

  if (loading) {
    return (
      <section id="leaderboard" className="py-16 relative">
        <div className="container mx-auto px-4">
          <div className="text-center mb-10">
            <h2 className="font-display text-3xl md:text-4xl font-bold mb-4">
              <span className="gradient-text">TOP</span>{" "}
              <span className="text-foreground">EARNERS</span>
            </h2>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {[...Array(2)].map((_, i) => (
              <Card key={i} variant="glass" className="animate-pulse">
                <CardHeader>
                  <div className="h-6 bg-muted rounded w-1/3" />
                </CardHeader>
                <CardContent>
                  {[...Array(5)].map((_, j) => (
                    <div key={j} className="h-12 bg-muted rounded mb-2" />
                  ))}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section id="leaderboard" className="py-16 relative">
      <div className="container mx-auto px-4">
        {/* Section Header */}
        <div className="text-center mb-10">
          <h2 className="font-display text-3xl md:text-4xl font-bold mb-4">
            <span className="gradient-text">TOP</span>{" "}
            <span className="text-foreground">EARNERS</span>
          </h2>
          <p className="text-muted-foreground">Ranked by total earnings</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Leaderboard */}
          <Card variant="glass">
            <CardHeader className="border-b border-border/50">
              <CardTitle className="flex items-center gap-2">
                <Trophy className="w-5 h-5 text-neon-green" />
                All-Time Leaderboard
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {leaderboard.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">
                  No predictors yet. Be the first!
                </div>
              ) : (
                <>
                  <div className="divide-y divide-border/50">
                    {(showAllLeaderboard ? leaderboard : leaderboard.slice(0, 15)).map((entry) => (
                      <a
                        key={entry.id}
                        href={`https://solscan.io/account/${entry.wallet_address}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`flex items-center justify-between p-4 hover:bg-muted/30 transition-colors cursor-pointer ${
                          entry.rank <= 3 ? "bg-gradient-to-r from-neon-green/5 to-transparent" : ""
                        } ${entry.isYou ? "ring-1 ring-neon-cyan/30 bg-neon-cyan/5" : ""}`}
                      >
                        <div className="flex items-center gap-4">
                          {getRankIcon(entry.rank)}
                          <div>
                            <p className={`font-medium ${entry.isYou ? "text-neon-cyan" : "text-foreground"}`}>
                              {entry.isYou ? "YOU" : entry.display_name || formatAddress(entry.wallet_address)}
                            </p>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <Wallet className="w-3 h-3" />
                              {entry.isYou ? "Your wallet" : formatAddress(entry.wallet_address)}
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-display font-bold text-neon-green">
                            {entry.total_claimed_usd.toFixed(4)} SOL
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {entry.total_wins} wins • {entry.win_rate.toFixed(1)}%
                          </p>
                        </div>
                      </a>
                    ))}
                  </div>
                  {leaderboard.length > 15 && (
                    <div className="p-4 flex flex-col items-center gap-2 border-t border-border/50 bg-muted/20">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowAllLeaderboard(!showAllLeaderboard)}
                        className="w-full max-w-[200px] gap-2 border-neon-green/50 bg-neon-green/5 text-foreground hover:bg-neon-green/10"
                      >
                        {showAllLeaderboard ? (
                          <>
                            View Less <ChevronUp className="w-4 h-4" />
                          </>
                        ) : (
                          <>
                            View More <ChevronDown className="w-4 h-4" />
                          </>
                        )}
                      </Button>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">
                        {showAllLeaderboard ? `Showing all ${leaderboard.length} entries` : `Showing 15 of ${leaderboard.length} entries`}
                      </p>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          {/* Recent Winners */}
          <Card variant="glass">
            <CardHeader className="border-b border-border/50">
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-neon-cyan" />
                Recent Winners
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {recentWinners.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">
                  No winners yet. Will you be the first?
                </div>
              ) : (
                <>
                  <div className="divide-y divide-border/50">
                    {(showAllWinners ? recentWinners : recentWinners.slice(0, 15)).map((winner) => {
                      const solscanUrl = winner.tx_signature
                        ? `https://solscan.io/tx/${winner.tx_signature}`
                        : `https://solscan.io/account/${winner.wallet_address}`;
                      return (
                        <a
                          key={winner.id}
                          href={solscanUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={`flex items-center justify-between p-4 hover:bg-muted/30 transition-colors cursor-pointer ${
                            winner.isYou ? "ring-1 ring-neon-cyan/30 bg-neon-cyan/5" : ""
                          }`}
                        >
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-neon-green to-neon-cyan flex items-center justify-center">
                              <Trophy className="w-5 h-5 text-background" />
                            </div>
                            <div>
                              <p className={`font-medium ${winner.isYou ? "text-neon-cyan" : "text-foreground"}`}>
                                {winner.isYou ? "YOU" : formatAddress(winner.wallet_address)}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {formatDistanceToNow(new Date(winner.created_at), { addSuffix: true })}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-display font-bold text-neon-green">
                              +{winner.amount.toFixed(4)} SOL
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {winner.tx_signature ? "View Tx on Solscan ↗" : "View on Solscan ↗"}
                            </p>
                          </div>
                        </a>
                      );
                    })}
                  </div>
                  {recentWinners.length > 15 && (
                    <div className="p-4 flex flex-col items-center gap-2 border-t border-border/50 bg-muted/20">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowAllWinners(!showAllWinners)}
                        className="w-full max-w-[200px] gap-2 border-neon-cyan/50 bg-neon-cyan/5 text-foreground hover:bg-neon-cyan/10"
                      >
                        {showAllWinners ? (
                          <>
                            View Less <ChevronUp className="w-4 h-4" />
                          </>
                        ) : (
                          <>
                            View More <ChevronDown className="w-4 h-4" />
                          </>
                        )}
                      </Button>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">
                        {showAllWinners ? `Showing all ${recentWinners.length} winners` : `Showing 15 of ${recentWinners.length} winners`}
                      </p>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
};
