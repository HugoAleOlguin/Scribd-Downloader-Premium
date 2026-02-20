# ============================================================
# Scribd Premium Downloader - Instalador para Firefox
# Ejecuta este script con click derecho > "Ejecutar con PowerShell"
# ============================================================

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

$originalManifest = Join-Path $scriptDir "manifest.json"
$firefoxManifest  = Join-Path $scriptDir "manifest-firefox.json"
$backupManifest   = Join-Path $scriptDir "manifest.chrome.backup.json"

Write-Host ""
Write-Host "  Scribd Premium Downloader - Configurador Firefox" -ForegroundColor Cyan
Write-Host "  =================================================" -ForegroundColor Cyan
Write-Host ""

# Verificar que existe el manifest de Firefox
if (-not (Test-Path $firefoxManifest)) {
    Write-Host "  [ERROR] No se encontro manifest-firefox.json en la carpeta." -ForegroundColor Red
    Read-Host "  Presiona Enter para cerrar"
    exit 1
}

# Hacer backup del manifest de Chrome (si no existe ya)
if (Test-Path $originalManifest) {
    Copy-Item $originalManifest $backupManifest -Force
    Write-Host "  [OK] Backup de manifest de Chrome guardado como manifest.chrome.backup.json" -ForegroundColor Green
}

# Copiar el manifest de Firefox como manifest.json
Copy-Item $firefoxManifest $originalManifest -Force
Write-Host "  [OK] manifest-firefox.json activado como manifest.json" -ForegroundColor Green

Write-Host ""
Write-Host "  Ahora:" -ForegroundColor Yellow
Write-Host "  1. Abre Firefox y ve a about:debugging#/runtime/this-firefox" -ForegroundColor White
Write-Host "  2. Haz clic en 'Cargar complemento temporal...'" -ForegroundColor White
Write-Host "  3. Navega a esta carpeta y selecciona 'manifest.json'" -ForegroundColor White
Write-Host ""
Write-Host "  Para restaurar Chrome, ejecuta INSTALAR-CHROME.ps1" -ForegroundColor Gray
Write-Host ""
Read-Host "  Presiona Enter para cerrar"
