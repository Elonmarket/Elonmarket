import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  User, 
  Wallet, 
  Trophy, 
  Target, 
  DollarSign, 
  ArrowLeft, 
  Shield, 
  Copy, 
  Check, 
  Activity, 
  Star,
  ExternalLink,
  Award
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";
import { formatDistanceToNow } from "date-fns";
import { useToast } from "@/hooks/use-toast";

interface DetailedProfile {
  display_name: string | null;
  wallet_address: string;
  total_wins: number;
  total_predictions: number;
  total_claimed_usd: number;
  rank: number | string;
}

interface RecentActivity {
  id: string;
  type: 'vote' | 'claim';
  round_question: string;
  option_label?: string;
  amount?: number;
  created_at: string;
  status?: string;
}

const Profile = () => {
  const { user, loading: authLoading } = useAuth();
  const [profile, setProfile] = useState<DetailedProfile | null>(null);
  const [activities, setActivities] = useState<RecentActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const fetchProfileData = async () => {
      if (!user?.id) return;

      try {
        setLoading(true);
        
        // 1. Fetch profile stats
        const { data: pData, error: pError } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", user.id)
          .single();

        if (pError) throw pError;

        // 2. Fetch rank using multiple criteria to avoid everyone being #1
        // We rank by: 1. Total Claimed (SOL), 2. Total Wins, 3. Total Predictions
        const { count: higherClaimed } = await supabase
          .from("profiles")
          .select("*", { count: "exact", head: true })
          .gt("total_claimed_usd", pData.total_claimed_usd || 0);

        const { count: sameClaimedHigherWins } = await supabase
          .from("profiles")
          .select("*", { count: "exact", head: true })
          .eq("total_claimed_usd", pData.total_claimed_usd || 0)
          .gt("total_wins", pData.total_wins || 0);

        const { count: sameBothHigherPredictions } = await supabase
          .from("profiles")
          .select("*", { count: "exact", head: true })
          .eq("total_claimed_usd", pData.total_claimed_usd || 0)
          .eq("total_wins", pData.total_wins || 0)
          .gt("total_predictions", pData.total_predictions || 0);

        const { count: sameThreeEarlier } = await supabase
          .from("profiles")
          .select("*", { count: "exact", head: true })
          .eq("total_claimed_usd", pData.total_claimed_usd || 0)
          .eq("total_wins", pData.total_wins || 0)
          .eq("total_predictions", pData.total_predictions || 0)
          .lt("created_at", pData.created_at);

        const calculatedRank = (higherClaimed || 0) + (sameClaimedHigherWins || 0) + (sameBothHigherPredictions || 0) + (sameThreeEarlier || 0) + 1;

        setProfile({
          display_name: pData.display_name,
          wallet_address: pData.wallet_address,
          total_wins: pData.total_wins || 0,
          total_predictions: pData.total_predictions || 0,
          total_claimed_usd: Number(pData.total_claimed_usd || 0),
          rank: calculatedRank,
        });

        // 3. Fetch recent votes
        const { data: votes } = await supabase
          .from("votes")
          .select(`
            id,
            created_at,
            prediction_rounds (question),
            prediction_options (label)
          `)
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(5);

        // 4. Fetch recent claims
        const { data: claims } = await supabase
          .from("claims")
          .select(`
            id,
            created_at,
            amount,
            status,
            prediction_rounds (question)
          `)
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(5);

        const combined: RecentActivity[] = [
          ...(votes || []).map((v: any) => ({
            id: v.id,
            type: 'vote' as const,
            round_question: v.prediction_rounds?.question || "Prediction Round",
            option_label: v.prediction_options?.label,
            created_at: v.created_at,
          })),
          ...(claims || []).map((c: any) => ({
            id: c.id,
            type: 'claim' as const,
            round_question: c.prediction_rounds?.question || "Prediction Round",
            amount: c.amount,
            status: c.status,
            created_at: c.created_at,
          }))
        ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 8);

        setActivities(combined);

      } catch (err) {
        console.error("Error fetching profile:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchProfileData();
  }, [user?.id]);

  const copyAddress = () => {
    if (profile?.wallet_address) {
      navigator.clipboard.writeText(profile.wallet_address);
      setCopied(true);
      toast({
        title: "Address Copied",
        description: "Wallet address copied to clipboard",
      });
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (authLoading || (loading && !profile)) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container mx-auto px-4 py-24 flex flex-col items-center justify-center">
          <div className="w-12 h-12 border-4 border-neon-cyan border-t-transparent rounded-full animate-spin mb-4" />
          <div className="text-muted-foreground animate-pulse">Synchronizing on-chain data...</div>
        </div>
        <Footer />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-background text-white">
        <Header />
        <div className="container mx-auto px-4 py-32 text-center">
          <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center mx-auto mb-6">
            <User className="w-10 h-10 text-muted-foreground" />
          </div>
          <h2 className="text-3xl font-display font-bold mb-4 uppercase tracking-tight">Access Denied</h2>
          <p className="text-muted-foreground mb-8 max-w-md mx-auto">You must be logged in with a registered wallet to view player profiles.</p>
          <Button asChild variant="glass" size="lg">
            <Link to="/">Return to Hub</Link>
          </Button>
        </div>
        <Footer />
      </div>
    );
  }

  const accuracy = profile?.total_predictions ? ((profile.total_wins / profile.total_predictions) * 100).toFixed(1) : "0";
  const level = Math.floor((profile?.total_predictions || 0) / 5) + 1;

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container mx-auto px-4 py-24">
        <div className="max-w-5xl mx-auto">
          {/* Top Bar */}
          <div className="flex items-center justify-between mb-8">
            <Button 
              variant="ghost" 
              size="sm" 
              className="gap-2 text-muted-foreground hover:text-white transition-colors"
              onClick={() => navigate("/")}
            >
              <ArrowLeft className="w-4 h-4" />
              Markets
            </Button>
            
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="gap-2 border-border/50" onClick={() => window.open(`https://solscan.io/account/${profile?.wallet_address}`, '_blank')}>
                <ExternalLink className="w-3.5 h-3.5" />
                Solscan
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            
            {/* Left Column: Identity & Level */}
            <div className="lg:col-span-1 space-y-6">
              <motion.div 
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.4 }}
              >
                <Card variant="glass" className="overflow-hidden border-neon-cyan/20">
                  {/* <div className="h-24 bg-gradient-to-r from-neon-cyan/20 via-neon-purple/20 to-neon-pink/20" /> */}
                  <CardContent className="relative pt-0 pb-8 text-center">
                    <div className="absolute -top-12 left-1/2 -translate-x-1/2">
                      {/* <div className="w-24 h-24 rounded-3xl bg-card border-4 border-background overflow-hidden shadow-2xl flex items-center justify-center group">
                        <User className="w-12 h-12 text-neon-cyan group-hover:scale-110 transition-transform" />
                      </div> */}
                    </div>
                    
                    <div className="mt-16">
                      <h2 className="text-2xl font-display font-bold text-white mb-2">
                        {profile?.display_name || "Anonymous"}
                      </h2>
                      <button 
                        onClick={copyAddress}
                        className="flex items-center mt-8 gap-2 text-xs text-muted-foreground hover:text-neon-cyan transition-colors mx-auto p-1.5 rounded-lg hover:bg-muted/50"
                      >
                        <span className="font-mono">{profile?.wallet_address.slice(0, 6)}...{profile?.wallet_address.slice(-6)}</span>
                        {copied ? <Check className="w-3.5 h-3.5 text-neon-green" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>

                    <div className="mt-8 grid grid-cols-2 gap-4">
                      <div className="p-3 rounded-xl bg-muted/30 border border-border/50">
                        <p className="text-[10px] text-muted-foreground uppercase mb-1">Rank</p>
                        <p className="text-lg font-display font-bold text-neon-purple">#{profile?.rank}</p>
                      </div>
                      <div className="p-3 rounded-xl bg-muted/30 border border-border/50">
                        <p className="text-[10px] text-muted-foreground uppercase mb-1">Wins</p>
                        <p className="text-lg font-display font-bold text-neon-green">{profile?.total_wins}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>

              
            </div>

            {/* Right Column: Stats & Activity */}
            <div className="lg:col-span-2 space-y-8">
              
              {/* Stats Overview */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
                  <Card variant="glass" className="bg-gradient-to-br from-card to-card/50 border-neon-cyan/10">
                    <CardContent className="p-6">
                      <div className="flex justify-between items-start mb-4">
                        <div className="p-2 rounded-lg bg-neon-cyan/10 border border-neon-cyan/20">
                          <Target className="w-5 h-5 text-neon-cyan" />
                        </div>
                        <span className="text-[10px] font-bold text-neon-cyan bg-neon-cyan/10 px-2 py-0.5 rounded-full uppercase">Activity</span>
                      </div>
                      <p className="text-3xl font-display font-bold text-white">{profile?.total_predictions}</p>
                      <p className="text-sm text-muted-foreground mt-1 font-medium uppercase tracking-wider">Prediction Counts</p>
                    </CardContent>
                  </Card>
                </motion.div>

                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
                  <Card variant="glass" className="bg-gradient-to-br from-card to-card/50 border-neon-orange/10">
                    <CardContent className="p-6">
                      <div className="flex justify-between items-start mb-4">
                        <div className="p-2 rounded-lg bg-neon-orange/10 border border-neon-orange/20">
                          <DollarSign className="w-5 h-5 text-neon-orange" />
                        </div>
                        <span className="text-[10px] font-bold text-neon-orange bg-neon-orange/10 px-2 py-0.5 rounded-full uppercase">Wealth</span>
                      </div>
                      <p className="text-3xl font-display font-bold text-white">{profile?.total_claimed_usd.toFixed(4)} SOL</p>
                      <p className="text-sm text-muted-foreground mt-1 font-medium uppercase tracking-wider">Sol Earned</p>
                    </CardContent>
                  </Card>
                </motion.div>
              </div>

              {/* Accuracy Bar */}
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
                <Card variant="glass" className="border-white/5">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div className="space-y-1">
                        <h3 className="text-sm font-bold text-white uppercase tracking-wider">Strategic Performance</h3>
                        <p className="text-xs text-muted-foreground">Historical win rate based on validated outcomes</p>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-display font-bold text-neon-cyan">{accuracy}%</p>
                      </div>
                    </div>
                    <div className="h-3 bg-muted rounded-full overflow-hidden p-0.5 border border-border/50">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${accuracy}%` }}
                        transition={{ duration: 1, ease: "easeOut" }}
                        className="h-full bg-gradient-to-r from-neon-cyan to-neon-purple rounded-full shadow-[0_0_10px_rgba(34,211,238,0.3)]" 
                      />
                    </div>
                  </CardContent>
                </Card>
              </motion.div>

              {/* Recent Activity List */}
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
                <Card variant="glass" className="border-white/5">
                  <CardHeader className="pb-4">
                    <CardTitle className="text-base font-display font-bold flex items-center gap-2">
                      <Activity className="w-5 h-5 text-neon-cyan" />
                      RECENT ACTIVITY
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="divide-y divide-border/50">
                      {activities.length === 0 ? (
                        <div className="p-12 text-center">
                          <p className="text-muted-foreground italic">No recent activity detected.</p>
                          <Button variant="link" className="text-neon-cyan mt-2" onClick={() => navigate("/")}>
                            Cast your first vote now
                          </Button>
                        </div>
                      ) : (
                        activities.map((act) => (
                          <div key={act.id} className="p-4 flex items-center justify-between hover:bg-white/[0.02] transition-colors">
                            <div className="flex items-center gap-4">
                              <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${
                                act.type === 'vote' 
                                  ? 'bg-neon-cyan/10 border-neon-cyan/20' 
                                  : 'bg-neon-green/10 border-neon-green/20'
                              }`}>
                                {act.type === 'vote' ? <Target className="w-5 h-5 text-neon-cyan" /> : <Trophy className="w-5 h-5 text-neon-green" />}
                              </div>
                              <div>
                                <p className="text-sm font-medium text-foreground leading-tight">
                                  {act.type === 'vote' ? `Voted for "${act.option_label}"` : `Claimed Reward`}
                                </p>
                                <p className="text-xs text-muted-foreground mt-1">
                                  {act.round_question}
                                </p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-[10px] font-medium text-muted-foreground uppercase">
                                {formatDistanceToNow(new Date(act.created_at), { addSuffix: true })}
                              </p>
                              {act.amount && (
                                <p className="text-xs font-bold text-neon-green">+{act.amount.toFixed(4)} SOL</p>
                              )}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>

            </div>
          </div>
        </div>
      </main>
      
      <Footer />
    </div>
  );
};

export default Profile;
