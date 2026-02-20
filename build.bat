@echo off
title Scribd Premium Downloader - Build
color 0B

echo.
echo  ==========================================
echo   Scribd Premium Downloader  -  Build
echo  ==========================================
echo.

REM ── Carpetas de salida ─────────────────────
set CHROME_OUT=%~dp0chrome
set FIREFOX_OUT=%~dp0firefox

REM ── Carpetas fuente ────────────────────────
set SHARED=%~dp0src\shared
set SRC_CHROME=%~dp0src\chrome
set SRC_FIREFOX=%~dp0src\firefox

REM ── Verificar que existe src/ ───────────────
if not exist "%SHARED%" (
    echo  [ERROR] No se encontro src\shared\
    pause & exit /b 1
)
if not exist "%SRC_CHROME%" (
    echo  [ERROR] No se encontro src\chrome\
    pause & exit /b 1
)
if not exist "%SRC_FIREFOX%" (
    echo  [ERROR] No se encontro src\firefox\
    pause & exit /b 1
)

REM ── Build Chrome ────────────────────────────
echo  Generando chrome\ ...
if exist "%CHROME_OUT%" rd /s /q "%CHROME_OUT%"
robocopy "%SHARED%"     "%CHROME_OUT%" /e /nfl /ndl /njh /njs >nul
robocopy "%SRC_CHROME%" "%CHROME_OUT%" /e /nfl /ndl /njh /njs >nul
echo  [OK] chrome\

REM ── Build Firefox ───────────────────────────
echo  Generando firefox\ ...
if exist "%FIREFOX_OUT%" rd /s /q "%FIREFOX_OUT%"
robocopy "%SHARED%"      "%FIREFOX_OUT%" /e /nfl /ndl /njh /njs >nul
robocopy "%SRC_FIREFOX%" "%FIREFOX_OUT%" /e /nfl /ndl /njh /njs >nul
echo  [OK] firefox\

REM ── Listo ───────────────────────────────────
echo.
echo  Listo! Instala desde:
echo.
echo   Chrome  -^>  chrome://extensions  -^>  "Cargar descomprimida"  -^>  chrome\
echo   Firefox -^>  about:debugging      -^>  "Cargar complemento"    -^>  firefox\manifest.json
echo.
pause
