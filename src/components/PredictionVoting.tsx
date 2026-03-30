import { useState, useEffect } from "react";
import { Clock, Trophy, Users, Lock, CheckCircle, AlertCircle, Timer, Shield, User as UserIcon, Gem, Gift } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { usePredictionRound, PredictionOption } from "@/hooks/usePredictionRound";
import { usePlatformData } from "@/hooks/usePlatformData";
import { useOnchainData } from "@/hooks/useOnchainData";
import { useVoting } from "@/hooks/useVoting";
import { useTokenVerification } from "@/hooks/useTokenVerification";
import { useHasVoted } from "@/hooks/useHasVoted";
import { useAuth } from "@/contexts/AuthContext";
import { AuthModal } from "@/components/AuthModal";
import { differenceInSeconds } from "date-fns";
import { formatToLocalTime, formatToLocalFullDate, parseToUTC } from "@/lib/utils";

const optionIcons: Record<string, string> = {
  Tesla: "/tesla-logo.png",
  SpaceX: "/spacex-logo.png",
  Dogecoin: "/doge-logo.png",
  Doge: "/doge-logo.png",
  "AI/Grok": "/grok-logo.png",
  Grok: "/grok-logo.png",
  Meme: "/doge-logo.png", // Using doge as a proxy for meme
  X: "/x-logo.png",
  Grokpedia: "/grokpedia.png", // Using grok as a proxy
  Starlink: "/starlink-logo.png",
  Gork: "/gork.png"
};

const optionColors: Record<string, string> = {
  Tesla: "bg-red-500",
  SpaceX: "bg-blue-500",
  Dogecoin: "bg-yellow-500",
  Doge: "bg-yellow-500",
  "AI/Grok": "bg-purple-500",
  Grok: "bg-purple-500",
  Meme: "bg-green-500",
  X: "bg-foreground/50",
  Grokpedia: "bg-cyan-500",
  Starlink: "bg-sky-500",
};

