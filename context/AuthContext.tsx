import React, { createContext, useContext, useEffect, useState } from 'react';
import { User } from '../types';
import { AuthService } from '../services/auth';
import { userService } from '../services/userService';
import { supabase } from '../services/supabase';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (e: string, p: string) => Promise<string | undefined>;
  register: (e: string, p: string, n: string, l: string, r?: string) => Promise<string | undefined>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  loginWithGoogle: () => void;
}

const AuthContext = createContext<AuthContextType>(null!);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check for active session on startup
    const initAuth = async () => {
      const sessionUser = await AuthService.getSession();
      if (sessionUser && sessionUser.isBlocked) {
          await AuthService.logout();
          setUser(null);
      } else {
          setUser(sessionUser);
      }
      setLoading(false);
    };
    initAuth();

    // Escuta mudanças de sessão em tempo real (Supabase Auth)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_OUT') {
        setUser(null);
      } else if (session?.user && event === 'SIGNED_IN') {
        const profile = await userService.getUserProfile(session.user.id);
        if (profile && profile.isBlocked) {
          await AuthService.logout();
          setUser(null);
        } else {
          setUser(profile);
        }
      }
    });

    return () => { subscription.unsubscribe(); };
  }, []);

  const login = async (email: string, pass: string) => {
    setLoading(true);
    const { user, error } = await AuthService.login(email, pass);
    if (user) {
        if (user.isBlocked) {
            await AuthService.logout();
            setUser(null);
            setLoading(false);
            return 'Esta conta foi bloqueada por um administrador.';
        }
        setUser(user);
    }
    setLoading(false);
    return error;
  };

  const register = async (email: string, pass: string, name: string, location: string, referralCode?: string) => {
    setLoading(true);
    const { user, error } = await AuthService.register(email, pass, name, location, referralCode);
    if (user) setUser(user);
    setLoading(false);
    return error;
  };

  const logout = async () => {
    await AuthService.logout();
    setUser(null);
  };

  const refreshUser = async () => {
    if (user) {
        const updatedUser = await userService.getUserProfile(user.id);
        if (updatedUser) setUser(updatedUser);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, refreshUser, loginWithGoogle: AuthService.loginWithGoogle }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);