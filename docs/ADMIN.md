# Yönetim Paneli (admin/)

Zirtan'ın operasyonu tek bir web arayüzünden yönetilir: `admin/`.
Bu belge mimari kararları ve panelin uygulamayla nasıl aynı sözleşmeyi
paylaştığını açıklar. Kurulum ve komutlar için `admin/README.md`.

## Neden ayrı bir uygulama?

Mobil uygulama Expo/React Native ile yazılıdır; yönetim işleri ise geniş
tablolar, çoklu filtre ve klavye ağırlıklı bir arayüz ister. Panel bu yüzden
ayrı bir **React 19 + Vite** uygulamasıdır, ancak veri modelini uygulamadan
kopyalamaz:

| Paylaşılan | Kaynak | Nasıl |
| --- | --- | --- |
| Alan tipleri | `src/domain` | `tsconfig` yol takma adı ile **tip-only** içe aktarım |
| Demo veri | `src/data/mock/seed*.ts` | `mockAdminApi` doğrudan okur |
| Tasarım token'ları | `src/core/theme/tokens.ts` | CSS değişkenlerine dönüştürülür |

React Native'e bağlı iki modül (`@/core/i18n`, `@/components/ui/Icon`) domain
katmanında yalnızca tip olarak kullanıldığından `admin/src/shims/` altındaki
stub'lara yönlendirilir. Böylece panel RN'e hiç bağımlı olmaz.

```
admin/vite.config.ts     → alias: @/domain, @/core/*, @/data/*
admin/tsconfig.json      → aynı yollar paths olarak
```

Sonuç: uygulamanın alan modeli değişirse **panel derlemesi kırılır**. Bu
kasıtlıdır; sözleşme sapması derleme zamanında yakalanır.

## Veri katmanı

`admin/src/data/adminApi.ts` tek bir `AdminApi` arayüzü tanımlar
(metrikler, kullanıcılar, moderasyon, doğrulama, rezervasyon/ödeme, SOS,
içerik, pazarlama, ajanlar, AI CTO, ayarlar, denetim). İki uygulaması vardır:

- `mockAdminApi` — tohum veriden türetilmiş, deterministik (mulberry32) demo
  verisi; gerçekçi ağ gecikmesi taklidi; tüm mutasyonlar bellekte kalıcı.
- `restAdminApi` — `VITE_ADMIN_API_URL` tanımlıysa devreye giren HTTP istemcisi.

Ekranlar yalnızca arayüzü bilir; kaynak değişimi ekran kodunu etkilemez.
Sunucu ekibi için uç nokta listesi `admin/README.md` içindedir.

Uygulama tarafındaki `DataProvider` (`src/data/repositories/index.ts`) son
kullanıcı işlemlerini modellerken, `AdminApi` aynı varlıkların **yönetimsel**
görünümünü ve eylemlerini modeller. İkisi çakışmaz; birbirini tamamlar.

## AI Geliştirme Komuta Merkezi (`/ai-cto`)

Panelin en yeni ekranı, doğal dildeki bir geliştirme talebini **kod olarak
yorumlanmadan önce** analiz eder: ne anlaşıldı, hangi modüller ve tablolar
etkilenir, risk seviyesi ne, insan onayı gerekiyor mu, 13 adımlı boru hattının
neresindeyiz.

Üç şey bu ekranı bir "sohbet kutusu"ndan ayırır:

1. **Ekran kod yazmaz.** Talebi kaydeder ve ajanlara devreder; kodu Claude Code
   ajanları yazar, CI doğrular, insan onaylar (`docs/AI_CTO.md` §0).
2. **Kural motoru panelde değil.** Risk sınıflandırması, kapılar ve onay
   kategorileri `agents/cto/lib/*.mjs` içindedir ve panel onları **doğrudan içe
   aktarır** (`@cto/*` takma adı); politika `agents/cto/policy.json`. Panelde
   gördüğün karar, `node agents/cto/intake.mjs` çıktısıyla aynıdır.
3. **Onay kanıt ister.** Kanıt alanı boşken onay düğmesi kapalıdır; onay
   yalnızca bekleyen adımı açar, geçilmemiş kapıları geçmiş saymaz.

Modül listesi elle yazılmaz: `vite.config.ts` içindeki `virtual:zirtan-modules`
eklentisi derleme sırasında `src/features/*` ve `src/domain/*.ts` adlarını okur.
(`import.meta.glob` kullanılmaz — o, özellik dosyalarını paket grafiğine sokar
ve React Native paneldeki derlemeye sızar.)

İzinler: `cto.view` · `cto.submit` · `cto.approve` (şu an yalnızca `admin`).

## Yetkilendirme

`admin/src/auth/roles.ts` içinde izin listesi ve `can(role, permission)`
yardımcısı bulunur. Roller: `admin`, `moderator`, `editor`, `support`.
Menü, yönlendirme koruması ve her tehlikeli düğme aynı yardımcıyı kullanır.

## Denetim günlüğü

Her mutasyon `AdminApi` uygulamasında bir denetim kaydı üretir:
kim (panel hesabı + rol), ne (işlem anahtarı), hedef, özet, gerekçe, zaman, IP.
Panelde bu kayıtlar "Denetim günlüğü" ekranından aranabilir/süzülebilir.
Gerçek sunucuya geçildiğinde aynı kaydı sunucu üretmelidir — panel yalnızca
gerekçeyi taşır.

## Doğrulama

```bash
cd admin
npm install
npm run build      # tsc --noEmit + vite build
npm run dev &
node <playwright-scripti>   # tüm ekranları gez, ekran görüntüsü al
```

Panel Playwright ile uçtan uca gezilerek doğrulanır: her ekran, arama/filtre,
bir moderasyon işlemi, bir iade işlemi, rol değişimi ve koyu tema.
Ekran görüntüleri `admin/screenshots/` altındadır ve konsol hatası beklenmez.
