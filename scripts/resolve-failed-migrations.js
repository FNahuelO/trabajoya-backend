/**
 * Script para resolver migraciones fallidas de Prisma
 * Versión JavaScript que se puede ejecutar directamente con Node.js
 */

const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function resolveFailedMigrations() {
  try {
    console.log("🔍 Verificando migraciones fallidas...");

    // Consultar la tabla _prisma_migrations para encontrar migraciones fallidas
    const failedMigrations = await prisma.$queryRaw`
      SELECT migration_name, finished_at, applied_steps_count
      FROM "_prisma_migrations"
      WHERE finished_at IS NULL
      ORDER BY started_at DESC;
    `;

    if (failedMigrations.length === 0) {
      console.log("✅ No se encontraron migraciones fallidas.");
      return;
    }

    console.log(
      `⚠️  Se encontraron ${failedMigrations.length} migración(es) fallida(s):`
    );
    failedMigrations.forEach((migration) => {
      console.log(`   - ${migration.migration_name}`);
    });

    // Resolver cada migración fallida
    for (const migration of failedMigrations) {
      console.log(`\n🔧 Resolviendo migración: ${migration.migration_name}`);

      // Si el nombre contiene comandos de shell sin ejecutar (como $(date...)), es una migración inválida
      const hasInvalidName =
        migration.migration_name.includes("$(") ||
        migration.migration_name.includes("date +");

      // Verificar si el cambio ya está aplicado (en este caso, phoneCountryCode)
      const isPhoneCountryCodeMigration =
        migration.migration_name.includes(
          "add_phone_country_code_to_empresa_profile"
        ) || migration.migration_name.includes("phone_country_code");

      if (isPhoneCountryCodeMigration || hasInvalidName) {
        // Verificar si la columna ya existe
        const columnExists = await prisma.$queryRaw`
          SELECT EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_name = 'EmpresaProfile'
            AND column_name = 'phoneCountryCode'
          ) as exists;
        `;

        if (columnExists[0]?.exists) {
          console.log(
            "   ✅ La columna phoneCountryCode ya existe. Marcando migración como aplicada..."
          );
          // Marcar la migración como aplicada
          await prisma.$executeRaw`
            UPDATE "_prisma_migrations"
            SET finished_at = NOW(),
                applied_steps_count = 1
            WHERE migration_name = ${migration.migration_name}
            AND finished_at IS NULL;
          `;
          console.log(
            `   ✅ Migración ${migration.migration_name} marcada como aplicada.`
          );
        } else {
          console.log(
            "   ⚠️  La columna no existe o la migración es inválida. Eliminando del registro..."
          );
          // Eliminar la migración del registro (es inválida o no es necesaria)
          await prisma.$executeRaw`
            DELETE FROM "_prisma_migrations"
            WHERE migration_name = ${migration.migration_name}
            AND finished_at IS NULL;
          `;
          console.log(
            `   ✅ Migración ${migration.migration_name} eliminada del registro.`
          );
        }
      } else {
        // Para otras migraciones fallidas, marcarlas como revertidas por defecto
        console.log(`   ⚠️  Migración desconocida. Eliminando del registro...`);
        await prisma.$executeRaw`
          DELETE FROM "_prisma_migrations"
          WHERE migration_name = ${migration.migration_name}
          AND finished_at IS NULL;
        `;
        console.log(
          `   ✅ Migración ${migration.migration_name} eliminada del registro.`
        );
      }
    }

    console.log("\n✅ Proceso de resolución de migraciones completado.");
  } catch (error) {
    console.error("❌ Error al resolver migraciones fallidas:", error);
    // No lanzar el error para que el despliegue continúe
    console.log("⚠️  Continuando con el despliegue...");
  } finally {
    await prisma.$disconnect();
  }
}

// Ejecutar el script
resolveFailedMigrations()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error("Error fatal al resolver migraciones:", error);
    // No fallar el despliegue, solo registrar el error
    process.exit(0);
  });
