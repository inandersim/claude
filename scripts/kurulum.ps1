<#
.SYNOPSIS
  Zirtan — Windows tek komut kurulumu.

.DESCRIPTION
  Projeyi indirir (ya da mevcut kopyayı günceller), dört paketin bağımlılıklarını
  kurar (ana uygulama, yönetim paneli, yapay zekâ ağ geçidi, pazarlama ajanları),
  Windows'a özgü Git ayarlarını yapar ve kurulumu doğrular.

  Betik tekrar tekrar çalıştırılabilir: var olanı bozmaz, eksik olanı tamamlar.

.PARAMETER Klasor
  Projenin kurulacağı klasör. Varsayılan: C:\projects\zirtan

.PARAMETER Dal
  Çalışılacak git dalı.

.PARAMETER Baslat
  Kurulum bitince uygulamayı tarayıcıda açar.

.PARAMETER AtlaDogrulama
  Tip denetimi ve testleri atlar (daha hızlı, ama kurulumu doğrulamaz).

.EXAMPLE
  .\kurulum.ps1
  .\kurulum.ps1 -Baslat
  .\kurulum.ps1 -Klasor "D:\projeler\zirtan"
#>

param(
  # Varsayılan C:\projects\zirtan — kısa ve boşluksuz yol, Windows'un 260 karakter
  # sınırına takılmayı önler (node_modules derin klasörler üretir). C: yazılabilir
  # değilse masaüstüne düşer.
  [string] $Klasor = $(
    $kok = 'C:\projects'
    if (Test-Path 'C:\') { Join-Path $kok 'zirtan' }
    else { Join-Path ([Environment]::GetFolderPath('Desktop')) 'zirtan' }
  ),
  [string] $Depo = 'https://github.com/inandersim/claude.git',
  [string] $Dal = 'claude/outdoor-adventure-social-app-du8h5t',
  [switch] $Baslat,
  [switch] $AtlaDogrulama
)

$ErrorActionPreference = 'Stop'
$script:Uyarilar = @()

function Yaz-Baslik($metin) {
  Write-Host ''
  Write-Host "-- $metin " -NoNewline -ForegroundColor Cyan
  Write-Host ('-' * [Math]::Max(0, 62 - $metin.Length)) -ForegroundColor DarkGray
}
function Yaz-Tamam($m) { Write-Host "  [tamam] $m" -ForegroundColor Green }
function Yaz-Bilgi($m)  { Write-Host "  $m" -ForegroundColor Gray }
function Yaz-Uyari($m)  { Write-Host "  [uyarı] $m" -ForegroundColor Yellow; $script:Uyarilar += $m }
function Yaz-Hata($m)   { Write-Host "  [hata]  $m" -ForegroundColor Red }

<# Bir komutun PATH'te olup olmadığını söyler. #>
function Var-Mi($komut) {
  $null -ne (Get-Command $komut -ErrorAction SilentlyContinue)
}

<# "v22.14.0" gibi bir çıktıdan ana sürüm numarasını çeker. #>
function Ana-Surum($metin) {
  if ($metin -match '(\d+)\.') { return [int]$Matches[1] }
  return 0
}

<#
  npm'i çalıştırır. Windows'ta npm bir .cmd sarmalayıcısıdır; PowerShell'in
  `$LASTEXITCODE` değerini doğru okuyabilmesi için cmd üzerinden çağrılır.
#>
function Npm-Calistir {
  param([string] $Argumanlar, [string] $CalismaDizini, [string] $Aciklama)
  Push-Location $CalismaDizini
  try {
    Yaz-Bilgi "$Aciklama..."
    & cmd /c "npm $Argumanlar" 2>&1 | ForEach-Object {
      if ($_ -match 'ERR!|error ') { Write-Host "    $_" -ForegroundColor DarkRed }
    }
    if ($LASTEXITCODE -ne 0) { throw "npm $Argumanlar başarısız (çıkış kodu $LASTEXITCODE)" }
    Yaz-Tamam $Aciklama
  } finally {
    Pop-Location
  }
}

Write-Host ''
Write-Host '  ZIRTAN - yerel kurulum' -ForegroundColor White
Write-Host '  Acik hava macera uygulamasi - Expo + React Native' -ForegroundColor DarkGray

# ------------------------------------------------------------------
# 1. Gereksinimler
# ------------------------------------------------------------------
Yaz-Baslik 'Gereksinimler denetleniyor'

if (-not (Var-Mi 'git')) {
  Yaz-Hata 'Git bulunamadı. https://git-scm.com adresinden kurup bu pencereyi yeniden aç.'
  return
}
Yaz-Tamam "Git $((git --version) -replace 'git version ', '')"

if (-not (Var-Mi 'node')) {
  Yaz-Hata 'Node.js bulunamadı. https://nodejs.org adresinden 22 LTS sürümünü kur (Add to PATH işaretli).'
  return
}
$nodeSurum = node --version
$nodeAna = Ana-Surum ($nodeSurum -replace 'v', '')
if ($nodeAna -lt 20) {
  Yaz-Hata "Node $nodeSurum çok eski. 22 LTS gerekiyor: https://nodejs.org"
  return
}
if ($nodeAna -lt 22) {
  Yaz-Uyari "Node $nodeSurum - proje 22 LTS ile gelistirildi; 22'ye yukseltmen onerilir."
} else {
  Yaz-Tamam "Node $nodeSurum"
}

if (-not (Var-Mi 'npm')) {
  Yaz-Hata 'npm bulunamadı. Node.js kurulumunu tekrar yap.'
  return
}
Yaz-Tamam "npm $(cmd /c 'npm --version')"

# ------------------------------------------------------------------
# 2. Windows'a özgü Git ayarları
# ------------------------------------------------------------------
Yaz-Baslik 'Git ayarları'

# Satır sonu: depo LF tutar. `input` ayarı Windows'ta dosyaları bozmadan çalışır.
git config --global core.autocrlf input
Yaz-Tamam 'Satır sonu dönüşümü kapatıldı (core.autocrlf=input)'

# node_modules derin klasörler üretir; 260 karakter sınırı aşılabilir.
git config --global core.longpaths true
Yaz-Tamam 'Uzun dosya yolu desteği açıldı (core.longpaths=true)'

# ------------------------------------------------------------------
# 3. Depoyu indir ya da güncelle
# ------------------------------------------------------------------
Yaz-Baslik 'Proje kodu'

$gitKlasoru = Join-Path $Klasor '.git'
if (Test-Path $gitKlasoru) {
  Yaz-Bilgi "Mevcut kopya bulundu: $Klasor"
  Push-Location $Klasor
  try {
    $kirli = git status --porcelain
    if ($kirli) {
      Yaz-Uyari 'Kaydedilmemiş değişikliklerin var; güncelleme atlandı (çalışman korundu).'
      Yaz-Bilgi 'Güncellemek için önce: git add -A; git commit -m "..."  sonra: git pull'
    } else {
      git fetch origin $Dal --quiet
      git checkout $Dal --quiet
      git pull origin $Dal --quiet
      Yaz-Tamam "Guncellendi: $Dal"
    }
  } finally { Pop-Location }
} else {
  if ((Test-Path $Klasor) -and (Get-ChildItem $Klasor -Force | Select-Object -First 1)) {
    Yaz-Hata "Klasör var ve boş değil ama git deposu değil: $Klasor"
    Yaz-Bilgi 'Başka bir klasör seç: .\kurulum.ps1 -Klasor "D:\zirtan"'
    return
  }
  $ustDizin = Split-Path -Parent $Klasor
  if ($ustDizin -and -not (Test-Path $ustDizin)) {
    New-Item -ItemType Directory -Path $ustDizin -Force | Out-Null
    Yaz-Bilgi "Klasor olusturuldu: $ustDizin"
  }
  Yaz-Bilgi "Indiriliyor: $Klasor"
  git clone --branch $Dal $Depo $Klasor
  if ($LASTEXITCODE -ne 0) {
    Yaz-Hata 'Klonlama başarısız. Depo özelse GitHub kimlik doğrulaması gerekir.'
    Yaz-Bilgi 'Kisisel erisim jetonu: GitHub > Settings > Developer settings > Personal access tokens'
    return
  }
  Yaz-Tamam "Indirildi: $Dal"
}

# ------------------------------------------------------------------
# 4. Bağımlılıklar
# ------------------------------------------------------------------
Yaz-Baslik 'Bağımlılıklar kuruluyor'
Yaz-Bilgi 'İlk kurulum birkaç dakika sürebilir.'

Npm-Calistir -Argumanlar 'install' -CalismaDizini $Klasor `
  -Aciklama 'Ana uygulama (Expo, React Native, harita, testler)'

$adminYolu = Join-Path $Klasor 'admin'
if (Test-Path (Join-Path $adminYolu 'package.json')) {
  Npm-Calistir -Argumanlar 'install' -CalismaDizini $adminYolu `
    -Aciklama 'Yönetim paneli (React + Vite)'
}

