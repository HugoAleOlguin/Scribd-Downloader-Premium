@echo off
title Scribd Premium Downloader - Build
color 0B

echo.
echo  ==========================================
echo   Scribd Premium Downloader  -  Build
echo  ==========================================
echo.

REM -- Output folders
set CHROME_OUT=%~dp0chrome
set FIREFOX_OUT=%~dp0firefox

REM -- Source folders
set SHARED=%~dp0src\shared
set SRC_CHROME=%~dp0src\chrome
set SRC_FIREFOX=%~dp0src\firefox

REM -- Check that src/ folders exist before doing anything
if not exist "%SHARED%" (
    echo  [ERROR] Could not find src\shared\  --  make sure you extracted the ZIP correctly.
    pause & exit /b 1
)
if not exist "%SRC_CHROME%" (
    echo  [ERROR] Could not find src\chrome\  --  make sure you extracted the ZIP correctly.
    pause & exit /b 1
)
if not exist "%SRC_FIREFOX%" (
    echo  [ERROR] Could not find src\firefox\  --  make sure you extracted the ZIP correctly.
    pause & exit /b 1
)

REM -- Build Chrome package
echo  Building chrome\ ...
if exist "%CHROME_OUT%" rd /s /q "%CHROME_OUT%"
robocopy "%SHARED%"     "%CHROME_OUT%" /e /nfl /ndl /njh /njs >nul
robocopy "%SRC_CHROME%" "%CHROME_OUT%" /e /nfl /ndl /njh /njs >nul
echo  [OK] chrome\

REM -- Build Firefox package
echo  Building firefox\ ...
if exist "%FIREFOX_OUT%" rd /s /q "%FIREFOX_OUT%"
robocopy "%SHARED%"      "%FIREFOX_OUT%" /e /nfl /ndl /njh /njs >nul
robocopy "%SRC_FIREFOX%" "%FIREFOX_OUT%" /e /nfl /ndl /njh /njs >nul
echo  [OK] firefox\

REM -- Done! Show install instructions
echo.
echo  Done! Now install the extension in your browser:
echo.
echo   Chrome / Edge / Brave:
echo     1. Go to  chrome://extensions
echo     2. Enable "Developer mode" (top-right switch)
echo     3. Click "Load unpacked"  -^>  select the  chrome\  folder
echo.
echo   Firefox:
echo     1. Go to  about:debugging#/runtime/this-firefox
echo     2. Click "Load Temporary Add-on..."
echo     3. Open the  firefox\  folder  -^>  select  manifest.json
echo.
pause
