-- CreateEnum
CREATE TYPE "UserType" AS ENUM ('POSTULANTE', 'EMPRESA', 'ADMIN');

-- CreateEnum
CREATE TYPE "ApplicationStatus" AS ENUM ('PENDING', 'REVIEWED', 'ACCEPTED', 'REJECTED', 'INTERVIEW');

-- CreateEnum
CREATE TYPE "JobType" AS ENUM ('TIEMPO_COMPLETO', 'MEDIO_TIEMPO', 'REMOTO', 'HIBRIDO', 'FREELANCE');

-- CreateEnum
CREATE TYPE "ExperienceLevel" AS ENUM ('JUNIOR', 'SEMISENIOR', 'SENIOR');

-- CreateEnum
CREATE TYPE "ModerationStatus" AS ENUM ('PENDING_PAYMENT', 'PENDING', 'APPROVED', 'REJECTED', 'AUTO_REJECTED');

-- CreateEnum
CREATE TYPE "CallType" AS ENUM ('VOICE', 'VIDEO');

-- CreateEnum
CREATE TYPE "CallStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'MISSED', 'ENDED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "VideoMeetingStatus" AS ENUM ('SCHEDULED', 'ACCEPTED', 'REJECTED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'MISSED');

-- CreateEnum
CREATE TYPE "SubscriptionPlan" AS ENUM ('BASIC', 'PREMIUM', 'ENTERPRISE');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('ACTIVE', 'CANCELED', 'EXPIRED', 'PENDING');

-- CreateEnum
CREATE TYPE "TermsType" AS ENUM ('POSTULANTE', 'EMPRESA', 'PRIVACY', 'TERMS');

-- CreateEnum
CREATE TYPE "MediaAssetType" AS ENUM ('CV', 'AVATAR', 'VIDEO', 'LOGO');

-- CreateEnum
CREATE TYPE "MediaAssetStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "CatalogType" AS ENUM ('JOB_AREA', 'JOB_TYPE', 'JOB_LEVEL', 'JOB_TYPES', 'EXPERIENCE_LEVELS', 'APPLICATION_STATUSES', 'MODALITIES', 'LANGUAGE_LEVELS', 'COMPANY_SIZES', 'SECTORS', 'STUDY_TYPES', 'STUDY_STATUSES', 'MARITAL_STATUSES');

-- CreateEnum
CREATE TYPE "CatalogLanguage" AS ENUM ('ES', 'EN', 'PT');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED', 'CANCELLED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('PAYPAL', 'MERCADOPAGO', 'STRIPE');

