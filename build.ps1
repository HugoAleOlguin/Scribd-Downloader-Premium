$root    = Split-Path -Parent $MyInvocation.MyCommand.Path
$src     = Join-Path $root "src"
$shared  = Join-Path $src "shared"
$targets = @{
    "chrome"  = Join-Path $root "dist\chrome"
    "firefox" = Join-Path $root "dist\firefox"
}

Write-Host ""
Write-Host "  Scribd Premium Downloader - Build" -ForegroundColor Cyan
Write-Host "  ===================================" -ForegroundColor Cyan
Write-Host ""

# Validar que src/ existe
if (-not (Test-Path $src)) {
    Write-Host "  [ERROR] Carpeta src/ no encontrada." -ForegroundColor Red
    exit 1
}
if (-not (Test-Path $shared)) {
    Write-Host "  [ERROR] Carpeta src/shared/ no encontrada." -ForegroundColor Red
    exit 1
}

foreach ($browser in $targets.Keys) {
    $srcDir = Join-Path $src $browser
    if (-not (Test-Path $srcDir)) {
        Write-Host "  [ERROR] Carpeta src/$browser/ no encontrada." -ForegroundColor Red
        exit 1
    }
}

# Build por cada navegador
foreach ($browser in $targets.Keys) {
    $dist   = $targets[$browser]
    $srcDir = Join-Path $src $browser

    Write-Host "  Building: $browser..." -ForegroundColor Yellow

    # Limpiar y recrear dist/browser/
    if (Test-Path $dist) { Remove-Item $dist -Recurse -Force }
    New-Item -ItemType Directory -Path $dist -Force | Out-Null

    # 1. Copiar archivos compartidos (src/shared/)
    Copy-Item "$shared\*" $dist -Recurse -Force
    Write-Host "    [OK] src/shared copiado." -ForegroundColor Green

    # 2. Copiar archivos especificos del navegador (overwrites si hay conflicto)
    Copy-Item "$srcDir\*" $dist -Recurse -Force
    Write-Host "    [OK] src/$browser copiado." -ForegroundColor Green

    Write-Host "    => dist/$browser listo para instalar." -ForegroundColor Cyan
    Write-Host ""
}

Write-Host "  BUILD COMPLETE" -ForegroundColor Green
Write-Host ""
Write-Host "  Para instalar:" -ForegroundColor White
Write-Host "    Chrome/Edge/Brave -> chrome://extensions/    -> Cargar descomprimida -> dist\chrome\" -ForegroundColor Gray
Write-Host "    Firefox           -> about:debugging         -> Cargar complemento   -> dist\firefox\manifest.json" -ForegroundColor Gray
Write-Host ""