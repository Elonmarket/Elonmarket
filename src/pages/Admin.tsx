import { useState } from "react";
import { Shield, ArrowLeft, Calendar, Wallet, Lock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Link } from "react-router-dom";
import { RoundManager } from "@/components/admin/RoundManager";
import { WalletSettings } from "@/components/admin/WalletSettings";
import { VaultManager } from "@/components/admin/VaultManager";


const Admin = () => {
  const [adminSecretKey, setAdminSecretKey] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authError, setAuthError] = useState("");

  const handleAdminLogin = async () => {
    if (!adminSecretKey.trim()) {
      setAuthError("Please enter the admin secret key");
      return;
    }
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
            action: "verify_admin",
            adminWallet: "private_admin",
            adminSecretKey: adminSecretKey.trim(),
          }),
        }
      );
      if (response.ok) {
        setIsAuthenticated(true);
        setAuthError("");
      } else {
        setAuthError("Invalid admin secret key");
        setAdminSecretKey("");
      }
    } catch {
      setAuthError("Failed to verify credentials");
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card variant="glass" className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="w-5 h-5" />
              Admin Authentication
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Admin Secret Key</Label>
              <Input
                type="password"
                value={adminSecretKey}
                onChange={(e) => setAdminSecretKey(e.target.value)}
                placeholder="Enter admin secret key"
                onKeyDown={(e) => e.key === "Enter" && handleAdminLogin()}
              />
            </div>
            {authError && (
              <p className="text-sm text-destructive">{authError}</p>
            )}
            <Button variant="neon" onClick={handleAdminLogin} className="w-full">
              <Shield className="w-4 h-4" />
              Authenticate
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <Shield className="w-8 h-8 text-primary" />
            <h1 className="font-display text-2xl font-bold">Admin Panel</h1>
          </div>
          <Link to="/">
            <Button variant="outline" size="sm">
              <ArrowLeft className="w-4 h-4" />
              Back
            </Button>
          </Link>
        </div>

        <Tabs defaultValue="rounds" className="space-y-6">
          <TabsList className="bg-muted/50 flex-wrap h-auto p-1 gap-1">
            <TabsTrigger value="rounds" className="flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Rounds
            </TabsTrigger>
            <TabsTrigger value="wallets" className="flex items-center gap-2">
              <Wallet className="w-4 h-4" />
              Wallets
            </TabsTrigger>
            <TabsTrigger value="vault" className="flex items-center gap-2">
              <Shield className="w-4 h-4" />
              Vault
            </TabsTrigger>
          </TabsList>

          <TabsContent value="rounds">
            <RoundManager adminSecretKey={adminSecretKey} />
          </TabsContent>

          <TabsContent value="wallets">
            <WalletSettings adminSecretKey={adminSecretKey} />
          </TabsContent>

          <TabsContent value="vault">
            <VaultManager adminSecretKey={adminSecretKey} />
          </TabsContent>

        </Tabs>
      </div>
    </div>
  );
};

export default Admin;
