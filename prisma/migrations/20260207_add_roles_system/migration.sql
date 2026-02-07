-- CreateTable: Roles del backoffice
CREATE TABLE "Role" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "description" TEXT,
    "permissions" TEXT[],
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Role_name_key" ON "Role"("name");

-- AlterTable: Agregar roleId a User
ALTER TABLE "User" ADD COLUMN "roleId" TEXT;

-- CreateIndex
CREATE INDEX "User_roleId_idx" ON "User"("roleId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Seed: Crear roles del sistema por defecto
INSERT INTO "Role" ("id", "name", "displayName", "description", "permissions", "isSystem", "createdAt", "updatedAt") VALUES
  (gen_random_uuid(), 'SUPER_ADMIN', 'Super Administrador', 'Acceso total al sistema', ARRAY['users:read','users:write','users:delete','jobs:read','jobs:write','jobs:delete','empresas:read','empresas:write','postulantes:read','postulantes:write','applications:read','applications:write','payments:read','payments:write','plans:read','plans:write','catalogs:read','catalogs:write','terms:read','terms:write','reports:read','reports:write','promotions:read','promotions:write','subscriptions:read','subscriptions:write','messages:read','calls:read','video-meetings:read','entitlements:read','entitlements:write','iap-products:read','iap-products:write','roles:read','roles:write','internal-users:read','internal-users:write','internal-users:delete','moderation:read','moderation:write'], true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'MODERADOR', 'Moderador', 'Puede moderar contenido y gestionar denuncias', ARRAY['jobs:read','jobs:write','reports:read','reports:write','moderation:read','moderation:write','users:read','empresas:read','postulantes:read','applications:read','messages:read'], true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'SOPORTE', 'Soporte', 'Acceso de lectura general y gestión de usuarios', ARRAY['users:read','users:write','jobs:read','empresas:read','empresas:write','postulantes:read','postulantes:write','applications:read','payments:read','subscriptions:read','messages:read','calls:read','video-meetings:read','entitlements:read','reports:read'], true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'VIEWER', 'Solo Lectura', 'Solo puede ver información, sin modificar nada', ARRAY['users:read','jobs:read','empresas:read','postulantes:read','applications:read','payments:read','plans:read','catalogs:read','subscriptions:read','messages:read','calls:read','video-meetings:read','entitlements:read','reports:read','promotions:read'], true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

