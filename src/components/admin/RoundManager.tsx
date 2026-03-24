import { useState, useEffect } from "react";
import { Calendar, Clock, Square, Trophy, Lock, Plus, X, Hash, Tag, Save, Zap, Timer, ArrowRight, CheckCircle2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format, addHours, addDays, differenceInMinutes, parseISO } from "date-fns";
import { formatToLocalTime, formatToLocalFullDate, parseToUTC } from "@/lib/utils";

const optionIcons: Record<string, string> = {
  Tesla: "/tesla-logo.png",
  SpaceX: "/spacex-logo.png",
  Dogecoin: "/doge-logo.png",
  Doge: "/doge-logo.png",
  "AI/Grok": "/grok-logo.png",
  Grok: "/grok-logo.png",
  Meme: "/doge-logo.png",
  X: "/x-logo.png",
  Grokpedia: "/grok-logo.png",
  Starlink: "/spacex-logo.png",
};

interface PredictionRound {
  id: string;
  round_number: number;
  status: string;
  start_time: string;
  end_time: string;
  prediction_start_time?: string;
  vote_lock_minutes?: number;
  total_votes: number;
  total_winners: number;
  winning_tweet_text?: string;
  question?: string;
}

export const RoundManager = ({ adminSecretKey }: { adminSecretKey: string }) => {
  const { toast } = useToast();
  const [rounds, setRounds] = useState<PredictionRound[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);

  // Game config state
  const [postsToDisplay, setPostsToDisplay] = useState(6);
  const [defaultOptions, setDefaultOptions] = useState<string[]>([]);
  const [newOption, setNewOption] = useState("");
  const [gameConfigId, setGameConfigId] = useState("");

  // Round creation state
  const [newRound, setNewRound] = useState({
    question: "What will Elon post about first?",
    predictionStartTime: "",
    predictionEndTime: "",
    voteLockMinutes: 60,
  });

  useEffect(() => {
    fetchRounds();
    fetchGameConfig();
  }, []);

  const fetchGameConfig = async () => {
    const { data } = await supabase
      .from("game_config" as any)
      .select("*")
      .limit(1)
      .single();

    if (data) {
      const d = data as any;
      setGameConfigId(d.id);
      setPostsToDisplay(d.posts_to_display || 6);
      setDefaultOptions(d.default_options || []);
    }
  };

  const fetchRounds = async () => {
    const { data } = await supabase
      .from("prediction_rounds")
      .select("*")
      .order("round_number", { ascending: false })
      .limit(10);
    if (data) setRounds(data as PredictionRound[]);
  };

  const saveGameConfig = async () => {
    setSavingConfig(true);
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({
            action: "update_game_config",
            adminWallet: "private_admin",
            adminSecretKey,
            data: {
              id: gameConfigId,
              rss_feed_url: "",
              posts_to_display: postsToDisplay,
              default_options: defaultOptions,
            },
          }),
        }
      );
      if (!response.ok) throw new Error("Failed to save");
      toast({ title: "Saved!", description: "Game settings updated." });
    } catch {
      toast({ title: "Error", description: "Failed to save settings", variant: "destructive" });
    } finally {
      setSavingConfig(false);
    }
  };

  const addOption = () => {
    if (newOption.trim() && !defaultOptions.includes(newOption.trim())) {
      setDefaultOptions([...defaultOptions, newOption.trim()]);
      setNewOption("");
    }
  };

  const removeOption = (option: string) => {
    setDefaultOptions(defaultOptions.filter((o) => o !== option));
  };

  const setTimePresets = (hours: number) => {
    const now = new Date();
    // Round to next hour for cleaner starting point
    const start = addHours(now, 1);
    start.setMinutes(0, 0, 0);
    
    const end = addHours(start, hours);
    
    setNewRound({
      ...newRound,
      predictionStartTime: format(start, "yyyy-MM-dd'T'HH:mm"),
      predictionEndTime: format(end, "yyyy-MM-dd'T'HH:mm"),
    });
  };

  const createRound = async () => {
    if (!newRound.predictionStartTime || !newRound.predictionEndTime) {
      toast({ title: "Error", description: "Please set prediction time frame", variant: "destructive" });
      return;
    }
    if (defaultOptions.length === 0) {
      toast({ title: "Error", description: "Please add at least one prediction option", variant: "destructive" });
      return;
    }

    setCreating(true);
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({
            action: "create_round",
            adminWallet: "private_admin",
            adminSecretKey,
            data: {
              question: newRound.question,
              startTime: new Date().toISOString(),
              endTime: new Date(newRound.predictionEndTime).toISOString(),
              predictionStartTime: new Date(newRound.predictionStartTime).toISOString(),
              voteLockMinutes: newRound.voteLockMinutes,
              status: "open",
              options: defaultOptions.map((label) => ({
                label,
                keywords: [label.toLowerCase()],
              })),
            },
          }),
        }
      );

      if (!response.ok) throw new Error("Failed to create round");
      toast({ title: "Round Created!", description: "Round is now open for voting." });
      fetchRounds();
      setNewRound({
        question: "What will Elon post about first?",
        predictionStartTime: "",
        predictionEndTime: "",
        voteLockMinutes: 60,
      });
    } catch {
      toast({ title: "Error", description: "Failed to create round", variant: "destructive" });
    } finally {
      setCreating(false);
    }
  };

  const endRound = async (roundId: string) => {
    setLoading(true);
    try {
      await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/detect-winner`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          "x-admin-secret": adminSecretKey,
        },
        body: JSON.stringify({ triggered_by: "admin", force_finalize: true }),
      });
      toast({ title: "Round ended!", description: "Winner detection triggered." });
      fetchRounds();
    } catch {
      toast({ title: "Error", description: "Failed to end round", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "open": return "bg-neon-green/20 text-neon-green border-neon-green/30";
      case "upcoming": return "bg-neon-cyan/20 text-neon-cyan border-neon-cyan/30";
      case "finalized": return "bg-neon-purple/20 text-neon-purple border-neon-purple/30";
      case "paid": return "bg-neon-green/20 text-neon-green border-neon-green/30";
      case "no_winner": return "bg-muted text-muted-foreground border-border";
      default: return "bg-muted text-muted-foreground border-border";
    }
  };

  // Calculate monitoring duration
  const durationMinutes = newRound.predictionStartTime && newRound.predictionEndTime 
    ? differenceInMinutes(parseISO(newRound.predictionEndTime), parseISO(newRound.predictionStartTime))
    : 0;
  
  const durationHours = Math.floor(durationMinutes / 60);
  const remainingMins = durationMinutes % 60;

  return (
    <div className="space-y-6">
      {/* Time Synchronization Info */}
      <div className="flex flex-wrap gap-4 px-1">
        <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/30 px-3 py-1.5 rounded-full border border-border/50 shadow-sm">
          <Clock className="w-3 h-3 text-neon-cyan" />
          <span>Local Time: <span className="text-foreground font-medium">{format(new Date(), "h:mm a")}</span></span>
          <span className="opacity-50">({Intl.DateTimeFormat().resolvedOptions().timeZone})</span>
        </div>
        {rounds.length > 0 && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/30 px-3 py-1.5 rounded-full border border-border/50 shadow-sm">
            <Tag className="w-3 h-3 text-neon-purple" />
            <span>Latest Round: <span className="text-foreground font-medium">#{rounds[0].round_number}</span></span>
          </div>
        )}
      </div>

      {/* Game Settings */}
      <Card variant="glass">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Tag className="w-5 h-5 text-neon-purple" />
            Global Presets
          </CardTitle>
          <p className="text-xs text-muted-foreground">Default settings for all new rounds.</p>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5 text-sm">
                <Hash className="w-3.5 h-3.5 text-muted-foreground" />
                Feed Display Count
              </Label>
              <Input
                type="number"
                min={1}
                max={20}
                value={postsToDisplay}
                onChange={(e) => setPostsToDisplay(Number(e.target.value))}
                className="bg-muted/20 border-border/50"
              />
              <p className="text-[10px] text-muted-foreground">Number of recent tweets shown on the live feed.</p>
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-1.5 text-sm">
                <Plus className="w-3.5 h-3.5 text-muted-foreground" />
                Add Quick Option
              </Label>
              <div className="flex gap-2">
                <Input
                  value={newOption}
                  onChange={(e) => setNewOption(e.target.value)}
                  placeholder="e.g. Neuralink, Mars"
                  className="bg-muted/20 border-border/50"
                  onKeyDown={(e) => e.key === "Enter" && addOption()}
                />
                <Button variant="outline" size="icon" onClick={addOption} className="shrink-0 border-border/50">
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>

          <div>
            <Label className="flex items-center gap-1.5 mb-3 text-sm text-muted-foreground uppercase tracking-wider font-bold text-[10px]">
              Active Prediction Pool
            </Label>
            <div className="flex flex-wrap gap-2 p-3 rounded-xl bg-muted/20 border border-border/50 min-h-[60px]">
              {defaultOptions.map((option) => (
                <Badge key={option} variant="secondary" className="pl-2.5 pr-1.5 py-1.5 flex items-center gap-2 bg-card border-border shadow-sm">
                  {optionIcons[option] && (
                    <img src={optionIcons[option]} alt="" className="w-3.5 h-3.5 object-contain" />
                  )}
                  <span className="text-sm font-medium">{option}</span>
                  <button onClick={() => removeOption(option)} className="p-0.5 hover:bg-destructive/10 text-muted-foreground hover:text-destructive rounded transition-colors">
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              ))}
              {defaultOptions.length === 0 && (
                <p className="text-xs text-muted-foreground italic flex items-center">No options added yet...</p>
              )}
            </div>
          </div>

          <Button variant="neon" onClick={saveGameConfig} disabled={savingConfig} className="w-full sm:w-auto">
            <Save className="w-4 h-4 mr-2" />
            {savingConfig ? "Saving..." : "Apply Game Settings"}
          </Button>
        </CardContent>
      </Card>

      {/* Create Round */}
      <Card variant="glass" className="border-neon-cyan/30 shadow-lg shadow-neon-cyan/5">
        <CardHeader className="pb-4 border-b border-border/50">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <CardTitle className="flex items-center gap-2 text-xl">
                <Zap className="w-5 h-5 text-neon-cyan" />
                Launch New Round
              </CardTitle>
              <p className="text-sm text-muted-foreground">Define the monitoring window and voting parameters.</p>
            </div>
            <Badge variant="outline" className="border-neon-cyan/50 text-neon-cyan px-3 py-1">
              Round #{rounds.length > 0 ? rounds[0].round_number + 1 : 1}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="pt-6 space-y-8">
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-7 space-y-4">
                <div className="space-y-2">
                  <Label className="text-sm font-semibold flex items-center gap-2">
                    <Hash className="w-4 h-4 text-neon-cyan" />
                    Prediction Event Title
                  </Label>
                  <Input
                    value={newRound.question}
                    onChange={(e) => setNewRound({ ...newRound, question: e.target.value })}
                    placeholder="e.g. What will Elon post about first?"
                    className="h-11 bg-muted/30 border-border/50 focus:border-neon-cyan/50 text-base"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      <Calendar className="w-3.5 h-3.5" />
                      Monitoring Starts
                    </Label>
                    <Input
                      type="datetime-local"
                      value={newRound.predictionStartTime}
                      onChange={(e) => setNewRound({ ...newRound, predictionStartTime: e.target.value })}
                      className="h-11 bg-muted/30 border-border/50 focus:ring-neon-cyan/20"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      <Timer className="w-3.5 h-3.5" />
                      Monitoring Ends
                    </Label>
                    <Input
                      type="datetime-local"
                      value={newRound.predictionEndTime}
                      onChange={(e) => setNewRound({ ...newRound, predictionEndTime: e.target.value })}
                      className="h-11 bg-muted/30 border-border/50 focus:ring-neon-cyan/20"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 pt-1">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase py-2 mr-2">Presets:</span>
                  {[1, 6, 12, 24].map((hr) => (
                    <Button 
                      key={hr} 
                      type="button" 
                      variant="outline" 
                      size="sm" 
                      onClick={() => setTimePresets(hr)}
                      className="h-7 text-[10px] px-3 bg-muted/10 hover:bg-neon-cyan/10 hover:text-neon-cyan border-border/50"
                    >
                      +{hr}h Window
                    </Button>
                  ))}
                </div>
              </div>

              <div className="lg:col-span-5 flex flex-col justify-between">
                <div className="p-5 rounded-2xl bg-card border border-border shadow-inner space-y-4">
                  <div className="flex items-center justify-between">
                    <Label className="flex items-center gap-2 text-sm font-semibold">
                      <Lock className="w-4 h-4 text-neon-orange" />
                      Voting Cut-off
                    </Label>
                    <span className="text-xs font-mono bg-neon-orange/10 text-neon-orange px-2 py-0.5 rounded">
                      {newRound.voteLockMinutes}m before
                    </span>
                  </div>
                  
                  <Input
                    type="range"
                    min={0}
                    max={120}
                    step={5}
                    value={newRound.voteLockMinutes}
                    onChange={(e) => setNewRound({ ...newRound, voteLockMinutes: Number(e.target.value) })}
                    className="accent-neon-orange"
                  />
                  
                  <div className="flex justify-between text-[10px] text-muted-foreground uppercase font-bold tracking-widest px-1">
                    <span>Instant</span>
                    <span>60m</span>
                    <span>120m</span>
                  </div>

                  <div className="mt-4 pt-4 border-t border-border/50">
                    <div className="flex items-center gap-3 text-sm">
                      <div className="w-8 h-8 rounded-lg bg-neon-orange/10 flex items-center justify-center">
                        <Lock className="w-4 h-4 text-neon-orange" />
                      </div>
                      <div className="flex-1">
                        <p className="font-medium">Vote Lock Trigger</p>
                        <p className="text-[11px] text-muted-foreground">
                          System will disable voting automatically.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Real-time Timeline visualization */}
          {(newRound.predictionStartTime || newRound.predictionEndTime) && (
            <div className="relative p-6 rounded-2xl bg-black/40 border border-white/5 overflow-hidden">
              <div className="absolute top-0 right-0 p-3">
                <Badge variant="outline" className="bg-neon-cyan/10 text-neon-cyan border-neon-cyan/20 gap-1.5 px-2.5">
                  <Clock className="w-3 h-3" />
                  {durationHours > 0 && `${durationHours}h `}{remainingMins}m Duration
                </Badge>
              </div>

              <h4 className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground mb-8 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-neon-green" />
                Round Lifecycle Timeline
              </h4>
              
              <div className="relative flex flex-col md:flex-row items-start md:items-center gap-8 md:gap-0 px-2">
                {/* Horizontal line (desktop) */}
                <div className="hidden md:block absolute top-[18px] left-10 right-10 h-[2px] bg-gradient-to-r from-neon-green via-neon-cyan to-muted border-none" />
                
                {/* Step 1: Start */}
                <div className="relative z-10 flex-1 flex flex-col items-center md:items-start text-center md:text-left">
                  <div className="w-10 h-10 rounded-full bg-neon-green flex items-center justify-center shadow-[0_0_15px_rgba(0,255,136,0.3)] mb-3">
                    <Zap className="w-5 h-5 text-black" />
                  </div>
                  <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider mb-1">Step 1: Launch</span>
                  <span className="text-xs font-medium text-foreground">Voting Opens Now</span>
                </div>

                {/* Step 2: Vote Lock */}
                <div className="relative z-10 flex-1 flex flex-col items-center md:items-start text-center md:text-left">
                  <div className="w-10 h-10 rounded-full bg-neon-orange flex items-center justify-center shadow-[0_0_15px_rgba(255,170,0,0.3)] mb-3 border-4 border-black">
                    <Lock className="w-4 h-4 text-black" />
                  </div>
                  <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider mb-1">Step 2: Lock</span>
                  <span className="text-xs font-medium text-neon-orange">
                    {newRound.predictionStartTime ? formatToLocalTime(new Date(new Date(newRound.predictionStartTime).getTime() - (newRound.voteLockMinutes * 60000)).toISOString()) : "--:--"}
                  </span>
                </div>

                {/* Step 3: Start Monitor */}
                <div className="relative z-10 flex-1 flex flex-col items-center md:items-start text-center md:text-left">
                  <div className="w-10 h-10 rounded-full bg-neon-cyan flex items-center justify-center shadow-[0_0_15px_rgba(0,243,255,0.3)] mb-3 border-4 border-black">
                    <Clock className="w-5 h-5 text-black" />
                  </div>
                  <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider mb-1">Step 3: Track</span>
                  <span className="text-xs font-medium text-foreground">
                    {newRound.predictionStartTime ? formatToLocalTime(new Date(newRound.predictionStartTime).toISOString()) : "--:--"}
                  </span>
                </div>

                {/* Step 4: End */}
                <div className="relative z-10 flex-0 flex flex-col items-center md:items-start text-center md:text-left">
                  <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center mb-3 border-4 border-black">
                    <Square className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider mb-1">Step 4: Result</span>
                  <span className="text-xs font-medium text-muted-foreground">
                    {newRound.predictionEndTime ? formatToLocalTime(new Date(newRound.predictionEndTime).toISOString()) : "--:--"}
                  </span>
                </div>
              </div>
            </div>
          )}

          <div className="pt-2">
            <Button 
              variant="neon" 
              onClick={createRound} 
              disabled={creating} 
              className="w-full h-14 text-lg font-bold shadow-[0_0_30px_rgba(0,243,255,0.15)] hover:shadow-[0_0_40px_rgba(0,243,255,0.25)] transition-all duration-300"
            >
              <Zap className={`w-6 h-6 mr-3 ${creating ? "animate-pulse" : ""}`} />
              {creating ? "INITIALIZING SMART CONTRACT..." : "LAUNCH PRODUCTION ROUND"}
            </Button>
            <div className="flex items-center justify-center gap-2 mt-4">
              <span className="w-2 h-2 rounded-full bg-neon-green animate-pulse" />
              <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">
                System online: Monitoring will start automatically at scheduled time
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Round History */}
      <Card variant="glass">
        <CardHeader className="flex flex-row items-center justify-between pb-4 border-b border-border/50">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Trophy className="w-5 h-5 text-neon-green" />
              Round Audit Logs
            </CardTitle>
            <p className="text-xs text-muted-foreground">Historical data and status of previous rounds.</p>
          </div>
          <Button variant="ghost" size="sm" onClick={fetchRounds} className="h-8 text-[10px] font-bold uppercase tracking-wider">
            Refresh Data
          </Button>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="space-y-4">
            {rounds.map((round) => (
              <div key={round.id} className="group relative flex flex-col sm:flex-row items-start sm:items-center justify-between p-5 rounded-2xl bg-muted/10 border border-border/50 hover:bg-muted/20 hover:border-border transition-all duration-200">
                <div className="space-y-2 flex-1">
                  <div className="flex items-center gap-3">
                    <span className="font-display font-bold text-lg">Round #{round.round_number}</span>
                    <Badge className={`${getStatusColor(round.status)} shadow-sm uppercase text-[10px] font-bold tracking-wider px-2`}>
                      {round.status}
                    </Badge>
                    {round.status === "open" && (
                      <span className="flex items-center gap-1.5 text-[10px] font-bold text-neon-green uppercase tracking-tight">
                        <span className="w-1.5 h-1.5 bg-neon-green rounded-full animate-pulse" />
                        Live
                      </span>
                    )}
                  </div>
                  
                  <p className="text-sm font-medium text-foreground/90">{round.question}</p>
                  
                  <div className="flex flex-wrap items-center gap-y-2 gap-x-4">
                    <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-neon-cyan" />
                      {round.prediction_start_time
                        ? `${formatToLocalTime(round.prediction_start_time)} - ${formatToLocalTime(round.end_time)}`
                        : `${formatToLocalTime(round.start_time)} - ${formatToLocalTime(round.end_time)}`}
                    </div>
                    {round.vote_lock_minutes && (
                      <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                        <Lock className="w-3.5 h-3.5 text-neon-orange" />
                        {round.vote_lock_minutes}m Lock
                      </div>
                    )}
                  </div>

                  {round.winning_tweet_text && (
                    <div className="mt-2 p-3 rounded-lg bg-neon-green/5 border border-neon-green/10 flex items-start gap-3 max-w-2xl">
                      <Trophy className="w-4 h-4 text-neon-green shrink-0 mt-0.5" />
                      <p className="text-xs text-foreground italic line-clamp-2">
                        "{round.winning_tweet_text}"
                      </p>
                    </div>
                  )}
                </div>

                <div className="mt-4 sm:mt-0 flex items-center gap-6 border-t sm:border-t-0 sm:border-l border-border/50 pt-4 sm:pt-0 sm:pl-6 w-full sm:w-auto">
                  <div className="flex flex-col gap-1 text-center sm:text-right">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Analytics</span>
                    <div className="flex items-center gap-3 justify-center sm:justify-end">
                      <div className="flex flex-col items-center sm:items-end">
                        <span className="text-sm font-bold text-foreground">{round.total_votes}</span>
                        <span className="text-[9px] text-muted-foreground uppercase">Votes</span>
                      </div>
                      <div className="flex flex-col items-center sm:items-end">
                        <span className="text-sm font-bold text-neon-green">{round.total_winners}</span>
                        <span className="text-[9px] text-muted-foreground uppercase">Winners</span>
                      </div>
                    </div>
                  </div>
                  
                  {round.status === "open" && (
                    <Button 
                      size="sm" 
                      variant="outline" 
                      onClick={() => endRound(round.id)} 
                      disabled={loading}
                      className="h-10 px-4 bg-background hover:bg-neon-cyan/5 hover:text-neon-cyan border-border/50 shadow-sm"
                    >
                      <ArrowRight className="w-4 h-4 mr-2" />
                      Finalize
                    </Button>
                  )}
                </div>
              </div>
            ))}
            
            {rounds.length === 0 && (
              <div className="text-center py-12 rounded-2xl border-2 border-dashed border-border/50">
                <Square className="w-10 h-10 text-muted-foreground/20 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">No round history available</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
