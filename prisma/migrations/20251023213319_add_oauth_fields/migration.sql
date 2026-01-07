-- CreateEnum: UserType (si no existe)
DO $$ BEGIN
    CREATE TYPE "UserType" AS ENUM ('POSTULANTE', 'EMPRESA');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- CreateEnum: ApplicationStatus (si no existe)
DO $$ BEGIN
    CREATE TYPE "ApplicationStatus" AS ENUM ('PENDING', 'REVIEWED', 'ACCEPTED', 'REJECTED', 'INTERVIEW');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- CreateEnum: JobType (si no existe)
DO $$ BEGIN
    CREATE TYPE "JobType" AS ENUM ('TIEMPO_COMPLETO', 'MEDIO_TIEMPO', 'REMOTO', 'HIBRIDO', 'FREELANCE');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- CreateEnum: ExperienceLevel (si no existe)
DO $$ BEGIN
    CREATE TYPE "ExperienceLevel" AS ENUM ('JUNIOR', 'SEMISENIOR', 'SENIOR');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "userType" "UserType" NOT NULL,
    "googleId" TEXT,
    "appleId" TEXT,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "language" TEXT NOT NULL DEFAULT 'es',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "RefreshToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "RefreshToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "PostulanteProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "city" TEXT,
    "country" TEXT,
    "skills" TEXT[],
    "profilePicture" TEXT,

    CONSTRAINT "PostulanteProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Experience" (
    "id" TEXT NOT NULL,
    "postulanteId" TEXT NOT NULL,
    "position" TEXT NOT NULL,
    "company" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),

    CONSTRAINT "Experience_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Education" (
    "id" TEXT NOT NULL,
    "postulanteId" TEXT NOT NULL,
    "degree" TEXT NOT NULL,
    "institution" TEXT NOT NULL,
    "startYear" INTEGER NOT NULL,
    "endYear" INTEGER,

    CONSTRAINT "Education_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "EmpresaProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "cuit" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "location" TEXT,

    CONSTRAINT "EmpresaProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Job" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "requirements" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "jobType" "JobType" NOT NULL,
    "category" TEXT NOT NULL,
    "experienceLevel" "ExperienceLevel" NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Job_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Application" (
    "id" TEXT NOT NULL,
    "postulanteId" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "status" "ApplicationStatus" NOT NULL DEFAULT 'PENDING',
    "appliedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Application_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "User_googleId_key" ON "User"("googleId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "User_appleId_key" ON "User"("appleId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "RefreshToken_token_key" ON "RefreshToken"("token");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "RefreshToken_userId_idx" ON "RefreshToken"("userId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "PostulanteProfile_userId_key" ON "PostulanteProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "EmpresaProfile_userId_key" ON "EmpresaProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "EmpresaProfile_cuit_key" ON "EmpresaProfile"("cuit");

-- AddForeignKey (verificar si ya existen)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'RefreshToken_userId_fkey'
    ) THEN
        ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'PostulanteProfile_userId_fkey'
    ) THEN
        ALTER TABLE "PostulanteProfile" ADD CONSTRAINT "PostulanteProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'Experience_postulanteId_fkey'
    ) THEN
        ALTER TABLE "Experience" ADD CONSTRAINT "Experience_postulanteId_fkey" FOREIGN KEY ("postulanteId") REFERENCES "PostulanteProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'Education_postulanteId_fkey'
    ) THEN
        ALTER TABLE "Education" ADD CONSTRAINT "Education_postulanteId_fkey" FOREIGN KEY ("postulanteId") REFERENCES "PostulanteProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'EmpresaProfile_userId_fkey'
    ) THEN
        ALTER TABLE "EmpresaProfile" ADD CONSTRAINT "EmpresaProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'Job_empresaId_fkey'
    ) THEN
        ALTER TABLE "Job" ADD CONSTRAINT "Job_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "EmpresaProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'Application_postulanteId_fkey'
    ) THEN
        ALTER TABLE "Application" ADD CONSTRAINT "Application_postulanteId_fkey" FOREIGN KEY ("postulanteId") REFERENCES "PostulanteProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'Application_jobId_fkey'
    ) THEN
        ALTER TABLE "Application" ADD CONSTRAINT "Application_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
