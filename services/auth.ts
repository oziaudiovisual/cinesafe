
import { supabase } from './supabase';
import { userService } from './userService';
import { User } from '../types';

const REFERRAL_STORAGE_KEY = 'cinesafe_ref';
const REFERRAL_TTL_MS = 24 * 60 * 60 * 1000; // 24h

// Persiste o código de indicação antes do redirect OAuth (chamado no Register).
export const storeReferral = (code: string) => {
  try {
    localStorage.setItem(REFERRAL_STORAGE_KEY, JSON.stringify({ code, ts: Date.now() }));
  } catch (e) { /* localStorage indisponível — ignora */ }
};

// Lê e remove o código de indicação (uso único, com TTL de 24h).
const consumeStoredReferral = (): string | undefined => {
  try {
    const raw = localStorage.getItem(REFERRAL_STORAGE_KEY);
    if (!raw) return undefined;
    localStorage.removeItem(REFERRAL_STORAGE_KEY);
    const { code, ts } = JSON.parse(raw);
    if (!code || typeof ts !== 'number' || Date.now() - ts > REFERRAL_TTL_MS) return undefined;
    return code;
  } catch (e) {
    return undefined;
  }
};

export const AuthService = {
  
  // --- SESSION MANAGEMENT ---
  
  getSession: async (): Promise<User | null> => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        let profile = await userService.getUserProfile(session.user.id);
        
        // Auto-create profile for first-time OAuth logins
        if (!profile) {
          const name = session.user.user_metadata?.full_name || session.user.email?.split('@')[0] || 'Usuário';
          const avatarUrl = session.user.user_metadata?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random`;
          
          const firstName = name.split(' ')[0].toLowerCase().replace(/[^a-z0-9]/g, '');
          const randomSuffix = Math.random().toString(36).substring(2, 6);
          const myReferralCode = `${firstName}-${randomSuffix}`;

          // Referral via OAuth: o ?ref é persistido no localStorage antes do redirect
          // do Google (ver Register). Aqui recuperamos e limpamos (uso único).
          const referredByCode = consumeStoredReferral();

          const newUser: User = {
            id: session.user.id,
            email: session.user.email || '',
            name: name,
            location: 'Brasil', // Default
            avatarUrl: avatarUrl,
            reputationPoints: 0,
            isVerified: false,
            role: 'user',
            referralCode: myReferralCode,
            ...(referredByCode ? { referredBy: referredByCode } : {}),
            referralCount: 0,
            usageStats: { serialChecks: {count: 0, month: ''}, contactReveals: {count: 0, month: ''} }
          };

          await userService.saveUser(newUser);

          // Conta a indicação (incrementa referral_count do indicador). O ticket de
          // sorteio NÃO é concedido aqui — só quando o convidado participar com CPF.
          if (referredByCode) {
            try { await userService.processReferral(referredByCode, newUser); } catch (e) { console.error('Erro no referral OAuth:', e); }
          }

          profile = newUser;
        }
        
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

  loginWithGoogle: async (): Promise<string | undefined> => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.origin }
      });
      // Em caso de sucesso o navegador é redirecionado para o Google,
      // então este ponto normalmente não é alcançado.
      if (error) return error.message;
    } catch (e: any) {
      console.error('Google login error:', e);
      return e.message || 'Não foi possível conectar com o Google. Tente novamente.';
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

        // Process Referral (incrementa referral_count do indicador). O ticket de
        // sorteio NÃO é concedido aqui — só quando o convidado participar com CPF.
        if (referralCode) {
            await userService.processReferral(referralCode, newUser);
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
