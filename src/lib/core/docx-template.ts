// سازنده WordprocessingML سبک + پرکن قالب‌های ورد رسمی کاربر — نسخه ۱.۴.۵
// قالب‌ها: public/templates/contract-hourly.docx، contract-fixed.docx، letterhead.docx
// (تولیدشده از فایل‌های ورد رسمی کاربر با scripts/make-word-templates.py — محتوا ۱۰۰٪ فایل خود کاربر است)
import JSZip from 'jszip';
import fs from 'node:fs';
import path from 'node:path';
import { appRoot } from '@/lib/app-root';

export function xmlEsc(s: string): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

const toFa = (v: number | string) => String(v ?? '').replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[Number(d)]);

/** مبلغ با جداکننده نقطه (سبک فایل ورد کاربر: 166.255.530) و رقم فارسی */
export function faMoneyDot(v: number | string | null | undefined): string {
  const n = Math.round(Number(v) || 0);
  const s = Math.abs(n).toLocaleString('en-US').replace(/,/g, '.');
  return toFa((n < 0 ? '-' : '') + s);
}

const FA = 'B Nazanin';
const KOODAK = 'B Koodak';

export interface WPtOpts {
  bold?: boolean; size?: number; align?: 'right' | 'center' | 'left' | 'both';
  font?: string; spacing?: number; italic?: boolean; color?: string;
}

/** پاراگراف ساده با متن (ممکن است چند خط با \n) */
export function wP(text: string, o: WPtOpts = {}): string {
  const sz = Math.round((o.size ?? 12) * 2);
  const jc = o.align === 'center' ? 'center' : o.align === 'left' ? 'left' : o.align === 'both' ? 'both' : 'right';
  const runs = String(text ?? '').split('\n').map((line, i) => {
    const br = i > 0 ? '<w:br/>' : '';
    return `<w:r><w:rPr><w:rFonts w:ascii="${o.font ?? FA}" w:hAnsi="${o.font ?? FA}" w:cs="${o.font ?? FA}"${o.bold ? '' : ''}/>${o.bold ? '<w:b/><w:bCs/>' : ''}${o.italic ? '<w:i/>' : ''}${o.color ? `<w:color w:val="${o.color}"/>` : ''}<w:sz w:val="${sz}"/><w:szCs w:val="${sz}"/><w:rtl/></w:rPr>${br}<w:t xml:space="preserve">${xmlEsc(line)}</w:t></w:r>`;
  }).join('');
  return `<w:p><w:pPr><w:bidi/><w:jc w:val="${jc}"/>${o.spacing ? `<w:spacing w:line="${o.spacing}" w:lineRule="auto"/>` : ''}</w:pPr>${runs}</w:p>`;
}

/** پاراگراف فقط عکس (inline، ۲٫۵ × ۳٫۲ سانتی‌متر) */
export function wPhotoParagraph(rid: string, cx = 900000, cy = 1152000): string {
  return `<w:p><w:pPr><w:bidi/><w:jc w:val="center"/><w:spacing w:after="80"/></w:pPr><w:r><w:drawing>
<wp:inline distT="0" distB="0" distL="0" distR="0">
<wp:extent cx="${cx}" cy="${cy}"/><wp:effectExtent l="0" t="0" r="0" b="0"/>
<wp:docPr id="901" name="PersPhoto"/><wp:cNvGraphicFramePr><a:graphicFrameLocks xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" noChangeAspect="1"/></wp:cNvGraphicFramePr>
<a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">
<pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">
<pic:nvPicPr><pic:cNvPr id="901" name="PersPhoto"/><pic:cNvPicPr/></pic:nvPicPr>
<pic:blipFill><a:blip r:embed="${rid}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>
<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr>
</pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>`;
}

const TC_BORDER = '<w:tcBorders><w:top w:val="single" w:sz="8" w:color="000000"/><w:bottom w:val="single" w:sz="8" w:color="000000"/><w:left w:val="single" w:sz="8" w:color="000000"/><w:right w:val="single" w:sz="8" w:color="000000"/></w:tcBorders>';
const TC_SHADE = '<w:shd w:val="clear" w:fill="F2F2F2"/>';

export interface WTCell { text: string; bold?: boolean; size?: number; align?: 'center' | 'right' | 'left'; shade?: boolean; font?: string; span?: number; noWrap?: boolean }
export interface WTRow { cells: WTCell[]; height?: number; header?: boolean }

