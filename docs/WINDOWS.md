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
cd C:\projects
git clone -b claude/outdoor-adventure-social-app-du8h5t https://github.com/inandersim/claude.git zirtan
cd zirtan
npm install
```

> **Neden `C:\projects`?** Yol kısa ve boşluk içermiyor. `node_modules` çok derin
> klasörler ürettiği için masaüstü gibi uzun yollarda Windows'un 260 karakter
> sınırına takılma riski var; kısa kök bunu baştan çözer.

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

Telefonda denemek için bkz. **4b** — Expo Go en hızlı yol ama vektör haritayı
göstermez, sebebi orada anlatılıyor.

## 4b. Telefonda deneme

Telefonda iki ayrı yol var ve **hangisini seçtiğin neyi test edebildiğini belirler.**

### Hangisi neyi kanıtlar

| | Expo Go | Geliştirme derlemesi |
| --- | --- | --- |
| Kurulum | Mağazadan indir, QR okut | Bir kez APK derlenir |
| Gerçek GPS | ✅ | ✅ |
| Çevrimdışı paketin diske yazılması | ✅ | ✅ |
| Kamera, bildirim, sensörler | ✅ | ✅ |
| **Vektör harita / 3B arazi / PMTiles** | ❌ SVG görünümüne düşer | ✅ |

Sebebi: `@maplibre/maplibre-react-native` **yerel (native) bir modüldür**, Expo Go'nun
içinde derlenmiş değildir. Uygulama bu yüzden çökmez — `loadMapLibre()` `null` döner ve
harita basit SVG görünümüne düşer (`src/features/maps/vector/engine.native.tsx`). Yani
Expo Go'da harita ekranları **açılır ama vektör harita göremezsin.**

### Yol 1 — Expo Go (5 dakika, hiçbir şey kurmadan)

1. **Telefon ve bilgisayar aynı Wi-Fi ağında olmalı.** Telefon mobil veride ise çalışmaz.

2. Bilgisayarın yerel IP'sini öğren:

   ```powershell
   ipconfig
   ```

   `Wireless LAN adapter Wi-Fi` altındaki `IPv4 Address` satırı — örneğin `192.168.1.24`.

3. `.env.local` içindeki karo sunucusu adresini bu IP ile değiştir. `localhost` telefonda
   **telefonun kendisi** demektir, bilgisayarın değil:

   ```
   EXPO_PUBLIC_TILES_URL=http://192.168.1.24:8090
   ```

4. Karo sunucusunu başlat (ayrı bir PowerShell penceresinde açık kalsın):

   ```powershell
   node tools/tiles/serve.mjs --port 8090
   ```

5. Uygulamayı başlat:

   ```powershell
   npm start
   ```

6. Telefona **Expo Go** uygulamasını kur (Play Store / App Store), aç ve terminaldeki QR
   kodu okut. iPhone'da QR'ı Kamera uygulamasıyla okutman gerekir.

Bittiğinde `.env.local` dosyasını `http://localhost:8090` haline geri getir, yoksa
tarayıcıda çalışmaz.

### Yol 2 — Geliştirme derlemesi (haritayı test etmek için tek yol)

Bu tek seferlik bir derlemedir; sonrasında `npm start` ile aynı hızda çalışırsın.

**Bilgisayarda derlemeden (Android Studio gerekmez):**

```powershell
npx eas login
npx eas init                                        # ilk kez: proje kimliği üretir
npx eas build --profile development --platform android
```

Derleme Expo'nun sunucusunda yapılır; bitince bir bağlantı verir, telefondan açıp APK'yı
kurarsın. Sonra:

```powershell
npx expo start --dev-client
```

Telefondaki Zirtan uygulaması (Expo Go değil) QR'ı okutup bağlanır.

> Ücretsiz EAS hesabında aylık derleme hakkı sınırlıdır ve kuyruk bekleyebilir.

**Kendi bilgisayarında derlemek (sınırsız ama kurulum ister):**

Android Studio + JDK 17 gerekir, ilk derleme 15–30 dakika sürer:

```powershell
npx expo prebuild            # android/ klasörünü üretir (.gitignore'da, depoya girmez)
npx expo run:android         # telefon USB ile bağlı ve USB hata ayıklama açık olmalı
```

### Bağlanamıyorsa

- **QR okundu ama yüklenmiyor** → Windows Güvenlik Duvarı `node`u engelliyordur. İlk
  çalıştırmada çıkan uyarıda **Özel ağlarda izin ver**i işaretle. Kaçırdıysan: Windows
  Defender Güvenlik Duvarı → Uygulamaya izin ver → `Node.js JavaScript Runtime` → Özel.
