# Modül geliştirme rehberi

Zirve'de yeni bir özellik modülü **katmanlı** yazılır: `domain → data → features → app`, yanında `i18n` ve `tests`. Bu rehber hem insan geliştiriciler hem de `module-builder` ajanı (`/new-module`) için tek kaynaktır. Mimari arka plan: `docs/ARCHITECTURE.md`; genel kurallar: `CLAUDE.md`.

Stack: Expo SDK 57, React Native 0.86, React 19, TypeScript strict (`noUncheckedIndexedAccess`), Expo Router typed routes, TanStack Query, Zustand, Reanimated 4, React Compiler lint kuralları. Uygulama Türkçe odaklı, 9 dil destekli.

## 1. Dosya sahipliği

**Ortak dosyalar** — yalnızca _sözleşme_ eklenir (tip, arayüz, anahtar, rota kaydı); davranış değiştirilmez, mevcut imzalar bozulmaz:

| Dosya                             | Modül için eklenen                                                                          |
| --------------------------------- | ------------------------------------------------------------------------------------------- |
| `src/domain/enums.ts`, `types.ts` | Modülün enum/tipleri (mümkünse kendi `domain/<mod>.ts` dosyanda tanımla ve export et)       |
| `src/domain/index.ts`             | `export * from './<mod>'`                                                                   |
| `src/data/repositories/index.ts`  | `XRepository` arayüzü ve `DataProvider` içine `<mod>: XRepository`                          |
| `src/data/mock/database.ts`       | `Tables` arayüzüne tablo alanları                                                           |
| `src/data/mock/provider.ts`       | `create<X>Repository(ctx)` bağı                                                             |
| `src/core/query/keys.ts`          | `queryKeys.<mod>`                                                                           |
| `src/app/(app)/_layout.tsx`       | Rota kayıtları (`<Stack.Screen name="<rota>/index" />`, modal için `presentation: 'modal'`) |
| `src/core/i18n/tr.ts`, `en.ts`, … | Yalnızca `<mod>: <mod>I18n.tr` / `.en` / `.de` … bağı                                       |
| `src/components/ui/Icon.tsx`      | **Dokunma.** Sadece mevcut `IconName` değerlerini kullan (dosyadaki `registry` anahtarları) |

**Modülün kendi dosyaları** (aşağıdaki sırayla yazılır):

1. **Domain (saf mantık):** `src/domain/<mod>.ts` — React/RN import yok; tarih/rastgelelik dışarıdan parametre (`now`, `seed`). Tüm dallar test edilebilir.
2. **Seed:** `src/data/mock/seed.<mod>.ts` — gerçekçi, zengin Türkçe demo verisi. Kullanıcı id'leri `src/data/mock/seed.ts` içindeki `seedUsers`'tan (`u_me` = giriş yapan kullanıcı; diğerleri dosyaya bak).
3. **Mock repository:** `src/data/mock/repos/<mod>.ts` — `create<X>Repository(ctx: MockContext): XRepository`. `ctx.db.load()` tabloları verir; mutasyon sonrası `ctx.db.markDirty()`; `await ctx.wait()` gecikme; `ctx.requireUser(t.users, id)`; `ctx.pushNotification({...})` bildirim. Hata için `throw new Error(...)`. Sonuçlar provider sınırında `deepClone`'lanır; repo içinde kopyalama yapma.
4. **Hooks:** `src/features/<mod>/hooks.ts` — `useQuery`/`useMutation` + `queryKeys.<mod>`, `getDataProvider()` (`@/data`), `useCurrentUser()` (`@/features/auth/session.store`). İyimser güncelleme gereken yerlerde `onMutate`/`onError` geri alma. Örnek: `src/features/stays/hooks.ts`, `src/features/clubs/hooks.ts`.
5. **Bileşenler:** `src/features/<mod>/components/*.tsx`.
6. **Ekranlar:** `src/app/(app)/<rota>/index.tsx`, `[id].tsx`, `new.tsx` (modal) — `_layout.tsx`'te kayıtlı adlarla.
7. **i18n:** `src/core/i18n/modules/<mod>.ts` — `const tr = {...}`, `export type XI18nShape = typeof tr`, `const en: XI18nShape = {...}`, `export const <mod>I18n = localeSet(tr, en)`. Nested nesne serbest (`t('climbing.type.sport')`). Yer tutucu `{{name}}`; **asla** `%{name}`. Diğer 7 dil `translator` ajanı ile (`/translate <mod>`), dosya düzeni `modules/locales/<loc>/<mod>.ts`.
8. **Testler:** `src/domain/__tests__/<mod>.test.ts` (saf mantık, her dal için bir `it`) ve isteğe bağlı `src/data/__tests__/<mod>Provider.test.ts` (`createMockProvider({ persist: false, latencyMs: 0 })`; örnek `src/data/__tests__/mockProviderModules.test.ts`).

## 2. Kod kuralları

