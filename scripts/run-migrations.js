#!/usr/bin/env node
/**
 * Script para ejecutar migraciones de Prisma en Cloud Run
 * Usa Cloud SQL Proxy para conexión TCP confiable
 */

const { execSync, spawn } = require('child_process');
const { existsSync, chmodSync } = require('fs');
const path = require('path');
const http = require('http');

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
    // Intentar desde metadatos
    try {
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

// Función para configurar DATABASE_URL para socket Unix directo
function configureDatabaseURL() {
  const originalUrl = process.env.DATABASE_URL;
  if (!originalUrl) {
    console.error('❌ ERROR: DATABASE_URL no está configurada');
    process.exit(1);
  }
  
  // Guardar URL original para posibles reintentos con diferentes formatos
  if (!process.env.ORIGINAL_DATABASE_URL) {
    process.env.ORIGINAL_DATABASE_URL = originalUrl;
  }
  
  // Si hay socket Unix disponible, usarlo directamente
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
      
      // Parsear parámetros existentes
      const otherParams = [];
      if (params) {
        params.split('&').forEach(pair => {
          const [key, value] = pair.split('=');
          if (key && key !== 'host' && key !== 'hostaddr') {
            otherParams.push(`${key}=${value || ''}`);
          }
        });
      }
      
      // Usar formato que PostgreSQL acepta directamente: postgresql://user:pass@localhost/db?host=/path
      // Pero Prisma puede tener problemas. Intentar primero con hostname vacío y PGHOST
      // Para Prisma con sockets Unix, necesitamos usar un formato especial
      // Prisma no acepta hostname vacío, pero podemos usar un formato que funcione
      // La mejor opción es usar solo las variables de PostgreSQL y una URL simple
      
      // Configurar variables de PostgreSQL (estas tienen prioridad)
      process.env.PGHOST = socketPath;
      process.env.PGDATABASE = db;
      process.env.PGUSER = username;
      process.env.PGPASSWORD = password;
      process.env.PGPORT = '5432';
      
      // El problema es complejo: Prisma CLI parsea la URL antes de pasarla al driver
      // y puede estar intentando usar el path del socket como hostname
      // 
      // Solución: Usar el formato correcto para sockets Unix que PostgreSQL acepta:
      // postgresql://user:pass@/database?host=/path/to/socket
      // Pero asegurarnos de que no haya puerto en la URL
      
      // La solución más simple y robusta: usar solo las variables de PostgreSQL
      // El driver node-postgres (que usa Prisma) respeta PGHOST cuando es un path absoluto
      // y lo usa en lugar del hostname en la URL
      //
      // Construir una URL simple - el hostname será ignorado porque PGHOST está configurado
      // Usamos localhost como placeholder, pero node-postgres usará PGHOST en su lugar
      const newUrl = `postgresql://${encodedUser}:${encodedPass}@localhost/${db}`;
      
      // NO incluir el puerto en la URL - esto evita que Prisma agregue :5432 incorrectamente
      // El driver usará el puerto por defecto de PostgreSQL (5432) o el especificado en PGPORT
      process.env.DATABASE_URL = newUrl;
      console.log('✅ DATABASE_URL configurada para socket Unix');
      console.log(`🔍 URL: postgresql://***:***@localhost/${db}`);
      console.log(`🔍 PGHOST=${socketPath} (node-postgres usará esto en lugar de localhost)`);
      console.log(`🔍 PGDATABASE=${db}, PGUSER=${username}, PGPASSWORD=***`);
      
    } catch (error) {
      console.error('❌ ERROR al configurar DATABASE_URL:', error.message);
      process.exit(1);
    }
  } else {
    console.log('⚠️  Socket Unix no disponible, usando DATABASE_URL original');
  }
}

// Función para esperar conexión a PostgreSQL
function waitForPostgreSQL(host, port, maxWait = 60000) {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    const checkConnection = () => {
      const net = require('net');
      const socket = new net.Socket();
      
      socket.setTimeout(2000);
      socket.once('connect', () => {
        socket.destroy();
        resolve();
      });
      
      socket.once('timeout', () => {
        socket.destroy();
        if (Date.now() - startTime >= maxWait) {
          reject(new Error('Timeout esperando PostgreSQL'));
        } else {
          setTimeout(checkConnection, 2000);
        }
      });
      
      socket.once('error', () => {
        socket.destroy();
        if (Date.now() - startTime >= maxWait) {
          reject(new Error('Error conectando a PostgreSQL'));
        } else {
          setTimeout(checkConnection, 2000);
        }
      });
      
      socket.connect(port, host);
    };
    
    checkConnection();
  });
}

