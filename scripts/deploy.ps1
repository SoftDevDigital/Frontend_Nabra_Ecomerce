# Script de deploy con cache busting automático para Windows
# Uso: .\scripts\deploy.ps1 [environment]

param(
    [string]$Environment = "production"
)

$ErrorActionPreference = "Stop"  # Salir si hay algún error

$Timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$VersionFile = "deployment_version.txt"

Write-Host "🚀 Iniciando deploy para $Environment..." -ForegroundColor Green

try {
    # 1. Generar versión única
    Write-Host "📦 Generando versión única..." -ForegroundColor Yellow
    node scripts/generate-version.js

    # 2. Crear archivo de versión para el servidor
    $GitCommit = git rev-parse --short HEAD
    $Version = "v$Timestamp-$GitCommit"
    $Version | Out-File -FilePath $VersionFile -Encoding UTF8
    Write-Host "✅ Versión generada: $Version" -ForegroundColor Green

    # 3. Instalar dependencias
    Write-Host "📥 Instalando dependencias..." -ForegroundColor Yellow
    npm ci --only=production

    # 4. Build del proyecto
    Write-Host "🔨 Construyendo proyecto..." -ForegroundColor Yellow
    npm run build

    # 5. Verificar que el build fue exitoso
    if (-not (Test-Path ".next")) {
        Write-Host "❌ Error: Build falló - directorio .next no encontrado" -ForegroundColor Red
        exit 1
    }

    Write-Host "✅ Build completado exitosamente" -ForegroundColor Green

    # 6. Crear archivo de información de deploy
    $DeployInfo = @{
        version = $Version
        timestamp = $Timestamp
        git_commit = git rev-parse HEAD
        git_branch = git branch --show-current
        build_time = (Get-Date -Format "yyyy-MM-ddTHH:mm:ssZ")
        environment = $Environment
    } | ConvertTo-Json -Depth 3

    $DeployInfo | Out-File -FilePath "deploy_info.json" -Encoding UTF8

    Write-Host "📋 Información de deploy:" -ForegroundColor Cyan
    Write-Host $DeployInfo

    # 7. Instrucciones para el servidor
    Write-Host ""
    Write-Host "🎯 Próximos pasos en el servidor:" -ForegroundColor Magenta
    Write-Host "1. Subir archivos al servidor:"
    Write-Host "   - .next/"
    Write-Host "   - public/"
    Write-Host "   - package.json"
    Write-Host "   - next.config.ts"
    Write-Host "   - deploy_info.json"
    Write-Host "   - $VersionFile"
    Write-Host ""
    Write-Host "2. En el servidor, ejecutar:"
    Write-Host "   npm ci --only=production"
    Write-Host "   npm start"
    Write-Host ""
    Write-Host "3. Verificar que el Service Worker esté funcionando:"
    Write-Host "   - Abrir DevTools > Application > Service Workers"
    Write-Host "   - Verificar que esté registrado y activo"
    Write-Host ""
    Write-Host "4. Probar cache busting:"
    Write-Host "   - Hacer cambios en el código"
    Write-Host "   - Hacer nuevo deploy"
    Write-Host "   - Verificar que los usuarios vean la notificación de actualización"

    Write-Host ""
    Write-Host "✅ Deploy preparado exitosamente!" -ForegroundColor Green
    Write-Host "📊 Versión: $Version" -ForegroundColor Cyan
    Write-Host "🕒 Timestamp: $Timestamp" -ForegroundColor Cyan

} catch {
    Write-Host "❌ Error durante el deploy: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}


