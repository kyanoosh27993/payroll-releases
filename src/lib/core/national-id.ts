// راستی‌آزمایی کد ملی ایران — الگوریتم رسمی چک‌دیجیت (دهم)
// کد ملی باید ۱۰ رقم باشد؛ همه ارقام یکسان نیست؛
// جمع (رقم i × وزن 10..2) mod 11:
//   اگر باقیمانده < ۲ → برابر رقم دهم؛ وگرنه 11 − باقیمانده برابر رقم دهم
import { normalizeDigits } from './numbers';

export function normalizeNationalId(input: string): string {
  return normalizeDigits(String(input || '')).replace(/[^0-9]/g, '');
}

/** اعتبارسنجی کامل کد ملی — true فقط برای کد ملی معتبر ۱۰ رقمی */
export function isValidNationalId(input: string): boolean {
  const code = normalizeNationalId(input);
  if (code.length !== 10) return false;
  if (/^(\d)\1{9}$/.test(code)) return false; // همه ارقام یکسان (۰۰۰۰۰۰۰۰۰۰ و ...)
  const check = Number(code[9]);
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += Number(code[i]) * (10 - i);
  const rem = sum % 11;
  return rem < 2 ? check === rem : check === 11 - rem;
}

/** شماره بیمه تامین اجتماعی — تکمیل هوشمند به ۱۰ رقم با صفر ابتدایی */
export function normalizeInsuranceNumber(input: string): string {
  const digits = normalizeDigits(String(input || '')).replace(/[^0-9]/g, '');
  if (!digits) return '';
  return digits.padStart(10, '0');
}
