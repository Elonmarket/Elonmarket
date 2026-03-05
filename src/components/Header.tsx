import { Target, User as UserIcon, Menu, X, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import { usePlatformData } from "@/hooks/usePlatformData";
import { supabase } from "@/integrations/supabase/client";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { AuthModal } from "@/components/AuthModal";

export const Header = () => {
  const { payoutStats } = usePlatformData();
  const { user, logout } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const checkAdmin = async () => {
      if (user?.wallet_address) {
        const { data } = await supabase.rpc("is_admin_wallet", {
          _wallet: user.wallet_address,
        });
        setIsAdmin(!!data);
      } else {
        setIsAdmin(false);
      }
    };
    checkAdmin();
  }, [user?.wallet_address]);

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16 md:h-20">
          {/* Logo */}
          <Link to="/" className="flex items-center group">
            <div className="h-12 md:h-16 overflow-hidden flex items-center justify-center transition-transform duration-200 group-hover:scale-[1.02]">
              <img src="/musk-logo.png" alt="Musk Market" className="h-full w-auto object-contain" />
            </div>
          </Link>

          {/* Stats - Desktop */}
          <div className="hidden lg:flex items-center gap-6">
            <div className="text-center">
              <p className="text-xs text-muted-foreground">Total Paid</p>
              <p className="font-display font-semibold text-neon-green text-sm">
                ${(payoutStats?.total_paid_usd || 0).toLocaleString()}
              </p>
            </div>
            <div className="text-center">
              <p className="text-xs text-muted-foreground">Predictions</p>
              <p className="font-display font-semibold text-foreground text-sm">
                {(payoutStats?.total_predictions_made || 0).toLocaleString()}
              </p>
            </div>
          </div>

          {/* Navigation - Desktop */}
          <nav className="hidden md:flex items-center gap-6">
            <a href="#feed" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Feed
            </a>
            <a href="#predict" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Markets
            </a>
            <a href="#leaderboard" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Leaderboard
            </a>
            {isAdmin && (
              <Link
                to="/admin65131200"
                className="text-sm text-neon-purple hover:text-foreground transition-colors flex items-center gap-1"
              >
                <Shield className="w-3 h-3" />
                Admin
              </Link>
            )}
          </nav>

          {/* Actions */}
          <div className="flex items-center gap-3">
            {user ? (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  className="hidden sm:flex gap-2"
                  onClick={() => navigate("/profile")}
                >
                  <UserIcon className="w-4 h-4" />
                  <span className="max-w-[120px] truncate">{user.display_name || "User"}</span>
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="hidden sm:inline-flex"
                  onClick={logout}
                >
                  <span className="text-xs">✕</span>
                </Button>
              </>
            ) : (
              <Button
                variant="neon"
                size="sm"
                onClick={() => setAuthModalOpen(true)}
                className="hidden sm:flex"
              >
                <UserIcon className="w-4 h-4" />
                Login
              </Button>
            )}

            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </Button>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden py-4 border-t border-border">
            <nav className="flex flex-col gap-4">
              <a
                href="#feed"
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                onClick={() => setMobileMenuOpen(false)}
              >
                Feed
              </a>
              <a
                href="#predict"
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                onClick={() => setMobileMenuOpen(false)}
              >
                Markets
              </a>
              <a
                href="#leaderboard"
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                onClick={() => setMobileMenuOpen(false)}
              >
                Leaderboard
              </a>
              {isAdmin && (
                <Link
                  to="/admin65131200"
                  className="text-sm text-neon-purple hover:text-foreground transition-colors flex items-center gap-1"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <Shield className="w-3 h-3" />
                  Admin
                </Link>
              )}
              {user && (
                <Link
                  to="/profile"
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <UserIcon className="w-3 h-3" />
                  Profile
                </Link>
              )}
              {user ? (
                <Button variant="outline" size="sm" onClick={logout}>
                  <UserIcon className="w-4 h-4" />
                  Logout
                </Button>
              ) : (
                <Button variant="neon" size="sm" onClick={() => { setAuthModalOpen(true); setMobileMenuOpen(false); }}>
                  <UserIcon className="w-4 h-4" />
                  Login
                </Button>
              )}
            </nav>
          </div>
        )}
      </div>
      <AuthModal open={authModalOpen} onOpenChange={setAuthModalOpen} />
    </header>
  );
};