/** جدول با همه مرزها — عرض بر حسب twips؛ سلول با span ستون‌های مجاور را مر می‌کند (نسخه ۱.۴.۷) */
export function wTable(rows: WTRow[], widthsTwips: number[], opts: { header?: boolean } = {}): string {
  const total = widthsTwips.reduce((a, b) => a + b, 0);
  const trs = rows.map((r) => {
    const h = r.height ? `<w:trPr><w:trHeight w:val="${r.height}" w:hRule="atLeast"/></w:trPr>` : '';
    let ci = 0;
    const tcs = r.cells.map((c) => {
      const span = Math.max(1, c.span ?? 1);
      const w = widthsTwips.slice(ci, ci + span).reduce((a, b) => a + b, 0) || 1000;
      ci += span;
      const sz = Math.round((c.size ?? 11) * 2);
      const jc = c.align ?? 'center';
      const spanXml = span > 1 ? `<w:gridSpan w:val="${span}"/>` : '';
      const nw = c.noWrap ? '<w:noWrap/>' : '';
      return `<w:tc><w:tcPr><w:tcW w:w="${w}" w:type="dxa"/>${spanXml}${nw}${TC_BORDER}${c.shade ? TC_SHADE : ''}<w:vAlign w:val="center"/></w:tcPr>
<w:p><w:pPr><w:bidi/><w:jc w:val="${jc}"/></w:pPr><w:r><w:rPr><w:rFonts w:ascii="${c.font ?? FA}" w:hAnsi="${c.font ?? FA}" w:cs="${c.font ?? FA}"/>${c.bold ? '<w:b/><w:bCs/>' : ''}<w:sz w:val="${sz}"/><w:szCs w:val="${sz}"/><w:rtl/></w:rPr><w:t xml:space="preserve">${xmlEsc(c.text)}</w:t></w:r></w:p></w:tc>`;
    }).join('');
    return `<w:tr>${h}${tcs}</w:tr>`;
  }).join('');
  const tblPr = `<w:tblPr><w:tblW w:w="${total}" w:type="dxa"/><w:tblBorders><w:top w:val="single" w:sz="8" w:color="000000"/><w:bottom w:val="single" w:sz="8" w:color="000000"/><w:left w:val="single" w:sz="8" w:color="000000"/><w:right w:val="single" w:sz="8" w:color="000000"/><w:insideH w:val="single" w:sz="8" w:color="000000"/><w:insideV w:val="single" w:sz="8" w:color="000000"/></w:tblBorders><w:tblLayout w:type="fixed"/></w:tblPr>`;
  const grid = `<w:tblGrid>${widthsTwips.map((w) => `<w:gridCol w:w="${w}"/>`).join('')}</w:tblGrid>`;
  return `<w:tbl>${tblPr}${grid}${trs}</w:tbl>`;
}

/** پاراگراف خالی */
export function wSpacer(halfPt = 120): string {
  return `<w:p><w:pPr><w:spacing w:after="${halfPt}"/></w:pPr></w:p>`;
}

// ---------------------------------------------------------------------------
// پرکن قالب docx — جایگزینی توکن‌ها + افزودن عکس پرسنل
// ---------------------------------------------------------------------------
async function loadTemplate(name: string): Promise<JSZip> {
  const p = path.join(appRoot(), 'public', 'templates', name);
  const buf = fs.readFileSync(p);
  return JSZip.loadAsync(buf);
}

async function saveZip(zip: JSZip): Promise<Buffer> {
  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' }) as Promise<Buffer>;
}

function replaceTokens(xml: string, values: Record<string, string>): string {
  // توکن‌های بدون مقدار خالی می‌شوند (نقطه‌چین بلند در ادامه همان گروه، لی‌اوت را نمی‌شکند)
  return xml.replace(/\{\{([A-Z_0-9]+)\}\}/g, (_m, key) => (key in values ? values[key] : ''));
}

/** عکس data-URL/base64 پرسنل → (buf, ext) یا null */
export function decodePersonPhoto(photo?: string | null): { buf: Buffer; ext: 'jpeg' | 'png' } | null {
  if (!photo) return null;
  try {
    let b64 = photo;
    let ext: 'jpeg' | 'png' = 'jpeg';
    const m = photo.match(/^data:image\/(jpe?g|png);base64,([\s\S]+)$/);
    if (m) { ext = m[1] === 'png' ? 'png' : 'jpeg'; b64 = m[2]; }
    else if (photo.includes(':')) return null; // data URL ناسالم
    const buf = Buffer.from(b64.replace(/\s/g, ''), 'base64');
    if (!buf.length || buf.length < 500) return null;
    // امضای فرمت
    if (buf[0] === 0x89 && buf[1] === 0x50) ext = 'png';
    else if (buf[0] !== 0xff || buf[1] !== 0xd8) return null;
    return { buf, ext };
  } catch { return null; }
}

