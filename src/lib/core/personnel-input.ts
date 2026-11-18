// آماده‌سازی ورودی پرسنل — نرمال‌سازی کدها، اعداد و درصد‌های nullable
import { normalizeDigits, cleanText, parseIntOr, parseNumber, parseNumberOr } from './numbers';
import { normalizeInsuranceNumber } from './national-id';
import { isSafeImageDataUrl } from './sanitize';

/** تاریخ جلالی استاندارد در دیتابیس همیشه با / است (yyyy/mm/dd) —
 *  ورودی ۸ رقمی (مثل 13650906) خودکار به 1365/09/06 تبدیل می‌شود (گزاره ۴) */
export function jalaliDateStr(input: unknown): string {
  const d = normalizeDigits(input ?? '').replace(/[^0-9/]/g, '').trim();
  if (!d) return '';
  if (d.includes('/')) return d;
  if (d.length === 8) return `${d.slice(0, 4)}/${d.slice(4, 6)}/${d.slice(6)}`;
  return d;
}

export function personnelData(body: Record<string, unknown>) {
  return {
    personnelCode: normalizeDigits(body.personnelCode ?? '').trim(),
    cardNo: normalizeDigits(body.cardNo ?? '').trim(),
    firstName: cleanText(body.firstName ?? ''),
    lastName: cleanText(body.lastName ?? ''),
    fatherName: cleanText(body.fatherName ?? ''),
    photo: isSafeImageDataUrl(body.photo) ?? '', // ممیزی امنیتی ۱٫۴٫۳: فقط data URL تصویر سالم پذیرفته می‌شود
    nationalId: normalizeDigits(body.nationalId ?? '').trim(),
    idNumber: normalizeDigits(body.idNumber ?? '').trim(),
    idSerial: normalizeDigits(body.idSerial ?? '').trim(),
    idIssuePlace: cleanText(body.idIssuePlace ?? ''),
    birthDate: jalaliDateStr(body.birthDate ?? ''),
    gender: cleanText(body.gender ?? '') || 'مرد',
    maritalStatus: cleanText(body.maritalStatus ?? '') || 'مجرد',
    dependents: parseIntOr(body.dependents, 0),
    education: cleanText(body.education ?? ''),
    mobile: normalizeDigits(body.mobile ?? '').trim(),
    jobTitle: cleanText(body.jobTitle ?? ''),
    department: cleanText(body.department ?? '') || 'عمومی',
    costCenter: cleanText(body.costCenter ?? ''),
    payslipGroup: cleanText(body.payslipGroup ?? ''),
    bankName: cleanText(body.bankName ?? ''),
    bankAccount: normalizeDigits(body.bankAccount ?? '').trim(),
    bankSheba: normalizeDigits(body.bankSheba ?? '').trim(),
    ssoNumber: normalizeInsuranceNumber(String(body.ssoNumber ?? '')), // همیشه ۱۰ رقم — صفرهای ابتدایی خودکار (گزاره ۲)
    ssoInsurer: cleanText(body.ssoInsurer ?? ''),
    militaryStatus: cleanText(body.militaryStatus ?? ''),
    isVeteran: Boolean(body.isVeteran),
    workLocation: cleanText(body.workLocation ?? ''),
    permanentNight: Boolean(body.permanentNight),
    shiftId: body.shiftId ? parseIntOr(body.shiftId, 0) || null : null,
    ssoWorkerPct: parseNumber(body.ssoWorkerPct, null),
    ssoEmployerPct: parseNumber(body.ssoEmployerPct, null),
    ssoUnempPct: parseNumber(body.ssoUnempPct, null),
    address: cleanText(body.address ?? ''),
    postalCode: normalizeDigits(body.postalCode ?? '').trim(),
    birthPlace: cleanText(body.birthPlace ?? ''),
    insuranceType: parseIntOr(body.insuranceType, 2) || 2,
    employmentType: parseIntOr(body.employmentType, 1) || 1,
    jobCategory: parseIntOr(body.jobCategory, 12) || 12,
    taxExemptionCode: parseIntOr(body.taxExemptionCode, 1) || 1,
    status: cleanText(body.status ?? '') || 'شاغل',
    hireDate: jalaliDateStr(body.hireDate ?? ''),
    endWorkDate: jalaliDateStr(body.endWorkDate ?? ''),
    notes: cleanText(body.notes ?? ''),
  };
}

/** آماده‌سازی ورودی قرارداد */
export function contractData(body: Record<string, unknown>) {
  return {
    contractType: cleanText(body.contractType ?? '') || 'ماهانه ثابت',
    hourlyRate: parseNumber(body.hourlyRate, 0) ?? 0,
    dailyRate: parseNumber(body.dailyRate, 0) ?? 0,
    monthlyWage: parseNumber(body.monthlyWage, 0) ?? 0,
    projectAmount: parseNumber(body.projectAmount, 0) ?? 0,
    startDate: jalaliDateStr(body.startDate ?? ''),
    endDate: jalaliDateStr(body.endDate ?? ''),
    payCycle: cleanText(body.payCycle ?? '') || 'ماهانه',
    insuranceRequired: body.insuranceRequired === undefined ? true : Boolean(body.insuranceRequired),
    notes: cleanText(body.notes ?? ''),
  };
}

/** آماده‌سازی ورودی حکم پرسنلی — همه فیلدهای مبلغ با parseNumberOr نرمال می‌شوند */
export function decreeData(body: Record<string, unknown>) {
  return {
    effectiveDate: jalaliDateStr(body.effectiveDate ?? ''),
    jobWage: parseNumberOr(body.jobWage, 0),
    seniorityWage: parseNumberOr(body.seniorityWage, 0),
    childAllowance: parseNumberOr(body.childAllowance, 0),
    housing: parseNumberOr(body.housing, 0),
    food: parseNumberOr(body.food, 0),
    adjustmentDiff: parseNumberOr(body.adjustmentDiff, 0),
    supervision: parseNumberOr(body.supervision, 0),
    educationAid: parseNumberOr(body.educationAid, 0),
    laborMarket: parseNumberOr(body.laborMarket, 0),
    attractionPercent: parseNumberOr(body.attractionPercent, 0),
    attractionAmount: parseNumberOr(body.attractionAmount, 0),
    otherBenefits: parseNumberOr(body.otherBenefits, 0),
    workerBen: parseNumberOr(body.workerBen, 0),
    fixedOvertime: parseNumberOr(body.fixedOvertime, 0),
    familyAllowance: parseNumberOr(body.familyAllowance, 0),
    shiftAllowance: parseNumberOr(body.shiftAllowance, 0),
    notes: cleanText(body.notes ?? ''),
  };
}
