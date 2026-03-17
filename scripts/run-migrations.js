#!/usr/bin/env node
/**
 * Script para ejecutar migraciones de Prisma en Cloud Run
 * Usa Cloud SQL Proxy para conexión TCP confiable
 */

const { execSync, spawn } = require('child_process');
const { existsSync, chmodSync, readdirSync } = require('fs');
const path = require('path');
const http = require('http');

const PRISMA_CMD = 'npm exec -- prisma';

function runPrisma(command, options = {}) {
  return execSync(`${PRISMA_CMD} ${command}`, options);
}

function getLocalMigrations() {
  const migrationsDir = path.join(process.cwd(), 'prisma', 'migrations');
  if (!existsSync(migrationsDir)) {
    return [];
  }

  return readdirSync(migrationsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((name) => name !== 'migration_lock.toml')
    .sort();
}

function validateDatabaseUrl() {
  const url = process.env.DATABASE_URL || '';
  if (!url) {
    console.error('❌ ERROR: DATABASE_URL no está configurada');
    process.exit(1);
  }

  // Evita despliegues con placeholders manuales
  if (/USUARIO|PASS|HOST|DB\?/i.test(url)) {
    console.error('❌ ERROR: DATABASE_URL contiene placeholders (USUARIO/PASS/HOST/DB)');
    console.error('💡 Configura la URL real desde Secret Manager o variables de entorno');
    process.exit(1);
  }
}

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
      // Establecer PRISMA_DATABASE_URL (Prisma usa esta variable)
      process.env.PRISMA_DATABASE_URL = newUrl;
      console.log('✅ DATABASE_URL configurada para socket Unix');
      
    } catch (error) {
      console.error('❌ ERROR al configurar DATABASE_URL:', error.message);
      process.exit(1);
    }
  } else {
    console.log('⚠️  Socket Unix no disponible, usando DATABASE_URL original');
    // Asegurar que PRISMA_DATABASE_URL también esté configurada
    if (process.env.DATABASE_URL && !process.env.PRISMA_DATABASE_URL) {
      process.env.PRISMA_DATABASE_URL = process.env.DATABASE_URL;
    }
  }
}