/** افزودن عکس به zip + رلیشن → برگرداندن rId و XML رلیشن جدید */
async function addPhoto(zip: JSZip, relsXml: string, photo: { buf: Buffer; ext: 'jpeg' | 'png' }, name: string): Promise<{ relsXml: string; rid: string }> {
  const mediaName = `media/${name}`;
  zip.file(`word/${mediaName}`, photo.buf);
  const ids = [...relsXml.matchAll(/Id="(rId\d+)"/g)].map((m) => Number(m[1].slice(3)));
  const rid = `rId${Math.max(100, ...ids) + 1}`;
  const rel = `<Relationship Id="${rid}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="${mediaName}"/>`;
  const relsXml2 = relsXml.replace('</Relationships>', rel + '</Relationships>');
  // اطمینان از ثبت پسوند در [Content_Types].xml
  const ct = await zip.file('[Content_Types].xml')!.async('string');
  const ext = photo.ext === 'png' ? 'png' : 'jpeg';
  if (!ct.includes(`Extension="${ext}"`)) {
    const ct2 = ct.replace('</Types>', `<Default Extension="${ext}" ContentType="image/${ext}"/></Types>`);
    zip.file('[Content_Types].xml', ct2);
  }
  return { relsXml: relsXml2, rid };
}

export interface ContractFillData {
  fullName: string; fatherName: string; birthDate: string; idNumber: string; nationalId: string;
  education: string; address: string; postalCode: string; phone: string; mobile: string;
  jobTitle: string; department: string;
  hourlyWage?: number; monthlyWage?: number; housing?: number; workerBen?: number;
  childAllowance?: number; familyAllowance?: number; otherBen?: number; attraction?: number;
  dailyWage?: number; fixedAmount?: number;
  sheba?: string; bankName?: string;
  startDate?: string; endDate?: string;
  docNum: string; docDate: string;
  photo?: string | null;
}

