import { useState, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";

export function useVoting() {
  const { toast } = useToast();
  const { user, sessionToken } = useAuth();
  const [loading, setLoading] = useState(false);

  const submitVote = useCallback(
    async (roundId: string, optionId: string, tokenBalance: number) => {
      if (!user || !sessionToken) {
        toast({
          title: "Not logged in",
          description: "Please log in with your username and password to vote",
          variant: "destructive",
        });
        return false;
      }

      try {
        setLoading(true);

        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/submit-vote`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
              "x-elonmarket-session": sessionToken ?? "",
            },
            body: JSON.stringify({
              walletAddress: user.wallet_address,
              roundId,
              optionId,
              tokenBalance,
            }),
          }
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Failed to submit vote");
        }

        toast({
          title: "Vote submitted! 🎯",
          description: "Your prediction has been recorded",
        });

        return true;
      } catch (err) {
        toast({
          title: "Vote failed",
          description: err instanceof Error ? err.message : "Unknown error",
          variant: "destructive",
        });
        return false;
      } finally {
        setLoading(false);
      }
    },
    [sessionToken, user, toast]
  );

  return { submitVote, loading };
}
