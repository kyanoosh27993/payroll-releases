'use client';

import * as React from 'react';
import './payroll-theme.css';
import { SearchableSelect } from '@/components/ui/searchable-select';

declare global {
  interface Window {
    queryLocalFonts?: () => Promise<Array<{ family: string; fullName: string; postscriptName: string; style: string }>>;
  }
}

export type PayrollThemeDensity = 'comfortable' | 'cozy' | 'compact';
export type PayrollThemeContrast = 'normal' | 'high';

export type PayrollThemeConfig = {
  preset: string;
  accent: string;
  accent2: string;
  font: string;
  fontSize: number;
  density: PayrollThemeDensity;
  radius: number;
  glass: number;
  blur: number;
  speed: number;
  motion: boolean;
  glow: boolean;
  aurora: boolean;
  stripes: boolean;
  contrast: PayrollThemeContrast;
  bgImage: string;   // data URL تصویر پس‌زمینه — خالی = بدون تصویر
  bgDim: number;     // تاریکی پوشش روی تصویر (۰ تا ۸۵٪)
  sidebarText: string; // رنگ نوشته‌های سایدبار — خالی = پیش‌فرض تم
};

type Preset = {
  id: string;
  name: string;
  mode: 'dark' | 'light';
  colors: {
    bg: string;
    surface: string;
    surface2: string;
    overlay: string;
    text: string;
    muted: string;
    border: string;
    primary: string;
    primaryFg: string;
    accent2: string;
    success: string;
    warning: string;
    danger: string;
    info: string;
    chart: [string, string, string, string, string, string];
  };
};

const STORAGE_KEY = 'payroll-theme-v1';

const PRESETS: Preset[] = [
  {
    id: 'hotel-aurora',
    name: 'اورورای هتل',
    mode: 'dark',
    colors: {
      bg: '#070b12', surface: '#0e1622', surface2: '#131f2e', overlay: '#182638',
      text: '#eaf2ff', muted: '#93a4b8', border: '#243447',
      primary: '#22d3ee', primaryFg: '#03151a', accent2: '#8b5cf6',
      success: '#10b981', warning: '#f59e0b', danger: '#ef4444', info: '#38bdf8',
      chart: ['#22d3ee', '#8b5cf6', '#f59e0b', '#10b981', '#f472b6', '#60a5fa'],
    },
  },
  {
    id: 'royal-ledger',
    name: 'دفتر سلطنتی',
    mode: 'dark',
    colors: {
      bg: '#080a14', surface: '#101426', surface2: '#171c33', overlay: '#1d2340',
      text: '#f4f1ff', muted: '#a9a3c2', border: '#2c3355',
      primary: '#d4af37', primaryFg: '#1a1403', accent2: '#7c3aed',
      success: '#22c55e', warning: '#f59e0b', danger: '#f43f5e', info: '#60a5fa',
      chart: ['#d4af37', '#7c3aed', '#22c55e', '#60a5fa', '#f43f5e', '#f97316'],
    },
  },
  {
    id: 'emerald-audit',
    name: 'حسابرسی زمرد',
    mode: 'light',
    colors: {
      bg: '#f3f7f5', surface: '#ffffff', surface2: '#e8f0ec', overlay: '#ffffff',
      text: '#10201a', muted: '#51665d', border: '#c9d8d1',
      primary: '#059669', primaryFg: '#ffffff', accent2: '#0ea5e9',
      success: '#059669', warning: '#d97706', danger: '#dc2626', info: '#0284c7',
      chart: ['#059669', '#0ea5e9', '#d97706', '#7c3aed', '#dc2626', '#65a30d'],
    },
  },
  {
    id: 'graphite-pro',
    name: 'گرافیت حرفه‌ای',
    mode: 'dark',
    colors: {
      bg: '#0b0d10', surface: '#14171c', surface2: '#1b1f26', overlay: '#20242c',
      text: '#edf1f7', muted: '#9aa3af', border: '#2b313b',
      primary: '#60a5fa', primaryFg: '#06121f', accent2: '#34d399',
      success: '#34d399', warning: '#fbbf24', danger: '#f87171', info: '#60a5fa',
      chart: ['#60a5fa', '#34d399', '#fbbf24', '#f472b6', '#a78bfa', '#fb7185'],
    },
  },
  {
    id: 'sunrise-hotel',
    name: 'طلوع هتل',
    mode: 'light',
    colors: {
      bg: '#fbf7f1', surface: '#ffffff', surface2: '#f3e9dc', overlay: '#ffffff',
      text: '#241a10', muted: '#6f5b49', border: '#e2d3c2',
      primary: '#ea580c', primaryFg: '#ffffff', accent2: '#0f766e',
      success: '#16a34a', warning: '#d97706', danger: '#dc2626', info: '#0369a1',
      chart: ['#ea580c', '#0f766e', '#16a34a', '#7c3aed', '#dc2626', '#ca8a04'],
    },
  },
  {
    id: 'midnight-executive',
    name: 'نیمه‌شب مدیران',
    mode: 'dark',
    colors: {
      bg: '#050509', surface: '#0d0d16', surface2: '#141422', overlay: '#191927',
      text: '#f2f2ff', muted: '#9d9db5', border: '#26263a',
      primary: '#a78bfa', primaryFg: '#120a24', accent2: '#22d3ee',
      success: '#4ade80', warning: '#facc15', danger: '#fb7185', info: '#38bdf8',
      chart: ['#a78bfa', '#22d3ee', '#facc15', '#4ade80', '#fb7185', '#f97316'],
    },
  },
];