/** پر کردن قرارداد روی قالب ورد رسمی کاربر — kind ساعتی = قرارداد خام عادی، مبلغ معین = قرارداد خام با مبلغ معین */
export async function fillContractDocx(kind: 'ساعتی' | 'مبلغ معین', d: ContractFillData): Promise<Buffer> {
  const zip = await loadTemplate(kind === 'ساعتی' ? 'contract-hourly.docx' : 'contract-fixed.docx');
  const xml0 = await zip.file('word/document.xml')!.async('string');
  const rels0 = await zip.file('word/_rels/document.xml.rels')!.async('string');

  // مقدار هر توکن: گروه چندخطی فقط در خانه اول مقدار می‌گیرد و بقیه نقطه‌چین می‌ماند
  const v: Record<string, string> = {};
  const fa = (s: string) => toFa(s);
  v.P_NAME = fa(d.fullName); v.P_FATHER = fa(d.fatherName); v.P_BIRTH = fa(d.birthDate);
  v.P_IDNUM = fa(d.idNumber); v.P_NATID = fa(d.nationalId); v.P_EDU = fa(d.education);
  v.P_ADDR0 = fa(d.address); v.P_POSTAL = fa(d.postalCode); v.P_PHONE0 = fa(d.phone);
  v.P_MOBILE0 = fa(d.mobile); v.P_JOB0 = fa(d.jobTitle); v.P_DEPT = fa(d.department || 'عمومی');
  v.P_SHEBA0 = fa(d.sheba || ''); v.P_BANK = fa(d.bankName || '');
  v.C_START0 = fa(d.startDate || ''); v.C_END0 = fa(d.endDate || '');
  if (kind === 'ساعتی') {
    v.HOURLY_WAGE = faMoneyDot(d.hourlyWage ?? 0);
    v.MONTHLY_WAGE = faMoneyDot(d.monthlyWage ?? 0);
    v.HOUSING = faMoneyDot(d.housing ?? 0);
    v.WORKER_BEN = faMoneyDot(d.workerBen ?? 0);
    v.CHILD_ALLOW = faMoneyDot(d.childAllowance ?? 0);
    v.FAMILY_ALLOW = faMoneyDot(d.familyAllowance ?? 0);
    v.OTHER_BEN = faMoneyDot(d.otherBen ?? 0);
    v.ATTRACTION = faMoneyDot(d.attraction ?? 0);
  } else {
    v.DAILY_WAGE = faMoneyDot(d.dailyWage ?? 0);
    v.MOAIN0 = faMoneyDot(d.fixedAmount ?? 0);
  }

  let xml = replaceTokens(xml0, {
    ...v,
    C_DOC_NUM: toFa(d.docNum),
    C_DOC_DATE: toFa(d.docDate),
    C_PIAVAST: 'حکم پرسنلی', // نسخه ۱٫۴٫۶ — حکم به‌عنوان پیوست قرارداد
  });
  // نسخه ۱٫۴٫۶ — نام پرسنل جای نقطه‌چین «امضای همکار» در فوتر هر صفحه
  const footer = await zip.file('word/footer1.xml')?.async('string');
  if (footer) {
    zip.file('word/footer1.xml', footer.replace(/\.\.{20,}/, xmlEsc(fa(d.fullName))).replace(/\{\{P_SIGN_NAME\}\}/g, xmlEsc(fa(d.fullName))));
  }
  const rels = rels0;
  const photo = decodePersonPhoto(d.photo);
  let docRels = rels;
  if (photo) {
    const added = await addPhoto(zip, rels, photo, 'person-photo.jpeg');
    // v1.4.7: photo floating top-right of page 1 inside the white space
    xml = insertTopRightPhoto(removePhotoRun(xml), added.rid);
    // v1.4.7 fix: the image relationship must actually be saved (bug: original rels were written back)
    docRels = added.relsXml;
  } else {
    // no photo: remove the old drawing run
    xml = removePhotoRun(xml);
    xml = xml.replace(/<mc:AlternateContent>(?:(?!<\/mc:AlternateContent>)[\s\S])*?RID_PHOTO[\s\S]*?<\/mc:AlternateContent>/g, '');
  }
  // v1.4.7: taller wage-table rows
  xml = wageTableTallerRows(xml, 420);
  // v1.4.7: compact line spacing so clauses 1-11 fit on page 1 (forced layout per user request)
  xml = compactParagraphsBeforeTable(xml, 'مشخصات طرفین');
  for (const key of ['حقوق و مزایای کارگر', 'افزایش حقوق', 'به موجب ماده ۱۴۸', 'عیدی و پاداش سالانه', 'حق سنوات یا مزایای پایان کار',
    'مدت قرارداد', 'این قرارداد فقط و فقط']) {
    xml = compactParagraph(xml, key);
  }
  // v1.4.7: clauses 1-11 only on page 1; page 2 starts with clause 12
  xml = pageBreakBefore(xml, 'توافقات و شرایط کاری');
  zip.file('word/document.xml', xml);
  zip.file('word/_rels/document.xml.rels', docRels);
  return saveZip(zip);
}

/** v1.4.7 — find paragraphs whose run-joined text contains the key (text may be split across runs) */
function paraMatches(xml: string, key: string): Array<{ start: number; end: number; text: string }> {
  const out: Array<{ start: number; end: number; text: string }> = [];
  const re = /<w:p(?: [^>]*)?>[\s\S]*?<\/w:p>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) {
    const text = (m[0].match(/<w:t[^>]*>([^<]*)<\/w:t>/g) || [])
      .map((t) => t.replace(/<w:t[^>]*>|<\/w:t>/g, '')).join('');
    if (text.includes(key)) out.push({ start: m.index, end: m.index + m[0].length, text });
  }
  return out;
}

/** v1.4.7 — remove the run containing the old RID_PHOTO drawing */
function removePhotoRun(xml: string): string {
  const i = xml.indexOf('RID_PHOTO');
  if (i < 0) return xml;
  const rs = Math.max(xml.lastIndexOf('<w:r>', i), xml.lastIndexOf('<w:r ', i));
  const re = xml.indexOf('</w:r>', i) + '</w:r>'.length;
  if (rs < 0 || re < 6) return xml;
  return xml.slice(0, rs) + xml.slice(re);
}