-- CreateEnum
CREATE TYPE "PromotionStatus" AS ENUM ('AVAILABLE', 'CLAIMED', 'USED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "IapPlatform" AS ENUM ('IOS', 'ANDROID');

-- CreateEnum
CREATE TYPE "EntitlementSource" AS ENUM ('APPLE_IAP', 'GOOGLE_PLAY', 'PROMO', 'MANUAL');

-- CreateEnum
CREATE TYPE "EntitlementStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'REVOKED', 'REFUNDED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "userType" "UserType" NOT NULL,
    "googleId" TEXT,
    "appleId" TEXT,
    "googleAccessToken" TEXT,
    "googleRefreshToken" TEXT,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "language" TEXT NOT NULL DEFAULT 'es',
    "resetToken" TEXT,
    "resetTokenExpiry" TIMESTAMP(3),
    "verificationToken" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RefreshToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "RefreshToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PostulanteProfile" (
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

-- CreateTable
CREATE TABLE "Experience" (
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

-- CreateTable
CREATE TABLE "Education" (
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
CREATE TABLE "EmpresaProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "razonSocial" TEXT,
    "cuit" TEXT NOT NULL,
    "documento" TEXT,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "phoneCountryCode" TEXT,
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
    "notificationPreferences" JSONB,

    CONSTRAINT "EmpresaProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Job" (
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

-- CreateTable
CREATE TABLE "Application" (
    "id" TEXT NOT NULL,
    "postulanteId" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "status" "ApplicationStatus" NOT NULL DEFAULT 'PENDING',
    "appliedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "coverLetter" TEXT,
    "isRead" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Application_pkey" PRIMARY KEY ("id")
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
    "callType" "CallType" NOT NULL DEFAULT 'VOICE',
    "status" "CallStatus" NOT NULL DEFAULT 'PENDING',
    "startedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "duration" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Call_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VideoMeeting" (
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
    "markdownContent" TEXT,
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

-- CreateTable
CREATE TABLE "MediaAsset" (
    "id" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "type" "MediaAssetType" NOT NULL,
    "bucket" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "status" "MediaAssetStatus" NOT NULL DEFAULT 'PENDING',
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MediaAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Catalog" (
    "id" TEXT NOT NULL,
    "type" "CatalogType" NOT NULL,
    "code" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Catalog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CatalogTranslation" (
    "id" TEXT NOT NULL,
    "catalogId" TEXT NOT NULL,
    "lang" "CatalogLanguage" NOT NULL,
    "label" TEXT NOT NULL,

    CONSTRAINT "CatalogTranslation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Plan" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "subscriptionPlan" "SubscriptionPlan" NOT NULL DEFAULT 'PREMIUM',
    "price" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "durationDays" INTEGER NOT NULL,
    "unlimitedCvs" BOOLEAN NOT NULL DEFAULT true,
    "allowedModifications" INTEGER NOT NULL DEFAULT 0,
    "canModifyCategory" BOOLEAN NOT NULL DEFAULT false,
    "categoryModifications" INTEGER NOT NULL DEFAULT 0,
    "hasFeaturedOption" BOOLEAN NOT NULL DEFAULT false,
    "hasAIFeature" BOOLEAN NOT NULL DEFAULT false,
    "launchBenefitAvailable" BOOLEAN NOT NULL DEFAULT false,
    "launchBenefitDuration" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL DEFAULT 0,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Plan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentTransaction" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "empresaId" TEXT,
    "orderId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "paymentMethod" "PaymentMethod" NOT NULL DEFAULT 'PAYPAL',
    "description" TEXT,
    "planType" "SubscriptionPlan",
    "planId" TEXT,
    "paypalData" JSONB,
    "failureReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PushToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "deviceId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PushToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserPromotion" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "promoKey" TEXT NOT NULL,
    "status" "PromotionStatus" NOT NULL DEFAULT 'AVAILABLE',
    "claimedAt" TIMESTAMP(3),
    "usedAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserPromotion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobPostEntitlement" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "jobPostId" TEXT NOT NULL,
    "source" "EntitlementSource" NOT NULL,
    "planKey" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "status" "EntitlementStatus" NOT NULL DEFAULT 'ACTIVE',
    "maxEdits" INTEGER NOT NULL DEFAULT 0,
    "editsUsed" INTEGER NOT NULL DEFAULT 0,
    "allowCategoryChange" BOOLEAN NOT NULL DEFAULT false,
    "maxCategoryChanges" INTEGER NOT NULL DEFAULT 0,
    "categoryChangesUsed" INTEGER NOT NULL DEFAULT 0,
    "transactionId" TEXT,
    "originalTransactionId" TEXT,
    "rawPayload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JobPostEntitlement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IapProduct" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "platform" "IapPlatform" NOT NULL,
    "planKey" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IapProduct_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_googleId_key" ON "User"("googleId");

-- CreateIndex
CREATE UNIQUE INDEX "User_appleId_key" ON "User"("appleId");

-- CreateIndex
CREATE UNIQUE INDEX "User_resetToken_key" ON "User"("resetToken");

-- CreateIndex
CREATE UNIQUE INDEX "User_verificationToken_key" ON "User"("verificationToken");

-- CreateIndex
CREATE UNIQUE INDEX "RefreshToken_token_key" ON "RefreshToken"("token");

-- CreateIndex
CREATE INDEX "RefreshToken_userId_idx" ON "RefreshToken"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "PostulanteProfile_userId_key" ON "PostulanteProfile"("userId");

-- CreateIndex
CREATE INDEX "Certification_postulanteId_idx" ON "Certification"("postulanteId");

-- CreateIndex
CREATE UNIQUE INDEX "EmpresaProfile_userId_key" ON "EmpresaProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "EmpresaProfile_cuit_key" ON "EmpresaProfile"("cuit");

-- CreateIndex
CREATE UNIQUE INDEX "Application_postulanteId_jobId_key" ON "Application"("postulanteId", "jobId");

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
CREATE INDEX "VideoMeeting_createdById_idx" ON "VideoMeeting"("createdById");

-- CreateIndex
CREATE INDEX "VideoMeeting_invitedUserId_idx" ON "VideoMeeting"("invitedUserId");

-- CreateIndex
CREATE INDEX "VideoMeeting_scheduledAt_idx" ON "VideoMeeting"("scheduledAt");

-- CreateIndex
CREATE INDEX "VideoMeeting_status_idx" ON "VideoMeeting"("status");

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
CREATE UNIQUE INDEX "MediaAsset_key_key" ON "MediaAsset"("key");

-- CreateIndex
CREATE INDEX "MediaAsset_ownerUserId_idx" ON "MediaAsset"("ownerUserId");

-- CreateIndex
CREATE INDEX "MediaAsset_type_idx" ON "MediaAsset"("type");

-- CreateIndex
CREATE INDEX "MediaAsset_status_idx" ON "MediaAsset"("status");

-- CreateIndex
CREATE INDEX "MediaAsset_key_idx" ON "MediaAsset"("key");

-- CreateIndex
CREATE INDEX "Catalog_type_order_idx" ON "Catalog"("type", "order");

-- CreateIndex
CREATE INDEX "Catalog_type_isActive_idx" ON "Catalog"("type", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "Catalog_type_code_key" ON "Catalog"("type", "code");

-- CreateIndex
CREATE INDEX "CatalogTranslation_catalogId_idx" ON "CatalogTranslation"("catalogId");

-- CreateIndex
CREATE UNIQUE INDEX "CatalogTranslation_catalogId_lang_key" ON "CatalogTranslation"("catalogId", "lang");

-- CreateIndex
CREATE UNIQUE INDEX "Plan_name_key" ON "Plan"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Plan_code_key" ON "Plan"("code");

-- CreateIndex
CREATE INDEX "Plan_code_idx" ON "Plan"("code");

-- CreateIndex
CREATE INDEX "Plan_isActive_idx" ON "Plan"("isActive");

-- CreateIndex
CREATE INDEX "Plan_order_idx" ON "Plan"("order");

-- CreateIndex
CREATE INDEX "Plan_subscriptionPlan_idx" ON "Plan"("subscriptionPlan");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentTransaction_orderId_key" ON "PaymentTransaction"("orderId");

-- CreateIndex
CREATE INDEX "PaymentTransaction_userId_idx" ON "PaymentTransaction"("userId");

-- CreateIndex
CREATE INDEX "PaymentTransaction_empresaId_idx" ON "PaymentTransaction"("empresaId");

-- CreateIndex
CREATE INDEX "PaymentTransaction_orderId_idx" ON "PaymentTransaction"("orderId");

-- CreateIndex
CREATE INDEX "PaymentTransaction_status_idx" ON "PaymentTransaction"("status");

-- CreateIndex
CREATE INDEX "PaymentTransaction_createdAt_idx" ON "PaymentTransaction"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PushToken_token_key" ON "PushToken"("token");

-- CreateIndex
CREATE INDEX "PushToken_userId_idx" ON "PushToken"("userId");

-- CreateIndex
CREATE INDEX "PushToken_token_idx" ON "PushToken"("token");

-- CreateIndex
CREATE INDEX "PushToken_isActive_idx" ON "PushToken"("isActive");

-- CreateIndex
CREATE INDEX "UserPromotion_userId_idx" ON "UserPromotion"("userId");

-- CreateIndex
CREATE INDEX "UserPromotion_promoKey_idx" ON "UserPromotion"("promoKey");

-- CreateIndex
CREATE INDEX "UserPromotion_status_idx" ON "UserPromotion"("status");

-- CreateIndex
CREATE UNIQUE INDEX "UserPromotion_userId_promoKey_key" ON "UserPromotion"("userId", "promoKey");

-- CreateIndex
CREATE INDEX "JobPostEntitlement_userId_idx" ON "JobPostEntitlement"("userId");

-- CreateIndex
CREATE INDEX "JobPostEntitlement_jobPostId_idx" ON "JobPostEntitlement"("jobPostId");

-- CreateIndex
CREATE INDEX "JobPostEntitlement_planKey_idx" ON "JobPostEntitlement"("planKey");

-- CreateIndex
CREATE INDEX "JobPostEntitlement_status_idx" ON "JobPostEntitlement"("status");

-- CreateIndex
CREATE INDEX "JobPostEntitlement_expiresAt_idx" ON "JobPostEntitlement"("expiresAt");

-- CreateIndex
CREATE INDEX "JobPostEntitlement_transactionId_idx" ON "JobPostEntitlement"("transactionId");

-- CreateIndex
CREATE UNIQUE INDEX "JobPostEntitlement_jobPostId_key" ON "JobPostEntitlement"("jobPostId");

-- CreateIndex
CREATE UNIQUE INDEX "JobPostEntitlement_transactionId_key" ON "JobPostEntitlement"("transactionId");

-- CreateIndex
CREATE INDEX "IapProduct_platform_idx" ON "IapProduct"("platform");

-- CreateIndex
CREATE INDEX "IapProduct_planKey_idx" ON "IapProduct"("planKey");

-- CreateIndex
CREATE INDEX "IapProduct_active_idx" ON "IapProduct"("active");

-- CreateIndex
CREATE INDEX "IapProduct_productId_idx" ON "IapProduct"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "IapProduct_productId_platform_key" ON "IapProduct"("productId", "platform");

-- AddForeignKey
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostulanteProfile" ADD CONSTRAINT "PostulanteProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Experience" ADD CONSTRAINT "Experience_postulanteId_fkey" FOREIGN KEY ("postulanteId") REFERENCES "PostulanteProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Education" ADD CONSTRAINT "Education_postulanteId_fkey" FOREIGN KEY ("postulanteId") REFERENCES "PostulanteProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Certification" ADD CONSTRAINT "Certification_postulanteId_fkey" FOREIGN KEY ("postulanteId") REFERENCES "PostulanteProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmpresaProfile" ADD CONSTRAINT "EmpresaProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Job" ADD CONSTRAINT "Job_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "EmpresaProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Application" ADD CONSTRAINT "Application_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Application" ADD CONSTRAINT "Application_postulanteId_fkey" FOREIGN KEY ("postulanteId") REFERENCES "PostulanteProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

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
ALTER TABLE "VideoMeeting" ADD CONSTRAINT "VideoMeeting_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VideoMeeting" ADD CONSTRAINT "VideoMeeting_invitedUserId_fkey" FOREIGN KEY ("invitedUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "EmpresaProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserTermsAcceptance" ADD CONSTRAINT "UserTermsAcceptance_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserTermsAcceptance" ADD CONSTRAINT "UserTermsAcceptance_termsId_fkey" FOREIGN KEY ("termsId") REFERENCES "TermsAndConditions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MediaAsset" ADD CONSTRAINT "MediaAsset_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CatalogTranslation" ADD CONSTRAINT "CatalogTranslation_catalogId_fkey" FOREIGN KEY ("catalogId") REFERENCES "Catalog"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentTransaction" ADD CONSTRAINT "PaymentTransaction_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentTransaction" ADD CONSTRAINT "PaymentTransaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentTransaction" ADD CONSTRAINT "PaymentTransaction_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "EmpresaProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PushToken" ADD CONSTRAINT "PushToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserPromotion" ADD CONSTRAINT "UserPromotion_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobPostEntitlement" ADD CONSTRAINT "JobPostEntitlement_jobPostId_fkey" FOREIGN KEY ("jobPostId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobPostEntitlement" ADD CONSTRAINT "JobPostEntitlement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IapProduct" ADD CONSTRAINT "IapProduct_planKey_fkey" FOREIGN KEY ("planKey") REFERENCES "Plan"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

