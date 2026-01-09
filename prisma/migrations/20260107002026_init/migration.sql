-- CreateEnum: UserType (si no existe)
DO $$ BEGIN
    CREATE TYPE "UserType" AS ENUM ('POSTULANTE', 'EMPRESA', 'ADMIN');
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

-- CreateEnum: ModerationStatus (si no existe)
DO $$ BEGIN
    CREATE TYPE "ModerationStatus" AS ENUM ('PENDING_PAYMENT', 'PENDING', 'APPROVED', 'REJECTED', 'AUTO_REJECTED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- CreateEnum: CallType (si no existe)
DO $$ BEGIN
    CREATE TYPE "CallType" AS ENUM ('VOICE', 'VIDEO');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- CreateEnum: CallStatus (si no existe)
DO $$ BEGIN
    CREATE TYPE "CallStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'MISSED', 'ENDED', 'CANCELLED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- CreateEnum: VideoMeetingStatus (si no existe)
DO $$ BEGIN
    CREATE TYPE "VideoMeetingStatus" AS ENUM ('SCHEDULED', 'ACCEPTED', 'REJECTED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'MISSED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- CreateEnum: SubscriptionPlan (si no existe)
DO $$ BEGIN
    CREATE TYPE "SubscriptionPlan" AS ENUM ('BASIC', 'PREMIUM', 'ENTERPRISE');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- CreateEnum: SubscriptionStatus (si no existe)
DO $$ BEGIN
    CREATE TYPE "SubscriptionStatus" AS ENUM ('ACTIVE', 'CANCELED', 'EXPIRED', 'PENDING');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- CreateEnum: TermsType (si no existe)
DO $$ BEGIN
    CREATE TYPE "TermsType" AS ENUM ('POSTULANTE', 'EMPRESA', 'PRIVACY');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- CreateEnum: MediaAssetType (si no existe)
DO $$ BEGIN
    CREATE TYPE "MediaAssetType" AS ENUM ('CV', 'AVATAR', 'VIDEO', 'LOGO');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- CreateEnum: MediaAssetStatus (si no existe)
DO $$ BEGIN
    CREATE TYPE "MediaAssetStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- CreateTable: User
CREATE TABLE IF NOT EXISTS "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "userType" "UserType" NOT NULL,
    "googleId" TEXT,
    "appleId" TEXT,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "language" TEXT NOT NULL DEFAULT 'es',
    "resetToken" TEXT,
    "resetTokenExpiry" TIMESTAMP(3),
    "verificationToken" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable: RefreshToken
CREATE TABLE IF NOT EXISTS "RefreshToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "RefreshToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable: PostulanteProfile
CREATE TABLE IF NOT EXISTS "PostulanteProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "city" TEXT,
    "country" TEXT,
    "skills" TEXT[],
    "profilePicture" TEXT,
    "cvUrl" TEXT,
    "videoUrl" TEXT,
    "notificationPreferences" JSONB,
    "birthDate" TIMESTAMP(3),
    "gender" TEXT,
    "nationality" TEXT,
    "maritalStatus" TEXT,
    "documentType" TEXT,
    "documentNumber" TEXT,
    "hasOwnVehicle" BOOLEAN NOT NULL DEFAULT false,
    "hasDriverLicense" BOOLEAN NOT NULL DEFAULT false,
    "phone" TEXT,
    "alternatePhone" TEXT,
    "address" TEXT,
    "calle" TEXT,
    "numero" TEXT,
    "piso" TEXT,
    "depto" TEXT,
    "province" TEXT,
    "postalCode" TEXT,
    "searchingFirstJob" BOOLEAN NOT NULL DEFAULT false,
    "resumeTitle" TEXT,
    "professionalDescription" TEXT,
    "employmentStatus" TEXT,
    "minimumSalary" DOUBLE PRECISION,
    "coverLetter" TEXT,
    "additionalInformation" TEXT,
    "linkedInUrl" TEXT,
    "portfolioUrl" TEXT,
    "websiteUrl" TEXT,
    "githubUrl" TEXT,
    "languages" JSONB,
    "normalizedSkills" TEXT[],

    CONSTRAINT "PostulanteProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable: Experience
CREATE TABLE IF NOT EXISTS "Experience" (
    "id" TEXT NOT NULL,
    "postulanteId" TEXT NOT NULL,
    "position" TEXT NOT NULL,
    "company" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "isCurrent" BOOLEAN NOT NULL DEFAULT false,
    "experienceLevel" "ExperienceLevel",
    "companyCountry" TEXT,
    "jobArea" TEXT,
    "companyActivity" TEXT,
    "description" TEXT,
    "peopleInCharge" TEXT,

    CONSTRAINT "Experience_pkey" PRIMARY KEY ("id")
);

-- CreateTable: Education
CREATE TABLE IF NOT EXISTS "Education" (
    "id" TEXT NOT NULL,
    "postulanteId" TEXT NOT NULL,
    "degree" TEXT NOT NULL,
    "institution" TEXT NOT NULL,
    "country" TEXT,
    "studyArea" TEXT,
    "studyType" TEXT,
    "status" TEXT,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "isCurrent" BOOLEAN NOT NULL DEFAULT false,
    "description" TEXT,
    "gpa" DOUBLE PRECISION,
    "honors" TEXT,

    CONSTRAINT "Education_pkey" PRIMARY KEY ("id")
);

-- CreateTable: Certification
CREATE TABLE IF NOT EXISTS "Certification" (
    "id" TEXT NOT NULL,
    "postulanteId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "issuer" TEXT NOT NULL,
    "issueDate" TIMESTAMP(3) NOT NULL,
    "expirationDate" TIMESTAMP(3),
    "credentialId" TEXT,
    "credentialUrl" TEXT,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Certification_pkey" PRIMARY KEY ("id")
);

-- CreateTable: EmpresaProfile
CREATE TABLE IF NOT EXISTS "EmpresaProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "razonSocial" TEXT,
    "cuit" TEXT NOT NULL,
    "documento" TEXT,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "sitioWeb" TEXT,
    "descripcion" TEXT,
    "sector" TEXT,
    "industria" TEXT,
    "tamano" TEXT,
    "cantidadEmpleados" TEXT,
    "condicionFiscal" TEXT,
    "contribuyenteIngresosBrutos" BOOLEAN NOT NULL DEFAULT false,
    "calle" TEXT,
    "numero" TEXT,
    "piso" TEXT,
    "depto" TEXT,
    "codigoPostal" TEXT,
    "localidad" TEXT,
    "ciudad" TEXT,
    "provincia" TEXT,
    "pais" TEXT,
    "nombreContacto" TEXT,
    "apellidoContacto" TEXT,
    "encabezadosAvisos" TEXT[],
    "beneficiosEmpresa" TEXT[],
    "logo" TEXT,

    CONSTRAINT "EmpresaProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable: Job
CREATE TABLE IF NOT EXISTS "Job" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "requirements" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "city" TEXT,
    "state" TEXT,
    "jobType" "JobType" NOT NULL,
    "workMode" TEXT,
    "category" TEXT NOT NULL,
    "experienceLevel" "ExperienceLevel" NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isPaid" BOOLEAN NOT NULL DEFAULT false,
    "paymentOrderId" TEXT,
    "paymentAmount" DOUBLE PRECISION,
    "paymentCurrency" TEXT DEFAULT 'USD',
    "paymentStatus" TEXT,
    "paidAt" TIMESTAMP(3),
    "moderationStatus" "ModerationStatus" NOT NULL DEFAULT 'PENDING',
    "moderationReason" TEXT,
    "moderatedBy" TEXT,
    "moderatedAt" TIMESTAMP(3),
    "autoRejectionReason" TEXT,

    CONSTRAINT "Job_pkey" PRIMARY KEY ("id")
);

-- CreateTable: Application
CREATE TABLE IF NOT EXISTS "Application" (
    "id" TEXT NOT NULL,
    "postulanteId" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "status" "ApplicationStatus" NOT NULL DEFAULT 'PENDING',
    "appliedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "coverLetter" TEXT,
    "isRead" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Application_pkey" PRIMARY KEY ("id")
);

-- CreateTable: JobFavorite
CREATE TABLE IF NOT EXISTS "JobFavorite" (
    "id" TEXT NOT NULL,
    "postulanteId" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JobFavorite_pkey" PRIMARY KEY ("id")
);

-- CreateTable: CompanyFavorite
CREATE TABLE IF NOT EXISTS "CompanyFavorite" (
    "id" TEXT NOT NULL,
    "postulanteId" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CompanyFavorite_pkey" PRIMARY KEY ("id")
);

-- CreateTable: Message
CREATE TABLE IF NOT EXISTS "Message" (
    "id" TEXT NOT NULL,
    "fromUserId" TEXT NOT NULL,
    "toUserId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateTable: Call
CREATE TABLE IF NOT EXISTS "Call" (
    "id" TEXT NOT NULL,
    "fromUserId" TEXT NOT NULL,
    "toUserId" TEXT NOT NULL,
    "callType" "CallType" NOT NULL DEFAULT 'VOICE',
    "status" "CallStatus" NOT NULL DEFAULT 'PENDING',
    "startedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "duration" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Call_pkey" PRIMARY KEY ("id")
);

-- CreateTable: VideoMeeting
CREATE TABLE IF NOT EXISTS "VideoMeeting" (
    "id" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "invitedUserId" TEXT NOT NULL,
    "title" TEXT,
    "description" TEXT,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "duration" INTEGER,
    "status" "VideoMeetingStatus" NOT NULL DEFAULT 'SCHEDULED',
    "meetingUrl" TEXT,
    "callId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "startedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),

    CONSTRAINT "VideoMeeting_pkey" PRIMARY KEY ("id")
);

-- CreateTable: Subscription
CREATE TABLE IF NOT EXISTS "Subscription" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "planType" "SubscriptionPlan" NOT NULL DEFAULT 'BASIC',
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'ACTIVE',
    "paypalOrderId" TEXT,
    "paypalSubscriptionId" TEXT,
    "startDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endDate" TIMESTAMP(3),
    "canceledAt" TIMESTAMP(3),
    "cancelReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable: TermsAndConditions
CREATE TABLE IF NOT EXISTS "TermsAndConditions" (
    "id" TEXT NOT NULL,
    "type" "TermsType" NOT NULL,
    "version" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TermsAndConditions_pkey" PRIMARY KEY ("id")
);

-- CreateTable: UserTermsAcceptance
CREATE TABLE IF NOT EXISTS "UserTermsAcceptance" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "termsId" TEXT NOT NULL,
    "acceptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserTermsAcceptance_pkey" PRIMARY KEY ("id")
);

