import { useState, useEffect } from "react";
import { Shield, RefreshCw, AlertTriangle, ArrowRightLeft, Wallet, Save, Percent } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export const VaultManager = ({ adminSecretKey }: { adminSecretKey: string }) => {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [draining, setDraining] = useState(false);
  const [transferring, setTransferring] = useState(false);
  const [newOwner, setNewOwner] = useState("");

  const [config, setConfig] = useState({
    vaultWallet: "",
    payoutWallet: "",
    payoutPercentage: 15,
  });

  const [balances, setBalances] = useState({
    vaultBalance: 0,
    payoutBalance: 0,
    claimableRewards: 0,
  });

  useEffect(() => {
    const loadData = async () => {
      const [{ data: walletConfig }, { data: walletBalances }] = await Promise.all([
        supabase.from("wallet_config").select("*").maybeSingle(),
        supabase.from("wallet_balances").select("*").maybeSingle(),
      ]);

      if (walletConfig) {
        setConfig({
          vaultWallet: walletConfig.vault_wallet_address || "",
          payoutWallet: walletConfig.payout_wallet_address || "",
          payoutPercentage: walletConfig.payout_percentage || 15,
        });
      }

      if (walletBalances) {
        setBalances({
          vaultBalance: (walletBalances as any).vault_balance_sol || 0,
          payoutBalance: (walletBalances as any).payout_balance_sol || 0,
          claimableRewards: (walletBalances as any).claimable_rewards_sol || 0,
        });
      }
    };
    loadData();
  }, []);

  const callAdmin = async (action: string, data?: any) => {
    const response = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          action,
          adminWallet: "private_admin",
          adminSecretKey,
          data,
        }),
      }
    );
    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || "Request failed");
    }
    return response.json();
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await callAdmin("update_wallet_config", config);
      toast({ title: "Saved!", description: "Vault configuration updated." });
    } catch {
      toast({ title: "Error", description: "Failed to save", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleRefreshBalance = async () => {
    setRefreshing(true);
    try {
      const result = await callAdmin("vault_refresh_balance");
      setBalances((prev) => ({ ...prev, vaultBalance: result.balance || 0 }));
      toast({ title: "Refreshed!", description: `Vault balance: ${result.balance?.toFixed(4) || 0} SOL` });
    } catch {
      toast({ title: "Error", description: "Failed to refresh balance", variant: "destructive" });
    } finally {
      setRefreshing(false);
    }
  };

  const handleDrain = async () => {
    if (!confirm("⚠️ Are you sure you want to drain the vault? This action cannot be undone.")) return;
    setDraining(true);
    try {
      await callAdmin("vault_drain");
      toast({ title: "Vault Drained", description: "All funds have been withdrawn from the vault." });
      handleRefreshBalance();
    } catch (error) {
      toast({ title: "Error", description: error instanceof Error ? error.message : "Drain failed", variant: "destructive" });
    } finally {
      setDraining(false);
    }
  };

  const handleTransferOwnership = async () => {
    if (!newOwner.trim()) {
      toast({ title: "Error", description: "Please enter new owner wallet address", variant: "destructive" });
      return;
    }
    if (!confirm(`Transfer vault ownership to ${newOwner}? This cannot be undone.`)) return;
    setTransferring(true);
    try {
      await callAdmin("vault_transfer_ownership", { newOwner: newOwner.trim() });
      toast({ title: "Ownership Transferred", description: `Vault ownership transferred to ${newOwner.slice(0, 8)}...` });
      setNewOwner("");
    } catch (error) {
      toast({ title: "Error", description: error instanceof Error ? error.message : "Transfer failed", variant: "destructive" });
    } finally {
      setTransferring(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Balances */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card variant="glass">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-full bg-primary/20">
                <Shield className="w-6 h-6 text-primary" />
              </div>
              <div>
                <div className="text-2xl font-bold">{balances.vaultBalance.toFixed(4)} SOL</div>
                <div className="text-sm text-muted-foreground">Vault Balance</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card variant="glass">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-full bg-neon-green/20">
                <Wallet className="w-6 h-6 text-neon-green" />
              </div>
              <div>
                <div className="text-2xl font-bold">{balances.payoutBalance.toFixed(4)} SOL</div>
                <div className="text-sm text-muted-foreground">Payout Balance</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card variant="glass">
          <CardContent className="p-6 flex items-center justify-center">
            <Button variant="outline" onClick={handleRefreshBalance} disabled={refreshing}>
              <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
              {refreshing ? "Refreshing..." : "Refresh Balances"}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Vault Configuration */}
      <Card variant="glass">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5" />
            Vault Configuration
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Vault Wallet Address</Label>
            <Input
              value={config.vaultWallet}
              onChange={(e) => setConfig({ ...config, vaultWallet: e.target.value })}
              placeholder="Solana wallet address (cold storage)"
            />
            <p className="text-xs text-muted-foreground mt-1">Cold storage that receives Pump.fun rewards</p>
          </div>
          <div>
            <Label>Payout Wallet Address</Label>
            <Input
              value={config.payoutWallet}
              onChange={(e) => setConfig({ ...config, payoutWallet: e.target.value })}
              placeholder="Solana wallet address (hot wallet)"
            />
            <p className="text-xs text-muted-foreground mt-1">Hot wallet used for automated winner payouts</p>
          </div>
          <div className="max-w-xs">
            <Label className="flex items-center gap-1.5">
              <Percent className="w-3.5 h-3.5" />
              Payout Percentage
            </Label>
            <Input
              type="number"
              min={1}
              max={100}
              value={config.payoutPercentage}
              onChange={(e) => setConfig({ ...config, payoutPercentage: Number(e.target.value) })}
            />
            <p className="text-xs text-muted-foreground mt-1">% of vault balance distributed per round to winners</p>
          </div>
          <Button variant="neon" onClick={handleSave} disabled={saving}>
            <Save className="w-4 h-4" />
            {saving ? "Saving..." : "Save Vault Config"}
          </Button>
        </CardContent>
      </Card>

      {/* Danger Zone */}
      <Card variant="glass" className="border-destructive/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="w-5 h-5" />
            Danger Zone
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 rounded-lg bg-destructive/10 border border-destructive/30">
            <div>
              <p className="font-medium">Drain Vault</p>
              <p className="text-xs text-muted-foreground">Withdraw all funds from the vault. This is irreversible.</p>
            </div>
            <Button variant="destructive" onClick={handleDrain} disabled={draining}>
              {draining ? "Draining..." : "Drain Vault"}
            </Button>
          </div>

          <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/30 space-y-3">
            <div>
              <p className="font-medium">Transfer Ownership</p>
              <p className="text-xs text-muted-foreground">Transfer vault ownership to a new wallet address.</p>
            </div>
            <div className="flex gap-2">
              <Input
                value={newOwner}
                onChange={(e) => setNewOwner(e.target.value)}
                placeholder="New owner wallet address"
              />
              <Button variant="destructive" onClick={handleTransferOwnership} disabled={transferring}>
                <ArrowRightLeft className="w-4 h-4" />
                {transferring ? "..." : "Transfer"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