const FALLBACK_FONTS = [
  'Vazirmatn', 'Segoe UI', 'Tahoma', 'Arial', 'Calibri', 'Cambria', 'Times New Roman',
  'B Nazanin', 'B Mitra', 'B Titr', 'IRANSans', 'IRANSansX', 'Sahel', 'Samim', 'Shabnam',
  'Noto Naskh Arabic', 'Noto Sans Arabic', 'Consolas', 'Courier New',
];

const DEFAULT_CONFIG: PayrollThemeConfig = {
  preset: 'hotel-aurora',
  accent: '#22d3ee',
  accent2: '#8b5cf6',
  font: 'Vazirmatn',
  fontSize: 14,
  density: 'cozy',
  radius: 18,
  glass: 38,
  blur: 14,
  speed: 1,
  motion: true,
  glow: true,
  aurora: true,
  stripes: true,
  contrast: 'normal',
  bgImage: '',
  bgDim: 35,
  sidebarText: '',
};

type ThemeContextValue = {
  config: PayrollThemeConfig;
  presets: Preset[];
  fonts: string[];
  fontsLoading: boolean;
  fontsError: string | null;
  update: (patch: Partial<PayrollThemeConfig>) => void;
  reset: () => void;
  randomize: () => void;
  exportConfig: () => void;
  importConfig: (file: File) => Promise<void>;
  loadWindowsFonts: () => Promise<void>;
};

const ThemeContext = React.createContext<ThemeContextValue | null>(null);

