-- CreateTable
CREATE TABLE "User" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "salt" TEXT NOT NULL,
    "fullName" TEXT NOT NULL DEFAULT '',
    "role" TEXT NOT NULL DEFAULT 'viewer',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "mustChangePassword" BOOLEAN NOT NULL DEFAULT false,
    "failedAttempts" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" DATETIME,
    "isSupervisor" BOOLEAN NOT NULL DEFAULT false,
    "expiresAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Session" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "token" TEXT NOT NULL UNIQUE,
    "userId" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" DATETIME NOT NULL,
    "lastSeenAt" DATETIME,
    CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "AuditLog" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "ts" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "username" TEXT,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL DEFAULT '',
    "entityId" INTEGER,
    "details" TEXT NOT NULL DEFAULT '',
    "beforeData" TEXT NOT NULL DEFAULT '',
    "afterData" TEXT NOT NULL DEFAULT ''
);

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateTable
CREATE TABLE "Company" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "nationalId" TEXT NOT NULL DEFAULT '',
    "economicCode" TEXT NOT NULL DEFAULT '',
    "ssoBranchCode" TEXT NOT NULL DEFAULT '',
    "ssoWorkshopCode" TEXT NOT NULL DEFAULT '',
    "ssoContractRow" TEXT NOT NULL DEFAULT '',
    "taxFileCode" TEXT NOT NULL DEFAULT '',
    "postalCode" TEXT NOT NULL DEFAULT '',
    "managerName" TEXT NOT NULL DEFAULT '',
    "logoPath" TEXT NOT NULL DEFAULT '',
    "address" TEXT NOT NULL DEFAULT '',
    "phone" TEXT NOT NULL DEFAULT '',
    "active" BOOLEAN NOT NULL DEFAULT true
);

