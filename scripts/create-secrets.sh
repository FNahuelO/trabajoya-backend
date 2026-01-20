#!/bin/bash
# Script para crear secretos individuales en Google Secret Manager
# Este script lee el secreto actual 'trabajoya-secrets' y crea secretos individuales

PROJECT_ID="trabajo-ya-483316"
SECRET_NAME="trabajoya-secrets"

echo "🔐 Creando secretos individuales en Secret Manager..."
echo "📋 Proyecto: $PROJECT_ID"
echo "📋 Secreto fuente: $SECRET_NAME"
echo ""

# Obtener el secreto actual
echo "📦 Obteniendo secreto '$SECRET_NAME' desde Secret Manager..."
SECRET_CONTENT=$(gcloud secrets versions access latest --secret="$SECRET_NAME" --project="$PROJECT_ID" 2>/dev/null)

if [ $? -ne 0 ]; then
  echo "❌ Error: No se pudo acceder al secreto '$SECRET_NAME'"
  echo "💡 Verifica que:"
  echo "   1. El secreto existe: gcloud secrets list --project=$PROJECT_ID"
  echo "   2. Tienes permisos: roles/secretmanager.secretAccessor"
  exit 1
fi

if [ -z "$SECRET_CONTENT" ]; then
  echo "❌ Error: El secreto está vacío"
  exit 1
fi

echo "✅ Secreto obtenido (${#SECRET_CONTENT} caracteres)"
echo "🔍 Parseando variables..."
echo ""

# Guardar contenido en archivo temporal para procesar con Node.js
TEMP_FILE=$(mktemp)
echo "$SECRET_CONTENT" > "$TEMP_FILE"

# Usar Node.js para parsear correctamente (maneja valores complejos mejor que bash)
node <<NODE_SCRIPT
const fs = require('fs');
const content = fs.readFileSync('$TEMP_FILE', 'utf-8');
const lines = content.split('\n');
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
  
  // Reemplazar \\n con saltos de línea reales
  value = value.replace(/\\\\n/g, '\n');
  
  variables[key] = value;
}

// Escribir cada variable en un archivo temporal separado
const output = [];
for (const [key, value] of Object.entries(variables)) {
  const filePath = \`/tmp/secret_\${key}.txt\`;
  fs.writeFileSync(filePath, value, 'utf-8');
  output.push({key, filePath, length: value.length});
}

// Escribir lista de variables encontradas
fs.writeFileSync('/tmp/secret_vars.json', JSON.stringify(output, null, 2));
console.log(\`✅ Parseadas \${output.length} variables:\`);
output.forEach(v => console.log(\`  - \${v.key} (\${v.length} caracteres)\`));
NODE_SCRIPT

if [ $? -ne 0 ]; then
  echo "❌ Error al parsear el secreto"
  rm -f "$TEMP_FILE"
  exit 1
fi

# Leer lista de variables parseadas
VARS_LIST=$(cat /tmp/secret_vars.json)
rm -f "$TEMP_FILE"

# Crear cada secreto individual
echo ""
echo "📝 Creando secretos individuales en Secret Manager..."
echo ""

# Parsear JSON y crear secretos
node <<NODE_SCRIPT
const fs = require('fs');
const varsList = JSON.parse(fs.readFileSync('/tmp/secret_vars.json', 'utf-8'));

for (const {key, filePath, length} of varsList) {
  console.log(\`\${key}\`); // Solo imprimir el nombre para el loop de bash
}
NODE_SCRIPT | while read -r SECRET_VAR; do
  SECRET_FILE="/tmp/secret_${SECRET_VAR}.txt"
  
  if [ ! -f "$SECRET_FILE" ]; then
    echo "⚠️  Archivo no encontrado para $SECRET_VAR"
    continue
  fi
  
  echo "🔍 Procesando: $SECRET_VAR"
  
  # Crear el secreto si no existe
  echo "  📦 Creando secreto en Secret Manager..."
  gcloud secrets create "$SECRET_VAR" \
    --project="$PROJECT_ID" \
    --replication-policy="automatic" \
    2>/dev/null
  
  if [ $? -eq 0 ]; then
    echo "  ✅ Secreto $SECRET_VAR creado"
  else
    echo "  ℹ️  Secreto $SECRET_VAR ya existe, agregando nueva versión..."
  fi
  
  # Agregar nueva versión del secreto
  gcloud secrets versions add "$SECRET_VAR" \
    --project="$PROJECT_ID" \
    --data-file="$SECRET_FILE" \
    >/dev/null 2>&1
  
  if [ $? -eq 0 ]; then
    echo "  ✅ Versión agregada a $SECRET_VAR"
  else
    echo "  ❌ Error al agregar versión a $SECRET_VAR"
  fi
  
  # Limpiar archivo temporal
  rm -f "$SECRET_FILE"
  echo ""
done

# Limpiar archivos temporales
rm -f /tmp/secret_vars.json

echo "✅ Proceso completado!"
echo ""
echo "📋 Para verificar los secretos creados:"
echo "   gcloud secrets list --project=$PROJECT_ID"
echo ""
echo "💡 Asegúrate de otorgar permisos a Cloud Run para acceder a estos secretos"

