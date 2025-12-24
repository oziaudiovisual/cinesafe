import React, { createContext, useContext, useEffect, useState } from 'react';
import { User } from '../types';
import { AuthService } from '../services/auth';
import { userService } from '../services/userService';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (e: string, p: string) => Promise<string | undefined>;
  register: (e: string, p: string, n: string, l: string, r?: string) => Promise<string | undefined>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>(null!);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check for active session on startup
    const initAuth = async () => {
      // StorageService.init() removed as it is no longer needed
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
        // This will now trigger the dynamic score calculation in getUserProfile
        const updatedUser = await userService.getUserProfile(user.id);
        if (updatedUser) setUser(updatedUser);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);