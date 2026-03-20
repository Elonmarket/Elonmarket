import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from "react";
interface UserProfile {
  id: string;
  display_name: string | null;
  wallet_address: string;
  total_wins?: number;
  total_predictions?: number;
  total_claimed_usd?: number;
}

interface AuthContextType {
  user: UserProfile | null;
  loading: boolean;
  error: string | null;
  register: (username: string, walletAddress: string) => Promise<boolean>;
  login: (username: string, walletAddress: string) => Promise<boolean>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const STORAGE_KEY = "elonmarket_user";

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        setUser(JSON.parse(stored));
      } catch {
        localStorage.removeItem(STORAGE_KEY);
      }
    }
    setLoading(false);
  }, []);

  const saveUser = (profile: UserProfile) => {
    setUser(profile);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
  };

  const register = useCallback(
    async (username: string, walletAddress: string) => {
      setError(null);
      try {
        const res = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/auth-register`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
            },
            body: JSON.stringify({
              action: "register",
              username,
              walletAddress,
            }),
          }
        );
        const data = await res.json();

        if (!res.ok) {
          setError(data.error ?? "Registration failed.");
          return false;
        }

        if (data.user) {
          saveUser(data.user as UserProfile);
          return true;
        }

        setError("Registration failed.");
        return false;
      } catch (e) {
        setError(e instanceof Error ? e.message : "Registration failed.");
        return false;
      }
    },
    []
  );

  const login = useCallback(
    async (username: string, walletAddress: string) => {
      setError(null);
      try {
        const res = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/auth-register`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
            },
            body: JSON.stringify({
              action: "login",
              username,
              walletAddress,
            }),
          }
        );
        const data = await res.json();

        if (!res.ok) {
          setError(data.error ?? "Login failed.");
          return false;
        }

        if (data.user) {
          saveUser(data.user as UserProfile);
          return true;
        }

        setError("Login failed.");
        return false;
      } catch (e) {
        setError(e instanceof Error ? e.message : "Login failed.");
        return false;
      }
    },
    []
  );

  const logout = useCallback(() => {
    setUser(null);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        error,
        register,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
};

