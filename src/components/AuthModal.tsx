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
  const { login, register, error } = useAuth();
  const { connected, publicKey, signMessage } = useWallet();
  const [mode, setMode] = useState<"login" | "register">("login"); // Removed "reset"
  const [username, setUsername] = useState("");
  const [walletAddress, setWalletAddress] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [localSuccess, setLocalSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (mode === "register" && publicKey && !walletAddress) {
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

  // Removed toBase64 as it was only used in resetPassword logic.

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    setLocalSuccess(null);

    if (!username.trim() || !password.trim() || (mode === "register" && !walletAddress.trim())) {
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
    if (mode === "register") { // Simplified validation for register mode only
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
    } else { // mode === "register"
      // Wallet address is still required for registration
      success = await register(username.trim(), walletAddress.trim(), password);
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
            {mode === "login" ? "Login" : "Register"}
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

          {(mode === "register") && (
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
                : "Create Account"}
          </Button>

          {/* Apply mt-6 for 24px vertical gap */}
          <div className="mt-6 text-center space-y-3"> {/* Container for links and info text */}
            <p className="text-sm text-muted-foreground"> {/* Changed text-xs to text-sm, kept text-center */}
              {mode === "login" ? (
                <>
                  Don't have an account?{" "}
                  <button
                    type="button"
                    className="text-neon-cyan hover:underline font-medium"
                    onClick={() => {
                      setMode("register");
                      resetState();
                    }}
                  >
                    Register
                  </button>
                </>
              ) : (
                <>
                  Already registered?{" "}
                  <button
                    type="button"
                    className="text-neon-cyan hover:underline font-medium"
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

            <p className="text-sm text-muted-foreground text-center">
              {mode === "register"
                ? "Your wallet stays linked to your account, and your password protects access."
                : "Login uses your username and password. Wallet access is not required here."}
            </p>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
