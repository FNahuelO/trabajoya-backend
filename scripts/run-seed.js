#!/usr/bin/env node
/**
 * Script para ejecutar seed en Cloud Run
 * Maneja correctamente la conexión a Cloud SQL usando sockets Unix o Cloud SQL Proxy
 */

const { execSync, spawn } = require('child_process');
const { existsSync } = require('fs');
const path = require('path');

// Función para cargar secrets desde TRABAJOYA_SECRETS (opcional)
// Si TRABAJOYA_SECRETS no está disponible, asume que los secretos individuales
// ya están disponibles como variables de entorno (montados desde Secret Manager)
function loadSecrets() {
  let secretContent = process.env.TRABAJOYA_SECRETS || '';
  
  if (!secretContent && existsSync('/etc/secrets/TRABAJOYA_SECRETS')) {
    const fs = require('fs');
    secretContent = fs.readFileSync('/etc/secrets/TRABAJOYA_SECRETS', 'utf8');
  }
  
  // Si TRABAJOYA_SECRETS no está disponible, verificar que DATABASE_URL existe
  // (asumiendo que los secretos individuales ya están montados)
  if (!secretContent) {
    if (process.env.DATABASE_URL) {
      console.log('ℹ️  TRABAJOYA_SECRETS no está disponible, usando secretos individuales montados');
      console.log('✅ DATABASE_URL ya está disponible como variable de entorno');
      return;
    } else {
      console.error('❌ ERROR: TRABAJOYA_SECRETS no está disponible y DATABASE_URL tampoco está configurada');
      process.exit(1);
    }
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

// Función para instalar y ejecutar Cloud SQL Proxy
function startCloudSQLProxy(instanceConnectionName, port = 5432) {
  return new Promise((resolve, reject) => {
    const os = require('os');
    const fs = require('fs');
    
    console.log('🔧 Configurando Cloud SQL Proxy...');
    
    // Determinar la arquitectura
    const arch = process.arch === 'x64' ? 'linux.amd64' : 'linux.386';
    const proxyPath = path.join(os.tmpdir(), 'cloud-sql-proxy');
    
    // Verificar si ya existe
    if (fs.existsSync(proxyPath)) {
      console.log('✅ Cloud SQL Proxy ya existe, verificando permisos...');
      try {
        fs.chmodSync(proxyPath, 0o755);
        const stats = fs.statSync(proxyPath);
        if (!stats.isFile()) {
          console.log('⚠️  El archivo existente no es válido, descargando nuevamente...');
          fs.unlinkSync(proxyPath);
          downloadAndRunProxy();
        } else {
          setTimeout(() => {
            runProxy();
          }, 100);
        }
      } catch (error) {
        console.log(`⚠️  Error verificando archivo existente: ${error.message}, descargando nuevamente...`);
        try {
          fs.unlinkSync(proxyPath);
        } catch (e) {
          // Ignorar si no se puede eliminar
        }
        downloadAndRunProxy();
      }
    } else {
      console.log(`📥 Descargando Cloud SQL Proxy...`);
      downloadAndRunProxy();
    }
    
    function downloadAndRunProxy() {
      try {
        const https = require('https');
        const url = `https://storage.googleapis.com/cloud-sql-connectors/cloud-sql-proxy/v2.8.0/cloud-sql-proxy.${arch}`;
        
        const file = fs.createWriteStream(proxyPath);
        https.get(url, (response) => {
          if (response.statusCode === 200) {
            response.pipe(file);
            file.on('finish', () => {
              file.close(() => {
                try {
                  const fd = fs.openSync(proxyPath, 'r+');
                  fs.fsyncSync(fd);
                  fs.closeSync(fd);
                } catch (e) {
                  // Ignorar si no se puede sincronizar
                }
                
                fs.chmodSync(proxyPath, 0o755);
                
                const stats = fs.statSync(proxyPath);
                if (!stats.isFile()) {
                  reject(new Error('El archivo descargado no es un archivo válido'));
                  return;
                }
                
                console.log('✅ Cloud SQL Proxy descargado');
                
                setTimeout(() => {
                  runProxy();
                }, 500);
              });
            });
          } else {
            reject(new Error(`Error descargando proxy: ${response.statusCode}`));
          }
        }).on('error', (error) => {
          reject(error);
        });
        
      } catch (error) {
        reject(error);
      }
    }
    
    function runProxy() {
      console.log(`🚀 Iniciando Cloud SQL Proxy en localhost:${port}...`);
      
      if (!fs.existsSync(proxyPath)) {
        reject(new Error(`Cloud SQL Proxy no encontrado en ${proxyPath}`));
        return;
      }
      
      try {
        const stats = fs.statSync(proxyPath);
        if (!stats.isFile()) {
          reject(new Error(`La ruta ${proxyPath} no es un archivo válido`));
          return;
        }
        
        fs.chmodSync(proxyPath, 0o755);
      } catch (error) {
        reject(new Error(`Error verificando Cloud SQL Proxy: ${error.message}`));
        return;
      }
      
      const proxyArgs = [
        instanceConnectionName,
        `--port=${port}`,
        '--address=127.0.0.1'
      ];
      
      let proxy;
      try {
        proxy = spawn(proxyPath, proxyArgs, {
          stdio: ['ignore', 'pipe', 'pipe'],
          env: {
            ...process.env,
          }
        });
      } catch (error) {
        reject(new Error(`Error ejecutando Cloud SQL Proxy: ${error.message}`));
        return;
      }
      
      let proxyReady = false;
      let outputBuffer = '';
      
      proxy.stdout.on('data', (data) => {
        const output = data.toString();
        outputBuffer += output;
        process.stdout.write(`[Cloud SQL Proxy] ${output}`);
        if (output.includes('Ready for new connections') || output.includes('listening')) {
          proxyReady = true;
        }
      });
      
      proxy.stderr.on('data', (data) => {
        const output = data.toString();
        outputBuffer += output;
        process.stderr.write(`[Cloud SQL Proxy] ${output}`);
        if (output.includes('Ready for new connections') || output.includes('listening')) {
          proxyReady = true;
        }
      });
      
      proxy.on('error', (error) => {
        console.error('❌ Error ejecutando Cloud SQL Proxy:', error);
        reject(error);
      });
      
      proxy.on('exit', (code) => {
        if (code !== 0 && code !== null) {
          console.error(`❌ Cloud SQL Proxy terminó con código ${code}`);
          console.error(`Output: ${outputBuffer}`);
        }
      });
      
      const checkReady = setInterval(() => {
        if (proxyReady) {
          clearInterval(checkReady);
          console.log('✅ Cloud SQL Proxy está listo');
          resolve(proxy);
        }
      }, 500);
      
      setTimeout(() => {
        clearInterval(checkReady);
        if (!proxyReady) {
          console.log('⚠️  Proxy iniciado (asumiendo que está listo después de 10s)');
          proxyReady = true;
          resolve(proxy);
        }
      }, 10000);
      
      process.on('exit', () => {
        if (!proxy.killed) {
          proxy.kill();
        }
      });
    }
  });
}

// Función para esperar conexión a PostgreSQL
function waitForPostgreSQL(host, port, maxWait = 30000) {
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

async function main() {
  console.log('🌱 Iniciando ejecución de seed...');
  
  try {
    // 1. Cargar secrets
    loadSecrets();
    
    if (!process.env.DATABASE_URL) {
      console.error('❌ ERROR: DATABASE_URL no está configurada');
      process.exit(1);
    }
    
    // Asegurar que PRISMA_DATABASE_URL esté configurada (Prisma usa esta variable)
    if (!process.env.PRISMA_DATABASE_URL && process.env.DATABASE_URL) {
      process.env.PRISMA_DATABASE_URL = process.env.DATABASE_URL;
    }
    
    // 2. Configurar conexión: Como Prisma CLI no respeta PGHOST con sockets Unix,
    // debemos usar Cloud SQL Proxy desde el inicio si hay socket Unix disponible
    const socketAvailable = existsSync('/cloudsql');
    const instanceConnectionName = getInstanceConnectionName();
    
    let proxyProcess = null;
    
    if (socketAvailable) {
      console.log('✅ Socket Unix disponible');
      console.log('⚠️  Prisma CLI no respeta PGHOST, usando Cloud SQL Proxy...');
      
      try {
        // Iniciar Cloud SQL Proxy inmediatamente
        proxyProcess = await startCloudSQLProxy(instanceConnectionName);
        
        // Esperar a que el proxy esté listo
        console.log('⏳ Esperando a que Cloud SQL Proxy esté listo...');
        await waitForPostgreSQL('127.0.0.1', 5432, 30000);
        console.log('✅ Cloud SQL Proxy está listo');
        
        // Configurar DATABASE_URL para usar TCP a través del proxy
        const originalUrl = process.env.DATABASE_URL;
        const match = originalUrl.match(/^postgresql:\/\/([^:]+):(.+?)@[^\/]*?\/([^?]+)/);
        
        if (match) {
          const [, user, pass, db] = match;
          const encodedUser = encodeURIComponent(user);
          const encodedPass = encodeURIComponent(pass);
          
          // Usar TCP a través del proxy local
          const proxyUrl = `postgresql://${encodedUser}:${encodedPass}@127.0.0.1:5432/${db}`;
          process.env.DATABASE_URL = proxyUrl;
          // Establecer PRISMA_DATABASE_URL (Prisma usa esta variable)
          process.env.PRISMA_DATABASE_URL = proxyUrl;
          
          // Limpiar variables de PostgreSQL para que use la URL directamente
          delete process.env.PGHOST;
          delete process.env.PGDATABASE;
          delete process.env.PGUSER;
          delete process.env.PGPASSWORD;
          
          console.log('✅ DATABASE_URL configurada para usar Cloud SQL Proxy');
        } else {
          throw new Error('No se pudo parsear DATABASE_URL');
        }
        
      } catch (proxyError) {
        console.error('❌ Error iniciando Cloud SQL Proxy:', proxyError.message);
        console.log('⚠️  Intentando con socket Unix directo...');
        // Intentar con socket Unix directo como fallback
        const socketPath = `/cloudsql/${instanceConnectionName}`;
        if (existsSync(socketPath) || existsSync(socketPath + '/.s.PGSQL.5432')) {
          const originalUrl = process.env.DATABASE_URL;
          const urlMatch = originalUrl.match(/^postgresql:\/\/([^:]+):(.+?)@([^\/]*?)(?:\/([^?]+))?(?:\?(.*))?$/);
          
          if (urlMatch) {
            const [, username, password, hostpart, database] = urlMatch;
            const db = database || 'trabajoya';
            const encodedUser = encodeURIComponent(username);
            const encodedPass = encodeURIComponent(password);
            
            const newUrl = `postgresql://${encodedUser}:${encodedPass}@localhost/${db}?host=${socketPath}`;
            process.env.DATABASE_URL = newUrl;
            process.env.PRISMA_DATABASE_URL = newUrl;
            console.log('✅ DATABASE_URL configurada para usar socket Unix');
          }
        }
      }
    } else {
      console.log('⚠️  Socket Unix no disponible, usando DATABASE_URL original');
    }
    
    // 3. Ejecutar seed-if-empty.js
    console.log('🚀 Ejecutando seed-if-empty...');
    try {
      execSync('node scripts/seed-if-empty.js', {
        stdio: 'inherit',
        env: process.env,
        cwd: process.cwd()
      });
      console.log('✅ Proceso de seed completado');
    } catch (seedError) {
      // seed-if-empty.js puede terminar con exit(0) incluso en caso de error
      // para no fallar el despliegue, así que solo registramos el error
      console.error('⚠️  El seed tuvo problemas, pero no se detiene el despliegue');
      console.error('💡 Revisa los logs anteriores para más detalles');
    }
    
    // Limpiar proxy al finalizar
    if (proxyProcess && !proxyProcess.killed) {
      proxyProcess.kill();
    }
    
  } catch (error) {
    console.error('❌ Error ejecutando seed:', error.message);
    // No fallar el despliegue por un error de seed
    process.exit(0);
  }
}

main();

