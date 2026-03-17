import { TrendingUp, Users, Zap, DollarSign, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePlatformData } from "@/hooks/usePlatformData";
import { useOnchainData } from "@/hooks/useOnchainData";
import { usePredictionRound } from "@/hooks/usePredictionRound";
import { useState, useEffect } from "react";

export const HeroSection = () => {
  const { payoutStats, playerCount } = usePlatformData();
  const { data: onchain } = useOnchainData();
  const { currentRound } = usePredictionRound();
  const [status, setStatus] = useState<{ label: string; color: string; pulse: boolean }>({
    label: "Predictions Closed",
    color: "text-muted-foreground",
    pulse: false
  });

  const vaultBalanceSOL = onchain?.vault.balance_sol ?? 0;

  useEffect(() => {
    const updateStatus = () => {
      if (!currentRound || currentRound.status !== "open") {
        setStatus({ label: "Predictions Closed", color: "text-muted-foreground", pulse: false });
        return;
      }

      const now = new Date();
      const predictionStart = currentRound.prediction_start_time ? new Date(currentRound.prediction_start_time) : null;
      const voteLockMinutes = currentRound.vote_lock_minutes || 60;
      const voteLockTime = predictionStart ? new Date(predictionStart.getTime() - voteLockMinutes * 60 * 1000) : null;

      if (voteLockTime && now >= voteLockTime) {
        // We are in the monitoring phase (either waiting for start or already scanning)
        setStatus({ label: "Monitoring", color: "text-neon-cyan", pulse: true });
      } else {
        // Voting is still open
        setStatus({ label: "Predictions Open", color: "text-neon-green", pulse: true });
      }
    };

    updateStatus();
    const interval = setInterval(updateStatus, 5000); // Check every 5s
    return () => clearInterval(interval);
  }, [currentRound]);

  return (
    <section className="relative min-h-[90vh] flex items-center justify-center overflow-hidden pt-20">
      {/* Background Effects */}
      <div className="absolute inset-0 bg-gradient-to-b from-background via-background to-card" />
      <div className="absolute top-1/3 left-1/4 w-[500px] h-[500px] bg-neon-green/5 rounded-full blur-[100px]" />
      <div className="absolute bottom-1/3 right-1/4 w-[400px] h-[400px] bg-neon-purple/5 rounded-full blur-[100px]" />
      
      {/* Grid Pattern */}
      <div 
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `linear-gradient(hsl(var(--border)) 1px, transparent 1px),
                           linear-gradient(90deg, hsl(var(--border)) 1px, transparent 1px)`,
          backgroundSize: "60px 60px"
        }}
      />

      <div className="container mx-auto px-4 relative z-10">
        <div className="max-w-3xl mx-auto text-center">
          {/* Live Badge */}
          <div className="inline-flex items-center gap-2 bg-card/80 border border-border px-4 py-2 rounded-full mb-6 animate-slide-up">
            <span className={`w-2 h-2 rounded-full ${status.color.replace('text-', 'bg-')} ${status.pulse ? 'animate-pulse' : ''}`} />
            <span className={`text-sm font-medium ${status.color}`}>{status.label}</span>
            <span className="text-sm text-muted-foreground">•</span>
            <span className="text-sm text-neon-green font-medium">{vaultBalanceSOL.toFixed(4)} SOL Pool</span>
          </div>

          {/* Main Title */}
          <h1 className="font-display text-4xl md:text-6xl lg:text-7xl font-bold mb-4 animate-slide-up tracking-tight text-white" style={{ animationDelay: "0.1s" }}>
            ELONMARKET
          </h1>

          <p className="text-lg md:text-xl text-foreground/90 mb-3 animate-slide-up font-medium" style={{ animationDelay: "0.2s" }}>
            Predict Elon's Next Tweet. Win SOL.
          </p>

          <p className="text-base text-muted-foreground mb-8 max-w-xl mx-auto animate-slide-up" style={{ animationDelay: "0.3s" }}>
            Free-to-play prediction market powered by Solana. 
            Hold $EMARKET tokens, make predictions, earn rewards.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12 animate-slide-up" style={{ animationDelay: "0.4s" }}>
            <Button asChild size="lg" className="group min-w-[200px] bg-white text-black hover:bg-white/90 transition-all hover:scale-105 active:scale-95">
              <a href="#predict">
                <img src="/musk-logo-design-black.png" alt="" className="w-10 h-10 object-contain group-hover:rotate-12 transition-transform" />
                Start Predicting
              </a>
            </Button>
            <Button variant="outline" size="lg" className="group min-w-[200px] border-white/20 hover:bg-white/5 transition-all hover:scale-105 active:scale-95">
              <TrendingUp className="w-4 h-4 mr-2" />
              Buy $EMARKET
            </Button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 animate-slide-up" style={{ animationDelay: "0.5s" }}>
            {[
              { icon: Users, label: "Players", value: playerCount.toLocaleString(), color: "text-neon-cyan" },
              { icon: TrendingUp, label: "Predictions", value: (payoutStats?.total_predictions_made || 0).toLocaleString(), color: "text-neon-green" },
              { icon: DollarSign, label: "Total SOL Paid", value: `${(payoutStats?.total_paid_usd || 0).toLocaleString()}`, color: "text-neon-purple" },
              { icon: Zap, label: "Rounds", value: (currentRound?.round_number || payoutStats?.total_rounds_completed || 0).toString(), color: "text-neon-orange" },
            ].map((stat) => (
              <div key={stat.label} className="bg-card/60 border border-border p-4 rounded-xl hover:border-border/80 transition-colors">
                <stat.icon className={`w-5 h-5 ${stat.color} mx-auto mb-2`} />
                <div className="font-display text-xl md:text-2xl font-semibold text-foreground mb-0.5">
                  {stat.value}
                </div>
                <div className="text-xs text-muted-foreground">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};
