import { useEffect, useRef, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { motion, AnimatePresence } from "framer-motion";
import { Terminal, Activity, Wifi, WifiOff } from "lucide-react";

interface PollerLog {
  id: string;
  level: string;
  message: string;
  metadata: unknown;
  created_at: string;
}

const levelColors: Record<string, string> = {
  info: "text-neon-green",
  poll: "text-cyan-400",
  tweet: "text-neon-green",
  repost: "text-purple-400",
  quote: "text-pink-400",
  error: "text-red-400",
  skip: "text-orange-400",
  success: "text-neon-green",
};

const levelIcons: Record<string, string> = {
  info: "ℹ",
  poll: "🔍",
  tweet: "📝",
  repost: "🔁",
  quote: "💬",
  error: "❌",
  skip: "⏭",
  success: "✅",
};

const MAX_VISIBLE_LOGS = 50;

export const PollerTerminal = () => {
  const [logs, setLogs] = useState<PollerLog[]>([]);
  const [connected, setConnected] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Fetch recent logs and subscribe to realtime
  const fetchLogs = useCallback(async () => {
    const { data } = await supabase
      .from("poller_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(MAX_VISIBLE_LOGS);

    if (data) {
      setLogs(data.reverse());
    }
  }, []);

  useEffect(() => {
    fetchLogs();

    let channel = supabase
      .channel("poller-logs-realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "poller_logs" },
        (payload) => {
          const newLog = payload.new as PollerLog;
          setLogs((prev) => {
            const updated = [...prev, newLog];
            return updated.slice(-MAX_VISIBLE_LOGS);
          });
        }
      )
      .subscribe((status) => {
        setConnected(status === "SUBSCRIBED");
      });

    // Re-fetch + reconnect when tab becomes visible (fixes mobile stale logs)
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        fetchLogs();
        supabase.removeChannel(channel);
        channel = supabase
          .channel("poller-logs-realtime-" + Date.now())
          .on(
            "postgres_changes",
            { event: "INSERT", schema: "public", table: "poller_logs" },
            (payload) => {
              const newLog = payload.new as PollerLog;
              setLogs((prev) => {
                const updated = [...prev, newLog];
                return updated.slice(-MAX_VISIBLE_LOGS);
              });
            }
          )
          .subscribe((status) => {
            setConnected(status === "SUBSCRIBED");
          });
      }
    };

    const handleOnline = () => {
      fetchLogs();
    };

    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("online", handleOnline);

    return () => {
      supabase.removeChannel(channel);
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("online", handleOnline);
    };
  }, [fetchLogs]);

  // Auto-scroll to bottom on new logs
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleTimeString("en-US", {
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  return (
    <section className="py-6 px-2 sm:px-4">
      <div className="max-w-6xl mx-auto">
        {/* Title + Explainer above terminal */}
        <div className="mb-4 px-1">
          <h3 className="text-xl sm:text-2xl font-bold text-foreground mb-2">
            Elonmarket Terminal
          </h3>
          <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
            Fastest Elon Tracking in the world. Live 24/7 feed of every Elon Musk post, repost, quote &amp; replies — no delays, no filters.
          </p>
        </div>

        <Card variant="glass" className="overflow-hidden border border-neon-green/20">
          {/* Terminal header */}
          <div className="flex items-center justify-between px-3 py-2 bg-black/60 border-b border-neon-green/10">
            <div className="flex items-center gap-1.5 min-w-0">
              <div className="flex gap-1 shrink-0">
                <div className="w-2.5 h-2.5 rounded-full bg-red-500/80" />
                <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/80" />
                <div className="w-2.5 h-2.5 rounded-full bg-green-500/80" />
              </div>
              <span className="text-[10px] sm:text-xs font-mono text-muted-foreground ml-2 truncate">
                elonmarket — poller — live
              </span>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {connected ? (
                <>
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-neon-green opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-neon-green" />
                  </span>
                  <span className="text-[10px] font-mono text-neon-green uppercase tracking-wider">
                    Live
                  </span>
                </>
              ) : (
                <>
                  <WifiOff className="w-3 h-3 text-muted-foreground" />
                  <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">
                    Connecting
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Log output */}
          <div
            ref={scrollRef}
            className="h-[220px] sm:h-[260px] overflow-y-auto bg-black/90 px-2 sm:px-3 py-1 sm:py-2 font-mono text-[10px] sm:text-xs leading-[1.35] sm:leading-[1.6] custom-scrollbar"
          >
            {logs.length === 0 ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <Terminal className="w-6 h-6 text-neon-green/20 mx-auto mb-2" />
                  <p className="text-muted-foreground text-[11px]">
                    Waiting for poller activity...
                  </p>
                </div>
              </div>
            ) : (
              <AnimatePresence initial={false}>
                {logs.map((log) => (
                  <motion.div
                    key={log.id}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.15 }}
                    className="whitespace-pre-wrap break-words py-[1px]"
                  >
                    <span className="text-muted-foreground/40 select-none">
                      [{formatTime(log.created_at)}]
                    </span>{" "}
                    {(log.level === "post" || log.level === "tweet" || /New post detected:/i.test(log.message)) ? (
                      <>
                        <span className="font-bold uppercase text-neon-green">POST</span>{" "}
                        <span className="text-foreground/70">
                          Elon Musk Post: {log.message.replace(/^New\s+post\s+detected:\s*/i, "")}
                        </span>
                      </>
                    ) : (log.level === "repost" || /New repost detected:/i.test(log.message)) ? (
                      <>
                        <span className="font-bold uppercase text-purple-400">REPOST</span>{" "}
                        <span className="text-foreground/70">
                          Elon Musk Repost: {log.message.replace(/^New\s+repost\s+detected:\s*/i, "")}
                        </span>
                      </>
                    ) : (
                      <>
                        <span className={`font-bold uppercase ${levelColors[log.level] || "text-foreground"}`}>
                          {log.level}
                        </span>{" "}
                        <span className="text-foreground/70">
                          {log.level === "skip" && /reply/i.test(log.message)
                            ? log.message.replace(/^Reply skipped:\s*/i, "Elon Musk Reply: ").replace(/^Skipped reply:\s*/i, "Elon Musk Reply: ")
                            : log.level === "quote" && /New quote detected:/i.test(log.message)
                            ? log.message.replace(/^New quote detected:\s*/i, "Elon Musk quote: ")
                            : log.message}
                        </span>
                      </>
                    )}
                  </motion.div>
                ))}
              </AnimatePresence>
            )}

            {/* Blinking cursor */}
            <div className="flex items-center gap-1 mt-1">
              <span className="text-neon-green/70">$</span>
              <span className="w-1.5 h-3.5 bg-neon-green/70 animate-pulse" />
            </div>
          </div>

          {/* Footer */}
          <div className="px-3 py-1.5 bg-black/60 border-t border-neon-green/10 flex items-center justify-between">
            <span className="text-[9px] sm:text-sm font-mono text-muted-foreground/40 sm:text-muted-foreground">
              elonmarket-poller v1.0 • 10s interval
            </span>
            <span className="text-[9px] sm:text-sm font-mono text-muted-foreground/40 sm:text-muted-foreground">
              {logs.length} entries
            </span>
          </div>
        </Card>
      </div>
    </section>
  );
};
