/*
  Warnings:

  - You are about to drop the column `endYear` on the `Education` table. All the data in the column will be lost.
  - You are about to drop the column `startYear` on the `Education` table. All the data in the column will be lost.
  - You are about to drop the column `location` on the `EmpresaProfile` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[postulanteId,jobId]` on the table `Application` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[resetToken]` on the table `User` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[verificationToken]` on the table `User` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `startDate` to the `Education` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "ModerationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'AUTO_REJECTED');

-- CreateEnum
CREATE TYPE "CallStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'MISSED', 'ENDED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "SubscriptionPlan" AS ENUM ('BASIC', 'PREMIUM', 'ENTERPRISE');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('ACTIVE', 'CANCELED', 'EXPIRED', 'PENDING');

-- CreateEnum
CREATE TYPE "TermsType" AS ENUM ('POSTULANTE', 'EMPRESA', 'PRIVACY');

-- AlterEnum
ALTER TYPE "UserType" ADD VALUE 'ADMIN';

-- AlterTable
ALTER TABLE "Application" ADD COLUMN     "coverLetter" TEXT,
ADD COLUMN     "isRead" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Education" DROP COLUMN "endYear",
DROP COLUMN "startYear",
ADD COLUMN     "country" TEXT,
ADD COLUMN     "description" TEXT,
ADD COLUMN     "endDate" TIMESTAMP(3),
ADD COLUMN     "gpa" DOUBLE PRECISION,
ADD COLUMN     "honors" TEXT,
ADD COLUMN     "isCurrent" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "startDate" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "status" TEXT,
ADD COLUMN     "studyArea" TEXT,
ADD COLUMN     "studyType" TEXT;

-- AlterTable
ALTER TABLE "EmpresaProfile" DROP COLUMN "location",
ADD COLUMN     "apellidoContacto" TEXT,
ADD COLUMN     "beneficiosEmpresa" TEXT[],
ADD COLUMN     "calle" TEXT,
ADD COLUMN     "cantidadEmpleados" TEXT,
ADD COLUMN     "ciudad" TEXT,
ADD COLUMN     "codigoPostal" TEXT,
ADD COLUMN     "condicionFiscal" TEXT,
ADD COLUMN     "contribuyenteIngresosBrutos" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "depto" TEXT,
ADD COLUMN     "descripcion" TEXT,
ADD COLUMN     "documento" TEXT,
ADD COLUMN     "encabezadosAvisos" TEXT[],
ADD COLUMN     "industria" TEXT,
ADD COLUMN     "localidad" TEXT,
ADD COLUMN     "logo" TEXT,
ADD COLUMN     "nombreContacto" TEXT,
ADD COLUMN     "numero" TEXT,
ADD COLUMN     "pais" TEXT,
ADD COLUMN     "phone" TEXT,
ADD COLUMN     "piso" TEXT,
ADD COLUMN     "provincia" TEXT,
ADD COLUMN     "razonSocial" TEXT,
ADD COLUMN     "sector" TEXT,
ADD COLUMN     "sitioWeb" TEXT,
ADD COLUMN     "tamano" TEXT;

-- AlterTable
ALTER TABLE "Experience" ADD COLUMN     "companyActivity" TEXT,
ADD COLUMN     "companyCountry" TEXT,
ADD COLUMN     "description" TEXT,
ADD COLUMN     "experienceLevel" "ExperienceLevel",
ADD COLUMN     "isCurrent" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "jobArea" TEXT,
ADD COLUMN     "peopleInCharge" TEXT;

-- AlterTable
ALTER TABLE "Job" ADD COLUMN     "autoRejectionReason" TEXT,
ADD COLUMN     "city" TEXT,
ADD COLUMN     "moderatedAt" TIMESTAMP(3),
ADD COLUMN     "moderatedBy" TEXT,
ADD COLUMN     "moderationReason" TEXT,
ADD COLUMN     "moderationStatus" "ModerationStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "state" TEXT,
ADD COLUMN     "workMode" TEXT;

-- AlterTable
ALTER TABLE "PostulanteProfile" ADD COLUMN     "additionalInformation" TEXT,
ADD COLUMN     "address" TEXT,
ADD COLUMN     "alternatePhone" TEXT,
ADD COLUMN     "birthDate" TIMESTAMP(3),
ADD COLUMN     "calle" TEXT,
ADD COLUMN     "coverLetter" TEXT,
ADD COLUMN     "cvUrl" TEXT,
ADD COLUMN     "depto" TEXT,
ADD COLUMN     "documentNumber" TEXT,
ADD COLUMN     "documentType" TEXT,
ADD COLUMN     "employmentStatus" TEXT,
ADD COLUMN     "gender" TEXT,
ADD COLUMN     "githubUrl" TEXT,
ADD COLUMN     "hasDriverLicense" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "hasOwnVehicle" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "languages" JSONB,
ADD COLUMN     "linkedInUrl" TEXT,
ADD COLUMN     "maritalStatus" TEXT,
ADD COLUMN     "minimumSalary" DOUBLE PRECISION,
ADD COLUMN     "nationality" TEXT,
ADD COLUMN     "normalizedSkills" TEXT[],
ADD COLUMN     "notificationPreferences" JSONB,
ADD COLUMN     "numero" TEXT,
ADD COLUMN     "phone" TEXT,
ADD COLUMN     "piso" TEXT,
ADD COLUMN     "portfolioUrl" TEXT,
ADD COLUMN     "postalCode" TEXT,
ADD COLUMN     "professionalDescription" TEXT,
ADD COLUMN     "province" TEXT,
ADD COLUMN     "resumeTitle" TEXT,
ADD COLUMN     "searchingFirstJob" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "videoUrl" TEXT,
ADD COLUMN     "websiteUrl" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "resetToken" TEXT,
ADD COLUMN     "resetTokenExpiry" TIMESTAMP(3),
ADD COLUMN     "verificationToken" TEXT;

-- CreateTable
CREATE TABLE "Certification" (
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

-- CreateTable
CREATE TABLE "JobFavorite" (
    "id" TEXT NOT NULL,
    "postulanteId" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JobFavorite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompanyFavorite" (
    "id" TEXT NOT NULL,
    "postulanteId" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CompanyFavorite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL,
    "fromUserId" TEXT NOT NULL,
    "toUserId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Call" (
    "id" TEXT NOT NULL,
    "fromUserId" TEXT NOT NULL,
    "toUserId" TEXT NOT NULL,
    "status" "CallStatus" NOT NULL DEFAULT 'PENDING',
    "startedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "duration" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Call_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subscription" (
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

-- CreateTable
CREATE TABLE "TermsAndConditions" (
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

-- CreateTable
CREATE TABLE "UserTermsAcceptance" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "termsId" TEXT NOT NULL,
    "acceptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserTermsAcceptance_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Certification_postulanteId_idx" ON "Certification"("postulanteId");

-- CreateIndex
CREATE INDEX "JobFavorite_postulanteId_idx" ON "JobFavorite"("postulanteId");

-- CreateIndex
CREATE INDEX "JobFavorite_jobId_idx" ON "JobFavorite"("jobId");

-- CreateIndex
CREATE UNIQUE INDEX "JobFavorite_postulanteId_jobId_key" ON "JobFavorite"("postulanteId", "jobId");

-- CreateIndex
CREATE INDEX "CompanyFavorite_postulanteId_idx" ON "CompanyFavorite"("postulanteId");

-- CreateIndex
CREATE INDEX "CompanyFavorite_empresaId_idx" ON "CompanyFavorite"("empresaId");

-- CreateIndex
CREATE UNIQUE INDEX "CompanyFavorite_postulanteId_empresaId_key" ON "CompanyFavorite"("postulanteId", "empresaId");

-- CreateIndex
CREATE INDEX "Call_fromUserId_idx" ON "Call"("fromUserId");

-- CreateIndex
CREATE INDEX "Call_toUserId_idx" ON "Call"("toUserId");

-- CreateIndex
CREATE INDEX "Subscription_empresaId_idx" ON "Subscription"("empresaId");

-- CreateIndex
CREATE INDEX "Subscription_status_idx" ON "Subscription"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_empresaId_status_key" ON "Subscription"("empresaId", "status");

-- CreateIndex
CREATE INDEX "TermsAndConditions_type_isActive_idx" ON "TermsAndConditions"("type", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "TermsAndConditions_type_version_key" ON "TermsAndConditions"("type", "version");

-- CreateIndex
CREATE INDEX "UserTermsAcceptance_userId_idx" ON "UserTermsAcceptance"("userId");

-- CreateIndex
CREATE INDEX "UserTermsAcceptance_termsId_idx" ON "UserTermsAcceptance"("termsId");

-- CreateIndex
CREATE UNIQUE INDEX "UserTermsAcceptance_userId_termsId_key" ON "UserTermsAcceptance"("userId", "termsId");

-- CreateIndex
CREATE UNIQUE INDEX "Application_postulanteId_jobId_key" ON "Application"("postulanteId", "jobId");

-- CreateIndex
CREATE UNIQUE INDEX "User_resetToken_key" ON "User"("resetToken");

-- CreateIndex
CREATE UNIQUE INDEX "User_verificationToken_key" ON "User"("verificationToken");

-- AddForeignKey
ALTER TABLE "Certification" ADD CONSTRAINT "Certification_postulanteId_fkey" FOREIGN KEY ("postulanteId") REFERENCES "PostulanteProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobFavorite" ADD CONSTRAINT "JobFavorite_postulanteId_fkey" FOREIGN KEY ("postulanteId") REFERENCES "PostulanteProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobFavorite" ADD CONSTRAINT "JobFavorite_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyFavorite" ADD CONSTRAINT "CompanyFavorite_postulanteId_fkey" FOREIGN KEY ("postulanteId") REFERENCES "PostulanteProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyFavorite" ADD CONSTRAINT "CompanyFavorite_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "EmpresaProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_fromUserId_fkey" FOREIGN KEY ("fromUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_toUserId_fkey" FOREIGN KEY ("toUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Call" ADD CONSTRAINT "Call_fromUserId_fkey" FOREIGN KEY ("fromUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Call" ADD CONSTRAINT "Call_toUserId_fkey" FOREIGN KEY ("toUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "EmpresaProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserTermsAcceptance" ADD CONSTRAINT "UserTermsAcceptance_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserTermsAcceptance" ADD CONSTRAINT "UserTermsAcceptance_termsId_fkey" FOREIGN KEY ("termsId") REFERENCES "TermsAndConditions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
