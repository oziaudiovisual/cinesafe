
import { supabase } from './supabase';
import { userService } from './userService';
import { raffleService } from './raffleService';
import { User } from '../types';

export const AuthService = {
  
  // --- SESSION MANAGEMENT ---
  
  getSession: async (): Promise<User | null> => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const profile = await userService.getUserProfile(session.user.id);
        return profile;
      }
      return null;
    } catch (e) {
      console.error('getSession error:', e);
      return null;
    }
  },

  // --- LOGIN ---

  login: async (email: string, password: string): Promise<{ user: User | null; error?: string }> => {
    try {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) return { user: null, error: error.message };
        if (!data.user) return { user: null, error: 'Erro no login.' };
        
        const profile = await userService.getUserProfile(data.user.id);
        if (!profile) return { user: null, error: 'Perfil não encontrado.' };
        return { user: profile };
    } catch (e: any) {
        return { user: null, error: e.message || 'Erro no login.' };
    }
  },

  // --- REGISTER ---

  register: async (email: string, password: string, name: string, location: string, referralCode?: string): Promise<{ user: User | null; error?: string }> => {
    try {
        // 1. Create Auth User
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) return { user: null, error: error.message };
        if (!data.user) return { user: null, error: 'Erro ao registrar.' };
        
        const uid = data.user.id;

        // Generate Unique Referral Code
        const firstName = name.split(' ')[0].toLowerCase().replace(/[^a-z0-9]/g, '');
        const randomSuffix = Math.random().toString(36).substring(2, 6);
        const myReferralCode = `${firstName}-${randomSuffix}`;

        // 2. Create Public Profile in users table
        const newUser: User = {
            id: uid,
            email: email,
            name: name,
            location: location,
            avatarUrl: `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random`,
            reputationPoints: 0,
            isVerified: false,
            role: 'user',
            referralCode: myReferralCode,
            ...(referralCode ? { referredBy: referralCode } : {}),
            referralCount: 0,
            usageStats: { serialChecks: {count: 0, month: ''}, contactReveals: {count: 0, month: ''} }
        };

        await userService.saveUser(newUser);

        // Process Referral
        if (referralCode) {
            await userService.processReferral(referralCode, newUser);
        }

        // Sorteios: conceder ticket de cadastro para todos os sorteios ativos
        try {
            const activeRaffles = await raffleService.getActiveRaffles();
            for (const raffle of activeRaffles) {
                await raffleService.grantSignupTicket(raffle.id, newUser);
            }
        } catch (e) {
            console.error('Erro ao conceder tickets de sorteio no cadastro:', e);
        }

        return { user: newUser };
    } catch (e: any) {
        return { user: null, error: e.message || 'Erro ao registrar.' };
    }
  },

  // --- LOGOUT ---

  logout: async () => {
    await supabase.auth.signOut();
  }
};