- **Harita boş ama uygulama çalışıyor** → `EXPO_PUBLIC_TILES_URL` hâlâ `localhost`
  olabilir, ya da karo sunucusu kapalıdır. Telefonun tarayıcısından
  `http://<IP>:8090/tiles/likya.pmtiles` adresini aç: indirme başlamıyorsa sorun ağdadır.
- **Expo Go "SDK uyumsuz" diyor** → Mağazadaki Expo Go bu SDK'yı henüz desteklemiyordur;
  Yol 2 tek seçenektir.
- **Aynı Wi-Fi'de ama bulamıyor** → Bazı ev/otel ağları cihazları birbirinden yalıtır
  (AP isolation). `npx expo start --tunnel` bunu aşar, sadece yavaştır.

## 5. Yönetim paneli

Ayrı bir uygulamadır, kendi bağımlılıkları vardır:

```powershell
cd admin
npm install
npm run dev         # http://localhost:5173
```

## 5b. Güncel kalmak

**Uygulama kendi kendini güncellemez.** Yeni bir sürüm çıktığında yerel kopyanın
haberi olmaz; güncellemeyi sen başlatırsın:

```powershell
npm run guncelle
```

Betik güvenli tarafta durur: kaydedilmemiş değişikliğin varsa **hiçbir şey
yapmaz**, yalnızca ileri sarma yapar (birleştirme çatışması üretmez), bağımlılık
dosyası değişmediyse `npm install` adımını atlar ve sonunda tip denetimi + test
çalıştırır.

| Seçenek    | Ne yapar                                    |
| ---------- | ------------------------------------------- |
| `--hizli`  | Tip denetimi ve testleri atlar              |
| `--sessiz` | Yalnızca değişiklik varsa konuşur           |

Otomatik olsun istersen Windows Zamanlanmış Görevi kur — oturum açılışında ve
her gün 09:00'da çalışır:

```powershell
.\scripts\guncelle.ps1 -Zamanla
.\scripts\guncelle.ps1 -ZamanlamayiKaldir   # vazgeçersen
```

Görev de aynı güvenlik kurallarına uyar: yarım kalmış işini asla ezmez, sessizce
güncelleme yapıp susmaz (değişiklik varsa ekrana yazar).

`scripts\guncelle.bat` dosyasına çift tıklamak da aynı işi yapar.

## 6. Diğer komutlar

| Komut                                     | Ne yapar                                            |
| ----------------------------------------- | --------------------------------------------------- |
| `npm run format`                          | Kodu Prettier ile biçimlendirir                     |
| `npm run i18n:check`                      | 23 dilde eksik çeviri var mı denetler               |
| `npm run guncelle`                        | Yerel kopyayı günceller (bkz. 5b)                   |
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

**`EMFILE: too many open files`.** Windows'ta aynı anda açık dosya tanıtıcısı
sayısı Linux'taki gibi yükseltilemez; Metro'nun dönüşüm işçileri sınırı aşınca
paketleme yarıda kalır. Depodaki `metro.config.js` bunu üç şekilde önler:

- yan projelerin (`admin`, `server/*`, `agents/*`, `website`) `node_modules`
  klasörleri ve üretilmiş çıktılar taramanın dışında bırakılır,
- Windows'ta işçi sayısı en fazla 4'e sınırlanır,
- önbellek `%TEMP%` yerine `node_modules\.cache\metro` altına alınır.

Yine de görürsen önbelleği temizleyip yeniden başlat:

```powershell
Remove-Item -Recurse -Force node_modules\.cache\metro
npx expo start --web --clear
```

Antivirüs dışlaması da bu klasör için ayrıca işe yarar.

**Veritabanı testleri.** `npm test` içindeki üç paket yerel Postgres ister;
sunucu yoksa **atlanır** (`3 skipped, 876 passed` normaldir). Denemek istersen
8. bölümdeki Docker adımını izle, sonra `ZIRTAN_TEST_PG=1` ile çalıştır.

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
| `connect ENOENT /tmp/.s.PGSQL...`    | Eski sürüm; `git pull` yap — veritabanı testleri artık sunucu yoksa atlanır       |
| `EMFILE: too many open files`        | 7. bölümdeki önbellek temizleme adımı; proje klasörünü antivirüsten dışla         |
| Değişiklik ekranda görünmüyor        | Metro'yu durdurup `--clear` ile başlat                                            |