-- CreateTable: MediaAsset
CREATE TABLE IF NOT EXISTS "MediaAsset" (
    "id" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "type" "MediaAssetType" NOT NULL,
    "bucket" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "status" "MediaAssetStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MediaAsset_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX IF NOT EXISTS "User_googleId_key" ON "User"("googleId");
CREATE UNIQUE INDEX IF NOT EXISTS "User_appleId_key" ON "User"("appleId");
CREATE UNIQUE INDEX IF NOT EXISTS "User_resetToken_key" ON "User"("resetToken");
CREATE UNIQUE INDEX IF NOT EXISTS "User_verificationToken_key" ON "User"("verificationToken");

CREATE UNIQUE INDEX IF NOT EXISTS "RefreshToken_token_key" ON "RefreshToken"("token");
CREATE INDEX IF NOT EXISTS "RefreshToken_userId_idx" ON "RefreshToken"("userId");

CREATE UNIQUE INDEX IF NOT EXISTS "PostulanteProfile_userId_key" ON "PostulanteProfile"("userId");

CREATE INDEX IF NOT EXISTS "Certification_postulanteId_idx" ON "Certification"("postulanteId");

CREATE UNIQUE INDEX IF NOT EXISTS "EmpresaProfile_userId_key" ON "EmpresaProfile"("userId");
CREATE UNIQUE INDEX IF NOT EXISTS "EmpresaProfile_cuit_key" ON "EmpresaProfile"("cuit");

CREATE UNIQUE INDEX IF NOT EXISTS "Application_postulanteId_jobId_key" ON "Application"("postulanteId", "jobId");

CREATE UNIQUE INDEX IF NOT EXISTS "JobFavorite_postulanteId_jobId_key" ON "JobFavorite"("postulanteId", "jobId");
CREATE INDEX IF NOT EXISTS "JobFavorite_postulanteId_idx" ON "JobFavorite"("postulanteId");
CREATE INDEX IF NOT EXISTS "JobFavorite_jobId_idx" ON "JobFavorite"("jobId");

CREATE UNIQUE INDEX IF NOT EXISTS "CompanyFavorite_postulanteId_empresaId_key" ON "CompanyFavorite"("postulanteId", "empresaId");
CREATE INDEX IF NOT EXISTS "CompanyFavorite_postulanteId_idx" ON "CompanyFavorite"("postulanteId");
CREATE INDEX IF NOT EXISTS "CompanyFavorite_empresaId_idx" ON "CompanyFavorite"("empresaId");

CREATE INDEX IF NOT EXISTS "Call_fromUserId_idx" ON "Call"("fromUserId");
CREATE INDEX IF NOT EXISTS "Call_toUserId_idx" ON "Call"("toUserId");

CREATE INDEX IF NOT EXISTS "VideoMeeting_createdById_idx" ON "VideoMeeting"("createdById");
CREATE INDEX IF NOT EXISTS "VideoMeeting_invitedUserId_idx" ON "VideoMeeting"("invitedUserId");
CREATE INDEX IF NOT EXISTS "VideoMeeting_scheduledAt_idx" ON "VideoMeeting"("scheduledAt");
CREATE INDEX IF NOT EXISTS "VideoMeeting_status_idx" ON "VideoMeeting"("status");

CREATE UNIQUE INDEX IF NOT EXISTS "Subscription_empresaId_status_key" ON "Subscription"("empresaId", "status");
CREATE INDEX IF NOT EXISTS "Subscription_empresaId_idx" ON "Subscription"("empresaId");
CREATE INDEX IF NOT EXISTS "Subscription_status_idx" ON "Subscription"("status");

CREATE UNIQUE INDEX IF NOT EXISTS "TermsAndConditions_type_version_key" ON "TermsAndConditions"("type", "version");
CREATE INDEX IF NOT EXISTS "TermsAndConditions_type_isActive_idx" ON "TermsAndConditions"("type", "isActive");

CREATE UNIQUE INDEX IF NOT EXISTS "UserTermsAcceptance_userId_termsId_key" ON "UserTermsAcceptance"("userId", "termsId");
CREATE INDEX IF NOT EXISTS "UserTermsAcceptance_userId_idx" ON "UserTermsAcceptance"("userId");
CREATE INDEX IF NOT EXISTS "UserTermsAcceptance_termsId_idx" ON "UserTermsAcceptance"("termsId");

CREATE UNIQUE INDEX IF NOT EXISTS "MediaAsset_key_key" ON "MediaAsset"("key");
CREATE INDEX IF NOT EXISTS "MediaAsset_ownerUserId_idx" ON "MediaAsset"("ownerUserId");
CREATE INDEX IF NOT EXISTS "MediaAsset_type_idx" ON "MediaAsset"("type");
CREATE INDEX IF NOT EXISTS "MediaAsset_status_idx" ON "MediaAsset"("status");
CREATE INDEX IF NOT EXISTS "MediaAsset_key_idx" ON "MediaAsset"("key");

-- AddForeignKey (verificar si ya existen)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'RefreshToken_userId_fkey'
    ) THEN
        ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_userId_fkey" 
            FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'PostulanteProfile_userId_fkey'
    ) THEN
        ALTER TABLE "PostulanteProfile" ADD CONSTRAINT "PostulanteProfile_userId_fkey" 
            FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'Experience_postulanteId_fkey'
    ) THEN
        ALTER TABLE "Experience" ADD CONSTRAINT "Experience_postulanteId_fkey" 
            FOREIGN KEY ("postulanteId") REFERENCES "PostulanteProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'Education_postulanteId_fkey'
    ) THEN
        ALTER TABLE "Education" ADD CONSTRAINT "Education_postulanteId_fkey" 
            FOREIGN KEY ("postulanteId") REFERENCES "PostulanteProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'Certification_postulanteId_fkey'
    ) THEN
        ALTER TABLE "Certification" ADD CONSTRAINT "Certification_postulanteId_fkey" 
            FOREIGN KEY ("postulanteId") REFERENCES "PostulanteProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'EmpresaProfile_userId_fkey'
    ) THEN
        ALTER TABLE "EmpresaProfile" ADD CONSTRAINT "EmpresaProfile_userId_fkey" 
            FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'Job_empresaId_fkey'
    ) THEN
        ALTER TABLE "Job" ADD CONSTRAINT "Job_empresaId_fkey" 
            FOREIGN KEY ("empresaId") REFERENCES "EmpresaProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'Application_postulanteId_fkey'
    ) THEN
        ALTER TABLE "Application" ADD CONSTRAINT "Application_postulanteId_fkey" 
            FOREIGN KEY ("postulanteId") REFERENCES "PostulanteProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'Application_jobId_fkey'
    ) THEN
        ALTER TABLE "Application" ADD CONSTRAINT "Application_jobId_fkey" 
            FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'JobFavorite_postulanteId_fkey'
    ) THEN
        ALTER TABLE "JobFavorite" ADD CONSTRAINT "JobFavorite_postulanteId_fkey" 
            FOREIGN KEY ("postulanteId") REFERENCES "PostulanteProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'JobFavorite_jobId_fkey'
    ) THEN
        ALTER TABLE "JobFavorite" ADD CONSTRAINT "JobFavorite_jobId_fkey" 
            FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'CompanyFavorite_postulanteId_fkey'
    ) THEN
        ALTER TABLE "CompanyFavorite" ADD CONSTRAINT "CompanyFavorite_postulanteId_fkey" 
            FOREIGN KEY ("postulanteId") REFERENCES "PostulanteProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'CompanyFavorite_empresaId_fkey'
    ) THEN
        ALTER TABLE "CompanyFavorite" ADD CONSTRAINT "CompanyFavorite_empresaId_fkey" 
            FOREIGN KEY ("empresaId") REFERENCES "EmpresaProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'Message_fromUserId_fkey'
    ) THEN
        ALTER TABLE "Message" ADD CONSTRAINT "Message_fromUserId_fkey" 
            FOREIGN KEY ("fromUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'Message_toUserId_fkey'
    ) THEN
        ALTER TABLE "Message" ADD CONSTRAINT "Message_toUserId_fkey" 
            FOREIGN KEY ("toUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'Call_fromUserId_fkey'
    ) THEN
        ALTER TABLE "Call" ADD CONSTRAINT "Call_fromUserId_fkey" 
            FOREIGN KEY ("fromUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'Call_toUserId_fkey'
    ) THEN
        ALTER TABLE "Call" ADD CONSTRAINT "Call_toUserId_fkey" 
            FOREIGN KEY ("toUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'VideoMeeting_createdById_fkey'
    ) THEN
        ALTER TABLE "VideoMeeting" ADD CONSTRAINT "VideoMeeting_createdById_fkey" 
            FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'VideoMeeting_invitedUserId_fkey'
    ) THEN
        ALTER TABLE "VideoMeeting" ADD CONSTRAINT "VideoMeeting_invitedUserId_fkey" 
            FOREIGN KEY ("invitedUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'Subscription_empresaId_fkey'
    ) THEN
        ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_empresaId_fkey" 
            FOREIGN KEY ("empresaId") REFERENCES "EmpresaProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'UserTermsAcceptance_userId_fkey'
    ) THEN
        ALTER TABLE "UserTermsAcceptance" ADD CONSTRAINT "UserTermsAcceptance_userId_fkey" 
            FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'UserTermsAcceptance_termsId_fkey'
    ) THEN
        ALTER TABLE "UserTermsAcceptance" ADD CONSTRAINT "UserTermsAcceptance_termsId_fkey" 
            FOREIGN KEY ("termsId") REFERENCES "TermsAndConditions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'MediaAsset_ownerUserId_fkey'
    ) THEN
        ALTER TABLE "MediaAsset" ADD CONSTRAINT "MediaAsset_ownerUserId_fkey" 
            FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;