$gatewayYolu = Join-Path $Klasor 'server\ai-gateway'
if (Test-Path (Join-Path $gatewayYolu 'package.json')) {
  Npm-Calistir -Argumanlar 'install' -CalismaDizini $gatewayYolu `
    -Aciklama 'Yapay zekâ ağ geçidi (Node + Claude SDK)'
}

$pazarlamaYolu = Join-Path $Klasor 'agents\marketing'
if (Test-Path (Join-Path $pazarlamaYolu 'package.json')) {
  Npm-Calistir -Argumanlar 'install' -CalismaDizini $pazarlamaYolu `
    -Aciklama 'Pazarlama ajanları'
}

# ------------------------------------------------------------------
# 5. Doğrulama
# ------------------------------------------------------------------
if ($AtlaDogrulama) {
  Yaz-Baslik 'Doğrulama atlandı (-AtlaDogrulama)'
} else {
  Yaz-Baslik 'Kurulum doğrulanıyor'
  Push-Location $Klasor
  try {
    Yaz-Bilgi 'TypeScript denetimi...'
    & cmd /c 'npm run typecheck' | Out-Null
    if ($LASTEXITCODE -eq 0) { Yaz-Tamam 'TypeScript: 0 hata' }
    else { Yaz-Uyari 'TypeScript hata verdi. Ayrinti icin: npm run typecheck' }

    Yaz-Bilgi 'Testler calistiriliyor (bir dakika surebilir)...'
    $testCikti = & cmd /c 'npm test 2>&1'
    $testGecti = $LASTEXITCODE -eq 0
    $ozetSatiri = $testCikti | Select-String -Pattern 'Tests:' | Select-Object -Last 1
    $ozet = if ($ozetSatiri) { ($ozetSatiri.ToString() -replace '\s+', ' ').Trim() } else { '' }
    if ($testGecti) {
      if ($ozet) { Yaz-Tamam "Testler gecti: $ozet" } else { Yaz-Tamam 'Testler geçti' }
    } else {
      Yaz-Uyari 'Testlerde hata var. Ayrinti icin: npm test'
    }
  } finally { Pop-Location }
}

