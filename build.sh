#!/bin/bash

# Scribd Premium Downloader - Constructor (Build)
# This script generates the 'chrome' and 'firefox' directories for browser installation.

echo ""
echo "  ======================================================"
echo "     SCRIBD PREMIUM DOWNLOADER - SYSTEM BUILDER"
echo "  ======================================================"
echo ""
echo "  Iniciando proceso de compilacion y empaquetado..."
echo ""

# -- Definition of paths
CHROME_OUT="./chrome"
FIREFOX_OUT="./firefox"
SHARED="./src/shared"
SRC_CHROME="./src/chrome"
SRC_FIREFOX="./src/firefox"

# -- Check that src/ folders exist before doing anything
if [ ! -d "$SHARED" ]; then
    echo "  [ERROR] Could not find $SHARED/  --  make sure you extracted the ZIP correctly."
    exit 1
fi
if [ ! -d "$SRC_CHROME" ]; then
    echo "  [ERROR] Could not find $SRC_CHROME/  --  make sure you extracted the ZIP correctly."
    exit 1
fi
if [ ! -d "$SRC_FIREFOX" ]; then
    echo "  [ERROR] Could not find $SRC_FIREFOX/  --  make sure you extracted the ZIP correctly."
    exit 1
fi

# -- Build Chrome package
echo "  Building chrome/ ..."
rm -rf "$CHROME_OUT"
mkdir -p "$CHROME_OUT"
cp -r "$SHARED"/* "$CHROME_OUT/"
cp -r "$SRC_CHROME"/* "$CHROME_OUT/"
echo "  ---> Version Chrome generada con exito en carpeta /chrome"

# -- Build Firefox package
echo "  Building firefox/ ..."
rm -rf "$FIREFOX_OUT"
mkdir -p "$FIREFOX_OUT"
cp -r "$SHARED"/* "$FIREFOX_OUT/"
cp -r "$SRC_FIREFOX"/* "$FIREFOX_OUT/"
echo "  ---> Version Firefox generada con exito en carpeta /firefox"

echo ""
echo "  ======================================================"
echo "              Done! Show install instructions"
echo "  ======================================================"
echo ""
echo "  Done! Now install the extension in your browser:"
echo ""
echo "   [ CHROME / EDGE / BRAVE ]"
echo "     1. Go to  chrome://extensions"
echo "     2. Enable \"Developer mode\" [top-right switch]"
echo "     3. Click \"Load unpacked\"  ->  select the  chrome/  folder"
echo ""
echo "   [ MOZILLA FIREFOX ]"
echo "     1. Go to  about:debugging#/runtime/this-firefox"
echo "     2. Click \"Load Temporary Add-on...\""
echo "     3. Open the  firefox/  folder  ->  select  manifest.json"
echo ""