export const PredictionVoting = () => {
  const { currentRound, options, refetch } = usePredictionRound();
  const { walletConfig } = usePlatformData();
  const { data: onchain } = useOnchainData();
  const { submitVote, loading: voteLoading } = useVoting();
  const { balance, verifyTokenBalance, loading: tokenLoading } = useTokenVerification();
  const { user } = useAuth();
  const { hasVoted: hasVotedFromDb, refetch: refetchHasVoted } = useHasVoted(
    currentRound?.id ?? null,
    user?.wallet_address ?? null
  );
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [timeRemaining, setTimeRemaining] = useState<string>("");
  const [voteLockRemaining, setVoteLockRemaining] = useState<string>("");
  const [localHasVoted, setLocalHasVoted] = useState(false);
  const [isVoteLocked, setIsVoteLocked] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);

  const hasVoted = hasVotedFromDb || localHasVoted;

  // Check token eligibility when user logs in
  useEffect(() => {
    if (user?.wallet_address) {
      verifyTokenBalance();
    }
  }, [user?.wallet_address, verifyTokenBalance]);

  // Update countdown timers
  useEffect(() => {
    if (!currentRound) return;

    const updateTimer = () => {
      const now = new Date();
      
      // Vote locking logic
      if (currentRound.status === "open" && currentRound.prediction_start_time) {
        const predictionStart = parseToUTC(currentRound.prediction_start_time);
        const voteLockMinutes = currentRound.vote_lock_minutes ?? 60;
        const voteLockTime = new Date(predictionStart.getTime() - voteLockMinutes * 60 * 1000);
        
        if (now >= voteLockTime) {
          setIsVoteLocked(true);
          // Show countdown to prediction start
          const secsToPrediction = differenceInSeconds(predictionStart, now);
          if (secsToPrediction > 0) {
            const mins = Math.floor(secsToPrediction / 60);
            const secs = secsToPrediction % 60;
            setVoteLockRemaining(`${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`);
          } else {
            setVoteLockRemaining("Monitoring...");
          }
        } else {
          setIsVoteLocked(false);
          // Show countdown to vote lock
          const secsToLock = differenceInSeconds(voteLockTime, now);
          const hours = Math.floor(secsToLock / 3600);
          const minutes = Math.floor((secsToLock % 3600) / 60);
          const secs = secsToLock % 60;
          setVoteLockRemaining(`${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`);
        }
      }

      const endTime = parseToUTC(currentRound.end_time);
      const seconds = differenceInSeconds(endTime, now);

      if (seconds <= 0) {
        setTimeRemaining("Round ended");
        setVoteLockRemaining("Finalizing...");
        // Trigger a refetch once when the timer reaches zero to finalize the round via the hook logic
        if (currentRound.status === "open") {
          refetch();
        }
        return;
      }

      const hours = Math.floor(seconds / 3600);
      const minutes = Math.floor((seconds % 3600) / 60);
      const secs = seconds % 60;

      setTimeRemaining(`${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [currentRound]);

  const handleVote = async () => {
    if (!selectedOption || !currentRound || !balance?.isEligible || isVoteLocked) return;

    const success = await submitVote(currentRound.id, selectedOption, balance.tokenBalance);
    if (success) {
      setLocalHasVoted(true);
      refetch();
      refetchHasVoted();
    }
  };

  const totalVotes = options.reduce((sum, opt) => sum + opt.vote_count, 0);

  // Calculate current payout from live on-chain vault balance
  const vaultBalance = onchain?.vault.balance_sol ?? 0;
  const payoutPercentage = onchain?.round_payout.percentage ?? walletConfig?.payout_percentage ?? 15;
  const currentPayout = onchain?.round_payout.estimated_sol ?? (vaultBalance * payoutPercentage) / 100;
  const isRoundOpen = currentRound?.status === "open";
  const isRoundFinalized = currentRound?.status === "finalized" || currentRound?.status === "paid" || currentRound?.status === "no_winner";
  const canVote = isRoundOpen && !isVoteLocked;

  return (
    <section id="predict" className="py-8 relative">
      <div className="container mx-auto px-4">
        {/* Section Header */}
        <div className="mb-4">
          <h2 className="font-display text-lg md:text-xl font-semibold text-foreground mb-0.5">
            Markets
          </h2>
          <p className="font-display text-base mt-1 flex flex-col items-center gap-1 md:text-lg font-semibold text-muted-foreground mb-0.5">
            {currentRound?.question || "What will Elon tweet about next?"}
          </p>
          {currentRound?.prediction_start_time && currentRound?.end_time && (
            <div className="mt-2 flex flex-col items-center gap-1">
                            <p className="text-sm text-foreground font-medium flex items-center gap-1.5">
                              <span className="ml-1 px-1.5 py-0.5 rounded bg-white text-black text-[10px] font-bold uppercase tracking-wider border border-neon-cyan/20">
                                Within
                              </span>
                              <Clock className="w-3.5 h-3.5 text-neon-cyan" />
                              {formatToLocalTime(currentRound.prediction_start_time)} – {formatToLocalTime(currentRound.end_time)}
                              
                            </p>
              <p className="text-xs text-muted-foreground">
                {formatToLocalFullDate(currentRound.prediction_start_time)} • Local Time ({Intl.DateTimeFormat().resolvedOptions().timeZone})
              </p>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Voting Card */}
          <div className="lg:col-span-2">
            <Card className="bg-card border-border h-full">
              <CardHeader className="border-b border-border pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {isRoundOpen && !isVoteLocked ? (
                      <div className="flex items-center gap-2 text-neon-green">
                        <span className="w-1.5 h-1.5 bg-neon-green rounded-full animate-pulse" />
                        <span className="text-sm font-medium">Voting Open</span>
                      </div>
                    ) : isRoundOpen && isVoteLocked ? (
                      <div className="flex items-center gap-2 text-neon-orange">
                        <Lock className="w-3.5 h-3.5" />
                        <span className="text-sm font-medium">Votes Locked</span>
                      </div>
                    ) : isRoundFinalized ? (
                      <div className="flex items-center gap-2 text-neon-purple">
                        <Trophy className="w-3.5 h-3.5" />
                        <span className="text-sm font-medium">Finalized</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Clock className="w-3.5 h-3.5" />
                        <span className="text-sm font-medium">Upcoming</span>
                      </div>
                    )}
                    <span className="text-xs text-muted-foreground px-2 py-0.5 bg-muted rounded">
                      Round {currentRound?.round_number || 1}
                    </span>
                  </div>
                  {isRoundOpen && (
                    <div className={`flex items-center gap-1.5 text-sm font-mono ${isVoteLocked ? "text-neon-orange" : "text-foreground"}`}>
                      {isVoteLocked ? <Lock className="w-3.5 h-3.5" /> : <Clock className="w-3.5 h-3.5 text-muted-foreground" />}
                      {isVoteLocked ? voteLockRemaining : timeRemaining}
                    </div>
                  )}
                </div>
              </CardHeader>

              <CardContent className="p-4">
                {/* Prediction time frame info */}
                {currentRound?.prediction_start_time && isRoundOpen && (
                  <div className={`mb-3 p-2 rounded-lg border ${isVoteLocked ? "bg-neon-orange/5 border-neon-orange/30" : "bg-neon-green/5 border-neon-green/30"}`}>
                    <p className="text-[11px]">
                      {isVoteLocked ? (
                        <span className="text-neon-orange">🔒 Votes locked. Prediction monitoring {voteLockRemaining === "Monitoring..." ? "is active" : `starts in ${voteLockRemaining}`}.</span>
                      ) : (
                        <span className="text-neon-green">🟢 Voting is open! Closes in {voteLockRemaining} (before prediction window starts)</span>
                      )}
                    </p>
                  </div>
                )}

                {/* Options Grid */}
                <div className="space-y-2 mb-4">
                  {options.map((option) => {
                    const percentage = totalVotes > 0 ? (option.vote_count / totalVotes) * 100 : 0;
                    const isSelected = selectedOption === option.id;
                    const isWinner = option.is_winner;

                    return (
                      <button
                        key={option.id}
                        onClick={() => !hasVoted && canVote && setSelectedOption(option.id)}
                        disabled={hasVoted || !canVote}
                        className={`relative w-full p-3.5 rounded-lg border transition-all duration-200 text-left ${
                          isWinner
                            ? "border-neon-green bg-neon-green/5"
                            : isSelected
                            ? "border-neon-cyan bg-neon-cyan/5"
                            : "border-border hover:border-border/80 bg-muted/30"
                        } ${hasVoted || !canVote ? "cursor-not-allowed opacity-60" : "cursor-pointer hover:bg-muted/50"}`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2.5">
                            {optionIcons[option.label] ? (
                              <div className="w-8 h-8 rounded-lg overflow-hidden flex items-center justify-center border border-border/50 bg-background/50">
                                <img 
                                  src={optionIcons[option.label]} 
                                  alt={option.label} 
                                  className="w-6 h-6 object-contain" 
                                />
                              </div>
                            ) : (
                              <span className="text-xl">⚡</span>
                            )}
                            <span className="font-medium text-sm">{option.label}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            {isWinner && (
                              <span className="flex items-center gap-1 text-neon-green text-xs font-medium">
                                <Trophy className="w-3.5 h-3.5" />
                                Winner
                              </span>
                            )}
                            {isSelected && !isWinner && (
                              <CheckCircle className="w-4 h-4 text-neon-cyan" />
                            )}
                            <span className="font-semibold text-sm">{percentage.toFixed(0)}%</span>
                          </div>
                        </div>

                        <div className="relative h-1.5 bg-muted rounded-full overflow-hidden">
                          <div 
                            className={`absolute inset-y-0 left-0 ${optionColors[option.label] || 'bg-primary'} rounded-full transition-all duration-300`}
                            style={{ width: `${percentage}%` }}
                          />
                        </div>

                        <p className="text-xs text-muted-foreground mt-1.5">{option.vote_count} votes</p>
                      </button>
                    );
                  })}
                </div>

                {/* Vote Button */}
                <div className="space-y-4">
                  {!user ? (
                    <Button variant="neon" className="w-full" onClick={() => setAuthModalOpen(true)}>
                      <UserIcon className="w-3.5 h-3.5 mr-2" />
                      Log in to vote
                    </Button>
                  ) : tokenLoading ? (
                    <Button variant="outline" className="w-full" disabled>
                      Verifying token balance...
                    </Button>
                  ) : !balance?.isEligible ? (
                    <div className="text-center p-3 rounded-lg bg-destructive/10 border border-destructive/30">
                      <AlertCircle className="w-5 h-5 text-destructive mx-auto mb-1.5" />
                      <p className="text-destructive font-medium">Insufficient token balance</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        You need at least {walletConfig?.min_token_balance || 1} tokens to participate
                      </p>
                    </div>
                  ) : hasVoted ? (
                    <div className="text-center p-3 rounded-lg bg-neon-green/10 border border-neon-green/30">
                      <CheckCircle className="w-5 h-5 text-neon-green mx-auto mb-1.5" />
                      <p className="text-neon-green font-medium">Vote submitted!</p>
                      <p className="text-xs text-muted-foreground mt-0.5">Your prediction has been recorded</p>
                    </div>
                  ) : isVoteLocked ? (
                    <div className="text-center p-3 rounded-lg bg-neon-orange/10 border border-neon-orange/30">
                      <Lock className="w-5 h-5 text-neon-orange mx-auto mb-1.5" />
                      <p className="text-neon-orange font-medium">Voting Locked</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Prediction monitoring {voteLockRemaining === "Monitoring..." ? "is active" : `starts in ${voteLockRemaining}`}
                      </p>
                    </div>
                  ) : !isRoundOpen ? (
                    <Button variant="outline" className="w-full" disabled>
                      <Clock className="w-3.5 h-3.5" />
                      {currentRound?.status === "upcoming" ? "Round not started yet" : "Round has ended"}
                    </Button>
                  ) : (
                    <Button
                      variant="neon"
                      className="w-full"
                      onClick={handleVote}
                      disabled={!selectedOption || voteLoading}
                    >
                      {voteLoading ? "Submitting..." : "Submit Prediction"}
                    </Button>
                  )}

                  {user && balance?.isEligible && (
                    <p className="text-xs text-center text-muted-foreground">
                      Token balance: {balance.tokenBalance.toLocaleString()} • Eligible to vote ✓
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Reward Info Card */}
          <div className="space-y-6">
            <Card className="bg-card border-border">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base font-display">
                  <Gem className="w-4 h-4 text-neon-green" />
                  Reward Pool
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Vault Balance</p>
                  <p className="font-display text-2xl font-semibold text-neon-green tracking-tight">
                    {vaultBalance.toFixed(4)} SOL
                  </p>
                </div>

                <div className="h-px bg-border" />

                <div className="space-y-3">
                  <div className="pt-2 flex justify-between items-end">
                    <p className="text-xs font-bold text-foreground uppercase tracking-wider">Round Pool ({payoutPercentage}%)</p>
                    <p className="font-display text-xl font-semibold text-neon-cyan tracking-tight">
                      {currentPayout.toFixed(4)} SOL
                    </p>
                  </div>
                </div>

                <div className="mt-4 p-2.5 rounded-lg bg-muted/30 border border-border/50 flex items-start gap-2.5">
                  <Gift className="w-3.5 h-3.5 text-neon-orange shrink-0 mt-0.5" />
                  <p className="text-[10px] leading-relaxed text-muted-foreground">
                    Rewards are sent automatically to winner wallets after each round. No claiming needed!
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card border-border">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Total Votes</span>
                  <span className="font-semibold flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-muted-foreground" />
                    {totalVotes}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Winners</span>
                  <span className="font-semibold text-neon-green">
                    {currentRound?.total_winners || 0}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Per Winner</span>
                  <span className="font-semibold text-neon-purple">
                    {currentRound?.payout_per_winner?.toFixed(4) || (currentRound?.total_winners ? (currentPayout / currentRound.total_winners).toFixed(4) : "--")} SOL
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
      <AuthModal open={authModalOpen} onOpenChange={setAuthModalOpen} />
    </section>
  );
};