// Función principal
async function main() {
  console.log('🚀 Iniciando ejecución de migraciones...');
  
  try {
    // 1. Cargar secrets
    loadSecrets();
    
    // 2. Verificar DATABASE_URL
    if (!process.env.DATABASE_URL) {
      console.error('❌ ERROR: DATABASE_URL no está configurada');
      process.exit(1);
    }
    
    // 3. Configurar DATABASE_URL para socket Unix si está disponible
    configureDatabaseURL();
    
    // 4. Ejecutar migraciones con reintentos
    const maxRetries = 5;
    const retryDelay = 10000;
    let attempt = 1;
    
    while (attempt <= maxRetries) {
      console.log(`\n🔄 Intento ${attempt} de ${maxRetries}...`);
      
      try {
        // Ejecutar prisma migrate deploy
        execSync('npx prisma migrate deploy', {
          stdio: 'inherit',
          env: process.env,
          cwd: process.cwd()
        });
        
        console.log('✅ Migraciones ejecutadas exitosamente');
        process.exit(0);
        
      } catch (error) {
        const errorMessage = error.message || error.toString();
        const isConnectionError = /P1001|P1013|Can't reach database|ECONNREFUSED|connection.*refused|timeout|empty host/i.test(errorMessage);
        
        // Si es error relacionado con el formato de URL, intentar alternativas
        if (/empty host|P1013|P1001|Can't reach database/i.test(errorMessage)) {
          console.log('⚠️  Error de conexión/formato, intentando configuración alternativa...');
          
          const socketPath = `/cloudsql/${getInstanceConnectionName()}`;
          if (existsSync('/cloudsql')) {
            const originalUrl = process.env.DATABASE_URL || process.env.ORIGINAL_DATABASE_URL;
            
            // Intentar diferentes formatos
            const formats = [
              // Formato 1: Solo usar PGHOST con URL simple
              () => {
                const match = originalUrl?.match(/^postgresql:\/\/([^:]+):(.+?)@[^\/]*?\/([^?]+)/);
                if (match) {
                  const [, user, pass, db] = match;
                  process.env.PGHOST = socketPath;
                  process.env.PGDATABASE = db;
                  process.env.PGUSER = user;
                  process.env.PGPASSWORD = pass;
                  return `postgresql://${user}:${pass}@127.0.0.1/${db}`;
                }
                return null;
              },
              // Formato 2: URL con hostname vacío pero sin parámetro host
              () => {
                const match = originalUrl?.match(/^postgresql:\/\/([^:]+):(.+?)@[^\/]*?\/([^?]+)/);
                if (match) {
                  const [, user, pass, db] = match;
                  process.env.PGHOST = socketPath;
                  return `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(pass)}@/${db}`;
                }
                return null;
              },
              // Formato 3: Usar IP privada si está disponible (como último recurso)
              () => {
                // No intentar TCP si estamos en Cloud Run, usar solo socket
                return null;
              }
            ];
            
            for (const formatFn of formats) {
              try {
                const newUrl = formatFn();
                if (newUrl) {
                  console.log(`🔄 Intentando formato alternativo...`);
                  process.env.DATABASE_URL = newUrl;
                  
                  execSync('npx prisma migrate deploy', {
                    stdio: 'inherit',
                    env: process.env,
                    cwd: process.cwd(),
                    timeout: 60000
                  });
                  
                  console.log('✅ Migraciones ejecutadas exitosamente con formato alternativo');
                  process.exit(0);
                }
              } catch (formatError) {
                // Continuar con el siguiente formato
                continue;
              }
            }
          }
        }
        
        if (isConnectionError && attempt < maxRetries) {
          console.log(`⚠️  Error de conexión detectado. Esperando ${retryDelay/1000}s antes del siguiente intento...`);
          await new Promise(resolve => setTimeout(resolve, retryDelay));
          attempt++;
          continue;
        } else {
          console.error(`❌ Error ejecutando migraciones (intento ${attempt}):`, errorMessage);
          process.exit(1);
        }
      }
    }
    
  } catch (error) {
    console.error('❌ Error fatal:', error.message);
    process.exit(1);
  }
}

main();
