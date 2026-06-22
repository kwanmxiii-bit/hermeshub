/**
 * Minimal auth context placeholder.
 *
 * The full GitHub-OAuth / Ed25519 session provider ships with the frontend
 * rebuild (later phase). This stub exists so the kept `Layout` component compiles
 * during the schema/lib phase; it exposes the shape Layout consumes and a no-op
 * provider. Do not build new features on top of this — it will be replaced.
 */
import { createContext, useContext, type ReactNode } from "react";

export interface AuthUser {
  id: string;
  name: string;
  avatar_url?: string;
  github_username?: string;
}

interface AuthContextValue {
  creator: AuthUser | null;
  login: () => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue>({
  creator: null,
  login: () => {},
  logout: () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const value: AuthContextValue = { creator: null, login: () => {}, logout: () => {} };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  return useContext(AuthContext);
}