- **i18n:** Bileşenlerde `const { t, locale } = useT()` (`@/core/i18n`); `t` doğrudan import edilmez (React Compiler modül düzeyi çağrıyı önbelleğe alır). `t('<mod>.anahtar')` tip güvenlidir (`TranslationKey`). Modül i18n dosyası dolmadan ekran yazma.
- **Tema:** `const { colors, isDark } = useTheme()` (`@/core/theme`); `spacing`, `radius`, `layout`, `typography` token'ları. Renkler yalnızca `colors.*` (`primary`, `surface`, `surfaceMuted`, `border`, `borderStrong`, `text`, `textMuted`, `textSubtle`, `danger`, `warning`, `success`, `background`; tam liste `src/core/theme/tokens.ts`).
- **UI bileşenleri** (`@/components/ui`): `Screen` (scroll, edges, withTabBar, contentStyle), `Header` (title, subtitle, showBack, right, large, onBack), `Text` (variant display/title/heading/body/caption/label, weight, color), `Button` (label, onPress, variant primary/secondary/ghost/danger, size sm/md/lg, icon, loading, fullWidth), `IconButton`, `Card` (onPress, padded, elevated), `Chip`, `Badge`, `Input` (label, icon, error, hint, secure, right), `SegmentedControl`, `StatTile`, `ProgressRing`, `SectionHeader`, `EmptyState`, `ErrorState` (onRetry), `Skeleton`, `Avatar`, `AdventureImage`, `Tappable`, `Icon`.
- **İç içe dokunulabilir yasak:** `Tappable`/`Button`/`IconButton`/`Card onPress` içine başka bir dokunulabilir koyma (web'de iç içe `<button>` hatası). Satır içi ayrı düğmeler için dış sarmalayıcı `View`.
- **React Compiler / Reanimated:** shared value `.set()` / `.get()`; render içinde `Date.now()`/`Math.random()` yok (`useState(() => Date.now())` ya da domain fonksiyonuna `now` parametresi).
- **Hermes:** `structuredClone` yok → `deepClone` (`@/core/utils/clone`).
- **Navigasyon:** geri `goBack(router, '/fallback')` (`@/core/navigation`); yönlendirme `router.push({ pathname: '/<rota>/[id]', params: { id } })` (typed routes).
- **Yardımcılar:** `formatDistance`, `distanceKm`, `DEFAULT_LOCATION`, `formatPriceTry(value, locale, zeroAsFree?)` (`@/domain`); `formatDuration`, `formatRelative`, `formatDate`, `formatTime` (`@/core/utils/time`); `formatCompact`, `formatNumber`, `formatAltitude`, `generateId(prefix)` (`@/core/utils/format`); `useLocation(fallbackCoords)`; `const toast = useToast(); toast('mesaj', 'success' | 'error' | 'info')`; `haptics` (`@/core/hooks/useHaptics`); `ADVENTURE_TYPE_META[type]`.
- Tarihler ISO string (`ISODate`); para birimi TRY; mesafe km.
- Türkçe yorum/JSDoc, İngilizce tanımlayıcı; Prettier ile biçimlendir.
- Ekranlar mobil öncelikli (390 px genişlikte kusursuz); `useWindowDimensions` ile tablet sütunu. Her listede yükleme (`Skeleton`), boş (`EmptyState`) ve hata (`ErrorState`) durumu; erişilebilirlik etiketleri (`accessibilityRole`, `accessibilityLabel`).
- Modelden ya da yapay zekâ araçlarından söz eden metin/yorum ekleme.

## 3. Typed routes

Yeni ekran dosyalarından sonra route tiplerini yenile (`.expo/types/router.d.ts` üretilir):

```bash
cd <repo> && (CI=1 timeout 75 npx expo start --web --port 8098 >/dev/null 2>&1 || true); grep -c "" .expo/types/router.d.ts
```

Paralel çalışan ajanlar farklı port kullanır. Ardından `npx tsc --noEmit`.

## 4. Doğrulama (bitirmeden önce zorunlu)

```bash
npx prettier --write <yazdığın dosyalar>
npx tsc --noEmit                     # kendi dosyalarında hata kalmasın
npx eslint --no-cache <yazdığın dosyalar>
npx jest <kendi test dosyaların>
node agents/devops/i18n-check.mjs --modules=<mod>
```

Git commit **yapma**; ana ajan/insan birleştirip commit'ler. Raporda: yazılan dosyalar, ortak dosyalardaki minimal değişiklikler, i18n anahtar sayısı, test sayısı, bilinen eksikler.

## 5. Kontrol listesi

- [ ] Domain saf ve test edilmiş (her dal için bir `it`)
- [ ] Seed gerçekçi; `u_me` senaryoları kapsıyor (boş/dolu/hatalı durumlar)
- [ ] Repository yan etkileri (bildirim, `markDirty`) tek yerde
- [ ] Hooks `queryKeys.<mod>` ile önbelleği geçersizliyor
- [ ] Ekranlarda yükleme/boş/hata üçlüsü ve erişilebilirlik etiketleri
- [ ] i18n `tr` + `en` tam, `%{` yok, `/translate <mod>` önerildi
- [ ] Typed routes yenilendi, `tsc`/`eslint`/`jest` temiz