-- CreateTable
CREATE TABLE "FiscalYear" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "companyId" INTEGER NOT NULL,
    "jy" INTEGER NOT NULL,
    "title" TEXT NOT NULL DEFAULT '',
    CONSTRAINT "FiscalYear_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FySetting" (
    "fiscalYearId" INTEGER NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL DEFAULT '',

    PRIMARY KEY ("fiscalYearId", "key"),
    CONSTRAINT "FySetting_fiscalYearId_fkey" FOREIGN KEY ("fiscalYearId") REFERENCES "FiscalYear" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TaxBracket" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "fiscalYearId" INTEGER NOT NULL,
    "seq" INTEGER NOT NULL,
    "fromAmount" INTEGER NOT NULL DEFAULT 0,
    "toAmount" INTEGER,
    "ratePercent" REAL NOT NULL,
    CONSTRAINT "TaxBracket_fiscalYearId_fkey" FOREIGN KEY ("fiscalYearId") REFERENCES "FiscalYear" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Personnel" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "companyId" INTEGER NOT NULL,
    "personnelCode" TEXT NOT NULL,
    "cardNo" TEXT NOT NULL DEFAULT '',
    "firstName" TEXT NOT NULL DEFAULT '',
    "lastName" TEXT NOT NULL DEFAULT '',
    "fatherName" TEXT NOT NULL DEFAULT '',
    "nationalId" TEXT NOT NULL DEFAULT '',
    "idNumber" TEXT NOT NULL DEFAULT '',
    "idSerial" TEXT NOT NULL DEFAULT '',
    "idIssuePlace" TEXT NOT NULL DEFAULT '',
    "birthDate" TEXT NOT NULL DEFAULT '',
    "gender" TEXT NOT NULL DEFAULT 'مرد',
    "maritalStatus" TEXT NOT NULL DEFAULT 'مجرد',
    "dependents" INTEGER NOT NULL DEFAULT 0,
    "education" TEXT NOT NULL DEFAULT '',
    "mobile" TEXT NOT NULL DEFAULT '',
    "jobTitle" TEXT NOT NULL DEFAULT '',
    "department" TEXT NOT NULL DEFAULT 'عمومی',
    "photo" TEXT NOT NULL DEFAULT '',
    "costCenter" TEXT NOT NULL DEFAULT '',
    "payslipGroup" TEXT NOT NULL DEFAULT '',
    "bankName" TEXT NOT NULL DEFAULT '',
    "bankAccount" TEXT NOT NULL DEFAULT '',
    "bankSheba" TEXT NOT NULL DEFAULT '',
    "ssoNumber" TEXT NOT NULL DEFAULT '',
    "ssoInsurer" TEXT NOT NULL DEFAULT '',
    "militaryStatus" TEXT NOT NULL DEFAULT '',
    "isVeteran" BOOLEAN NOT NULL DEFAULT false,
    "workLocation" TEXT NOT NULL DEFAULT '',
    "permanentNight" BOOLEAN NOT NULL DEFAULT false,
    "shiftId" INTEGER,
    "ssoWorkerPct" REAL,
    "ssoEmployerPct" REAL,
    "ssoUnempPct" REAL,
    "address" TEXT NOT NULL DEFAULT '',
    "postalCode" TEXT NOT NULL DEFAULT '',
    "birthPlace" TEXT NOT NULL DEFAULT '',
    "insuranceType" INTEGER NOT NULL DEFAULT 2,
    "employmentType" INTEGER NOT NULL DEFAULT 1,
    "jobCategory" INTEGER NOT NULL DEFAULT 12,
    "jobCode" TEXT NOT NULL DEFAULT '',
    "taxExemptionCode" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'شاغل',
    "hireDate" TEXT NOT NULL DEFAULT '',
    "endWorkDate" TEXT NOT NULL DEFAULT '',
    "notes" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Contract" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "personnelId" INTEGER NOT NULL,
    "contractType" TEXT NOT NULL DEFAULT 'ماهانه ثابت',
    "hourlyRate" INTEGER NOT NULL DEFAULT 0,
    "dailyRate" INTEGER NOT NULL DEFAULT 0,
    "monthlyWage" INTEGER NOT NULL DEFAULT 0,
    "projectAmount" INTEGER NOT NULL DEFAULT 0,
    "startDate" TEXT NOT NULL DEFAULT '',
    "endDate" TEXT NOT NULL DEFAULT '',
    "payCycle" TEXT NOT NULL DEFAULT 'ماهانه',
    "insuranceRequired" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT NOT NULL DEFAULT '',
    "docKind" TEXT NOT NULL DEFAULT '',
    "periodKey" TEXT NOT NULL DEFAULT '',
    "snapshot" TEXT NOT NULL DEFAULT '',
    "isValid" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Contract_personnelId_fkey" FOREIGN KEY ("personnelId") REFERENCES "Personnel" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable — فرم‌های چاپی ضروری (نسخه ۱٫۲٫۰)
CREATE TABLE "PrintForm" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "fileName" TEXT NOT NULL,
    "mime" TEXT NOT NULL DEFAULT 'application/octet-stream',
    "size" INTEGER NOT NULL DEFAULT 0,
    "data" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Decree" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "personnelId" INTEGER NOT NULL,
    "effectiveDate" TEXT NOT NULL,
    "jobWage" INTEGER NOT NULL DEFAULT 0,
    "seniorityWage" INTEGER NOT NULL DEFAULT 0,
    "childAllowance" INTEGER NOT NULL DEFAULT 0,
    "housing" INTEGER NOT NULL DEFAULT 0,
    "food" INTEGER NOT NULL DEFAULT 0,
    "adjustmentDiff" INTEGER NOT NULL DEFAULT 0,
    "supervision" INTEGER NOT NULL DEFAULT 0,
    "educationAid" INTEGER NOT NULL DEFAULT 0,
    "laborMarket" INTEGER NOT NULL DEFAULT 0,
    "attractionPercent" INTEGER NOT NULL DEFAULT 0,
    "attractionAmount" INTEGER NOT NULL DEFAULT 0,
    "otherBenefits" INTEGER NOT NULL DEFAULT 0,
    "workerBen" INTEGER NOT NULL DEFAULT 0,
    "fixedOvertime" INTEGER NOT NULL DEFAULT 0,
    "familyAllowance" INTEGER NOT NULL DEFAULT 0,
    "shiftAllowance" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Decree_personnelId_fkey" FOREIGN KEY ("personnelId") REFERENCES "Personnel" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Shift" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "companyId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "schedule" TEXT NOT NULL DEFAULT '{}',
    "premiumPct" REAL NOT NULL DEFAULT 10,
    "notes" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "ShiftAssignment" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "personnelId" INTEGER NOT NULL,
    "jy" INTEGER NOT NULL,
    "jm" INTEGER NOT NULL,
    "shiftId" INTEGER NOT NULL,
    CONSTRAINT "ShiftAssignment_personnelId_fkey" FOREIGN KEY ("personnelId") REFERENCES "Personnel" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ShiftOverride" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "personnelId" INTEGER NOT NULL,
    "jy" INTEGER NOT NULL,
    "jm" INTEGER NOT NULL,
    "jd" INTEGER NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'custom',
    "shiftId" INTEGER,
    "startMin" INTEGER NOT NULL DEFAULT 480,
    "endMin" INTEGER NOT NULL DEFAULT 960,
    "note" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ShiftOverride_personnelId_fkey" FOREIGN KEY ("personnelId") REFERENCES "Personnel" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AttendanceMonth" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "fiscalYearId" INTEGER NOT NULL,
    "jy" INTEGER NOT NULL,
    "jm" INTEGER NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'دستی',
    "importedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AttendanceMonth_fiscalYearId_fkey" FOREIGN KEY ("fiscalYearId") REFERENCES "FiscalYear" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AttendanceDaily" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "monthId" INTEGER NOT NULL,
    "personnelId" INTEGER NOT NULL,
    "day" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'بدون شیفت',
    "entry1" INTEGER NOT NULL DEFAULT -1,
    "exit1" INTEGER NOT NULL DEFAULT -1,
    "entry2" INTEGER NOT NULL DEFAULT -1,
    "exit2" INTEGER NOT NULL DEFAULT -1,
    "entry3" INTEGER NOT NULL DEFAULT -1,
    "exit3" INTEGER NOT NULL DEFAULT -1,
    "lateMin" INTEGER NOT NULL DEFAULT 0,
    "earlyMin" INTEGER NOT NULL DEFAULT 0,
    "missingMin" INTEGER NOT NULL DEFAULT 0,
    "leaveMin" INTEGER NOT NULL DEFAULT 0,
    "missionMin" INTEGER NOT NULL DEFAULT 0,
    "overtimeMin" INTEGER NOT NULL DEFAULT 0,
    "freeOvertimeMin" INTEGER NOT NULL DEFAULT 0,
    "workedMin" INTEGER NOT NULL DEFAULT 0,
    "expectedMin" INTEGER NOT NULL DEFAULT 0,
    "leaveKind" TEXT NOT NULL DEFAULT '',
    "edited" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "AttendanceDaily_monthId_fkey" FOREIGN KEY ("monthId") REFERENCES "AttendanceMonth" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AttendanceDaily_personnelId_fkey" FOREIGN KEY ("personnelId") REFERENCES "Personnel" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Loan" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "personnelId" INTEGER NOT NULL,
    "title" TEXT NOT NULL DEFAULT 'وام',
    "totalAmount" INTEGER NOT NULL,
    "installment" INTEGER NOT NULL,
    "installmentsCount" INTEGER NOT NULL DEFAULT 0,
    "paidCount" INTEGER NOT NULL DEFAULT 0,
    "startPeriod" TEXT NOT NULL DEFAULT '',
    "remaining" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT NOT NULL DEFAULT '',
    CONSTRAINT "Loan_personnelId_fkey" FOREIGN KEY ("personnelId") REFERENCES "Personnel" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Advance" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "personnelId" INTEGER NOT NULL,
    "payDate" TEXT NOT NULL DEFAULT '',
    "amount" INTEGER NOT NULL,
    "recovered" BOOLEAN NOT NULL DEFAULT false,
    "period" TEXT NOT NULL DEFAULT '',
    "notes" TEXT NOT NULL DEFAULT '',
    CONSTRAINT "Advance_personnelId_fkey" FOREIGN KEY ("personnelId") REFERENCES "Personnel" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Leave" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "personnelId" INTEGER NOT NULL,
    "fromDate" TEXT NOT NULL,
    "toDate" TEXT NOT NULL,
    "days" REAL NOT NULL DEFAULT 0,
    "leaveKind" TEXT NOT NULL DEFAULT 'استحقاقی',
    "approved" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT NOT NULL DEFAULT '',
    CONSTRAINT "Leave_personnelId_fkey" FOREIGN KEY ("personnelId") REFERENCES "Personnel" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "OpeningBalance" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "personnelId" INTEGER NOT NULL,
    "title" TEXT NOT NULL DEFAULT '',
    "kind" TEXT NOT NULL DEFAULT 'other',
    "unit" TEXT NOT NULL DEFAULT 'amount',
    "amount" REAL NOT NULL DEFAULT 0,
    "effect" TEXT NOT NULL DEFAULT 'none',
    "consumed" BOOLEAN NOT NULL DEFAULT false,
    "usedPeriod" TEXT NOT NULL DEFAULT '',
    "notes" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OpeningBalance_personnelId_fkey" FOREIGN KEY ("personnelId") REFERENCES "Personnel" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PayrollItemConfig" (
    "code" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'earning',
    "formulaKey" TEXT NOT NULL DEFAULT 'manual',
    "taxMode" TEXT NOT NULL DEFAULT 'm84',
    "taxPercent" REAL NOT NULL DEFAULT 0,
    "insured" BOOLEAN NOT NULL DEFAULT true,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sort" INTEGER NOT NULL DEFAULT 100,
    "systemLocked" BOOLEAN NOT NULL DEFAULT false
);

-- CreateTable
CREATE TABLE "PayrollPeriod" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "fiscalYearId" INTEGER NOT NULL,
    "jy" INTEGER NOT NULL,
    "jm" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'پیش‌نویس',
    "calculatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PayrollPeriod_fiscalYearId_fkey" FOREIGN KEY ("fiscalYearId") REFERENCES "FiscalYear" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PayrollLine" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "periodId" INTEGER NOT NULL,
    "personnelId" INTEGER NOT NULL,
    "itemCode" TEXT NOT NULL,
    "amount" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "PayrollLine_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "PayrollPeriod" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PayrollLine_personnelId_fkey" FOREIGN KEY ("personnelId") REFERENCES "Personnel" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PayrollSummary" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "periodId" INTEGER NOT NULL,
    "personnelId" INTEGER NOT NULL,
    "workedDays" REAL NOT NULL DEFAULT 0,
    "leaveDays" REAL NOT NULL DEFAULT 0,
    "leaveBalance" REAL NOT NULL DEFAULT 0,
    "overtimeMin" INTEGER NOT NULL DEFAULT 0,
    "gross" INTEGER NOT NULL DEFAULT 0,
    "insuredBase" INTEGER NOT NULL DEFAULT 0,
    "workerIns" INTEGER NOT NULL DEFAULT 0,
    "employerIns" INTEGER NOT NULL DEFAULT 0,
    "unemploymentIns" INTEGER NOT NULL DEFAULT 0,
    "taxBase" INTEGER NOT NULL DEFAULT 0,
    "tax" INTEGER NOT NULL DEFAULT 0,
    "totalDeductions" INTEGER NOT NULL DEFAULT 0,
    "netPay" INTEGER NOT NULL DEFAULT 0,
    "prevBalance" INTEGER NOT NULL DEFAULT 0,
    "payApproved" BOOLEAN NOT NULL DEFAULT true,
    "payPaid" BOOLEAN NOT NULL DEFAULT false,
    "payNote" TEXT NOT NULL DEFAULT '',
    CONSTRAINT "PayrollSummary_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "PayrollPeriod" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PayrollSummary_personnelId_fkey" FOREIGN KEY ("personnelId") REFERENCES "Personnel" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PayrollManual" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "periodId" INTEGER NOT NULL,
    "personnelId" INTEGER NOT NULL,
    "itemCode" TEXT NOT NULL,
    "amount" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "PayrollManual_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "PayrollPeriod" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PayrollManual_personnelId_fkey" FOREIGN KEY ("personnelId") REFERENCES "Personnel" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ReportDef" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "config" TEXT NOT NULL,
    "isBuiltin" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "InstalledModule" (
    "key" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "licenseNote" TEXT NOT NULL DEFAULT ''
);

-- CreateTable
CREATE TABLE "CalendarEvent" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "jy" INTEGER NOT NULL,
    "jm" INTEGER NOT NULL,
    "jd" INTEGER NOT NULL,
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'دستی'
);

