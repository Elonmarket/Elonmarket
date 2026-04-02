import React, { useState, useEffect, useCallback } from "react";
import { ExternalLink, RefreshCw, Sparkles, User, Repeat2, Quote } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useTweets, Tweet } from "@/hooks/useTweets";
import { motion, AnimatePresence } from "framer-motion";
import elonmarketLogo from "@/assets/muskmarket-logo.jpg";
import elonAvatar from "@/assets/elon-avatar.jpeg";
import { supabase } from "@/integrations/supabase/client";

const optionColors: Record<string, string> = {
  Tesla: "bg-red-500/20 text-red-400 border-red-500/40 shadow-red-500/10",
  Grok: "bg-purple-500/20 text-purple-400 border-purple-500/40 shadow-purple-500/10",
  "AI/Grok": "bg-purple-500/20 text-purple-400 border-purple-500/40 shadow-purple-500/10",
  SpaceX: "bg-blue-500/20 text-blue-400 border-blue-500/40 shadow-blue-500/10",
  X: "bg-foreground/10 text-foreground border-foreground/20",
  Doge: "bg-yellow-500/20 text-yellow-400 border-yellow-500/40 shadow-yellow-500/10",
  Dogecoin: "bg-yellow-500/20 text-yellow-400 border-yellow-500/40 shadow-yellow-500/10",
  Grokpedia: "bg-cyan-500/20 text-cyan-400 border-cyan-500/40 shadow-cyan-500/10",
  Starlink: "bg-sky-500/20 text-sky-400 border-sky-500/40 shadow-sky-500/10",
  Meme: "bg-green-500/20 text-green-400 border-green-500/40 shadow-green-500/10",
};

