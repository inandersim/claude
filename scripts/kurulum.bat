@echo off
REM ---------------------------------------------------------------
REM  Zirtan - Windows kurulumu (cift tiklanabilir)
REM
REM  Bu dosya kurulum.ps1 betigini calistirir. PowerShell'in imzasiz
REM  betik calistirmasi varsayilan olarak kapali oldugu icin burada
REM  yalnizca bu calistirma icin gecici olarak aciliyor; sistem
REM  ayarlarin degismiyor.
REM ---------------------------------------------------------------

setlocal
cd /d "%~dp0"

echo.
echo   Zirtan kurulumu baslatiliyor...
echo.

where powershell >nul 2>nul
if errorlevel 1 (
  echo   [hata] PowerShell bulunamadi.
  echo   Windows 10 ve uzerinde varsayilan olarak kurulu olmalidir.
  echo.
  pause
  exit /b 1
)

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0kurulum.ps1" %*

echo.
echo   Pencereyi kapatmak icin bir tusa bas.
pause >nul
