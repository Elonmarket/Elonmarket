import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { User, Wallet, AlertCircle, Lock } from "lucide-react";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";

interface AuthModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const AuthModal = ({ open, onOpenChange }: AuthModalProps) => {
  const { login, register, resetPassword, error } = useAuth();
  const { connected, publicKey, signMessage } = useWallet();
  const [mode, setMode] = useState<"login" | "register" | "reset">("login");
  const [username, setUsername] = useState("");
  const [walletAddress, setWalletAddress] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [localSuccess, setLocalSuccess] = useState<string | null>(null);

  useEffect(() => {
    if ((mode === "reset" || mode === "register") && publicKey && !walletAddress) {
      setWalletAddress(publicKey.toBase58());
    }
  }, [mode, publicKey, walletAddress]);

  const resetState = () => {
    setUsername("");
    setWalletAddress("");
    setPassword("");
    setLocalError(null);
    setLocalSuccess(null);
  };

  const toBase64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    setLocalSuccess(null);

    if (!username.trim() || !password.trim() || ((mode === "register" || mode === "reset") && !walletAddress.trim())) {
      setLocalError(
        mode === "login"
          ? "Username and password are required"
          : "Username, wallet address, and password are required"
      );
      return;
    }
    if (username.trim().length < 3) {
      setLocalError("Username must be at least 3 characters");
      return;
    }
    if (password.trim().length < 8) {
      setLocalError("Password must be at least 8 characters");
      return;
    }
    if (mode === "register" || mode === "reset") {
      // Basic Solana address validation (base58, 32-44 chars)
      if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(walletAddress.trim())) {
        setLocalError("Invalid Solana wallet address");
        return;
      }
    }

    setSubmitting(true);
    let success = false;

    if (mode === "login") {
      success = await login(username.trim(), password);
    } else if (mode === "register") {
      success = await register(username.trim(), walletAddress.trim(), password);
    } else {
      if (!connected || !publicKey) {
        setLocalError("Connect the registered wallet to set or reset the password.");
        setSubmitting(false);
        return;
      }
      if (publicKey.toBase58() !== walletAddress.trim()) {
        setLocalError("The connected wallet must match the wallet address on the account.");
        setSubmitting(false);
        return;
      }
      if (!signMessage) {
        setLocalError("This wallet does not support message signing.");
        setSubmitting(false);
        return;
      }

      try {
        const challengeRes = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/auth-register`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
            },
            body: JSON.stringify({
              action: "request-password-challenge",
              username: username.trim(),
              walletAddress: walletAddress.trim(),
            }),
          }
        );
        const challengeData = await challengeRes.json();

        if (!challengeRes.ok || !challengeData.challengeToken || !challengeData.message) {
          setLocalError(challengeData.error ?? "Could not start password reset.");
          setSubmitting(false);
          return;
        }

        const signed = await signMessage(new TextEncoder().encode(challengeData.message as string));
        success = await resetPassword(
          username.trim(),
          walletAddress.trim(),
          password,
          challengeData.challengeToken as string,
          toBase64(signed),
        );
      } catch (err) {
        setLocalError(err instanceof Error ? err.message : "Password reset failed.");
        setSubmitting(false);
        return;
      }
    }
    setSubmitting(false);

    if (success) {
      onOpenChange(false);
      resetState();
    }
  };

  const displayError = localError || error;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-card border-border">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">
            {mode === "login" ? "Login" : mode === "register" ? "Register" : "Set or Reset Password"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="username" className="flex items-center gap-2">
              <User className="w-3.5 h-3.5" />
              Username
            </Label>
            <Input
              id="username"
              placeholder="Enter your username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="bg-muted/50"
            />
          </div>

          {(mode === "register" || mode === "reset") && (
            <div className="space-y-2">
              <Label htmlFor="wallet" className="flex items-center gap-2">
                <Wallet className="w-3.5 h-3.5" />
                Wallet Address
              </Label>
              <Input
                id="wallet"
                placeholder="Your Solana wallet address"
                value={walletAddress}
                onChange={(e) => setWalletAddress(e.target.value)}
                className="bg-muted/50 font-mono text-xs"
              />
              {mode === "reset" && (
                <div className="pt-2">
                  <WalletMultiButton className="!h-10 !w-full !rounded-md !text-sm" />
                </div>
              )}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="password" className="flex items-center gap-2">
              <Lock className="w-3.5 h-3.5" />
              Password
            </Label>
            <Input
              id="password"
              type="password"
              placeholder={mode === "login" ? "Enter your password" : "Create a password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="bg-muted/50"
            />
          </div>

          {displayError && (
            <div className="flex items-center gap-2 p-2.5 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-sm">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {displayError}
            </div>
          )}

          {localSuccess && (
            <div className="p-2.5 rounded-lg border text-sm">
              {localSuccess}
            </div>
          )}

          <Button type="submit" variant="neon" className="w-full" disabled={submitting}>
            {submitting
              ? "Please wait..."
              : mode === "login"
                ? "Login"
                : mode === "register"
                  ? "Create Account"
                  : "Sign Wallet and Set Password"}
          </Button>

          {/* Apply mt-6 for 24px vertical gap */}
          <div className="mt-6 text-center space-y-3"> {/* Container for links and info text */}
            <p className="text-sm text-muted-foreground"> {/* Changed text-xs to text-sm, kept text-center */}
              {mode === "login" ? (
                <>
                  Don't have an account?{" "}
                  <button
                    type="button"
                    className="text-neon-cyan hover:underline font-medium" // Added font-medium
                    onClick={() => {
                      setMode("register");
                      resetState();
                    }}
                  >
                    Register
                  </button>
                  {" · "}
                  <button
                    type="button"
                    className="text-neon-cyan hover:underline font-normal opacity-85" // Added font-normal opacity-85
                    onClick={() => {
                      setMode("reset");
                      resetState();
                      if (publicKey) setWalletAddress(publicKey.toBase58());
                    }}
                  >
                    Forgot password / old account
                  </button>
                </>
              ) : mode === "register" ? (
                <>
                  Already registered?{" "}
                  <button
                    type="button"
                    className="text-neon-cyan hover:underline font-medium" // Added font-medium
                    onClick={() => {
                      setMode("login");
                      resetState();
                    }}
                  >
                    Login
                  </button>
                </>
              ) : (
                <>
                  Back to{" "}
                  <button
                    type="button"
                    className="text-neon-cyan hover:underline font-medium" // Added font-medium
                    onClick={() => {
                      setMode("login");
                      resetState();
                    }}
                  >
                    Login
                  </button>
                </>
              )}
            </p>

            <p className="text-sm text-muted-foreground text-center"> {/* Changed text-xs to text-sm, kept text-center */}
              {mode === "register"
                ? "Your wallet stays linked to your account, and your password protects access."
                : mode === "reset"
                  ? "For legacy accounts or forgotten passwords, connect the registered wallet and sign the reset challenge."
                  : "Login uses your username and password. Wallet access is not required here."}
            </p>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
