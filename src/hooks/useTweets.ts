import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

const CACHE_KEY = "elonmarket_tweets_cache";
const MAX_TWEETS = 12;
const RETRY_DELAYS = [2000, 4000, 8000]; // Exponential backoff

export interface Tweet {
  id: string;
  tweet_id: string;
  tweet_url?: string;
  text: string;
  author_id: string;
  author_username: string;
  author_name?: string;
  author_avatar?: string;
  tweet_type: "post" | "quote" | "repost";
  quoted_tweet_id?: string;
  quoted_tweet_text?: string;
  matched_option_id?: string;
  matched_keywords?: string[];
  created_at_twitter: string;
  fetched_at: string;
}

/** Read cached tweets from localStorage */
function getCachedTweets(): Tweet[] {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (raw) return JSON.parse(raw) as Tweet[];
  } catch {
    // Ignore corrupted cache
  }
  return [];
}

/** Persist tweets to localStorage */
function setCachedTweets(tweets: Tweet[]) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(tweets));
  } catch {
    // Storage full or unavailable — ignore
  }
}

async function fetchWithRetry(attempt = 0): Promise<Tweet[]> {
  const { data, error } = await supabase
    .from("tweets")
    .select("*")
    .order("created_at_twitter", { ascending: false })
    .limit(MAX_TWEETS);

  if (error) {
    if (attempt < RETRY_DELAYS.length) {
      await new Promise((r) => setTimeout(r, RETRY_DELAYS[attempt]));
      return fetchWithRetry(attempt + 1);
    }
    throw error;
  }

  return (data as unknown as Tweet[]) ?? [];
}

export function useTweets() {
  const [tweets, setTweets] = useState<Tweet[]>(() => getCachedTweets());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTweets = useCallback(async () => {
    try {
      setLoading(true);
      const data = await fetchWithRetry();

      if (data.length > 0) {
        setTweets(data);
        setCachedTweets(data);
        setError(null);
      }
    } catch (err) {
      console.error("Tweet fetch error:", err);
      setError(err instanceof Error ? err.message : "Failed to load tweets");
      // Keep showing cached tweets — don't clear state
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTweets();

    // Auto-refresh every 60 seconds
    const interval = setInterval(fetchTweets, 60_000);

    // Realtime subscription for instant updates
    const channel = supabase
      .channel("tweets-realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "tweets" },
        (payload) => {
          const newTweet = payload.new as unknown as Tweet;
          setTweets((prev) => {
            const filtered = prev.filter((t) => t.tweet_id !== newTweet.tweet_id);
            const updated = [newTweet, ...filtered].slice(0, MAX_TWEETS);
            setCachedTweets(updated);
            return updated;
          });
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "tweets" },
        (payload) => {
          const updated = payload.new as unknown as Tweet;
          setTweets((prev) => {
            const next = prev.map((t) =>
              t.tweet_id === updated.tweet_id ? updated : t
            );
            setCachedTweets(next);
            return next;
          });
        }
      )
      .subscribe();

    return () => {
      clearInterval(interval);
      channel.unsubscribe();
    };
  }, [fetchTweets]);

  return { tweets, loading, error, refetch: fetchTweets };
}
