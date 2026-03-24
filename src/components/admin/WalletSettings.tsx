import { useState, useEffect } from "react";
import { Wallet, Save, Coins } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export const WalletSettings = ({ adminSecretKey }: { adminSecretKey: string }) => {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState({
    tokenContract: "",
    minTokenBalance: 1,
  });

  useEffect(() => {
    const loadConfig = async () => {
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
              action: "get_wallet_config",
              adminWallet: "private_admin",
              adminSecretKey,
            }),
          }
        );
        if (response.ok) {
          const data = await response.json();
          setConfig({
            tokenContract: data.token_contract_address || "",
            minTokenBalance: data.min_token_balance || 1,
          });
        }
      } catch (e) {
        console.error("Error loading wallet config:", e);
      }
    };
    loadConfig();
  }, [adminSecretKey]);

  const handleSave = async () => {
    setSaving(true);
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
            action: "update_wallet_config",
            adminWallet: "private_admin",
            adminSecretKey,
            data: config,
          }),
        }
      );
      if (!response.ok) throw new Error("Failed to save");
      toast({ title: "Saved!", description: "Wallet settings updated." });
    } catch {
      toast({ title: "Error", description: "Failed to save settings", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card variant="glass">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Wallet className="w-5 h-5" />
          Token & Eligibility Settings
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label className="flex items-center gap-1.5">
            <Coins className="w-3.5 h-3.5" />
            Token Contract Address
          </Label>
          <Input
            value={config.tokenContract}
            onChange={(e) => setConfig({ ...config, tokenContract: e.target.value })}
            placeholder="SPL Token address"
          />
          <p className="text-xs text-muted-foreground mt-1">Token required for voting eligibility</p>
        </div>
        <div className="max-w-xs">
          <Label>Minimum Token Balance</Label>
          <Input
            type="number"
            min={1}
            value={config.minTokenBalance}
            onChange={(e) => setConfig({ ...config, minTokenBalance: Number(e.target.value) })}
          />
          <p className="text-xs text-muted-foreground mt-1">Users must hold at least this many tokens to vote</p>
        </div>

        <div className="p-4 rounded-lg bg-muted/50 border border-border">
          <p className="text-sm text-muted-foreground">
            <strong>How it works:</strong> When users try to vote, the system checks their on-chain token balance via Solana RPC. Only holders with the minimum balance can participate.
          </p>
        </div>

        <Button variant="neon" onClick={handleSave} disabled={saving}>
          <Save className="w-4 h-4" />
          {saving ? "Saving..." : "Save Wallet Settings"}
        </Button>
      </CardContent>
    </Card>
  );
};
