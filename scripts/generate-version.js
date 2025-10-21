const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Generar un hash único basado en timestamp y contenido del package.json
const generateVersionHash = () => {
  const timestamp = Date.now();
  const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  const content = `${packageJson.version}-${timestamp}-${Math.random().toString(36).substr(2, 9)}`;
  return crypto.createHash('md5').update(content).digest('hex').substr(0, 8);
};

const version = generateVersionHash();
const buildTimestamp = Date.now();

// Crear el archivo de versión optimizado
const versionContent = `// Este archivo se genera automáticamente en cada build
// No editar manualmente

export const APP_VERSION = '${version}';
export const BUILD_TIMESTAMP = ${buildTimestamp};
export const BUILD_TIME = '${new Date(buildTimestamp).toISOString()}';

// Función para verificar si hay una nueva versión disponible (ultra rápida)
export const checkForUpdates = async (): Promise<boolean> => {
  try {
    const response = await fetch('/api/version?' + Date.now(), {
      method: 'GET',
      cache: 'no-cache',
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
        'X-Requested-With': 'XMLHttpRequest'
      }
    });
    
    if (!response.ok) return false;
    
    const data = await response.json();
    return data.version !== APP_VERSION;
  } catch (error) {
    // Silencioso - no mostrar errores al usuario
    return false;
  }
};

// Función para forzar recarga de la página (instantánea)
export const forceReload = () => {
  if (typeof window !== 'undefined') {
    window.location.reload();
  }
};

// Función para obtener información de versión
export const getVersionInfo = () => ({
  version: APP_VERSION,
  timestamp: BUILD_TIMESTAMP,
  buildTime: BUILD_TIME,
  isDevelopment: process.env.NODE_ENV === 'development'
});
`;

// Crear directorio si no existe
const versionDir = path.join(__dirname, '..', 'src', 'lib');
if (!fs.existsSync(versionDir)) {
  fs.mkdirSync(versionDir, { recursive: true });
}

const versionFile = path.join(versionDir, 'version.ts');
fs.writeFileSync(versionFile, versionContent);

// Crear archivo de build info para el servidor
const buildInfo = {
  version,
  timestamp: buildTimestamp,
  buildTime: new Date(buildTimestamp).toISOString(),
  gitCommit: require('child_process').execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim(),
  gitBranch: require('child_process').execSync('git branch --show-current', { encoding: 'utf8' }).trim()
};

fs.writeFileSync(path.join(__dirname, '..', 'build-info.json'), JSON.stringify(buildInfo, null, 2));

console.log(`✅ Version hash generado: ${version}`);
console.log(`📅 Build timestamp: ${new Date(buildTimestamp).toISOString()}`);
console.log(`🔧 Git commit: ${buildInfo.gitCommit}`);
console.log(`🌿 Git branch: ${buildInfo.gitBranch}`);