-- CreateTable
CREATE TABLE "AppSetting" (
    "key" TEXT NOT NULL PRIMARY KEY,
    "value" TEXT NOT NULL DEFAULT ''
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "FiscalYear_companyId_jy_key" ON "FiscalYear"("companyId", "jy");

-- CreateIndex
CREATE INDEX "Personnel_cardNo_idx" ON "Personnel"("cardNo");

-- CreateIndex
CREATE UNIQUE INDEX "Personnel_companyId_personnelCode_key" ON "Personnel"("companyId", "personnelCode");

-- CreateIndex
CREATE UNIQUE INDEX "ShiftAssignment_personnelId_jy_jm_key" ON "ShiftAssignment"("personnelId", "jy", "jm");

-- CreateIndex
CREATE UNIQUE INDEX "AttendanceMonth_fiscalYearId_jy_jm_key" ON "AttendanceMonth"("fiscalYearId", "jy", "jm");

-- CreateIndex
CREATE INDEX "AttendanceDaily_personnelId_idx" ON "AttendanceDaily"("personnelId");

-- CreateIndex
CREATE UNIQUE INDEX "AttendanceDaily_monthId_personnelId_day_key" ON "AttendanceDaily"("monthId", "personnelId", "day");

-- CreateIndex
CREATE UNIQUE INDEX "PayrollPeriod_fiscalYearId_jy_jm_key" ON "PayrollPeriod"("fiscalYearId", "jy", "jm");

-- CreateIndex
CREATE INDEX "PayrollLine_periodId_personnelId_idx" ON "PayrollLine"("periodId", "personnelId");

-- CreateIndex
CREATE UNIQUE INDEX "PayrollSummary_periodId_personnelId_key" ON "PayrollSummary"("periodId", "personnelId");

-- CreateIndex
CREATE UNIQUE INDEX "PayrollManual_periodId_personnelId_itemCode_key" ON "PayrollManual"("periodId", "personnelId", "itemCode");

-- CreateIndex
CREATE UNIQUE INDEX "ShiftOverride_personnelId_jy_jm_jd_key" ON "ShiftOverride"("personnelId", "jy", "jm", "jd");
CREATE INDEX "ShiftOverride_jy_jm_idx" ON "ShiftOverride"("jy", "jm");
CREATE INDEX "CalendarEvent_jy_jm_idx" ON "CalendarEvent"("jy", "jm");
CREATE INDEX "Decree_personnelId_idx" ON "Decree"("personnelId");
CREATE INDEX "ShiftAssignment_jy_jm_idx" ON "ShiftAssignment"("jy", "jm");
CREATE INDEX "Loan_personnelId_idx" ON "Loan"("personnelId");
CREATE INDEX "Advance_personnelId_idx" ON "Advance"("personnelId");
CREATE INDEX "Leave_personnelId_idx" ON "Leave"("personnelId");
CREATE INDEX "PayrollSummary_personnelId_idx" ON "PayrollSummary"("personnelId");
CREATE INDEX "OpeningBalance_personnelId_idx" ON "OpeningBalance"("personnelId");

