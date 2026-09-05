# Katkı Rehberi

## Kurulum
```bash
npm install
npm start
```

## Kurallar
- **Dal**: `feature/<kısa-ad>` veya `fix/<kısa-ad>`.
- **Commit**: [Conventional Commits](https://www.conventionalcommits.org/) — `feat:`, `fix:`, `refactor:`, `docs:`, `test:`, `chore:`.
- PR açmadan önce: `npm run lint && npm run typecheck && npm test`.
- Yeni metinler **önce `src/core/i18n/tr.ts`** dosyasına, ardından `en.ts`'ye eklenir; tip hatası eksik çeviriyi gösterir.
- Yeni renk / boşluk değerleri doğrudan bileşenlere değil, `src/core/theme/tokens.ts` dosyasına eklenir.
- İş mantığı `src/domain` altında saf fonksiyon olarak yazılır ve test edilir.

## Dosya adlandırma
- Bileşenler: `PascalCase.tsx`
- Hook'lar: `hooks.ts` (özellik başına) veya `useX.ts`
- Rotalar: Expo Router kuralları (`[id].tsx`, `(group)`)
