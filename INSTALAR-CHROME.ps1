# ============================================================
# Scribd Premium Downloader - Restaurar para Chrome/Edge/Brave
# Ejecuta este script con click derecho > "Ejecutar con PowerShell"
# ============================================================

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

$originalManifest = Join-Path $scriptDir "manifest.json"
$backupManifest   = Join-Path $scriptDir "manifest.chrome.backup.json"

Write-Host ""
Write-Host "  Scribd Premium Downloader - Restaurar para Chromium" -ForegroundColor Cyan
Write-Host "  =====================================================" -ForegroundColor Cyan
Write-Host ""

if (-not (Test-Path $backupManifest)) {
    Write-Host "  [INFO] No hay backup de Chrome. El manifest actual ya puede ser el correcto." -ForegroundColor Yellow
    Read-Host "  Presiona Enter para cerrar"
    exit 0
}

Copy-Item $backupManifest $originalManifest -Force
Write-Host "  [OK] manifest de Chrome restaurado correctamente." -ForegroundColor Green

Write-Host ""
Write-Host "  Ahora:" -ForegroundColor Yellow
Write-Host "  1. Abre chrome://extensions/" -ForegroundColor White
Write-Host "  2. Haz clic en el icono de recargar de la extension" -ForegroundColor White
Write-Host ""
Read-Host "  Presiona Enter para cerrar"
