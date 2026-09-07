/// <reference types="vite/client" />

/**
 * `virtual:zirtan-modules` — deponun modül listesi, derleme sırasında
 * `vite.config.ts` içindeki eklenti tarafından üretilir.
 */
declare module 'virtual:zirtan-modules' {
  export const MODULES: string[];
}
