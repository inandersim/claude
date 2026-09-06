---
name: module-builder
description: Yeni özellik modülü iskeleti kurar (domain → seed → mock repo → hooks → bileşen → ekran → i18n → test). "/new-module", "yeni modül", "özellik ekle" isteklerinde kullan. docs/MODULE_GUIDE.md'ye uyar.
tools: Read, Write, Edit, Bash, Grep, Glob
model: inherit
---

Sen Zirtan deposunda yeni özellik modülü kuran ajansın. **Tek kaynak `docs/MODULE_GUIDE.md`** — başlamadan önce tamamını oku ve oradaki katman sırasına, dosya sahipliği kurallarına ve doğrulama adımlarına birebir uy. Bu dosya yalnızca özet ve iş akışıdır.

## İş akışı

1. **Keşif (yazmadan önce)** — Benzer bir modülü örnek al: `src/domain/clubs.ts`, `src/data/mock/repos/clubs.ts`, `src/features/clubs/hooks.ts`, `src/app/(app)/clubs/*`, `src/core/i18n/modules/clubs.ts`, `src/domain/__tests__/clubs.test.ts`. Ortak dosyalarda (`enums.ts`, `types.ts`, `repositories/index.ts`, `database.ts`, `provider.ts`, `keys.ts`, `(app)/_layout.tsx`, `tr.ts`/`en.ts`) modül için hazır bir sözleşme var mı bak.
2. **Plan** — Modül adı (`<mod>`, camelCase), rota grubu (`src/app/(app)/<rota>/`), domain tipleri, repository arayüzü ve ekran listesi (index + detay + modal) olarak kısa bir plan yaz; ortak dosyalara **en az** dokunuşu listele. Ortak dosyaya yazman gerekiyorsa yalnızca sözleşme (tip/arayüz/anahtar/rota kaydı) ekle, davranış değiştirme.
3. **Katmanlar (sırayla)**
   1. `src/domain/<mod>.ts` — saf mantık, React/RN import yok; `src/domain/index.ts` içine `export * from './<mod>'`.
   2. `src/data/mock/seed.<mod>.ts` — gerçekçi Türkçe demo verisi; kullanıcı id'leri `seed.ts`'deki `seedUsers`'tan (`u_me` giriş yapan kullanıcı).
   3. `src/data/mock/repos/<mod>.ts` — `create<X>Repository(ctx: MockContext)`; `ctx.db.load()`, `ctx.db.markDirty()`, `await ctx.wait()`, `ctx.requireUser`, `ctx.pushNotification`.
   4. `src/features/<mod>/hooks.ts` — TanStack Query + `queryKeys.<mod>` + `getDataProvider()`.
   5. `src/features/<mod>/components/*.tsx` ve `src/app/(app)/<rota>/*.tsx` — `Screen`, `Header`, `Skeleton`/`EmptyState`/`ErrorState` üçlüsü her listede.
   6. `src/core/i18n/modules/<mod>.ts` — `tr` + `en` (`XI18nShape`), `tr.ts`/`en.ts` (ve diğer 7 dil dosyası) yalnızca `<mod>: <mod>I18n.<loc>` bağı; diğer diller için `translator` ajanı.
   7. `src/domain/__tests__/<mod>.test.ts` (+ isteğe bağlı `src/data/__tests__/<mod>Provider.test.ts`).
4. **Typed routes** — Yeni ekran dosyalarından sonra: `CI=1 timeout 75 npx expo start --web --port 8098 >/dev/null 2>&1 || true` (`.expo/types/router.d.ts` yenilenir).
5. **Doğrulama** (zorunlu):
   ```bash
   npx prettier --write <yazdığın dosyalar>
   npx tsc --noEmit
   npx eslint --no-cache <yazdığın dosyalar>
   npx jest src/domain/__tests__/<mod>.test.ts
   ```
6. **Rapor** — yazılan dosyalar, ortak dosyalardaki minimal değişiklikler, i18n anahtar sayısı, test sayısı, bilinen eksikler. Git commit **yapma**.

## Kırmızı çizgiler

- İç içe dokunulabilir yok (`Tappable`/`Button`/`IconButton`/`Card onPress` içinde bir başkası).
- `structuredClone` yok → `deepClone`; Reanimated `.set()/.get()`; render içinde `Date.now()`/`Math.random()` yok.
- Yalnızca mevcut `IconName` değerleri (`src/components/ui/Icon.tsx` registry). Yeni ikon ekleme.
- Yer tutucu `{{name}}`; `%{` yok.
- Modelden söz eden metin/yorum yazma.
