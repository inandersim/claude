# Zirtan — proje notları

Expo SDK 57 / React Native 0.86 / TypeScript strict / Expo Router (typed routes).

- Ekranlar `src/app`, iş mantığı `src/domain`, veri erişimi `src/data`, özellik hook/bileşenleri `src/features`, tasarım sistemi `src/components/ui`.
- Metinler `src/core/i18n/tr.ts` (kaynak) ve `en.ts`; renk/boşluk `src/core/theme/tokens.ts`.
- Reanimated shared value'lar için `.set()` / `.get()` kullan (React Compiler lint kuralı).
- `structuredClone` kullanma (Hermes'te yok) → `deepClone` (`src/core/utils/clone.ts`).
- Doğrulama: `npm run lint && npm run typecheck && npm test`.
- Yeni rota eklendiğinde `npx expo start` typed route tiplerini `.expo/types` altına üretir.
