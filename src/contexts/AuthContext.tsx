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
  sessionToken: string | null;
  loading: boolean;
  error: string | null;
  register: (username: string, walletAddress: string, password: string) => Promise<boolean>;
  login: (username: string, password: string) => Promise<boolean>;
  resetPassword: (
    username: string,
    walletAddress: string,
    password: string,
    challengeToken: string,
    signature: string
  ) => Promise<boolean>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const STORAGE_KEY = "elonmarket_user";
const SESSION_STORAGE_KEY = "elonmarket_session";

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    const storedSession = localStorage.getItem(SESSION_STORAGE_KEY);

    if (!stored || !storedSession) {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(SESSION_STORAGE_KEY);
      setLoading(false);
      return;
    }

    if (stored) {
      try {
        setUser(JSON.parse(stored));
      } catch {
        localStorage.removeItem(STORAGE_KEY);
        localStorage.removeItem(SESSION_STORAGE_KEY);
      }
    }
    if (storedSession) {
      setSessionToken(storedSession);
    }
    setLoading(false);
  }, []);

  const saveUser = (profile: UserProfile, token: string) => {
    setUser(profile);
    setSessionToken(token);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
    localStorage.setItem(SESSION_STORAGE_KEY, token);
  };

  const register = useCallback(
    async (username: string, walletAddress: string, password: string) => {
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
              password,
            }),
          }
        );
        const data = await res.json();

        if (!res.ok) {
          setError(data.error ?? "Registration failed.");
          return false;
        }

        if (data.user && data.sessionToken) {
          saveUser(data.user as UserProfile, data.sessionToken as string);
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
    async (username: string, password: string) => {
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
              password,
            }),
          }
        );
        const data = await res.json();

        if (!res.ok) {
          setError(data.error ?? "Login failed.");
          return false;
        }

        if (data.user && data.sessionToken) {
          saveUser(data.user as UserProfile, data.sessionToken as string);
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

  const resetPassword = useCallback(
    async (
      username: string,
      walletAddress: string,
      password: string,
      challengeToken: string,
      signature: string
    ) => {
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
              action: "reset-password",
              username,
              walletAddress,
              password,
              challengeToken,
              signature,
            }),
          }
        );
        const data = await res.json();

        if (!res.ok) {
          setError(data.error ?? "Password reset failed.");
          return false;
        }

        if (data.user && data.sessionToken) {
          saveUser(data.user as UserProfile, data.sessionToken as string);
          return true;
        }

        setError("Password reset failed.");
        return false;
      } catch (e) {
        setError(e instanceof Error ? e.message : "Password reset failed.");
        return false;
      }
    },
    []
  );

  const logout = useCallback(() => {
    setUser(null);
    setSessionToken(null);
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(SESSION_STORAGE_KEY);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        sessionToken,
        loading,
        error,
        register,
        login,
        resetPassword,
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