/** v1.4.7 — clean floating picture anchored to top-right of page 1 (white space) */
function insertTopRightPhoto(xml: string, rid: string): string {
  const CX = 1000125, CY = 1076325;
  const photoRun = `<w:r><w:rPr><w:noProof/></w:rPr><w:drawing>`
    + `<wp:anchor distT="0" distB="0" distL="114300" distR="114300" simplePos="0" relativeHeight="251660288" behindDoc="0" locked="0" layoutInCell="1" allowOverlap="1">`
    + `<wp:simplePos x="0" y="0"/>`
    + `<wp:positionH relativeFrom="margin"><wp:posOffset>5040000</wp:posOffset></wp:positionH>`
    + `<wp:positionV relativeFrom="page"><wp:posOffset>1140000</wp:posOffset></wp:positionV>`
    + `<wp:extent cx="${CX}" cy="${CY}"/><wp:effectExtent l="0" t="0" r="0" b="0"/><wp:wrapNone/>`
    + `<wp:docPr id="910" name="PersPhotoTop"/>`
    + `<wp:cNvGraphicFramePr><a:graphicFrameLocks xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" noChangeAspect="1"/></wp:cNvGraphicFramePr>`
    + `<a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">`
    + `<pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">`
    + `<pic:nvPicPr><pic:cNvPr id="910" name="PersPhotoTop"/><pic:cNvPicPr/></pic:nvPicPr>`
    + `<pic:blipFill><a:blip r:embed="${rid}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>`
    + `<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${CX}" cy="${CY}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr>`
    + `</pic:pic></a:graphicData></a:graphic></wp:anchor></w:drawing></w:r>`;
  const p0 = xml.indexOf('<w:p');
  if (p0 < 0) return xml;
  const tagEnd = xml.indexOf('>', p0) + 1;
  return xml.slice(0, tagEnd) + photoRun + xml.slice(tagEnd);
}

/** v1.4.7 — insert a page break before the paragraph containing the key text (run-split safe) */
function pageBreakBefore(xml: string, key: string): string {
  const hit = paraMatches(xml, key)[0];
  if (!hit) return xml;
  const brk = '<w:p><w:pPr><w:spacing w:after="0"/></w:pPr><w:r><w:br w:type="page"/></w:r></w:p>';
  return xml.slice(0, hit.start) + brk + xml.slice(hit.start);
}

/** v1.4.7 — taller rows for the wage table (found by its first row label, run-split safe) */
function wageTableTallerRows(xml: string, twips: number): string {
  const hit = paraMatches(xml, 'حقوق پایه ساعتی')[0];
  if (!hit) return xml;
  const ts = xml.lastIndexOf('<w:tbl>', hit.start);
  const te = xml.indexOf('</w:tbl>', hit.end) + '</w:tbl>'.length;
  if (ts < 0 || te < 8) return xml;
  const tbl = xml.slice(ts, te);
  const tbl2 = tbl.replace(/<w:tr(?: [^>]*)?>/g, (m0) => `${m0}<w:trPr><w:trHeight w:val="${twips}" w:hRule="atLeast"/></w:trPr>`);
  return xml.slice(0, ts) + tbl2 + xml.slice(te);
}

/** v1.4.7 — compact every paragraph from the key paragraph until the wage table (run-split safe) */
function compactParagraphsBeforeTable(xml: string, keyStart: string): string {
  const a = paraMatches(xml, keyStart)[0];
  const tHit = paraMatches(xml, 'حقوق پایه ساعتی')[0];
  if (!a || !tHit) return xml;
  const ts = xml.lastIndexOf('<w:tbl>', tHit.start);
  if (ts < 0) return xml;
  const re = /<w:p(?: [^>]*)?>[\s\S]*?<\/w:p>/g;
  re.lastIndex = a.start;
  type Hit = { start: number; end: number };
  const hits: Hit[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) {
    if (m.index >= ts) break;
    hits.push({ start: m.index, end: m.index + m[0].length });
    re.lastIndex = m.index + m[0].length;
  }
  let out = xml;
  for (let k = hits.length - 1; k >= 0; k--) {
    const seg = out.slice(hits[k].start, hits[k].end);
    let p2 = seg.replace(/<w:spacing[^/]*\/>/g, '');
    const sp = '<w:spacing w:after="0" w:before="0" w:line="240" w:lineRule="auto"/>';
    if (p2.includes('<w:pPr>')) p2 = p2.replace('<w:pPr>', `<w:pPr>${sp}`);
    else p2 = p2.replace(/(<w:p(?: [^>]*)?>)/, `$1<w:pPr>${sp}</w:pPr>`);
    out = out.slice(0, hits[k].start) + p2 + out.slice(hits[k].end);
  }
  return out;
}

