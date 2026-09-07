@echo off
REM ---------------------------------------------------------------
REM  Zirtan - yerel kopyayi gunceller (cift tiklanabilir)
REM
REM  guncelle.ps1 betigini calistirir. PowerShell'in imzasiz betik
REM  calistirmasi varsayilan olarak kapali oldugu icin burada
REM  yalnizca bu calistirma icin gecici olarak aciliyor.
REM ---------------------------------------------------------------

setlocal
cd /d "%~dp0"

echo.
echo   Zirtan guncelleniyor...
echo.

where powershell >nul 2>nul
if errorlevel 1 (
  echo   [hata] PowerShell bulunamadi.
  echo.
  pause
  exit /b 1
)

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0guncelle.ps1" %*

echo.
echo   Pencereyi kapatmak icin bir tusa bas.
pause >nul
