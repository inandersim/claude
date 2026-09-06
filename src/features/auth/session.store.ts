import { create } from 'zustand';

import { getDataProvider } from '@/data';
import type {
  CompleteProfileInput,
  OtpChallenge,
  OtpVerification,
  RequestOtpInput,
  SignInInput,
  SignUpInput,
  User,
  VerifyOtpInput,
} from '@/domain';

export type SessionStatus = 'loading' | 'signedOut' | 'signedIn';

interface SessionState {
  status: SessionStatus;
  user: User | null;
  hydrate: () => Promise<void>;
  signIn: (input: SignInInput) => Promise<void>;
  signUp: (input: SignUpInput) => Promise<void>;
  /** Telefona SMS doğrulama kodu ister (hız sınırı veri katmanında uygulanır). */
  requestOtp: (input: RequestOtpInput) => Promise<OtpChallenge>;
  /** Kodu doğrular; profil tamamsa oturumu açar, değilse `needsProfile` döner. */
  verifyOtp: (input: VerifyOtpInput) => Promise<OtpVerification>;
  /** İlk kez doğrulayan kullanıcı için kaydı tamamlar ve oturumu açar. */
  completeProfile: (input: CompleteProfileInput) => Promise<User>;
  signOut: () => Promise<void>;
  /** Profil güncellendiğinde yerel kopyayı yeniler */
  setUser: (user: User) => void;
  refreshUser: () => Promise<void>;
}

export const useSessionStore = create<SessionState>((set, get) => ({
  status: 'loading',
  user: null,

  hydrate: async () => {
    try {
      const user = await getDataProvider().auth.getSession();
      set({ user, status: user ? 'signedIn' : 'signedOut' });
    } catch {
      set({ user: null, status: 'signedOut' });
    }
  },

  signIn: async (input) => {
    const user = await getDataProvider().auth.signIn(input);
    set({ user, status: 'signedIn' });
  },

  signUp: async (input) => {
    const user = await getDataProvider().auth.signUp(input);
    set({ user, status: 'signedIn' });
  },

  requestOtp: async (input) => {
    return await getDataProvider().auth.requestOtp(input);
  },

  verifyOtp: async (input) => {
    const result = await getDataProvider().auth.verifyOtp(input);
    // Profil tamamsa oturum hemen açılır; değilse kayıt ekranı devam eder.
    if (result.user) set({ user: result.user, status: 'signedIn' });
    return result;
  },

  completeProfile: async (input) => {
    const user = await getDataProvider().auth.completeProfile(input);
    set({ user, status: 'signedIn' });
    return user;
  },

  signOut: async () => {
    await getDataProvider().auth.signOut();
    set({ user: null, status: 'signedOut' });
  },

  setUser: (user) => set({ user }),

  refreshUser: async () => {
    const current = get().user;
    if (!current) return;
    const fresh = await getDataProvider().users.getById(current.id);
    if (fresh) set({ user: fresh });
  },
}));

/** Oturum açmış kullanıcıyı döner; korunan ekranlarda kullanılır. */
export function useCurrentUser(): User {
  const user = useSessionStore((s) => s.user);
  if (!user) {
    throw new Error('useCurrentUser yalnızca oturum açılmış ekranlarda kullanılabilir.');
  }
  return user;
}
