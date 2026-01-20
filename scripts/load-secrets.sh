#!/bin/sh
# Script simple para cargar y parsear secretos desde Cloud Run

echo "🔐 [load-secrets.sh] Iniciando carga de secretos..."

# Función para parsear contenido KEY=VALUE y exportar variables
parse_and_export() {
  local content="$1"
  local source="$2"
  
  echo "📦 [load-secrets.sh] Parseando desde: $source"
  
  # Guardar en archivo temporal
  printf "%s\n" "$content" > /tmp/secrets.txt
  
  # Usar Node.js para parsear (más robusto que bash)
  node <<'NODE_SCRIPT'
    const fs = require('fs');
    const content = fs.readFileSync('/tmp/secrets.txt', 'utf-8');
    const lines = content.split('\n');
    const exports = [];
    const variables = {};
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      
      const eqIndex = trimmed.indexOf('=');
      if (eqIndex <= 0) continue;
      
      const key = trimmed.substring(0, eqIndex).trim();
      let value = trimmed.substring(eqIndex + 1);
      
      // Validar clave
      if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue;
      
      // Remover comillas externas
      if ((value.startsWith('"') && value.endsWith('"') && value.length > 1) ||
          (value.startsWith("'") && value.endsWith("'") && value.length > 1)) {
        value = value.slice(1, -1);
      }
      
      // Reemplazar \n con saltos de línea reales
      value = value.replace(/\\n/g, '\n');
      
      variables[key] = value;
    }
    
    // Generar exports
    for (const [key, value] of Object.entries(variables)) {
      const escaped = String(value).replace(/'/g, "'\\''");
      exports.push(`export ${key}='${escaped}'`);
    }
    
    fs.writeFileSync('/tmp/export.sh', exports.join('\n') + '\n');
    console.log(`✅ Parseadas ${Object.keys(variables).length} variables`);
    if (variables.DATABASE_URL) {
      console.log(`✅ DATABASE_URL encontrada (${variables.DATABASE_URL.length} caracteres)`);
    }
NODE_SCRIPT
  
  # Cargar variables exportadas
  if [ -f "/tmp/export.sh" ]; then
    . /tmp/export.sh
    rm -f /tmp/secrets.txt /tmp/export.sh
    echo "✅ [load-secrets.sh] Secretos cargados y exportados correctamente"
    return 0
  else
    rm -f /tmp/secrets.txt
    echo "❌ [load-secrets.sh] Error al generar archivo de exportación"
    return 1
  fi
}

# Intentar cargar desde DATABASE_URL (Cloud Run monta el secreto completo aquí)
if [ -n "$DATABASE_URL" ]; then
  # Verificar si contiene múltiples variables (más de una línea que empiece con KEY=)
  VAR_COUNT=$(printf "%s\n" "$DATABASE_URL" | grep -c "^[A-Z_][A-Z0-9_]*=" || echo "0")
  
  if [ "$VAR_COUNT" -gt 1 ]; then
    echo "✅ [load-secrets.sh] DATABASE_URL contiene $VAR_COUNT variables, parseando..."
    if parse_and_export "$DATABASE_URL" "DATABASE_URL"; then
      exit 0
    fi
  fi
fi

# Intentar cargar desde cualquier otra variable que contenga múltiples KEY=
for var_name in JWT_ACCESS_SECRET GOOGLE_CLIENT_SECRET AWS_ACCESS_KEY_ID; do
  eval var_value="\$$var_name"
  if [ -n "$var_value" ]; then
    VAR_COUNT=$(printf "%s\n" "$var_value" | grep -c "^[A-Z_][A-Z0-9_]*=" || echo "0")
    if [ "$VAR_COUNT" -gt 1 ]; then
      echo "✅ [load-secrets.sh] $var_name contiene $VAR_COUNT variables, parseando..."
      if parse_and_export "$var_value" "$var_name"; then
        exit 0
      fi
    fi
  fi
done

# Intentar cargar desde archivo montado
if [ -f "/etc/secrets/trabajoya-secrets" ]; then
  echo "📦 [load-secrets.sh] Detectado archivo /etc/secrets/trabajoya-secrets, cargando..."
  if parse_and_export "$(cat /etc/secrets/trabajoya-secrets)" "archivo"; then
    exit 0
  fi
fi

# Intentar desde cualquier archivo en /etc/secrets
if [ -d "/etc/secrets" ]; then
  for secret_file in /etc/secrets/*; do
    if [ -f "$secret_file" ] && [ -r "$secret_file" ]; then
      echo "📦 [load-secrets.sh] Detectado archivo $secret_file, cargando..."
      if parse_and_export "$(cat "$secret_file")" "$secret_file"; then
        exit 0
      fi
    fi
  done
fi

echo "⚠️  [load-secrets.sh] No se encontró secreto completo para parsear, usando variables de entorno existentes"

