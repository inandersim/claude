import { create } from 'zustand';

import { DEFAULT_COUNTRY_ISO2, type OtpChallenge } from '@/domain';

/**
 * Telefon kayıt akışının ekranlar arası kısa ömürlü durumu.
 *
 * Numara ve bekleyen doğrulama isteği burada durur; böylece `/phone`,
 * `/verify` ve `/complete-profile` ekranları aynı bilgiyi paylaşır ve numara
 * URL parametresinde taşınmaz (kayıt ekranı paylaşılabilir bir bağlantı değildir).
 */
interface PhoneAuthState {
  /** Seçili ülke (ISO 3166-1 alpha-2) */
  countryIso2: string;
  /** Doğrulanmakta olan E.164 numara */
  phone: string | null;
  /** Son kod isteğinin sonucu (geri sayım ve geliştirme rozeti için) */
  challenge: OtpChallenge | null;
  setCountry: (iso2: string) => void;
  /** Yeni bir doğrulama isteği başlatır */
  start: (phone: string, challenge: OtpChallenge) => void;
  /** Yeniden gönderim sonrası bekleyen isteği tazeler */
  refresh: (challenge: OtpChallenge) => void;
  reset: () => void;
}

export const usePhoneAuthStore = create<PhoneAuthState>((set) => ({
  countryIso2: DEFAULT_COUNTRY_ISO2,
  phone: null,
  challenge: null,
  setCountry: (countryIso2) => set({ countryIso2 }),
  start: (phone, challenge) => set({ phone, challenge }),
  refresh: (challenge) => set({ challenge }),
  reset: () => set({ phone: null, challenge: null }),
}));