/** v1.4.7 — force single-line spacing on the paragraph containing the key text (run-split safe) */
function compactParagraph(xml: string, key: string): string {
  const hit = paraMatches(xml, key)[0];
  if (!hit) return xml;
  const para = xml.slice(hit.start, hit.end);
  let p2 = para.replace(/<w:spacing[^/]*\/>/g, '');
  const sp = '<w:spacing w:after="0" w:before="0" w:line="240" w:lineRule="auto"/>';
  if (p2.includes('<w:pPr>')) p2 = p2.replace('<w:pPr>', `<w:pPr>${sp}`);
  else p2 = p2.replace(/(<w:p(?: [^>]*)?>)/, `$1<w:pPr>${sp}</w:pPr>`);
  return xml.slice(0, hit.start) + p2 + xml.slice(hit.end);
}

/** پر کردن سند روی سربرگ رسمی کاربر — bodyXml = بدنه آماده WordprocessingML */
export async function fillLetterheadDocx(
  bodyXml: string,
  meta: { num: string; num2: string; date: string },
  photo?: string | null,
): Promise<Buffer> {
  const zip = await loadTemplate('letterhead.docx');
  const xml0 = await zip.file('word/document.xml')!.async('string');
  const rels0 = await zip.file('word/_rels/document.xml.rels')!.async('string');
  const h0 = await zip.file('word/header1.xml')!.async('string');

  // v1.4.7 — تاریخ و شماره سربرگ با رقم فارسی و فونت B Koodak (قبلاً رقم انگلیسی چاپ می‌شد)
  let header = h0;
  const hv: Array<[string, string]> = [
    ['{{LH_NUM}}', meta.num], ['{{LH_NUM2}}', meta.num2],
    ['{{LH_D}}', meta.date.split('/')[0] || ''],
    ['{{LH_M}}', meta.date.split('/')[1] || ''],
    ['{{LH_Y}}', meta.date.split('/')[2] || ''],
  ];
  for (const [tok, val] of hv) header = koodakHeaderRun(header, tok, toFa(val));
  header = header.replace(/\{\{LH_[A-Z0-9]+\}\}/g, '');
  let rels = rels0;

  let body = bodyXml;
  const photoBuf = decodePersonPhoto(photo);
  if (photoBuf) {
    const added = await addPhoto(zip, rels, photoBuf, 'person-photo.jpeg');
    rels = added.relsXml;
    body = wPhotoParagraph(added.rid, 720000, 920000) + body;
  }
  // جایگزینی پاراگراف توکن بدنه (شامل توکن ممکن است داخل چند run شکسته شود — ساده: کل پاراگراف را جستجو کن)
  const marker = '<w:t xml:space="preserve">{{LH_BODY}}</w:t>';
  if (xml0.includes(marker)) {
    const paraStart = xml0.lastIndexOf('<w:p>', xml0.indexOf(marker));
    const paraEnd = xml0.indexOf('</w:p>', xml0.indexOf(marker)) + '</w:p>'.length;
    const xml = xml0.slice(0, paraStart) + body + xml0.slice(paraEnd);
    zip.file('word/document.xml', xml);
  } else {
    zip.file('word/document.xml', body);
  }
  zip.file('word/header1.xml', header);
  zip.file('word/_rels/document.xml.rels', rels);
  return saveZip(zip);
}

/** v1.4.7 — replace the run holding a letterhead token with Persian digits + B Koodak font */
function koodakHeaderRun(h: string, tok: string, val: string): string {
  const i = h.indexOf(tok);
  if (i < 0) return h;
  const s = Math.max(h.lastIndexOf('<w:r>', i), h.lastIndexOf('<w:r ', i));
  const e = h.indexOf('</w:r>', i) + '</w:r>'.length;
  if (s < 0 || e < 6) return h.split(tok).join(val);
  const run = `<w:r><w:rPr><w:rFonts w:ascii="B Koodak" w:hAnsi="B Koodak" w:cs="B Koodak"/><w:sz w:val="28"/><w:szCs w:val="28"/><w:rtl/></w:rPr><w:t xml:space="preserve">${xmlEsc(val)}</w:t></w:r>`;
  return h.slice(0, s) + run + h.slice(e);
}
