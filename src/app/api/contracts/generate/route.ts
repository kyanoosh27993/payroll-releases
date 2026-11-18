// تولید قرارداد کار هوشمند — گزاره ۸ نسخه ۱٫۲٫۰
// GET  /api/contracts/generate?personnelId=&kind=ساعتی|مبلغ معین&format=html|doc  → پیش‌نمایش بدون ذخیره
// POST { personnelId, kind } → تولید + ذخیره نسخه جدید (نسخه قبلی سابقه می‌شود)
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { userFromHeaders, hasRole } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { buildContractHtml, DEFAULT_CONTRACT_COMPANY, decreeTotalSum, type ContractKind, type ContractPerson, type ContractDecree } from '@/lib/core/contract-doc';
import { fillContractDocx } from '@/lib/core/docx-template';
import { todayJalali } from '@/lib/core/settlement';
import { parseJalaliDateStr } from '@/lib/core/numbers';

export const dynamic = 'force-dynamic';

/** سربرگ ذخیره‌شده برنامه (یا پیش‌فرض) — مورد ۱۲ نسخه ۱٫۴٫۳ */
async function loadLetterhead(): Promise<string | undefined> {
  try {
    const row = await db.appSetting.findUnique({ where: { key: 'letterhead_image' } });
    return row?.value || '/letterhead/letterhead-default.jpeg';
  } catch { return undefined; }
}

export async function loadContractInputs(personnelId: number) {
  const p = await db.personnel.findUnique({ where: { id: personnelId } });
  if (!p) throw new Error('پرسنل یافت نشد');
  const decree = await db.decree.findFirst({ where: { personnelId }, orderBy: { effectiveDate: 'desc' } });
  const contract = await db.contract.findFirst({ where: { personnelId }, orderBy: { createdAt: 'desc' } });
  // مورد ۱۳ نسخه ۱٫۴٫۳: شرکت مالکِ این پرسنل — هرگز findFirst سراسری (نشت بین شرکت‌ها)
  const company = (await db.company.findUnique({ where: { id: p.companyId } })) ?? null;
  const person: ContractPerson = {
    firstName: p.firstName, lastName: p.lastName, fatherName: p.fatherName, birthDate: p.birthDate,
    idNumber: p.idNumber, nationalId: p.nationalId, education: p.education, address: p.address,
    postalCode: p.postalCode, mobile: p.mobile, phone: (p as unknown as { phone?: string }).phone ?? '',
    maritalStatus: p.maritalStatus, dependents: p.dependents,
    jobTitle: p.jobTitle, department: p.department || 'عمومی', personnelCode: p.personnelCode,
    hireDate: p.hireDate, photo: p.photo || '', bankName: p.bankName, bankAccount: p.bankAccount, bankSheba: p.bankSheba,
  };
  const dec: ContractDecree | null = decree ? {
    effectiveDate: decree.effectiveDate, jobWage: decree.jobWage, seniorityWage: decree.seniorityWage,
    childAllowance: decree.childAllowance, housing: decree.housing, food: decree.food,
    adjustmentDiff: decree.adjustmentDiff, supervision: decree.supervision, educationAid: decree.educationAid,
    laborMarket: decree.laborMarket, attractionPercent: decree.attractionPercent, attractionAmount: decree.attractionAmount,
    otherBenefits: decree.otherBenefits, workerBen: decree.workerBen, fixedOvertime: decree.fixedOvertime,
    familyAllowance: decree.familyAllowance, shiftAllowance: decree.shiftAllowance,
  } : null;
  const co = company ? {
    name: company.name, managerName: company.managerName || DEFAULT_CONTRACT_COMPANY.managerName,
    nationalId: company.nationalId, address: company.address, phone: company.phone,
    logoPath: company.logoPath || undefined, // مورد ۱۲: لوگوی شرکت در قرارداد
  } : DEFAULT_CONTRACT_COMPANY;
  return { person, dec, co, contract, raw: p };
}

function kindOf(raw: string): ContractKind {
  return raw.includes('معین') || raw.includes('معين') || raw.includes('مبلغ') ? 'مبلغ معین' : 'ساعتی';
}

