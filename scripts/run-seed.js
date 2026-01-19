#!/usr/bin/env node
/**
 * Script para ejecutar seed en Cloud Run
 * Maneja correctamente la conexión a Cloud SQL usando sockets Unix
 */

const { execSync } = require('child_process');
const { existsSync } = require('fs');

// Función para cargar secrets desde TRABAJOYA_SECRETS
function loadSecrets() {
  let secretContent = process.env.TRABAJOYA_SECRETS || '';
  
  if (!secretContent && existsSync('/etc/secrets/TRABAJOYA_SECRETS')) {
    const fs = require('fs');
    secretContent = fs.readFileSync('/etc/secrets/TRABAJOYA_SECRETS', 'utf8');
  }
  
  if (!secretContent) {
    console.error('❌ ERROR: TRABAJOYA_SECRETS no está disponible');
    process.exit(1);
  }
  
  console.log('🔐 Cargando secrets desde TRABAJOYA_SECRETS...');
  
  try {
    const secrets = JSON.parse(secretContent.trim());
    if (typeof secrets === 'object' && !Array.isArray(secrets)) {
      console.log(`✅ Formato JSON detectado, cargadas ${Object.keys(secrets).length} variables`);
      Object.keys(secrets).forEach(key => {
        process.env[key] = String(secrets[key]);
      });
      return;
    }
  } catch (e) {
    // No es JSON
  }
  
  const lines = secretContent.split('\n');
  const keys = [];
  lines.forEach(line => {
    line = line.trim();
    if (line && !line.startsWith('#')) {
      const eqIndex = line.indexOf('=');
      if (eqIndex > 0) {
        const key = line.substring(0, eqIndex).trim();
        let value = line.substring(eqIndex + 1);
        
        if ((value.startsWith('"') && value.endsWith('"') && value.length > 1) || 
            (value.startsWith("'") && value.endsWith("'") && value.length > 1)) {
          value = value.slice(1, -1);
        }
        
        if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) {
          process.env[key] = value;
          keys.push(key);
        }
      }
    }
  });
  
  console.log(`✅ Formato KEY=VALUE detectado, cargadas ${keys.length} variables`);
}

// Función para obtener nombre de conexión de Cloud SQL
function getInstanceConnectionName() {
  let name = process.env.CLOUD_SQL_CONNECTION_NAME || '';
  
  if (!name) {
    try {
      const http = require('http');
      const options = {
        hostname: 'metadata.google.internal',
        path: '/computeMetadata/v1/instance/attributes/cloud-sql-instance',
        headers: { 'Metadata-Flavor': 'Google' },
        timeout: 2000
      };
      
      http.get(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          if (data.trim()) {
            name = data.trim();
          }
        });
      }).on('error', () => {});
    } catch (e) {
      // Ignorar
    }
  }
  
  if (!name) {
    const projectId = process.env.GOOGLE_CLOUD_PROJECT || 
                      process.env.GCP_PROJECT || 
                      process.env.PROJECT_ID ||
                      'trabajo-ya-483316';
    name = `${projectId}:us-central1:trabajoya-db`;
  }
  
  return name;
}

// Función para configurar DATABASE_URL
function configureDatabaseURL() {
  const originalUrl = process.env.DATABASE_URL;
  if (!originalUrl) {
    console.error('❌ ERROR: DATABASE_URL no está configurada');
    process.exit(1);
  }
  
  const socketPath = `/cloudsql/${getInstanceConnectionName()}`;
  
  if (existsSync('/cloudsql') && (existsSync(socketPath) || existsSync(socketPath + '/.s.PGSQL.5432'))) {
    console.log('✅ Socket Unix disponible, configurando DATABASE_URL...');
    
    try {
      const urlMatch = originalUrl.match(/^postgresql:\/\/([^:]+):(.+?)@([^\/]*?)(?:\/([^?]+))?(?:\?(.*))?$/);
      
      if (!urlMatch) {
        throw new Error('Formato de URL no reconocido');
      }
      
      const [, username, password, hostpart, database, params] = urlMatch;
      const db = database || 'trabajoya';
      
      const encodedUser = encodeURIComponent(username);
      const encodedPass = encodeURIComponent(password);
      
      const otherParams = [];
      if (params) {
        params.split('&').forEach(pair => {
          const [key, value] = pair.split('=');
          if (key && key !== 'host' && key !== 'hostaddr') {
            otherParams.push(`${key}=${value || ''}`);
          }
        });
      }
      
      const paramsStr = otherParams.length > 0 
        ? `${otherParams.join('&')}&host=${socketPath}`
        : `host=${socketPath}`;
      
      process.env.PGHOST = socketPath;
      process.env.PGDATABASE = db;
      process.env.PGUSER = username;
      process.env.PGPASSWORD = password;
      
      const newUrl = `postgresql://${encodedUser}:${encodedPass}@localhost/${db}?${paramsStr}`;
      
      process.env.DATABASE_URL = newUrl;
      console.log('✅ DATABASE_URL configurada');
      console.log(`🔍 Usando socket: ${socketPath}`);
      
    } catch (error) {
      console.error('❌ ERROR al configurar DATABASE_URL:', error.message);
      process.exit(1);
    }
  } else {
    console.log('⚠️  Socket Unix no disponible, usando DATABASE_URL original');
  }
}

async function main() {
  console.log('🌱 Iniciando ejecución de seed...');
  
  try {
    loadSecrets();
    
    if (!process.env.DATABASE_URL) {
      console.error('❌ ERROR: DATABASE_URL no está configurada');
      process.exit(1);
    }
    
    configureDatabaseURL();
    
    // Ejecutar seed-if-empty.js
    console.log('🚀 Ejecutando seed-if-empty...');
    execSync('node scripts/seed-if-empty.js', {
      stdio: 'inherit',
      env: process.env,
      cwd: process.cwd()
    });
    
    console.log('✅ Seed ejecutado exitosamente');
    
  } catch (error) {
    console.error('❌ Error ejecutando seed:', error.message);
    // No fallar el despliegue por un error de seed
    process.exit(0);
  }
}

main();

