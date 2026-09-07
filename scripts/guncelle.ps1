<#
.SYNOPSIS
  Zirtan - yerel kopyayi gunceller (Windows sarmalayici).

.DESCRIPTION
  Guncelleme mantigi tek yerdedir: `scripts/guncelle.mjs`. Bu betik onu calistirir
  ve Windows'a ozgu tek isi yapar: zamanlanmis gorev kaydi. Ayni mantigi iki dilde
  yazmak, ikisi zamanla ayrisacagi icin tercih edilmedi.

.PARAMETER Klasor
  Proje klasoru. Varsayilan: C:\projects\zirtan

.PARAMETER Zamanla
  Windows Zamanlanmis Gorev olusturur: oturum acilisinda ve her gun 09:00'da.

.PARAMETER ZamanlamayiKaldir
  Olusturulan zamanlanmis gorevi siler.

.PARAMETER Hizli
  Tip denetimi ve testleri atlar.

.PARAMETER Sessiz
  Yalnizca degisiklik varsa ciktiy verir - zamanlanmis gorev icin uygundur.

.EXAMPLE
  .\guncelle.ps1
  .\guncelle.ps1 -Zamanla
  .\guncelle.ps1 -ZamanlamayiKaldir
#>

param(
  [string] $Klasor = 'C:\projects\zirtan',
  [string] $Dal = 'claude/outdoor-adventure-social-app-du8h5t',
  [switch] $Zamanla,
  [switch] $ZamanlamayiKaldir,
  [switch] $Hizli,
  [switch] $Sessiz
)

$ErrorActionPreference = 'Stop'
$GorevAdi = 'Zirtan-Guncelle'

if ($ZamanlamayiKaldir) {
  $mevcut = Get-ScheduledTask -TaskName $GorevAdi -ErrorAction SilentlyContinue
  if ($mevcut) {
    Unregister-ScheduledTask -TaskName $GorevAdi -Confirm:$false
    Write-Host "  [tamam] Zamanlanmis gorev silindi: $GorevAdi" -ForegroundColor Green
  } else {
    Write-Host '  Zamanlanmis gorev zaten yok.' -ForegroundColor Gray
  }
  exit 0
}

if ($Zamanla) {
  $betik = $MyInvocation.MyCommand.Path
  $eylem = New-ScheduledTaskAction -Execute 'powershell.exe' `
    -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$betik`" -Klasor `"$Klasor`" -Sessiz -Hizli"
  # Iki tetikleyici: oturum acilisi ve her gun 09:00. Bilgisayari her gun
  # kapatmayan da, her sabah acan da gunde en az bir kez guncellenir.
  $tetikleyiciler = @(
    (New-ScheduledTaskTrigger -AtLogOn),
    (New-ScheduledTaskTrigger -Daily -At 9am)
  )
  $ayar = New-ScheduledTaskSettingsSet -StartWhenAvailable -DontStopOnIdleEnd `
    -ExecutionTimeLimit (New-TimeSpan -Minutes 30)
  Register-ScheduledTask -TaskName $GorevAdi -Action $eylem -Trigger $tetikleyiciler `
    -Settings $ayar -Description 'Zirtan yerel kopyasini gunceller' -Force | Out-Null
  Write-Host ''
  Write-Host "  [tamam] Zamanlanmis gorev kuruldu: $GorevAdi" -ForegroundColor Green
  Write-Host "  Oturum acilisinda ve her gun 09:00'da calisir." -ForegroundColor Gray
  Write-Host '  Kaldirmak icin: .\guncelle.ps1 -ZamanlamayiKaldir' -ForegroundColor Gray
  Write-Host ''
  exit 0
}

if (-not (Test-Path $Klasor)) {
  Write-Host "  [hata]  Klasor bulunamadi: $Klasor" -ForegroundColor Red
  Write-Host '  Once kurulumu calistir: .\kurulum.ps1' -ForegroundColor Gray
  exit 1
}

$betikYolu = Join-Path $Klasor 'scripts\guncelle.mjs'
if (-not (Test-Path $betikYolu)) {
  Write-Host "  [hata]  Guncelleme betigi bulunamadi: $betikYolu" -ForegroundColor Red
  exit 1
}

$argumanlar = @($betikYolu, '--klasor', $Klasor, '--dal', $Dal)
if ($Sessiz) { $argumanlar += '--sessiz' }
if ($Hizli)  { $argumanlar += '--hizli' }

# node stderr'e yazdiginda $ErrorActionPreference='Stop' bunu olumcul sayar;
# basari yalnizca cikis koduyla olculur.
$oncekiTercih = $ErrorActionPreference
$ErrorActionPreference = 'Continue'
try {
  & node @argumanlar
  $kod = $LASTEXITCODE
} finally {
  $ErrorActionPreference = $oncekiTercih
}

# 2 = kaydedilmemis degisiklik; hata degil, bilincli duraklama.
if ($kod -eq 2) { exit 0 }
exit $kod
