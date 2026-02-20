$root   = Split-Path -Parent $MyInvocation.MyCommand.Path
$shared = Join-Path $root "shared"
$targets = @{ "chrome" = Join-Path $root "dist\chrome"; "firefox" = Join-Path $root "dist\firefox" }

Write-Host ""
Write-Host "  Scribd Premium Downloader - Build" -ForegroundColor Cyan
Write-Host "  ===================================" -ForegroundColor Cyan
Write-Host ""

foreach ($browser in $targets.Keys) {
    $srcDir = Join-Path $root $browser
    if (-not (Test-Path $srcDir)) { Write-Host "  [ERROR] Carpeta /$browser no encontrada." -ForegroundColor Red; exit 1 }
}
if (-not (Test-Path $shared)) { Write-Host "  [ERROR] Carpeta /shared no encontrada." -ForegroundColor Red; exit 1 }

foreach ($browser in $targets.Keys) {
    $dist   = $targets[$browser]
    $srcDir = Join-Path $root $browser
    Write-Host "  Building: $browser..." -ForegroundColor Yellow
    if (Test-Path $dist) { Remove-Item $dist -Recurse -Force }
    New-Item -ItemType Directory -Path $dist -Force | Out-Null
    Copy-Item "$shared\*" $dist -Recurse -Force
    Write-Host "    [OK] Shared files copied." -ForegroundColor Green
    Copy-Item "$srcDir\*" $dist -Recurse -Force
    Write-Host "    [OK] Browser-specific files copied." -ForegroundColor Green
    Write-Host "    => dist/$browser ready." -ForegroundColor Cyan
    Write-Host ""
}

Write-Host "  BUILD COMPLETE" -ForegroundColor Green
Write-Host ""
Write-Host "  Chrome/Edge/Brave : dist\chrome\" -ForegroundColor Gray
Write-Host "  Firefox           : dist\firefox\" -ForegroundColor Gray
Write-Host ""