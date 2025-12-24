
import { auth } from './firebase';
import { userService } from './userService';
import { User } from '../types';

export const AuthService = {
  
  // --- SESSION MANAGEMENT ---
  
  getSession: async (): Promise<User | null> => {
    return new Promise((resolve) => {
        const unsubscribe = auth.onAuthStateChanged(async (firebaseUser) => {
            if (firebaseUser) {
                const profile = await userService.getUserProfile(firebaseUser.uid);
                resolve(profile);
            } else {
                resolve(null);
            }
            unsubscribe();
        });
    });
  },

  // --- LOGIN ---

  login: async (email: string, password: string): Promise<{ user: User | null; error?: string }> => {
    try {
        const userCredential = await auth.signInWithEmailAndPassword(email, password);
        const profile = await userService.getUserProfile(userCredential.user!.uid);
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
        const userCredential = await auth.createUserWithEmailAndPassword(email, password);
        const uid = userCredential.user!.uid;

        // Generate Unique Referral Code
        const firstName = name.split(' ')[0].toLowerCase().replace(/[^a-z0-9]/g, '');
        const randomSuffix = Math.random().toString(36).substring(2, 6);
        const myReferralCode = `${firstName}-${randomSuffix}`;

        // 2. Create Public Profile in Firestore
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
            // Fix: Only add referredBy if it exists to avoid "undefined" error in Firestore
            ...(referralCode ? { referredBy: referralCode } : {}),
            referralCount: 0,
            usageStats: { serialChecks: {count: 0, month: ''}, contactReveals: {count: 0, month: ''} }
        };

        await userService.saveUser(newUser);

        // Process Referral
        if (referralCode) {
            await userService.processReferral(referralCode);
        }

        return { user: newUser };
    } catch (e: any) {
        return { user: null, error: e.message || 'Erro ao registrar.' };
    }
  },

  // --- LOGOUT ---

  logout: async () => {
    await auth.signOut();
  }
};
