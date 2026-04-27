-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('PATIENT', 'DOCTOR', 'ADMIN');

-- CreateEnum
CREATE TYPE "AccountStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'DELETED');

-- CreateEnum
CREATE TYPE "VerificationStatus" AS ENUM ('PENDING', 'VERIFIED', 'REVOKED');

-- CreateEnum
CREATE TYPE "CaseStatus" AS ENUM ('PENDING_REVIEW', 'UNDER_REVIEW', 'REVIEWED', 'CLOSED');

-- CreateEnum
CREATE TYPE "RiskTier" AS ENUM ('LOW', 'MODERATE', 'ELEVATED', 'HIGH');

-- CreateEnum
CREATE TYPE "Recommendation" AS ENUM ('ROUTINE_SCREENING', 'SHORT_TERM_FOLLOWUP', 'ADDITIONAL_IMAGING', 'BIOPSY_RECOMMENDED', 'IMMEDIATE_REFERRAL');

-- CreateEnum
CREATE TYPE "AIAgreement" AS ENUM ('AGREE', 'PARTIAL', 'DISAGREE');

-- CreateEnum
CREATE TYPE "ModelStatus" AS ENUM ('STAGING', 'ACTIVE', 'DEPRECATED', 'ROLLED_BACK');

-- CreateEnum
CREATE TYPE "ChatSessionStatus" AS ENUM ('ACTIVE', 'CLOSED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" TIMESTAMP(3),
    "passwordHash" TEXT,
    "name" TEXT,
    "phoneNumber" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'PATIENT',
    "accountStatus" "AccountStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastLoginAt" TIMESTAMP(3),

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "Patient" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "pseudonymId" TEXT NOT NULL,
    "regionCode" TEXT NOT NULL,
    "consentSignedAt" TIMESTAMP(3),
    "consentVersion" TEXT,
    "dateOfBirth" TIMESTAMP(3),

    CONSTRAINT "Patient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Doctor" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "licenseNumber" TEXT NOT NULL,
    "licenseVerifiedAt" TIMESTAMP(3),
    "licenseExpiry" TIMESTAMP(3) NOT NULL,
    "specialty" TEXT NOT NULL,
    "assignedRegions" TEXT[],
    "verificationStatus" "VerificationStatus" NOT NULL DEFAULT 'PENDING',

    CONSTRAINT "Doctor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Admin" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "permissions" JSONB NOT NULL,
    "createdBy" TEXT,

    CONSTRAINT "Admin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Case" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "regionCode" TEXT NOT NULL,
    "status" "CaseStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "assignedDoctorId" TEXT,
    "assignedAt" TIMESTAMP(3),

    CONSTRAINT "Case_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImageMetadata" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "storageReference" TEXT NOT NULL,
    "modality" TEXT NOT NULL DEFAULT 'MG',
    "viewPosition" TEXT,
    "laterality" TEXT,
    "imageHashSha256" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImageMetadata_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AIInference" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "modelVersion" TEXT NOT NULL,
    "riskTier" "RiskTier" NOT NULL,
    "attentionMapReference" TEXT,
    "inferenceTimestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "shownToDoctor" BOOLEAN NOT NULL DEFAULT false,
    "rawOutputJson" JSONB,

    CONSTRAINT "AIInference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DoctorReview" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "doctorId" TEXT NOT NULL,
    "biradsClassification" INTEGER NOT NULL,
    "clinicalNotes" TEXT,
    "recommendation" "Recommendation" NOT NULL,
    "aiInferenceId" TEXT,
    "aiAgreement" "AIAgreement",
    "reviewStartedAt" TIMESTAMP(3),
    "reviewCompletedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DoctorReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PatientCommunication" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "summaryText" TEXT NOT NULL,
    "recommendationText" TEXT NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedByDoctorId" TEXT,
    "approvedAt" TIMESTAMP(3),
    "sentToPatient" BOOLEAN NOT NULL DEFAULT false,
    "sentAt" TIMESTAMP(3),

    CONSTRAINT "PatientCommunication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ModelVersion" (
    "id" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "architecture" TEXT NOT NULL,
    "trainingDatasetHash" TEXT NOT NULL,
    "validationMetrics" JSONB NOT NULL,
    "status" "ModelStatus" NOT NULL DEFAULT 'STAGING',
    "deployedAt" TIMESTAMP(3),
    "deployedById" TEXT,
    "rollbackVersion" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ModelVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrainingDataset" (
    "id" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "caseIds" TEXT[],
    "inclusionCriteria" JSONB NOT NULL,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrainingDataset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DriftMonitoring" (
    "id" TEXT NOT NULL,
    "modelVersionId" TEXT NOT NULL,
    "measurementDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "disagreementRate" DOUBLE PRECISION NOT NULL,
    "confidenceDistribution" JSONB NOT NULL,
    "alertTriggered" BOOLEAN NOT NULL DEFAULT false,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),

    CONSTRAINT "DriftMonitoring_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccessLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "resourceType" TEXT,
    "resourceId" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,

    CONSTRAINT "AccessLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DataAccessLog" (
    "id" TEXT NOT NULL,
    "accessorId" TEXT NOT NULL,
    "accessorType" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "accessType" TEXT NOT NULL,
    "justification" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DataAccessLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ModelDecisionLog" (
    "id" TEXT NOT NULL,
    "aiInferenceId" TEXT NOT NULL,
    "inputHash" TEXT NOT NULL,
    "outputJson" JSONB NOT NULL,
    "doctorOverride" BOOLEAN NOT NULL DEFAULT false,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ModelDecisionLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatSession" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "doctorId" TEXT NOT NULL,
    "status" "ChatSessionStatus" NOT NULL DEFAULT 'ACTIVE',
    "isMandatory" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "closedAt" TIMESTAMP(3),
    "closedByDoctorAt" TIMESTAMP(3),

    CONSTRAINT "ChatSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatMessage" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "senderRole" "UserRole" NOT NULL,
    "senderDoctorId" TEXT,
    "senderPatientId" TEXT,
    "content" TEXT NOT NULL,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "VerificationToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier", "token");

-- CreateIndex
CREATE UNIQUE INDEX "Patient_userId_key" ON "Patient"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Patient_pseudonymId_key" ON "Patient"("pseudonymId");

-- CreateIndex
CREATE INDEX "Patient_regionCode_idx" ON "Patient"("regionCode");

-- CreateIndex
CREATE INDEX "Patient_pseudonymId_idx" ON "Patient"("pseudonymId");

-- CreateIndex
CREATE UNIQUE INDEX "Doctor_userId_key" ON "Doctor"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Doctor_licenseNumber_key" ON "Doctor"("licenseNumber");

-- CreateIndex
CREATE INDEX "Doctor_verificationStatus_idx" ON "Doctor"("verificationStatus");

-- CreateIndex
CREATE INDEX "Doctor_assignedRegions_idx" ON "Doctor"("assignedRegions");

-- CreateIndex
CREATE UNIQUE INDEX "Admin_userId_key" ON "Admin"("userId");

-- CreateIndex
CREATE INDEX "Case_status_idx" ON "Case"("status");

-- CreateIndex
CREATE INDEX "Case_regionCode_idx" ON "Case"("regionCode");

-- CreateIndex
CREATE INDEX "Case_patientId_idx" ON "Case"("patientId");

-- CreateIndex
CREATE INDEX "Case_assignedDoctorId_idx" ON "Case"("assignedDoctorId");

-- CreateIndex
CREATE INDEX "ImageMetadata_caseId_idx" ON "ImageMetadata"("caseId");

-- CreateIndex
CREATE INDEX "AIInference_caseId_idx" ON "AIInference"("caseId");

-- CreateIndex
CREATE INDEX "AIInference_modelVersion_idx" ON "AIInference"("modelVersion");

-- CreateIndex
CREATE UNIQUE INDEX "DoctorReview_aiInferenceId_key" ON "DoctorReview"("aiInferenceId");

-- CreateIndex
CREATE INDEX "DoctorReview_caseId_idx" ON "DoctorReview"("caseId");

-- CreateIndex
CREATE INDEX "DoctorReview_doctorId_idx" ON "DoctorReview"("doctorId");

-- CreateIndex
CREATE INDEX "PatientCommunication_caseId_idx" ON "PatientCommunication"("caseId");

-- CreateIndex
CREATE UNIQUE INDEX "ModelVersion_version_key" ON "ModelVersion"("version");

-- CreateIndex
CREATE INDEX "ModelVersion_status_idx" ON "ModelVersion"("status");

-- CreateIndex
CREATE UNIQUE INDEX "TrainingDataset_version_key" ON "TrainingDataset"("version");

-- CreateIndex
CREATE INDEX "DriftMonitoring_modelVersionId_idx" ON "DriftMonitoring"("modelVersionId");

-- CreateIndex
CREATE INDEX "DriftMonitoring_alertTriggered_idx" ON "DriftMonitoring"("alertTriggered");

-- CreateIndex
CREATE INDEX "AccessLog_userId_idx" ON "AccessLog"("userId");

-- CreateIndex
CREATE INDEX "AccessLog_action_idx" ON "AccessLog"("action");

-- CreateIndex
CREATE INDEX "AccessLog_timestamp_idx" ON "AccessLog"("timestamp");

-- CreateIndex
CREATE INDEX "DataAccessLog_caseId_idx" ON "DataAccessLog"("caseId");

-- CreateIndex
CREATE INDEX "DataAccessLog_accessorId_idx" ON "DataAccessLog"("accessorId");

-- CreateIndex
CREATE INDEX "DataAccessLog_timestamp_idx" ON "DataAccessLog"("timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "ModelDecisionLog_aiInferenceId_key" ON "ModelDecisionLog"("aiInferenceId");

-- CreateIndex
CREATE INDEX "ModelDecisionLog_timestamp_idx" ON "ModelDecisionLog"("timestamp");

-- CreateIndex
CREATE INDEX "ChatSession_caseId_idx" ON "ChatSession"("caseId");

-- CreateIndex
CREATE INDEX "ChatSession_doctorId_idx" ON "ChatSession"("doctorId");

-- CreateIndex
CREATE INDEX "ChatSession_patientId_idx" ON "ChatSession"("patientId");

-- CreateIndex
CREATE INDEX "ChatSession_status_idx" ON "ChatSession"("status");

-- CreateIndex
CREATE UNIQUE INDEX "ChatSession_caseId_doctorId_patientId_key" ON "ChatSession"("caseId", "doctorId", "patientId");

-- CreateIndex
CREATE INDEX "ChatMessage_sessionId_idx" ON "ChatMessage"("sessionId");

-- CreateIndex
CREATE INDEX "ChatMessage_createdAt_idx" ON "ChatMessage"("createdAt");

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Patient" ADD CONSTRAINT "Patient_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Doctor" ADD CONSTRAINT "Doctor_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Admin" ADD CONSTRAINT "Admin_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Case" ADD CONSTRAINT "Case_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Case" ADD CONSTRAINT "Case_assignedDoctorId_fkey" FOREIGN KEY ("assignedDoctorId") REFERENCES "Doctor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImageMetadata" ADD CONSTRAINT "ImageMetadata_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIInference" ADD CONSTRAINT "AIInference_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DoctorReview" ADD CONSTRAINT "DoctorReview_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DoctorReview" ADD CONSTRAINT "DoctorReview_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "Doctor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DoctorReview" ADD CONSTRAINT "DoctorReview_aiInferenceId_fkey" FOREIGN KEY ("aiInferenceId") REFERENCES "AIInference"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatientCommunication" ADD CONSTRAINT "PatientCommunication_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatientCommunication" ADD CONSTRAINT "PatientCommunication_approvedByDoctorId_fkey" FOREIGN KEY ("approvedByDoctorId") REFERENCES "Doctor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModelVersion" ADD CONSTRAINT "ModelVersion_deployedById_fkey" FOREIGN KEY ("deployedById") REFERENCES "Admin"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingDataset" ADD CONSTRAINT "TrainingDataset_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "Admin"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DriftMonitoring" ADD CONSTRAINT "DriftMonitoring_modelVersionId_fkey" FOREIGN KEY ("modelVersionId") REFERENCES "ModelVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DriftMonitoring" ADD CONSTRAINT "DriftMonitoring_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "Admin"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccessLog" ADD CONSTRAINT "AccessLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DataAccessLog" ADD CONSTRAINT "DataAccessLog_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModelDecisionLog" ADD CONSTRAINT "ModelDecisionLog_aiInferenceId_fkey" FOREIGN KEY ("aiInferenceId") REFERENCES "AIInference"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatSession" ADD CONSTRAINT "ChatSession_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatSession" ADD CONSTRAINT "ChatSession_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatSession" ADD CONSTRAINT "ChatSession_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "Doctor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ChatSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_senderDoctorId_fkey" FOREIGN KEY ("senderDoctorId") REFERENCES "Doctor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_senderPatientId_fkey" FOREIGN KEY ("senderPatientId") REFERENCES "Patient"("id") ON DELETE SET NULL ON UPDATE CASCADE;