export async function GET(req: NextRequest) {
  try {
    const me = userFromHeaders(req);
    if (!hasRole(me, 'admin', 'operator', 'viewer')) {
      return NextResponse.json({ error: 'دسترسی مجاز نیست' }, { status: 403 });
    }
    const sp = req.nextUrl.searchParams;
    const personnelId = Number(sp.get('personnelId') || 0);
    if (!personnelId) return NextResponse.json({ error: 'personnelId الزامی است' }, { status: 400 });
    const kind = kindOf(sp.get('kind') ?? 'ساعتی');
    const format = sp.get('format') ?? 'html';
    const { person, dec, co, contract, raw } = await loadContractInputs(personnelId);
    const letterhead = await loadLetterhead();

    // نسخه ۱٫۴٫۵ — تولید فایل ورد واقعی روی قالب رسمی کاربر (contract-hourly / contract-fixed)
    if (format === 'docx') {
      if (!dec) return NextResponse.json({ error: 'ابتدا حکم حقوقی برای این پرسنل ثبت کنید — قرارداد از روی حکم تولید می‌شود' }, { status: 400 });
      const monthlyWage = (dec.jobWage || 0) + (dec.seniorityWage || 0);
      const hourlyDiv = 7.33;
      const hourlyRate = contract?.hourlyRate ? contract.hourlyRate : Math.round((monthlyWage / 30) / hourlyDiv);
      const otherBen = (dec.adjustmentDiff || 0) + (dec.supervision || 0) + (dec.educationAid || 0)
        + (dec.laborMarket || 0) + (dec.otherBenefits || 0) + (dec.shiftAllowance || 0) + (dec.fixedOvertime || 0);
      const startDate = contract?.startDate ?? person.hireDate;
      const buf = await fillContractDocx(kind, {
        fullName: `${person.firstName} ${person.lastName}`.trim(), fatherName: person.fatherName,
        birthDate: person.birthDate, idNumber: person.idNumber, nationalId: person.nationalId,
        education: person.education, address: person.address, postalCode: person.postalCode,
        phone: person.phone ?? '', mobile: person.mobile,
        jobTitle: person.jobTitle, department: person.department || 'عمومی',
        hourlyWage: hourlyRate, monthlyWage,
        housing: dec.housing, workerBen: dec.workerBen,
        childAllowance: dec.childAllowance, familyAllowance: dec.familyAllowance,
        otherBen, attraction: dec.attractionAmount,
        dailyWage: contract?.dailyRate ? contract.dailyRate : Math.round(monthlyWage / 30),
        fixedAmount: contract?.monthlyWage ? contract.monthlyWage : undefined,
        sheba: person.bankSheba, bankName: person.bankName,
        startDate, endDate: contract?.endDate ?? '',
        docNum: person.personnelCode, docDate: contract?.startDate ?? todayJalali(),
        photo: person.photo,
      });
      return new NextResponse(new Uint8Array(buf), {
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'Content-Disposition': `attachment; filename="contract-${encodeURIComponent(person.personnelCode || String(personnelId))}.docx"`,
        },
      });
    }
    const result = buildContractHtml(kind, person, dec, co, {
      startDate: contract?.startDate ?? person.hireDate,
      endDate: contract?.endDate ?? '',
      hourlyRate: contract?.hourlyRate ?? undefined,
      monthlyWage: contract?.monthlyWage ?? undefined,
      projectAmount: contract?.projectAmount ?? undefined,
      letterhead,
      companyLogo: co.logoPath,
    });
    if (format === 'doc') {
      return new NextResponse('\ufeff' + result.html, {
        headers: {
          'Content-Type': 'application/msword; charset=utf-8',
          'Content-Disposition': `attachment; filename="contract-${personnelId}.doc"`,
        },
      });
    }
    return new NextResponse(result.html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const me = userFromHeaders(req);
    if (!hasRole(me, 'admin', 'operator')) {
      return NextResponse.json({ error: 'دسترسی مجاز نیست' }, { status: 403 });
    }
    const body = await req.json();
    const personnelId = Number(body.personnelId || 0);
    if (!personnelId) return NextResponse.json({ error: 'personnelId الزامی است' }, { status: 400 });
    const kind = kindOf(String(body.kind ?? 'ساعتی'));
    const { person, dec, co, contract } = await loadContractInputs(personnelId);
    const letterhead = await loadLetterhead();
    if (!dec) {
      return NextResponse.json({ error: 'ابتدا حکم حقوقی برای این پرسنل ثبت کنید — قرارداد از روی حکم تولید می‌شود' }, { status: 400 });
    }
    if (!person.nationalId) {
      return NextResponse.json({ error: 'برای تولید قرارداد، کد ملی پرسنل الزامی است' }, { status: 400 });
    }
    const startDate = contract?.startDate ?? person.hireDate;
    const endDate = contract?.endDate ?? '';
    const result = buildContractHtml(kind, person, dec, co, {
      startDate, endDate,
      hourlyRate: contract?.hourlyRate ?? undefined,
      monthlyWage: contract?.monthlyWage ?? undefined,
      projectAmount: contract?.projectAmount ?? undefined,
      letterhead,
      companyLogo: co.logoPath,
    });
    // گزاره ۸ — جمع مبالغ قرارداد باید با جمع حکم برابر باشد
    // (تفاوت ناشی از درج قانونی «مجرد» یا «عدم مشمول» خطا نیست — هشدار داده می‌شود)
    const lawfulDiff = result.notes.some((n) => n.includes('مجرد') || n.includes('عدم مشمول'));
    if (kind === 'ساعتی' && result.mismatch && !lawfulDiff) {
      return NextResponse.json({
        error: `عدم تطابق جمع مبالغ: جمع جدول قرارداد ${result.tableSum.toLocaleString('en-US')} ریال و جمع حکم ${decreeTotalSum(dec).toLocaleString('en-US')} ریال است. ابتدا حکم را اصلاح کنید.`,
      }, { status: 400 });
    }
    const periodKey = startDate ? (() => { const pd = parseJalaliDateStr(startDate); return pd ? `${pd[0]}/${String(pd[1]).padStart(2, '0')}` : ''; })() : '';
    await db.contract.updateMany({
      where: { personnelId, docKind: kind, isValid: true, id: { not: contract?.id ?? -1 } },
      data: { isValid: false },
    });
    let contractRow;
    const snap = JSON.stringify({ tableSum: result.tableSum, decreeSum: result.decreeSum, at: new Date().toISOString() });
    if (contract) {
      if (!contract.docKind) {
        contractRow = await db.contract.update({
          where: { id: contract.id },
          data: { docKind: kind, periodKey, snapshot: snap },
        });
      } else {
        // نسخه جدید — قرارداد قبلی به‌عنوان سابقه حفظ می‌شود
        contractRow = await db.contract.create({
          data: {
            personnelId, contractType: contract.contractType, hourlyRate: contract.hourlyRate,
            dailyRate: contract.dailyRate, monthlyWage: contract.monthlyWage, projectAmount: contract.projectAmount,
            startDate: contract.startDate, endDate: contract.endDate, payCycle: contract.payCycle,
            insuranceRequired: contract.insuranceRequired, notes: contract.notes,
            docKind: kind, periodKey, snapshot: snap, isValid: true,
          },
        });
        await db.contract.update({ where: { id: contract.id }, data: { isValid: false } });
      }
    } else {
      return NextResponse.json({ error: 'ابتدا قرارداد پایه (تاریخ شروع/پایان) را در تب قراردادها ثبت کنید' }, { status: 400 });
    }
    await logAudit({
      user: me, action: 'تولید قرارداد هوشمند', entity: 'contract', entityId: contractRow.id,
      details: `${person.firstName} ${person.lastName} — ${kind} — دوره ${periodKey}`,
      after: { tableSum: result.tableSum, decreeSum: result.decreeSum },
    });
    return NextResponse.json({
      contract: contractRow, tableSum: result.tableSum, decreeSum: result.decreeSum,
      mismatch: result.mismatch, notes: result.notes, html: result.html,
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
