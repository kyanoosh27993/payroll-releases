// نسخه‌بندی خودکار قرارداد پس از تغییر حکم — گزاره ۸ نسخه ۱٫۲٫۰
// «چنانچه تغییری در مقادیر مندرج در احکام پرسنلی صورت گیرد، می‌بایست از آن ماه
// به بعد حتماً یک قرارداد جدید ساخته شود و قرارداد قبلی به‌عنوان سابقه باقی بماند»
import { db } from '@/lib/db';
import { parseJalaliDateStr } from './numbers';

/** پس از ثبت/ویرایش حکم: اگر قرارداد هوشمند معتبری با دوره قبل از ماه حکم باشد،
 *  نسخه جدید همان نوع برای ماه حکم ساخته و نسخه قبلی سابقه (isValid=false) می‌شود */
export async function ensureContractVersion(personnelId: number, effectiveDate: string): Promise<{ created: boolean; kinds: string[] }> {
  const d = parseJalaliDateStr(effectiveDate);
  if (!d) return { created: false, kinds: [] };
  const decreePeriodKey = `${d[0]}/${String(d[1]).padStart(2, '0')}`; // صفرنگه‌داشته برای مقایسه رشته‌ای درست
  const valids = await db.contract.findMany({ where: { personnelId, docKind: { not: '' }, isValid: true } });
  const kinds: string[] = [];
  for (const c of valids) {
    // اگر دوره قرارداد از ماه حکم قدیمی‌تر است → قرارداد جدید لازم است
    if (c.periodKey && c.periodKey < decreePeriodKey) {
      await db.contract.update({ where: { id: c.id }, data: { isValid: false } });
      await db.contract.create({
        data: {
          personnelId, contractType: c.contractType, hourlyRate: c.hourlyRate,
          dailyRate: c.dailyRate, monthlyWage: c.monthlyWage, projectAmount: c.projectAmount,
          startDate: c.startDate, endDate: c.endDate, payCycle: c.payCycle,
          insuranceRequired: c.insuranceRequired, notes: c.notes,
          docKind: c.docKind, periodKey: decreePeriodKey,
          snapshot: JSON.stringify({ auto: true, fromDecree: effectiveDate, at: new Date().toISOString() }),
          isValid: true,
        },
      });
      kinds.push(c.docKind);
    }
  }
  return { created: kinds.length > 0, kinds };
}
