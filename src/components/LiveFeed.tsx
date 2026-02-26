import { ExternalLink, RefreshCw, Sparkles, User } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useState, useEffect, useCallback } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { useTweets, Tweet } from "@/hooks/useTweets";
import { motion, AnimatePresence } from "framer-motion";
import muskMarketLogo from "@/assets/muskmarket-logo.jpg";
import { supabase } from "@/integrations/supabase/client";

const optionColors: Record<string, string> = {
  Tesla: "bg-red-500/20 text-red-400 border-red-500/40 shadow-red-500/10",
  Grok: "bg-purple-500/20 text-purple-400 border-purple-500/40 shadow-purple-500/10",
  SpaceX: "bg-blue-500/20 text-blue-400 border-blue-500/40 shadow-blue-500/10",
  X: "bg-foreground/10 text-foreground border-foreground/20",
  Doge: "bg-yellow-500/20 text-yellow-400 border-yellow-500/40 shadow-yellow-500/10",
  Grokpedia: "bg-cyan-500/20 text-cyan-400 border-cyan-500/40 shadow-cyan-500/10",
  Starlink: "bg-sky-500/20 text-sky-400 border-sky-500/40 shadow-sky-500/10",
};

const detectMatchingOptions = (text: string, options: string[]): string[] => {
  // IMPORTANT: this must match the backend spirit:
  // - exact word matching (case-insensitive)
  // - "Grokipedia" should NOT match "Grok"
  // - allow punctuation boundaries like "Grok," "Grok." "(Grok)"
  // - allow @mentions like "@Tesla"
  const matches: string[] = [];
  const raw = text ?? "";

  const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  for (const option of options) {
    if (!option) continue;

    if (option === "X") {
      // Match standalone X or X.com
      // \b ensures we don't match "SpaceX" because "e" and "X" are both word chars, so no boundary exists.
      const standaloneX = /\bX\b/;
      const xCom = /\bx\.com\b/i;
      if (standaloneX.test(raw) || xCom.test(raw)) matches.push(option);
      continue;
    }

    const kw = escapeRegex(option);
    const wordRegex = new RegExp(`(?<![a-zA-Z0-9@#])${kw}(?![a-zA-Z0-9])`, "i");
    const comRegex = new RegExp(`(?<![a-zA-Z0-9@#])${kw}\\.com(?![a-zA-Z0-9])`, "i");
    const mentionRegex = new RegExp(`@${kw}\\b`, "i");

    if (wordRegex.test(raw) || comRegex.test(raw) || mentionRegex.test(raw)) matches.push(option);
  }

  return matches;
};

const TweetCard = ({ tweet, index, predictionOptions }: { tweet: Tweet; index: number; predictionOptions: string[] }) => {
  const matchingOptions = detectMatchingOptions(tweet.text, predictionOptions);
  const hasMatch = matchingOptions.length > 0;
  const postDate = new Date(tweet.created_at_twitter);
  const [timeAgo, setTimeAgo] = useState("");

  useEffect(() => {
    const updateTimeAgo = () => {
      const now = Date.now();
      const diff = Math.max(0, now - postDate.getTime());
      const seconds = Math.floor(diff / 1000);
      const minutes = Math.floor(seconds / 60);
      const hours = Math.floor(minutes / 60);
      const days = Math.floor(hours / 24);

      if (seconds < 10) setTimeAgo("just now");
      else if (seconds < 60) setTimeAgo(`${seconds}s ago`);
      else if (minutes < 60) setTimeAgo(`${minutes}m ago`);
      else if (hours < 24) setTimeAgo(`${hours}h ago`);
      else setTimeAgo(`${days}d ago`);
    };

    updateTimeAgo();
    const interval = setInterval(updateTimeAgo, 10_000);
    return () => clearInterval(interval);
  }, [postDate.getTime()]);

  // Preserve @mentions (e.g. @Tesla, @SpaceX) - only collapse extra spaces
  const cleanText = tweet.text.replace(/\s{2,}/g, " ").trim();
  const truncatedText = cleanText.length > 180
    ? cleanText.slice(0, 180).trim() + "…"
    : cleanText;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1, duration: 0.3 }}
      className="h-full"
    >
      <Card
        className={`relative bg-card/60 border-border hover:bg-card/80 transition-all duration-300 p-4 overflow-hidden h-full flex flex-col ${
          hasMatch ? "ring-1 ring-neon-green/30" : ""
        }`}
      >
        {hasMatch && (
          <div className="absolute inset-0 bg-gradient-to-br from-neon-green/5 to-transparent pointer-events-none" />
        )}

        <div className="relative flex gap-3">
          {tweet.author_avatar ? (
            <img
              src={tweet.author_avatar}
              alt={tweet.author_username}
              className="w-10 h-10 rounded-full object-cover shrink-0 border border-border"
            />
          ) : (
            <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center shrink-0 border border-border">
              <User className="w-5 h-5 text-muted-foreground" />
            </div>
          )}
          <div className="flex-1 min-w-0 flex flex-col">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-foreground truncate">{tweet.author_name || "Elon Musk"}</span>
              <span className="text-muted-foreground text-xs">· {timeAgo}</span>
            </div>

            <p className="text-foreground mt-2 text-sm leading-relaxed break-words flex-1">
              {truncatedText}
            </p>

            {hasMatch && (
              <div className="flex flex-wrap gap-1.5 mt-3">
                <Sparkles className="w-3.5 h-3.5 text-neon-green" />
                {matchingOptions.map((option) => (
                  <span
                    key={option}
                    className={`px-2 py-0.5 rounded-full text-xs font-medium border ${optionColors[option] || "bg-primary/20 text-primary border-primary/40"}`}
                  >
                    {option}
                  </span>
                ))}
              </div>
            )}

            {tweet.tweet_type === "quote" && tweet.quoted_tweet_text && (
              <div className="mt-3 p-2 rounded-lg border border-border bg-muted/30 text-xs text-muted-foreground line-clamp-2">
                <p className="italic">"{tweet.quoted_tweet_text.slice(0, 100)}{tweet.quoted_tweet_text.length > 100 ? "…" : ""}"</p>
              </div>
            )}
          </div>
        </div>
      </Card>
    </motion.div>
  );
};