export function usePayrollTheme(): ThemeContextValue {
  const ctx = React.useContext(ThemeContext);
  if (!ctx) throw new Error('usePayrollTheme must be used inside PayrollThemeProvider');
  return ctx;
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

function isHex(v: string): boolean {
  return /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(v);
}

function sanitize(input: Partial<PayrollThemeConfig>): PayrollThemeConfig {
  const preset = PRESETS.some((p) => p.id === input.preset) ? String(input.preset) : DEFAULT_CONFIG.preset;
  const base = PRESETS.find((p) => p.id === preset) ?? PRESETS[0];
  const density: PayrollThemeDensity =
    input.density === 'comfortable' || input.density === 'compact' || input.density === 'cozy'
      ? input.density
      : DEFAULT_CONFIG.density;
  const contrast: PayrollThemeContrast = input.contrast === 'high' ? 'high' : 'normal';
  return {
    preset,
    accent: isHex(String(input.accent ?? '')) ? String(input.accent) : base.colors.primary,
    accent2: isHex(String(input.accent2 ?? '')) ? String(input.accent2) : base.colors.accent2,
    font: typeof input.font === 'string' && input.font.trim() ? input.font.trim() : DEFAULT_CONFIG.font,
    fontSize: clamp(Number(input.fontSize ?? DEFAULT_CONFIG.fontSize), 12, 18),
    density,
    radius: clamp(Number(input.radius ?? DEFAULT_CONFIG.radius), 6, 28),
    glass: clamp(Number(input.glass ?? DEFAULT_CONFIG.glass), 0, 100),
    blur: clamp(Number(input.blur ?? DEFAULT_CONFIG.blur), 0, 28),
    speed: clamp(Number(input.speed ?? DEFAULT_CONFIG.speed), 0.4, 2.4),
    motion: input.motion !== false,
    glow: input.glow !== false,
    aurora: input.aurora !== false,
    stripes: input.stripes !== false,
    contrast,
    bgImage:
      typeof input.bgImage === 'string' && input.bgImage.startsWith('data:image/')
        && input.bgImage.length < 4_500_000
        ? input.bgImage
        : '',
    bgDim: clamp(Number(input.bgDim ?? DEFAULT_CONFIG.bgDim), 0, 85),
    sidebarText: isHex(String(input.sidebarText ?? '')) ? String(input.sidebarText) : '',
  };
}

function hexToRgb(hex: string): [number, number, number] {
  let h = hex.replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgba(hex: string, alpha: number): string {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r},${g},${b},${clamp(alpha, 0, 1).toFixed(3)})`;
}

function applyConfig(cfg: PayrollThemeConfig): void {
  if (typeof document === 'undefined') return;
  const preset = PRESETS.find((p) => p.id === cfg.preset) ?? PRESETS[0];
  const c = preset.colors;
  const root = document.documentElement;
  const set = (name: string, value: string) => root.style.setProperty(name, value);

  root.classList.add('pt-enabled');
  // همگام‌سازی کلاس «dark» با حالت تم — قواعد .dark در globals.css و واریانت‌های dark:
  // تیلویند فقط با این کلاس کار می‌کنند؛ بدون آن بخشی از رابط هنگام تغییر تم تیره/روشن تغییری نمی‌کرد
  root.classList.toggle('dark', preset.mode === 'dark');
  root.dataset.ptTheme = preset.id;
  root.dataset.ptMode = preset.mode;
  root.dataset.ptMotion = cfg.motion ? 'on' : 'off';
  root.dataset.ptGlow = cfg.glow ? 'on' : 'off';
  root.dataset.ptAurora = cfg.aurora ? 'on' : 'off';
  root.dataset.ptStripes = cfg.stripes ? 'on' : 'off';
  root.dataset.ptContrast = cfg.contrast;
  root.dataset.ptBgimg = cfg.bgImage ? 'on' : 'off';
  root.style.colorScheme = preset.mode;
  set('--pt-bg-image', cfg.bgImage ? `url("${cfg.bgImage}")` : 'none');
  set('--pt-bg-dim', (cfg.bgDim / 100).toFixed(3));

  set('--pt-bg', c.bg);
  set('--pt-surface', c.surface);
  set('--pt-surface-2', c.surface2);
  set('--pt-overlay', c.overlay);
  set('--pt-text', c.text);
  set('--pt-muted', c.muted);
  set('--pt-border', c.border);
  set('--pt-primary', cfg.accent);
  set('--pt-primary-foreground', c.primaryFg);
  set('--pt-accent-2', cfg.accent2);
  set('--pt-success', c.success);
  set('--pt-warning', c.warning);
  set('--pt-danger', c.danger);
  set('--pt-info', c.info);
  set('--pt-chart-1', cfg.accent);
  set('--pt-chart-2', cfg.accent2);
  set('--pt-chart-3', c.chart[2]);
  set('--pt-chart-4', c.chart[3]);
  set('--pt-chart-5', c.chart[4]);
  set('--pt-chart-6', c.chart[5]);

  set('--pt-font', `"${cfg.font}", Vazirmatn, Tahoma, "Segoe UI", sans-serif`);
  set('--pt-font-size', `${cfg.fontSize}px`);
  set('--pt-radius', `${cfg.radius}px`);

  const density =
    cfg.density === 'comfortable'
      ? { cell: 12, space: 16, row: 48 }
      : cfg.density === 'compact'
        ? { cell: 6, space: 8, row: 36 }
        : { cell: 9, space: 12, row: 42 };
  set('--pt-cell', `${density.cell}px`);
  set('--pt-space', `${density.space}px`);
  set('--pt-row', `${density.row}px`);

  set('--pt-panel-bg', rgba(c.surface, 1 - cfg.glass * 0.0045));
  set('--pt-overlay-bg', rgba(c.overlay, 1 - cfg.glass * 0.0035));
  set('--pt-input-bg', rgba(c.bg, preset.mode === 'dark' ? 0.55 : 0.7));
  set('--pt-blur', `${cfg.blur}px`);
  set('--pt-dur-fast', `${Math.round(160 / cfg.speed)}ms`);
  set('--pt-dur', `${Math.round(320 / cfg.speed)}ms`);
  set('--pt-dur-slow', `${Math.round(900 / cfg.speed)}ms`);
  set('--pt-glow', cfg.glow ? '1' : '0');
  set('--pt-aurora-opacity', cfg.aurora ? '1' : '0');

  set('--background', c.bg);
  set('--foreground', c.text);
  set('--card', c.surface);
  set('--card-foreground', c.text);
  set('--popover', c.overlay);
  set('--popover-foreground', c.text);
  set('--primary', cfg.accent);
  set('--primary-foreground', c.primaryFg);
  set('--secondary', c.surface2);
  set('--secondary-foreground', c.text);
  set('--muted', c.surface2);
  set('--muted-foreground', c.muted);
  set('--accent', c.surface2);
  set('--accent-foreground', c.text);
  set('--destructive', c.danger);
  set('--border', c.border);
  set('--input', c.border);
  set('--ring', cfg.accent);
  set('--sidebar', c.surface);
  set('--sidebar-foreground', cfg.sidebarText || c.text);
  set('--sidebar-primary', cfg.accent);
  set('--sidebar-primary-foreground', c.primaryFg);
  // واریانت‌های هاور/کمرنگ سایدبار از رنگ نوشته‌های سایدبار مشتق می‌شوند
  set('--sidebar-accent', cfg.sidebarText
    ? `color-mix(in srgb, ${cfg.sidebarText} 14%, transparent)`
    : c.surface2);
  set('--sidebar-accent-foreground', cfg.sidebarText || c.text);
  set('--sidebar-border', cfg.sidebarText
    ? `color-mix(in srgb, ${cfg.sidebarText} 24%, ${c.border})`
    : c.border);
  set('--sidebar-ring', cfg.accent);
}

function downloadText(filename: string, text: string, type = 'application/json'): void {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function PayrollThemeProvider({ children }: { children: React.ReactNode }) {
  const [config, setConfig] = React.useState<PayrollThemeConfig>(DEFAULT_CONFIG);
  const [hydrated, setHydrated] = React.useState(false);
  const [fonts, setFonts] = React.useState<string[]>(FALLBACK_FONTS);
  const [fontsLoading, setFontsLoading] = React.useState(false);
  const [fontsError, setFontsError] = React.useState<string | null>(null);

  React.useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) setConfig(sanitize({ ...DEFAULT_CONFIG, ...JSON.parse(raw) }));
    } catch {
      setConfig(DEFAULT_CONFIG);
    }
    setHydrated(true);
  }, []);

  React.useEffect(() => {
    if (!hydrated) return;
    applyConfig(config);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    } catch {
      // احتمالاً حافظه پر است (مثلاً به‌خاطر تصویر پس‌زمینه) — بدون تصویر دوباره تلاش می‌کنیم
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...config, bgImage: '' }));
      } catch {
        /* storage may be unavailable */
      }
    }
  }, [config, hydrated]);

  const update = React.useCallback((patch: Partial<PayrollThemeConfig>) => {
    setConfig((current) => sanitize({ ...current, ...patch }));
  }, []);

  const reset = React.useCallback(() => setConfig(DEFAULT_CONFIG), []);

  const randomize = React.useCallback(() => {
    const preset = PRESETS[Math.floor(Math.random() * PRESETS.length)];
    const accents = ['#22d3ee', '#8b5cf6', '#f59e0b', '#10b981', '#f472b6', '#60a5fa', '#d4af37', '#ea580c'];
    setConfig(
      sanitize({
        ...DEFAULT_CONFIG,
        preset: preset.id,
        accent: accents[Math.floor(Math.random() * accents.length)],
        accent2: accents[Math.floor(Math.random() * accents.length)],
        radius: 10 + Math.floor(Math.random() * 16),
        glass: 20 + Math.floor(Math.random() * 55),
        blur: 8 + Math.floor(Math.random() * 16),
        speed: 0.7 + Math.random() * 1.2,
      }),
    );
  }, []);

  const exportConfig = React.useCallback(() => {
    downloadText('payroll-theme.json', JSON.stringify(config, null, 2));
  }, [config]);

  const importConfig = React.useCallback(async (file: File) => {
    const text = await file.text();
    const parsed = JSON.parse(text) as Partial<PayrollThemeConfig>;
    setConfig(sanitize({ ...DEFAULT_CONFIG, ...parsed }));
  }, []);

  const loadWindowsFonts = React.useCallback(async () => {
    setFontsLoading(true);
    setFontsError(null);
    try {
      if (typeof window !== 'undefined' && typeof window.queryLocalFonts === 'function') {
        const list = await window.queryLocalFonts();
        const families = Array.from(new Set(list.map((f) => f.family))).sort((a, b) => a.localeCompare(b, 'fa'));
        const merged = [...FALLBACK_FONTS, ...families.filter((f) => !FALLBACK_FONTS.includes(f))];
        setFonts(merged);
      } else {
        setFontsError('مرورگر شما دسترسی به فونت‌های نصب‌شده را نمی‌دهد؛ از فهرست پیش‌فرض استفاده کنید.');
      }
    } catch {
      setFontsError('اجازه خواندن فونت‌های ویندوز داده نشد یا مرورگر پشتیبانی نمی‌کند.');
    } finally {
      setFontsLoading(false);
    }
  }, []);

  const value = React.useMemo<ThemeContextValue>(
    () => ({ config, presets: PRESETS, fonts, fontsLoading, fontsError, update, reset, randomize, exportConfig, importConfig, loadWindowsFonts }),
    [config, fonts, fontsLoading, fontsError, update, reset, randomize, exportConfig, importConfig, loadWindowsFonts],
  );

  return (
    <ThemeContext.Provider value={value}>
      <div className="pt-bgimg" aria-hidden />
      {children}
      <PayrollThemeDock />
    </ThemeContext.Provider>
  );
}

function PayrollThemeDock() {
  const ctx = usePayrollTheme();
  const [open, setOpen] = React.useState(false);
  const [bgNote, setBgNote] = React.useState('');
  const fileRef = React.useRef<HTMLInputElement | null>(null);
  const bgFileRef = React.useRef<HTMLInputElement | null>(null);

  // انتخاب تصویر پس‌زمینه — کوچک‌سازی در مرورگر تا حداکثر ۱۶۰۰ پیکسل و ذخیره در localStorage
  const pickBgImage = React.useCallback(async (file: File) => {
    setBgNote('');
    try {
      const url = URL.createObjectURL(file);
      const img = new Image();
      await new Promise<void>((res, rej) => {
        img.onload = () => res();
        img.onerror = () => rej(new Error('load'));
        img.src = url;
      });
      const max = 1920;
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(img.width * scale));
      canvas.height = Math.max(1, Math.round(img.height * scale));
      const g = canvas.getContext('2d');
      if (!g) throw new Error('canvas');
      g.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      const data = canvas.toDataURL('image/jpeg', 0.82);
      if (data.length >= 4_500_000) {
        setBgNote('تصویر خیلی بزرگ است؛ تصویر کوچک‌تری انتخاب کنید.');
        return;
      }
      ctx.update({ bgImage: data });
      setBgNote('تصویر پس‌زمینه اعمال شد.');
    } catch {
      setBgNote('خواندن تصویر ممکن نشد؛ فایل دیگری انتخاب کنید.');
    }
  }, [ctx]);

  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const { config, update } = ctx;

  return (
    <div className="pt-root" dir="rtl">
      <button className="pt-fab" type="button" aria-expanded={open} aria-label="شخصی‌سازی ظاهر برنامه" title="شخصی‌سازی ظاهر" onClick={() => setOpen((v) => !v)}>
        🎨
      </button>
      {open ? (
        <section className="pt-panel" role="dialog" aria-label="شخصی‌سازی تم">
          <div className="pt-head">
            <div>
              <h2>شخصی‌سازی ظاهر</h2>
              <small>تغییرات زنده و فقط روی ظاهر برنامه</small>
            </div>
            <button className="pt-close" type="button" onClick={() => setOpen(false)} aria-label="بستن">✕</button>
          </div>

          <div className="pt-group">
            <h3>تم‌های آماده</h3>
            <div className="pt-presets">
              {ctx.presets.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className={`pt-preset ${config.preset === p.id ? 'on' : ''}`}
                  onClick={() => update({ preset: p.id, accent: p.colors.primary, accent2: p.colors.accent2 })}
                >
                  <span className="pt-dot" style={{ background: p.colors.primary }} />
                  <span>{p.name}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="pt-group">
            <h3>رنگ و فونت</h3>
            <div className="pt-row">
              <label htmlFor="pt-accent">رنگ اصلی</label>
              <input id="pt-accent" className="pt-color" type="color" value={config.accent} onChange={(e) => update({ accent: e.target.value })} />
            </div>
            <div className="pt-row">
              <label htmlFor="pt-accent2">رنگ مکمل</label>
              <input id="pt-accent2" className="pt-color" type="color" value={config.accent2} onChange={(e) => update({ accent2: e.target.value })} />
            </div>
            <div className="pt-row">
              <label htmlFor="pt-font">فونت برنامه</label>
            </div>
            <SearchableSelect
              className="w-full"
              value={config.font}
              onValueChange={(v) => update({ font: v })}
              options={ctx.fonts.map((f) => ({ value: f, label: f }))}
              searchPlaceholder="جستجوی فونت…"
            />
            <div className="pt-actions">
              <button className="pt-btn" type="button" onClick={() => void ctx.loadWindowsFonts()} disabled={ctx.fontsLoading}>
                {ctx.fontsLoading ? 'در حال خواندن…' : 'خواندن فونت‌های ویندوز'}
              </button>
              <button className="pt-btn" type="button" onClick={() => update({ font: 'Vazirmatn' })}>بازگشت به وزیرمتن</button>
            </div>
            {ctx.fontsError ? <div className="pt-note">{ctx.fontsError}</div> : null}
          </div>

          <div className="pt-group">
            <h3>پس‌زمینه و رنگ منو</h3>
            <div className="pt-row">
              <label htmlFor="pt-sidetext">رنگ نوشته‌های منو (سایدبار)</label>
              <input id="pt-sidetext" className="pt-color" type="color" value={config.sidebarText || '#eaf2ff'} onChange={(e) => update({ sidebarText: e.target.value })} />
            </div>
            <div className="pt-actions">
              <button className="pt-btn" type="button" onClick={() => update({ sidebarText: '' })}>رنگ پیش‌فرض تم برای منو</button>
            </div>
            <div className="pt-actions">
              <button className="pt-btn" type="button" onClick={() => bgFileRef.current?.click()}>
                انتخاب تصویر پس‌زمینه
              </button>
              {config.bgImage ? (
                <button className="pt-btn" type="button" onClick={() => update({ bgImage: '' })}>حذف تصویر پس‌زمینه</button>
              ) : null}
            </div>
            {config.bgImage ? (
              <>
                <div className="pt-row">
                  <label htmlFor="pt-bgdim">تاریکی پوشش روی تصویر</label>
                  <output>{config.bgDim}%</output>
                </div>
                <input id="pt-bgdim" className="pt-range" type="range" min={0} max={85} step={5} value={config.bgDim} onChange={(e) => update({ bgDim: Number(e.target.value) })} />
              </>
            ) : null}
            <input
              ref={bgFileRef}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void pickBgImage(file);
                e.target.value = '';
              }}
            />
            {bgNote ? <div className="pt-note">{bgNote}</div> : null}
          </div>

          <div className="pt-group">
            <h3>چیدمان و خوانایی</h3>
            <div className="pt-row">
              <label htmlFor="pt-size">اندازه قلم</label>
              <output>{config.fontSize}px</output>
            </div>
            <input id="pt-size" className="pt-range" type="range" min={12} max={18} step={1} value={config.fontSize} onChange={(e) => update({ fontSize: Number(e.target.value) })} />
            <div className="pt-row">
              <label htmlFor="pt-density">تراکم جدول‌ها</label>
            </div>
            <SearchableSelect
              className="w-full"
              value={config.density}
              onValueChange={(v) => update({ density: v as PayrollThemeDensity })}
              options={[
                { value: 'comfortable', label: 'راحت' },
                { value: 'cozy', label: 'متعادل' },
                { value: 'compact', label: 'فشرده' },
              ]}
            />
            <label className="pt-check">
              <input type="checkbox" checked={config.stripes} onChange={(e) => update({ stripes: e.target.checked })} />
              راه‌راه کردن ردیف‌های جدول
            </label>
            <label className="pt-check">
              <input type="checkbox" checked={config.contrast === 'high'} onChange={(e) => update({ contrast: e.target.checked ? 'high' : 'normal' })} />
              کنتراست بالا
            </label>
          </div>

          <div className="pt-group">
            <h3>جلوه‌های پویا</h3>
            <div className="pt-row">
              <label htmlFor="pt-radius">گردی گوشه‌ها</label>
              <output>{config.radius}px</output>
            </div>
            <input id="pt-radius" className="pt-range" type="range" min={6} max={28} step={1} value={config.radius} onChange={(e) => update({ radius: Number(e.target.value) })} />
            <div className="pt-row">
              <label htmlFor="pt-glass">شدت شیشه‌ای</label>
              <output>{config.glass}%</output>
            </div>
            <input id="pt-glass" className="pt-range" type="range" min={0} max={100} step={1} value={config.glass} onChange={(e) => update({ glass: Number(e.target.value) })} />
            <div className="pt-row">
              <label htmlFor="pt-blur">محوکردن پس‌زمینه</label>
              <output>{config.blur}px</output>
            </div>
            <input id="pt-blur" className="pt-range" type="range" min={0} max={28} step={1} value={config.blur} onChange={(e) => update({ blur: Number(e.target.value) })} />
            <div className="pt-row">
              <label htmlFor="pt-speed">سرعت انیمیشن</label>
              <output>{config.speed.toFixed(1)}x</output>
            </div>
            <input id="pt-speed" className="pt-range" type="range" min={0.4} max={2.4} step={0.1} value={config.speed} onChange={(e) => update({ speed: Number(e.target.value) })} />
            <label className="pt-check">
              <input type="checkbox" checked={config.motion} onChange={(e) => update({ motion: e.target.checked })} />
              فعال‌بودن حرکت‌ها
            </label>
            <label className="pt-check">
              <input type="checkbox" checked={config.glow} onChange={(e) => update({ glow: e.target.checked })} />
              درخشش کارت‌ها
            </label>
            <label className="pt-check">
              <input type="checkbox" checked={config.aurora} onChange={(e) => update({ aurora: e.target.checked })} />
              پس‌زمینهٔ اورورا
            </label>
          </div>

          <div className="pt-actions">
            <button className="pt-btn primary" type="button" onClick={ctx.randomize}>پیشنهاد تصادفی</button>
            <button className="pt-btn" type="button" onClick={ctx.reset}>بازنشانی</button>
            <button className="pt-btn" type="button" onClick={ctx.exportConfig}>خروجی تنظیمات</button>
            <button className="pt-btn" type="button" onClick={() => fileRef.current?.click()}>ورود تنظیمات</button>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void ctx.importConfig(file).catch(() => undefined);
              e.target.value = '';
            }}
          />
          <div className="pt-note">این تنظیمات در مرورگر ذخیره می‌شود و هیچ دادهٔ حقوقی را تغییر نمی‌دهد.</div>
        </section>
      ) : null}
    </div>
  );
}

export default PayrollThemeProvider;
