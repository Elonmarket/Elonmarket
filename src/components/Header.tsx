import { Target, User as UserIcon, Menu, X, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import { usePlatformData } from "@/hooks/usePlatformData";
import { supabase } from "@/integrations/supabase/client";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { AuthModal } from "@/components/AuthModal";
import headerLogo from "@/assets/elonmarket-header-logo.png";

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
          <Link to="/" className="flex items-center group" aria-label="Elonmarket home">
            <img
              src={headerLogo}
              alt="Elonmarket"
              className="block h-12 md:h-14 w-auto object-contain opacity-95 brightness-110 contrast-125 transition-transform duration-200 group-hover:scale-[1.02]"
              style={{ mixBlendMode: "screen" }}
            />
          </Link>

          {/* Stats - Desktop */}
          <div className="hidden lg:flex items-center gap-6">
            <div className="text-center">
              <p className="text-xs text-muted-foreground">Total SOL Paid</p>
              <p className="font-display font-semibold text-neon-green text-sm">
                {(payoutStats?.total_paid_usd || 0).toLocaleString()}
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
            <a href="/docs" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Docs
            </a>
            <a href="#predict" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Markets
            </a>
            <a href="#leaderboard" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Leaderboard
            </a>
            <a href="https://x.com/elonmarkets" target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground transition-colors">
              <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
            </a>
            <a href="https://github.com/muskmarket/Elonmarket" target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground transition-colors">
              <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current"><path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/></svg>
            </a>

            {isAdmin && (
              <Link
                to={`/${import.meta.env.VITE_ADMIN_ROUTE || "admin"}`}
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
                href="/docs" 
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                onClick={() => setMobileMenuOpen(false)}
              >
                Docs
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
              <div className="flex items-center gap-4">
                <a href="https://x.com/elonmarkets" target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground transition-colors" onClick={() => setMobileMenuOpen(false)}>
                  <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                </a>
                <a href="https://github.com/muskmarket/Elonmarket" target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground transition-colors" onClick={() => setMobileMenuOpen(false)}>
                  <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current"><path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/></svg>
                </a>
              </div>
              {isAdmin && (
                <Link
                  to={`/${import.meta.env.VITE_ADMIN_ROUTE || "admin"}`}
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
