import { useEffect, useRef, useState } from "react";
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
  tweet: "text-yellow-400",
  repost: "text-purple-400",
  quote: "text-pink-400",
  error: "text-red-400",
  skip: "text-muted-foreground",
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

  // Fetch recent logs on mount
  useEffect(() => {
    const fetchLogs = async () => {
      const { data } = await supabase
        .from("poller_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(MAX_VISIBLE_LOGS);

      if (data) {
        setLogs(data.reverse());
      }
    };

    fetchLogs();

    // Subscribe to realtime inserts
    const channel = supabase
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

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

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
        <Card variant="glass" className="overflow-hidden border border-neon-green/20">
          {/* Terminal header */}
          <div className="flex items-center justify-between px-3 sm:px-4 py-2 bg-black/60 border-b border-neon-green/10">
            <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
              <div className="flex gap-1 sm:gap-1.5 shrink-0">
                <div className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full bg-red-500/80" />
                <div className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full bg-yellow-500/80" />
                <div className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full bg-green-500/80" />
              </div>
              <Terminal className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-neon-green/70 ml-1 sm:ml-2 shrink-0" />
              <span className="text-[10px] sm:text-xs font-mono text-neon-green/70 tracking-wide truncate">
                elonmarket_terminal
              </span>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              {connected ? (
                <div className="flex items-center gap-1">
                  <Wifi className="w-3 h-3 text-neon-green" />
                  <span className="text-[9px] sm:text-[10px] font-mono text-neon-green uppercase tracking-widest">
                    Live
                  </span>
                  <span className="relative flex h-1.5 w-1.5 sm:h-2 sm:w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-neon-green opacity-75" />
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 sm:h-2 sm:w-2 bg-neon-green" />
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-1">
                  <WifiOff className="w-3 h-3 text-muted-foreground" />
                  <span className="text-[9px] sm:text-[10px] font-mono text-muted-foreground uppercase tracking-widest">
                    Connecting
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Terminal description */}
          <div className="px-3 sm:px-4 py-1.5 sm:py-2 bg-black/40 border-b border-neon-green/5">
            <div className="flex items-start gap-1.5 sm:gap-2">
              <Activity className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-neon-green/50 shrink-0 mt-0.5" />
              <p className="text-[10px] sm:text-[11px] font-mono text-muted-foreground leading-tight">
                <span className="text-neon-green/70">Elonmarket Terminal</span>
                {" — "}
                Monitoring Elon Musk's X activity live.
              </p>
            </div>
          </div>

          {/* Log output */}
          <div
            ref={scrollRef}
            className="h-[200px] sm:h-[240px] overflow-y-auto bg-black/80 px-2 sm:px-4 py-2 sm:py-3 font-mono text-[10px] sm:text-xs leading-relaxed custom-scrollbar"
          >
            {logs.length === 0 ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <Terminal className="w-6 h-6 sm:w-8 sm:h-8 text-neon-green/20 mx-auto mb-2" />
                  <p className="text-muted-foreground text-[10px] sm:text-[11px]">
                    Waiting for poller activity...
                  </p>
                  <p className="text-muted-foreground/50 text-[9px] sm:text-[10px] mt-1">
                    Logs will appear here in real time
                  </p>
                </div>
              </div>
            ) : (
              <AnimatePresence initial={false}>
                {logs.map((log) => (
                  <motion.div
                    key={log.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.2 }}
                    className="flex items-start gap-1 sm:gap-2 py-0.5 hover:bg-white/[0.02] rounded px-0.5 sm:px-1 -mx-0.5 sm:-mx-1"
                  >
                    <span className="text-muted-foreground/50 shrink-0 select-none text-[9px] sm:text-xs">
                      {formatTime(log.created_at)}
                    </span>
                    <span className="shrink-0 select-none w-3 sm:w-4 text-center text-[10px] sm:text-xs">
                      {levelIcons[log.level] || "•"}
                    </span>
                    <span className={`shrink-0 uppercase text-[8px] sm:text-[10px] w-10 sm:w-14 pt-px ${levelColors[log.level] || "text-foreground"}`}>
                      [{log.level}]
                    </span>
                    <span className="text-foreground/80 break-all min-w-0">
                      {log.message}
                    </span>
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
          <div className="px-3 sm:px-4 py-1 sm:py-1.5 bg-black/60 border-t border-neon-green/10 flex items-center justify-between">
            <span className="text-[9px] sm:text-[10px] font-mono text-muted-foreground/50">
              nitter-poller v1.0 • 10s
            </span>
            <span className="text-[9px] sm:text-[10px] font-mono text-muted-foreground/50">
              {logs.length} entries
            </span>
          </div>
        </Card>
      </div>
    </section>
  );
};
