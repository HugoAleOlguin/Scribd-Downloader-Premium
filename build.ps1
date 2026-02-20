param([string]$Browser = "all")

$root   = Split-Path -Parent $MyInvocation.MyCommand.Path
$shared = Join-Path $root "src\shared"

function Build-Browser($name) {
    $src  = Join-Path $root "src\$name"
    $dest = Join-Path $root $name

    if (-not (Test-Path $src))    { Write-Host "[ERROR] src/$name not found" -ForegroundColor Red; exit 1 }
    if (-not (Test-Path $shared)) { Write-Host "[ERROR] src/shared not found" -ForegroundColor Red; exit 1 }

    if (Test-Path $dest) { Remove-Item $dest -Recurse -Force }
    New-Item -ItemType Directory -Path $dest -Force | Out-Null

    Copy-Item "$shared\*" $dest -Recurse -Force
    Copy-Item "$src\*"    $dest -Recurse -Force

    Write-Host "  [OK] $name/" -ForegroundColor Green
}

Write-Host ""
Write-Host "  Scribd Premium Downloader - Build" -ForegroundColor Cyan
Write-Host ""

switch ($Browser) {
    "chrome"  { Build-Browser "chrome" }
    "firefox" { Build-Browser "firefox" }
    default   { Build-Browser "chrome"; Build-Browser "firefox" }
}

Write-Host ""
Write-Host "  Done. Install from:" -ForegroundColor White
Write-Host "   Chrome  -> chrome://extensions  -> Load unpacked -> chrome\"  -ForegroundColor DarkCyan
Write-Host "   Firefox -> about:debugging      -> Load addon    -> firefox\manifest.json" -ForegroundColor DarkCyan
Write-Host ""