export const LiveFeed = () => {
  const { tweets, loading, refetch } = useTweets();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [postsToDisplay, setPostsToDisplay] = useState(6);
  const [predictionOptions, setPredictionOptions] = useState<string[]>(["Tesla", "Grok", "SpaceX", "X", "Doge", "Grokpedia", "Starlink"]);

  // Fetch game config for posts_to_display and prediction options
  useEffect(() => {
    const fetchConfig = async () => {
      const { data } = await supabase
        .from("game_config" as any)
        .select("posts_to_display, default_options")
        .limit(1)
        .single();
      if (data) {
        const d = data as any;
        if (d.posts_to_display) setPostsToDisplay(d.posts_to_display);
        if (d.default_options?.length > 0) setPredictionOptions(d.default_options);
      }
    };
    fetchConfig();
  }, []);

  // Auto-refresh every 60 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      refetch();
    }, 60000);
    return () => clearInterval(interval);
  }, [refetch]);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await refetch();
    setTimeout(() => setIsRefreshing(false), 500);
  }, [refetch]);

  return (
    <section id="feed" className="py-12 relative">
      <div className="container mx-auto px-4">
        {/* Section Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h2 className="font-display text-xl md:text-2xl font-semibold text-foreground">
                Live Feed
              </h2>
              <span className="flex items-center gap-1.5 px-2 py-0.5 bg-neon-green/10 text-neon-green text-xs rounded-full border border-neon-green/20">
                <span className="w-1.5 h-1.5 bg-neon-green rounded-full animate-pulse" />
                Live
              </span>
            </div>
            <p className="text-sm text-muted-foreground">Real-time posts from Elon Musk</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isRefreshing} className="gap-1.5">
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <a
              href="https://x.com/elonmusk"
              target="_blank"
              rel="noopener noreferrer"
              className="hidden sm:flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Elon Musk
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>

        {/* Tweet Cards Grid */}
        {tweets.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-muted-foreground text-sm">Waiting for tweets via IFTTT...</p>
            <p className="text-muted-foreground/60 text-xs mt-2">New posts will appear here in real-time</p>
          </div>
        ) : (
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            <AnimatePresence mode="popLayout">
              {tweets.slice(0, postsToDisplay).map((tweet, index) => (
                <TweetCard key={tweet.tweet_id} tweet={tweet} index={index} predictionOptions={predictionOptions} />
              ))}
            </AnimatePresence>
          </div>
        )}

        {/* Prediction Options Legend */}
        <div className="mt-6 p-4 rounded-xl bg-card/40 border border-border">
          <p className="text-xs text-muted-foreground mb-3 text-center">Prediction Options</p>
          <div className="flex flex-wrap gap-2 justify-center">
            {predictionOptions.map((option) => (
              <span
                key={option}
                className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all hover:scale-105 ${optionColors[option] || "bg-primary/20 text-primary border-primary/40"}`}
              >
                {option}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};