# ------------------------------------------------------------------
# 6. Özet
# ------------------------------------------------------------------
Yaz-Baslik 'Kurulum tamamlandı'
Write-Host ''
Write-Host "  Proje klasörü: " -NoNewline -ForegroundColor Gray
Write-Host $Klasor -ForegroundColor White
Write-Host ''
Write-Host '  Uygulamayı çalıştır:' -ForegroundColor Gray
Write-Host "    cd `"$Klasor`"" -ForegroundColor White
Write-Host '    npm run web       ' -NoNewline -ForegroundColor White
Write-Host '# tarayıcı: http://localhost:8081' -ForegroundColor DarkGray
Write-Host '    npm start         ' -NoNewline -ForegroundColor White
Write-Host '# telefonda Expo Go ile karekod' -ForegroundColor DarkGray
Write-Host ''
Write-Host '  Yönetim paneli:' -ForegroundColor Gray
Write-Host '    cd admin; npm run dev   ' -NoNewline -ForegroundColor White
Write-Host '# http://localhost:5173' -ForegroundColor DarkGray
Write-Host ''
Write-Host '  Demo giriş: ' -NoNewline -ForegroundColor Gray
Write-Host 'a@b.co / 123456' -ForegroundColor White
Write-Host ''
Write-Host '  Ayrıntılı rehber: ' -NoNewline -ForegroundColor Gray
Write-Host 'docs\WINDOWS.md' -ForegroundColor White

if ($script:Uyarilar.Count -gt 0) {
  Write-Host ''
  Write-Host "  $($script:Uyarilar.Count) uyarı vardı:" -ForegroundColor Yellow
  foreach ($u in $script:Uyarilar) { Write-Host "    · $u" -ForegroundColor Yellow }
}

if ($Baslat) {
  Yaz-Baslik 'Uygulama başlatılıyor'
  Yaz-Bilgi 'Durdurmak için Ctrl+C. Tarayıcı birkaç saniye içinde açılır.'
  Push-Location $Klasor
  try { & cmd /c 'npm run web' } finally { Pop-Location }
} else {
  Write-Host ''
  Write-Host '  İpucu: kurulumdan sonra doğrudan başlatmak için' -ForegroundColor DarkGray
  Write-Host '         .\kurulum.ps1 -Baslat' -ForegroundColor DarkGray
  Write-Host ''
}
