# Zirtan — Windows'ta yerel kurulum

Bu belge projeyi kendi bilgisayarında (Windows) çalıştırmak içindir.
Depo `inandersim/claude`, geliştirme dalı `claude/outdoor-adventure-social-app-du8h5t`.

## 1. Gerekenler

| Araç              | Sürüm  | Not                                                                                           |
| ----------------- | ------ | --------------------------------------------------------------------------------------------- |
| **Node.js**       | 22 LTS | [nodejs.org](https://nodejs.org) — kurulumda "Add to PATH" işaretli olsun                     |
| **Git**           | güncel | [git-scm.com](https://git-scm.com) — beraberinde Git Bash gelir, kabuk betikleri için gerekli |
| **VS Code**       | güncel | Önerilen eklentiler: ESLint, Prettier, Expo Tools                                             |
| Expo Go (telefon) | güncel | Uygulamayı telefonda açmak için; App Store / Play Store                                       |

İsteğe bağlı (yalnızca ilgili işi yapacaksan):

| Araç                 | Ne için                                                |
| -------------------- | ------------------------------------------------------ |
| Docker Desktop       | Yerel Postgres + PostGIS (veritabanı şemasını denemek) |
| Android Studio       | Android geliştirme derlemesi (gerçek harita motoru)    |
| Xcode (yalnızca Mac) | iOS derlemesi — Windows'ta yapılamaz                   |

## 2. Projeyi indir

Git kurulu olduğu için en güvenilir yol doğrudan klonlamaktır.
**PowerShell** aç ve şu dört satırı sırayla çalıştır:

```powershell
cd "$env:USERPROFILE\Desktop"
git clone -b claude/outdoor-adventure-social-app-du8h5t https://github.com/inandersim/claude.git "travel zirtan"
cd "travel zirtan"
npm install
```

Sonra çalıştır:

```powershell
npm run web      # tarayıcıda http://localhost:8081 açılır
```

Bu kadar. Uygulama demo veriyle çalışır; giriş `a@b.co` / `123456`.

### Yardımcı kurulum betiği (isteğe bağlı)

Depo indikten sonra `scripts/kurulum.ps1` betiği kalan üç paketin
bağımlılıklarını da kurar (yönetim paneli, yapay zekâ ağ geçidi, pazarlama
ajanları), Windows'a özgü Git ayarlarını yapar ve kurulumu doğrular:

```powershell
.\scripts\kurulum.ps1
```

PowerShell imzasız betikleri engellerse `scripts\kurulum.bat` dosyasına
**çift tıkla** — o, kısıtı yalnızca bu çalıştırma için aşar.

| Seçenek               | Ne yapar                                    |
| --------------------- | ------------------------------------------- |
| `-Baslat`             | Kurulum bitince uygulamayı tarayıcıda açar  |
| `-Klasor "D:\zirtan"` | Başka bir klasöre kurar                     |
| `-AtlaDogrulama`      | Tip denetimi ve testleri atlar (daha hızlı) |

Betik tekrar tekrar çalıştırılabilir; kaydedilmemiş değişikliğin varsa
güncellemeyi atlar.

Klasör adında boşluk var (`travel zirtan`); Node ve Expo bunu sorunsuz kaldırır,
ancak komut yazarken yolu **tırnak içinde** vermeyi unutma.

> Depo özelse ve `git clone` kimlik sorarsa: GitHub'da
> **Settings → Developer settings → Personal access tokens** üzerinden bir token
> üretip parola yerine onu gir. Ya da [GitHub Desktop](https://desktop.github.com)
> ile grafik arayüzden klonla.

## 3. Kurulumu doğrula

`npm install` birkaç dakika sürer. Bittiğinde her şeyin yerinde olduğunu kontrol et:

```powershell
npm run typecheck   # TypeScript — 0 hata olmalı
npm test            # Jest — 900+ test geçmeli
npm run lint        # ESLint — temiz olmalı
```

Üçü de temizse kurulum tamam.

## 4. Uygulamayı çalıştır

```powershell
npm run web         # tarayıcıda: http://localhost:8081
npm start           # QR kod çıkar; Expo Go ile telefonda aç
npm run android     # Android emülatörü/cihaz (Android Studio gerekir)
```

Demo giriş: e-posta `a@b.co`, şifre `123456`. Telefonla kayıt akışında doğrulama
kodu **konsola yazılır** ve ekranda geliştirme rozeti olarak görünür.

`npm run android` yerine `npm start` sonrası telefonda Expo Go ile QR okutmak
en hızlı yoldur; bilgisayar ve telefon **aynı Wi-Fi ağında** olmalı.

## 5. Yönetim paneli

Ayrı bir uygulamadır, kendi bağımlılıkları vardır:

```powershell
cd admin
npm install
npm run dev         # http://localhost:5173
```

## 6. Diğer komutlar

| Komut                                     | Ne yapar                                            |
| ----------------------------------------- | --------------------------------------------------- |
| `npm run format`                          | Kodu Prettier ile biçimlendirir                     |
| `npm run i18n:check`                      | 23 dilde eksik çeviri var mı denetler               |
| `npm run health`                          | Altyapı sağlık taraması, `docs/health` altına rapor |
| `npm run test:tiles`                      | Harita karo hattı testleri                          |
| `npm run test:selfheal`                   | Kendi kendini geliştirme altyapısı testleri         |
| `node tools/tiles/build-graph.mjs --list` | Hazır harita bölgelerini listeler                   |
| `node website/build.mjs`                  | Statik web sitesini üretir                          |

## 7. Windows'a özgü bilinmesi gerekenler

**Kabuk betikleri.** Depoda tek bir `.sh` dosyası var (`supabase/test/run.sh`,
veritabanı şema testleri). PowerShell bunu çalıştıramaz; **Git Bash** ya da
**WSL** kullan:

```bash
# Git Bash içinde
PGHOST=localhost PGPORT=54322 PGUSER=postgres ./supabase/test/run.sh
```

**Satır sonları.** Depoda `.gitattributes` var, her şey LF olarak tutulur.
Git'in dosyaları bozmaması için bir kez şunu çalıştır:

```powershell
git config --global core.autocrlf input
```

**Uzun yol sınırı.** `node_modules` derin klasörler üretir. Windows'un 260
karakter sınırını aç:

```powershell
git config --global core.longpaths true
```

**Antivirüs.** Windows Defender `node_modules` klasörünü tararken Metro'yu
yavaşlatır. Proje klasörünü **Virüs ve tehdit koruması → Dışlamalar** listesine
eklemek derleme süresini belirgin şekilde kısaltır.

**Port çakışması.** Metro 8081, karo sunucusu 8090, yönetim paneli 5173
kullanır. Doluysa:

```powershell
npx expo start --web --port 8082
```

## 8. Veritabanını yerelde çalıştırmak (isteğe bağlı)

Şemayı denemek istersen Docker en kolay yol:

```powershell
docker run --rm -e POSTGRES_PASSWORD=postgres -p 54322:5432 postgis/postgis:16-3.4
```

Sonra Git Bash'te:

```bash
PGHOST=localhost PGPORT=54322 PGUSER=postgres PGPASSWORD=postgres ./supabase/test/run.sh
```

Bu komut sıfırdan veritabanı kurar, 38 migration ve tohum verisini uygular,
ardından güvenlik politikası testlerini çalıştırır.

## 9. Gerçek sunucuya bağlanmak

Uygulama varsayılan olarak cihaz üzerindeki sahte veritabanıyla çalışır.
Gerçek sunucu hazır olduğunda kök dizine `.env.local` oluştur:

```
EXPO_PUBLIC_SUPABASE_URL=https://<proje>.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<anon anahtar>
```

Değişkenler tanımlıysa uygulama otomatik olarak gerçek sağlayıcıya geçer.
Ayrıntı: `docs/REMOTE_PROVIDER.md`, `docs/AUTH.md`, `supabase/README.md`.

## 10. Değişiklikleri geri göndermek

```powershell
git add -A
git commit -m "açıklama"
git push
```

Yeni bir özellik için ayrı dal açmak daha güvenli:

```powershell
git checkout -b ozellik/yeni-bir-sey
git push -u origin ozellik/yeni-bir-sey
```

## 11. Bir şey çalışmazsa

| Belirti                              | Çözüm                                                                             |
| ------------------------------------ | --------------------------------------------------------------------------------- |
| `npm install` hata veriyor           | Node 22 kurulu mu? `node -v` ile bak. `npm cache clean --force` sonra tekrar dene |
| Metro açılıyor ama sayfa boş         | `npx expo start --web --clear` (önbelleği temizler)                               |
| "Module not found"                   | Yeni paket eklendiyse `npm install` tekrar çalıştır                               |
| Telefonda QR okumuyor                | Aynı Wi-Fi'de misin? Değilse `npx expo start --tunnel`                            |
| Testler yerelde farklı sonuç veriyor | `node -v` sürümünü kontrol et; 22 olmalı                                          |
| Değişiklik ekranda görünmüyor        | Metro'yu durdurup `--clear` ile başlat                                            |