// Función para instalar y ejecutar Cloud SQL Proxy
function startCloudSQLProxy(instanceConnectionName, port = 5432) {
  return new Promise((resolve, reject) => {
    const os = require('os');
    const path = require('path');
    const fs = require('fs');
    
    console.log('🔧 Configurando Cloud SQL Proxy...');
    
    // Determinar la arquitectura
    const arch = process.arch === 'x64' ? 'linux.amd64' : 'linux.386';
    const proxyPath = path.join(os.tmpdir(), 'cloud-sql-proxy');
    
    // Verificar si ya existe
    if (fs.existsSync(proxyPath)) {
      console.log('✅ Cloud SQL Proxy ya existe, verificando permisos...');
      try {
        // Asegurar permisos de ejecución
        fs.chmodSync(proxyPath, 0o755);
        // Verificar que es un archivo válido
        const stats = fs.statSync(proxyPath);
        if (!stats.isFile()) {
          console.log('⚠️  El archivo existente no es válido, descargando nuevamente...');
          fs.unlinkSync(proxyPath);
          downloadAndRunProxy();
        } else {
          // Pequeño delay para asegurar que el sistema de archivos está listo
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
        // Descargar Cloud SQL Proxy
        const https = require('https');
        const url = `https://storage.googleapis.com/cloud-sql-connectors/cloud-sql-proxy/v2.8.0/cloud-sql-proxy.${arch}`;
        
        const file = fs.createWriteStream(proxyPath);
        https.get(url, (response) => {
          if (response.statusCode === 200) {
            response.pipe(file);
            file.on('finish', () => {
              file.close(() => {
                // Forzar sincronización del archivo al disco
                try {
                  const fd = fs.openSync(proxyPath, 'r+');
                  fs.fsyncSync(fd);
                  fs.closeSync(fd);
                } catch (e) {
                  // Ignorar si no se puede sincronizar
                }
                
                // Establecer permisos de ejecución
                fs.chmodSync(proxyPath, 0o755);
                
                // Verificar que el archivo existe y tiene permisos correctos
                const stats = fs.statSync(proxyPath);
                if (!stats.isFile()) {
                  reject(new Error('El archivo descargado no es un archivo válido'));
                  return;
                }
                
                console.log('✅ Cloud SQL Proxy descargado');
                
                // Esperar un momento para asegurar que el sistema de archivos está sincronizado
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
      
      // Verificar que el archivo existe y es ejecutable antes de ejecutarlo
      if (!fs.existsSync(proxyPath)) {
        reject(new Error(`Cloud SQL Proxy no encontrado en ${proxyPath}`));
        return;
      }
      
      try {
        // Verificar permisos
        const stats = fs.statSync(proxyPath);
        if (!stats.isFile()) {
          reject(new Error(`La ruta ${proxyPath} no es un archivo válido`));
          return;
        }
        
        // Asegurar permisos de ejecución
        fs.chmodSync(proxyPath, 0o755);
      } catch (error) {
        reject(new Error(`Error verificando Cloud SQL Proxy: ${error.message}`));
        return;
      }
      
      // En Cloud Run, el socket Unix ya está montado, el proxy puede usarlo automáticamente
      // El formato para proxy v2 es: cloud-sql-proxy INSTANCE_CONNECTION_NAME --port=PORT
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
            // El proxy detectará automáticamente el socket Unix en /cloudsql
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
      
      // Esperar a que el proxy esté listo
      const checkReady = setInterval(() => {
        if (proxyReady) {
          clearInterval(checkReady);
          console.log('✅ Cloud SQL Proxy está listo');
          resolve(proxy);
        }
      }, 500);
      
      // Timeout después de 10 segundos
      setTimeout(() => {
        clearInterval(checkReady);
        if (!proxyReady) {
          console.log('⚠️  Proxy iniciado (asumiendo que está listo después de 10s)');
          proxyReady = true;
          resolve(proxy);
        }
      }, 10000);
      
      // Guardar referencia al proceso para poder matarlo después
      process.on('exit', () => {
        if (!proxy.killed) {
          proxy.kill();
        }
      });
    }
  });
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
    const localMigrations = getLocalMigrations();
    if (localMigrations.length === 0) {
      console.error('❌ No se encontraron carpetas en prisma/migrations dentro del contenedor.');
      console.error('❌ Se cancela deploy para evitar falsos OK sin migraciones.');
      process.exit(1);
    }
    console.log(`📚 Migraciones locales detectadas: ${localMigrations.length}`);
    console.log(`📌 Última migración local: ${localMigrations[localMigrations.length - 1]}`);

    // 1. Cargar secrets
    loadSecrets();
    
    // 2. Verificar DATABASE_URL
    validateDatabaseUrl();
    
    // Asegurar que PRISMA_DATABASE_URL esté configurada (Prisma usa esta variable)
    if (!process.env.PRISMA_DATABASE_URL && process.env.DATABASE_URL) {
      process.env.PRISMA_DATABASE_URL = process.env.DATABASE_URL;
    }

    // Si usamos Supabase, no debemos pasar por Cloud SQL Proxy.
    // Prisma usará DIRECT_URL para migraciones cuando esté disponible.
    const dbUrlForRouting = process.env.DIRECT_URL || process.env.DATABASE_URL || '';
    const isSupabase = /supabase\.co|pooler\.supabase\.com/i.test(dbUrlForRouting);
    if (isSupabase) {
      if (process.env.DIRECT_URL) {
        process.env.DATABASE_URL = process.env.DIRECT_URL;
        process.env.PRISMA_DATABASE_URL = process.env.DIRECT_URL;
      } else {
        process.env.PRISMA_DATABASE_URL = process.env.DATABASE_URL;
      }
      console.log('✅ Supabase detectado, omitiendo Cloud SQL Proxy');
    }
    
    // 3. Configurar conexión: Como Prisma CLI no respeta PGHOST con sockets Unix,
    // debemos usar Cloud SQL Proxy desde el inicio si hay socket Unix disponible
    const socketAvailable = !isSupabase && existsSync('/cloudsql');
    const instanceConnectionName = getInstanceConnectionName();
    
    let proxyProcess = null;
    global.proxyProcess = null; // Para acceso desde handlers
    
    if (socketAvailable) {
      console.log('✅ Socket Unix disponible');
      console.log('⚠️  Prisma CLI no respeta PGHOST, usando Cloud SQL Proxy...');
      
      try {
        // Iniciar Cloud SQL Proxy inmediatamente
        proxyProcess = await startCloudSQLProxy(instanceConnectionName);
        global.proxyProcess = proxyProcess;
        
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
        configureDatabaseURL();
      }
    } else {
      console.log('⚠️  Socket Unix no disponible, usando DATABASE_URL original');
    }
    
    // 4. Validar estado de migraciones antes de ejecutar nuevas
    // Importante: no hacemos rollback ni resolve automático en deploy.
    console.log('🔍 Verificando estado de migraciones...');
    try {
      // Verificar estado de migraciones (capturar stderr también porque Prisma puede escribir errores allí)
      let migrateStatus = '';
      let hasFailedMigrations = false;
      
      try {
        migrateStatus = runPrisma('migrate status', {
          encoding: 'utf8',
          env: process.env,
          cwd: process.cwd(),
          stdio: ['pipe', 'pipe', 'pipe']
        });
      } catch (statusError) {
        // Prisma migrate status puede fallar con código 1 si hay migraciones fallidas
        migrateStatus = statusError.stdout?.toString() || statusError.stderr?.toString() || statusError.message || '';
        hasFailedMigrations = migrateStatus.includes('failed') || 
                             migrateStatus.includes('P3009') ||
                             statusError.message.includes('failed migrations');
      }
      
      // Si hay migraciones fallidas, fallar explícitamente.
      if (hasFailedMigrations || migrateStatus.includes('failed') || migrateStatus.includes('P3009')) {
        console.error('❌ Se detectaron migraciones en estado failed (P3009).');
        console.error('❌ Este deploy no aplica rollback/resolve automático.');
        if (migrateStatus) {
          console.error(migrateStatus);
        }
        process.exit(1);
      } else {
        console.log('✅ No se detectaron migraciones fallidas');
      }
    } catch (statusError) {
      // Si migrate status devuelve error de migración fallida, cortar el deploy.
      const statusMessage = statusError?.stdout?.toString() ||
                            statusError?.stderr?.toString() ||
                            statusError?.message ||
                            String(statusError);
      if (/P3009|failed migrations|failed/i.test(statusMessage)) {
        console.error('❌ Se detectó estado inválido de migraciones. Se cancela deploy sin rollback.');
        console.error(statusMessage);
        process.exit(1);
      }
      // Si es otro tipo de error de status, continuar y dejar que migrate deploy decida.
      console.log('⚠️  No se pudo verificar estado de migraciones, continuando...');
    }
    
    // 5. Ejecutar migraciones con reintentos
    const maxRetries = 5;
    const retryDelay = 10000;
    let attempt = 1;
    
    while (attempt <= maxRetries) {
      console.log(`\n🔄 Intento ${attempt} de ${maxRetries}...`);
      
      try {
        // Ejecutar prisma migrate deploy
        runPrisma('migrate deploy', {
          stdio: 'inherit',
          env: process.env,
          cwd: process.cwd()
        });

        // Verificación final: debe quedar sin pendientes
        const finalStatus = runPrisma('migrate status', {
          encoding: 'utf8',
          env: process.env,
          cwd: process.cwd(),
          stdio: ['pipe', 'pipe', 'pipe']
        });
        if (/following migration\(s\) have not yet been applied|failed migrations/i.test(finalStatus)) {
          console.error('❌ migrate deploy finalizó pero el estado no quedó consistente.');
          console.error(finalStatus);
          process.exit(1);
        }

        console.log('✅ Migraciones ejecutadas y verificadas exitosamente');
        process.exit(0);
        
      } catch (error) {
        const errorMessage = error.message || error.toString();
        const isConnectionError = /P1001|P1013|Can't reach database|ECONNREFUSED|connection.*refused|timeout|empty host/i.test(errorMessage);
        
        // Si es error relacionado con conexión, usar Cloud SQL Proxy como último recurso
        if ((/P1001|P1013|Can't reach database|ECONNREFUSED|connection.*refused|timeout/i.test(errorMessage)) && 
            socketAvailable && !proxyProcess && attempt === 1) {
          console.log('⚠️  Prisma CLI no respeta PGHOST, usando Cloud SQL Proxy...');
          
          try {
            // Iniciar Cloud SQL Proxy
            proxyProcess = await startCloudSQLProxy(instanceConnectionName);
            global.proxyProcess = proxyProcess; // Guardar globalmente
            
            // Esperar a que el proxy esté listo
            await waitForPostgreSQL('127.0.0.1', 5432, 30000);
            
            // Configurar DATABASE_URL para usar TCP a través del proxy
            const originalUrl = process.env.ORIGINAL_DATABASE_URL || process.env.DATABASE_URL;
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
              
              console.log('✅ Cloud SQL Proxy activo, usando TCP localhost:5432');
              
              // Reintentar inmediatamente con el proxy (sin incrementar attempt)
              attempt = 0; // Resetear para que siga en intento 1 pero con proxy
              continue;
            }
          } catch (proxyError) {
            console.error('❌ Error con Cloud SQL Proxy:', proxyError.message);
            // Continuar con el ciclo de reintentos normal
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
    
    // Limpiar proxy si existe
    if (proxyProcess && !proxyProcess.killed) {
      console.log('🧹 Cerrando Cloud SQL Proxy...');
      proxyProcess.kill();
    }
    
    process.exit(1);
  }
}

// Manejar señales de terminación para limpiar el proxy
process.on('SIGTERM', () => {
  if (global.proxyProcess && !global.proxyProcess.killed) {
    global.proxyProcess.kill();
  }
  process.exit(0);
});

process.on('SIGINT', () => {
  if (global.proxyProcess && !global.proxyProcess.killed) {
    global.proxyProcess.kill();
  }
  process.exit(0);
});

main();
