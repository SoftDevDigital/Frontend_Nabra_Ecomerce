#!/bin/bash

# Script de deploy con cache busting automático
# Uso: ./scripts/deploy.sh [environment]

set -e  # Salir si hay algún error

ENVIRONMENT=${1:-production}
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
VERSION_FILE="deployment_version.txt"

echo "🚀 Iniciando deploy para $ENVIRONMENT..."

# 1. Generar versión única
echo "📦 Generando versión única..."
node scripts/generate-version.js

# 2. Crear archivo de versión para el servidor
echo "v$TIMESTAMP-$(git rev-parse --short HEAD)" > $VERSION_FILE
echo "✅ Versión generada: $(cat $VERSION_FILE)"

# 3. Instalar dependencias
echo "📥 Instalando dependencias..."
npm ci --only=production

# 4. Build del proyecto
echo "🔨 Construyendo proyecto..."
npm run build

# 5. Verificar que el build fue exitoso
if [ ! -d ".next" ]; then
    echo "❌ Error: Build falló - directorio .next no encontrado"
    exit 1
fi

echo "✅ Build completado exitosamente"

# 6. Crear archivo de información de deploy
cat > deploy_info.json << EOF
{
  "version": "$(cat $VERSION_FILE)",
  "timestamp": "$TIMESTAMP",
  "git_commit": "$(git rev-parse HEAD)",
  "git_branch": "$(git branch --show-current)",
  "build_time": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "environment": "$ENVIRONMENT"
}
EOF

echo "📋 Información de deploy:"
cat deploy_info.json

# 7. Instrucciones para el servidor
echo ""
echo "🎯 Próximos pasos en el servidor:"
echo "1. Subir archivos al servidor:"
echo "   - .next/"
echo "   - public/"
echo "   - package.json"
echo "   - next.config.ts"
echo "   - deploy_info.json"
echo "   - $VERSION_FILE"
echo ""
echo "2. En el servidor, ejecutar:"
echo "   npm ci --only=production"
echo "   npm start"
echo ""
echo "3. Verificar que el Service Worker esté funcionando:"
echo "   - Abrir DevTools > Application > Service Workers"
echo "   - Verificar que esté registrado y activo"
echo ""
echo "4. Probar cache busting:"
echo "   - Hacer cambios en el código"
echo "   - Hacer nuevo deploy"
echo "   - Verificar que los usuarios vean la notificación de actualización"

echo ""
echo "✅ Deploy preparado exitosamente!"
echo "📊 Versión: $(cat $VERSION_FILE)"
echo "🕒 Timestamp: $TIMESTAMP"