const optionIcons: Record<string, string> = {
  Tesla: "/tesla-logo.png",
  SpaceX: "/spacex-logo.png",
  Dogecoin: "/doge-logo.png",
  Doge: "/doge-logo.png",
  "AI/Grok": "/grok-logo.png",
  Grok: "/grok-logo.png",
  Meme: "/doge-logo.png",
  X: "/x-logo.png",
  Grokpedia: "/grokpedia.png",
  Starlink: "/starlink-logo.png",
  Gork: "/gork.png"
};

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const detectMatchingOptions = (text: string, options: string[]): string[] => {
  // IMPORTANT: this must match the backend spirit:
  // - exact word matching (case-insensitive)
  // - "Grokipedia" should NOT match "Grok"
  // - allow punctuation boundaries like "Grok," "Grok." "(Grok)"
  // - allow @mentions like "@Tesla"
  const matches: string[] = [];
  const raw = text ?? "";

  for (const option of options) {
    if (!option) continue;

    if (option === "X") {
      const standaloneX = /\bX\b/;
      const unicodeX = /𝕏/;
      const xCom = /\bx\.com\b/i;
      if (standaloneX.test(raw) || unicodeX.test(raw) || xCom.test(raw)) matches.push(option);
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

/** Split text into segments and wrap matching option keywords in <mark> for highlighting. */
function highlightMatchesInText(text: string, options: string[]): React.ReactNode {
  if (!text || options.length === 0) return text;
  const raw = text;
  let segments: { str: string; match: string | null }[] = [{ str: raw, match: null }];

  for (const option of options) {
    if (option === "X") {
      const re = /\b(X)\b|(\bx\.com\b)|(𝕏)/gi;
      segments = segments.flatMap((seg) => {
        if (seg.match) return [seg];
        const parts: { str: string; match: string | null }[] = [];
        let last = 0;
        let m: RegExpExecArray | null;
        while ((m = re.exec(seg.str)) !== null) {
          if (m.index > last) parts.push({ str: seg.str.slice(last, m.index), match: null });
          parts.push({ str: m[0], match: option });
          last = m.index + m[0].length;
        }
        if (last < seg.str.length) parts.push({ str: seg.str.slice(last), match: null });
        return parts.length ? parts : [seg];
      });
      continue;
    }
    const kw = escapeRegex(option);
    const re = new RegExp(`(?<![a-zA-Z0-9@#])(${kw})(?![a-zA-Z0-9])|(${kw}\\.com)|(@${kw}\\b)`, "gi");
    segments = segments.flatMap((seg) => {
      if (seg.match) return [seg];
      const parts: { str: string; match: string | null }[] = [];
      let last = 0;
      let m: RegExpExecArray | null;
      while ((m = re.exec(seg.str)) !== null) {
        if (m.index > last) parts.push({ str: seg.str.slice(last, m.index), match: null });
        parts.push({ str: m[0], match: option });
        last = m.index + m[0].length;
      }
      if (last < seg.str.length) parts.push({ str: seg.str.slice(last), match: null });
      return parts.length ? parts : [seg];
    });
  }

  return (
    <>
      {segments.map((seg, i) =>
        seg.match ? (
          <mark key={i} className={`rounded px-0.5 ${optionColors[seg.match] || "bg-primary/30 text-primary"}`}>
            {seg.str}
          </mark>
        ) : (
          seg.str
        )
      )}
    </>
  );
}

// Strip repost headers and "DisplayName (@username)" patterns from text
// so account display names (e.g. "Tesla") don't cause false keyword matches
const stripAttributionPatterns = (text: string): string => {
  let cleaned = text;
  // Remove "RT by @username:" or "RT @username:" prefix
  cleaned = cleaned.replace(/^RT\s+(by\s+)?@\S+:\s*/i, "");
  // Remove "DisplayName (@username)" / "DisplayName (@username):" patterns
  // e.g. "Tesla Motors (@tesla):" or "SpaceX (@SpaceX)"
  cleaned = cleaned.replace(/[\w][\w\s]*?\s*\(@[A-Za-z0-9_]+\)\s*:?\s*/g, "");
  return cleaned.trim();
};

const getTextForMatching = (t: Tweet) => {
  const mainText = stripAttributionPatterns(t.text ?? "");
  const quotedText = stripAttributionPatterns(t.quoted_tweet_text ?? "");
  return [mainText, quotedText].filter(Boolean).join("\n");
};

const TweetCard = React.forwardRef(({ tweet, index, predictionOptions }: { tweet: Tweet; index: number; predictionOptions: string[] }, ref: React.ForwardedRef<HTMLDivElement>) => {
  const matchingOptions = detectMatchingOptions(getTextForMatching(tweet), predictionOptions);
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

  // Detect if it's a pure repost based on tweet_type or text prefix
  const isRepost = tweet.tweet_type === "repost" || /^RT\s+(by\s+)?@/i.test(tweet.text);
  const isQuote = tweet.tweet_type === "quote" && !isRepost;

  // Extract author info if we don't have it structured yet
  // This helps for older tweets or if poller extraction fails
  const authorPattern = /^([^(@]+)\s+\((@\w+)\):\s*(.*)$/s;
  const rawTextForRepost = tweet.text.replace(/^RT\s+(by\s+)?@\S+:\s*/i, "").trim();
  const authorMatch = !tweet.quoted_tweet_author_username ? rawTextForRepost.match(authorPattern) : null;
  
  const originalAuthor = {
    name: tweet.quoted_tweet_author_name || (authorMatch ? authorMatch[1].trim() : null),
    username: tweet.quoted_tweet_author_username || (authorMatch ? authorMatch[2].trim().replace("@", "") : null),
    avatar: tweet.quoted_tweet_author_avatar || null
  };

  // For reposts without quoted_tweet_text, extract the reposted content from main text
  const rawRepostContent = isRepost && !tweet.quoted_tweet_text
    ? (authorMatch ? authorMatch[3].trim() : rawTextForRepost)
    : tweet.quoted_tweet_text;

  // Helper: strip "Name (@username):" attribution and Nitter URLs
  const stripDisplayNoise = (t: string) =>
    t.replace(/^[^(\n]{0,80}\(@[A-Za-z0-9_]+\)\s*:?\s*/u, "")
     .replace(/https?:\/\/(?:127\.0\.0\.1:\d+|nitter\.[^\s/]+)\/\S*/gi, "")
     .replace(/\s*—\s*$/, "")
     .replace(/\s{2,}/g, " ")
     .trim();

  const repostContent = rawRepostContent ? stripDisplayNoise(rawRepostContent) : rawRepostContent;

  const cleanText = stripDisplayNoise(tweet.text);
  const truncatedText = cleanText.length > 180
    ? cleanText.slice(0, 180).trim() + "…"
    : cleanText;

  const tweetUrl = tweet.tweet_id
    ? `https://x.com/elonmusk/status/${tweet.tweet_id}`
    : tweet.tweet_url;

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1, duration: 0.3 }}
      className="h-full"
    >
      <Card
        className={`relative bg-card/60 border-border hover:bg-card/80 transition-all duration-300 p-4 overflow-hidden h-full flex flex-col ${
          hasMatch ? "ring-1 ring-neon-green/30 shadow-[0_0_15px_rgba(34,197,94,0.1)]" : ""
        }`}
        {...(tweetUrl
          ? {
              onClick: () => window.open(tweetUrl, "_blank", "noopener,noreferrer"),
              className: `relative bg-card/60 border-border hover:bg-card/80 transition-all duration-300 p-4 overflow-hidden h-full flex flex-col ${
                hasMatch ? "ring-1 ring-neon-green/30 shadow-[0_0_15px_rgba(34,197,94,0.1)]" : ""
              } cursor-pointer`,
            }
          : {})}
      >
        {hasMatch && (
          <div className="absolute inset-0 bg-gradient-to-br from-neon-green/5 to-transparent pointer-events-none" />
        )}

        {/* Repost Indicator (at top) */}
        {isRepost && (
          <div className="flex items-center gap-1.5 mb-2 text-muted-foreground text-[10px] font-bold uppercase tracking-wider ml-1">
            <Repeat2 className="w-3.5 h-3.5 text-neon-green/70" />
            <span>{tweet.author_name || "Elon Musk"} Reposted</span>
          </div>
        )}

        <div className="relative flex gap-3 h-full">
          <img
            src={elonAvatar}
            alt={tweet.author_username}
            className="w-10 h-10 rounded-full object-cover shrink-0 border border-border"
          />
          <div className="flex-1 min-w-0 flex flex-col">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-foreground truncate">{tweet.author_name || "Elon Musk"}</span>
              <span className="text-muted-foreground text-xs">· {timeAgo}</span>
            </div>

            {/* Only show main text if it's not a pure RT header */}
            {!isRepost && (
              <p className="text-foreground mt-1.5 text-sm leading-relaxed break-words">
                {truncatedText}
              </p>
            )}

            {/* Quoted/Reposted Content */}
            {repostContent && (
              <div 
                className={`mt-3 p-3 rounded-xl border border-border/50 bg-muted/20 relative group overflow-hidden flex-1 flex flex-col justify-center min-h-[60px] ${isRepost ? 'border-neon-green/20 bg-neon-green/5' : ''}`}
                onClick={(e) => {
                  if (tweet.quoted_tweet_id && (originalAuthor.username || tweet.quoted_tweet_author_username)) {
                    e.stopPropagation();
                    const username = originalAuthor.username || tweet.quoted_tweet_author_username;
                    window.open(`https://x.com/${username}/status/${tweet.quoted_tweet_id}`, "_blank", "noopener,noreferrer");
                  }
                }}
              >
                {isQuote && <Quote className="absolute -top-1 -right-1 w-8 h-8 text-foreground/5 pointer-events-none" />}
                
                {/* Original Author Header for Reposts/Quotes */}
                {originalAuthor.username && (
                  <div className="flex items-center gap-2 mb-2">
                    {originalAuthor.avatar ? (
                      <img 
                        src={originalAuthor.avatar} 
                        alt={originalAuthor.username} 
                        className="w-5 h-5 rounded-full object-cover shrink-0"
                      />
                    ) : (
                      <div className="w-5 h-5 rounded-full bg-muted flex items-center justify-center shrink-0">
                        <Repeat2 className="w-3 h-3 text-muted-foreground" />
                      </div>
                    )}
                    <div className="flex items-center gap-1 overflow-hidden">
                      <span className="text-xs font-bold text-foreground truncate max-w-[120px]">
                        {originalAuthor.name || originalAuthor.username}
                      </span>
                      <span className="text-[10px] text-muted-foreground truncate">
                        @{originalAuthor.username}
                      </span>
                    </div>
                  </div>
                )}

                <p className={`text-foreground text-sm leading-relaxed italic relative z-10 ${isRepost ? 'line-clamp-6' : 'line-clamp-3'}`}>
                  {highlightMatchesInText(repostContent || "", matchingOptions)}
                </p>

                {/* Media Image */}
                {tweet.media_url && (
                  <div className="mt-2.5 rounded-lg overflow-hidden border border-border/50 bg-black/20">
                    <img 
                      src={tweet.media_url} 
                      alt="Tweet media" 
                      className="w-full h-auto max-h-[300px] object-contain"
                    />
                  </div>
                )}
              </div>
            )}

            {hasMatch && (
              <div className="flex flex-wrap gap-1.5 mt-3">
                <Sparkles className="w-3.5 h-3.5 text-neon-green" />
                {matchingOptions.map((option) => (
                  <span
                    key={option}
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${optionColors[option] || "bg-primary/20 text-primary border-primary/40"}`}
                  >
                    {optionIcons[option] && (
                      <img src={optionIcons[option]} alt="" className="w-3 h-3 object-contain" />
                    )}
                    {option}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </Card>
    </motion.div>
  );
});


TweetCard.displayName = "TweetCard";

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
            <p className="text-sm text-muted-foreground">Real-time posts from <a href="https://x.com/elonmusk" target="_blank" rel="noopener noreferrer" className="text-muted-foreground underline decoration-muted-foreground/30 underline-offset-2 hover:decoration-muted-foreground/60 transition-colors">@elonmusk</a></p>
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
