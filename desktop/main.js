// اجرای برنامه وب به‌صورت پنجره دسکتاپ (exe) — Electron
// سرور Next.js را به‌صورت child process بالا می‌آورد و پنجره بومی ویندوز باز می‌کند.
//
// مقاوم‌سازی نسخه ۱.۳:
//  ۱) اگر مسیر پروفایل ویندوز (نام کاربری) حاوی حروف غیرلاتین (فارسی) باشد، موتور
//     SQLite پرisma در باز کردن فایل دیتابیس خطا می‌دهد (Internal Server Error)؛
//     در این حالت داده‌ها به پوشه همگانی C:\Users\Public\PayrollSystem منتقل می‌شود
//     که همیشه مسیر لاتین دارد و همه کاربران به آن دسترسی دارند.
//  ۲) اگر پورت 47310 اشغال باشد، خودکار پورت‌های بعدی امتحان می‌شوند.
//  ۳) لاگ کامل سرور در فایل logs\server.log ذخیره می‌شود تا خطاهای احتمالی قابل
//     ردیابی باشند؛ در صورت شکست راه‌اندازی، مسیر همین لاگ در پیام خطا نمایش داده می‌شود.
//  ۴) آماده‌بودن سرور فقط با پاسخ سالم (کد کمتر از ۵۰۰) پذیرفته می‌شود.
const { app, BrowserWindow, shell, Menu } = require('electron');
const { spawn } = require('child_process');
const path = require('path');
const http = require('http');
const fs = require('fs');
const net = require('net');

const BASE_PORT = Number(process.env.PAYROLL_PORT) || 47310;
const WEBAPP_DIR = app.isPackaged
  ? path.join(process.resourcesPath, 'webapp')
  : path.join(__dirname, '..', 'webapp');

// --- انتخاب پوشه داده با مسیر لاتین (رفع خطای SQLite روی نام کاربری فارسی) ---
function asciiSafe(p) {
  return /^[\x20-\x7E]*$/.test(p);
}
function pickDataDir() {
  const def = app.getPath('userData'); // %APPDATA%\PayrollSystem
  if (asciiSafe(def)) return def;
  const candidates = [];
  try { candidates.push(path.join(app.getPath('public'), 'PayrollSystem')); } catch {}
  candidates.push(path.join(process.env.SystemDrive || 'C:', 'PayrollSystem'));
  candidates.push(path.join(app.getPath('temp'), 'PayrollSystem'));
  for (const c of candidates) {
    try { fs.mkdirSync(c, { recursive: true }); return c; } catch {}
  }
  return def; // آخرین راه: همان مسیر پیش‌فرض
}
const DATA_DIR = pickDataDir();
try { app.setPath('userData', DATA_DIR); } catch {}
const DB_DIR = path.join(DATA_DIR, 'data');
const LOG_DIR = path.join(DATA_DIR, 'logs');
const LOG_PATH = path.join(LOG_DIR, 'server.log');

let PORT = BASE_PORT;
let serverProc = null;
let mainWindow = null;
let logStream = null;

function logLine(s) {
  const line = `[${new Date().toISOString()}] ${s}`;
  if (logStream) logStream.write(line + '\n');
  process.stdout.write(line + '\n');
}

// قفل تک‌نمونه — اجرای دوباره exe فقط پنجره قبلی را فوکوس می‌کند (جلوی دو سرور همزمان هم گرفته می‌شود)
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}

// آماده‌بودن سرور: فقط پاسخ با کد کمتر از ۵۰۰ (۵۰۰ یعنی خطای برنامه — ادامه بده تا سبز شود)
function waitServer(url, timeoutMs = 90000) {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    let lastStatus = 0;
    const probe = () => {
      if (Date.now() - started > timeoutMs) {
        reject(new Error('timeout — آخرین کد پاسخ: ' + (lastStatus || 'بدون پاسخ')));
        return;
      }
      const req = http.get(url, (res) => {
        res.resume();
        lastStatus = res.statusCode || 0;
        if (lastStatus < 500) resolve(true);
        else setTimeout(probe, 800);
      });
      req.on('error', () => setTimeout(probe, 500));
      req.setTimeout(4000, () => req.destroy(new Error('probe-timeout')));
    };
    probe();
  });
}

// اگر پورت اشغال باشد پورت بعدی امتحان می‌شود — تا ۱۰ پورت
function findFreePort(start) {
  return new Promise((resolve) => {
    const tryPort = (p, n) => {
      if (n <= 0) { resolve(start); return; }
      const s = net.createServer();
      s.once('error', () => tryPort(p + 1, n - 1));
      s.once('listening', () => s.close(() => resolve(p)));
      s.listen(p, '127.0.0.1');
    };
    tryPort(start, 10);
  });
}

function startServer() {
  fs.mkdirSync(DB_DIR, { recursive: true });
  fs.mkdirSync(LOG_DIR, { recursive: true });
  logStream = fs.createWriteStream(LOG_PATH, { flags: 'a' });
  const serverPath = path.join(WEBAPP_DIR, 'server.js');
  if (!fs.existsSync(serverPath)) {
    throw new Error('فایل سرور یافت نشد: ' + serverPath);
  }
  const dbUrl = 'file:' + path.join(DB_DIR, 'payroll.db').replace(/\\/g, '/');
  logLine(`شروع سرور — نسخه ${app.getVersion()} | پورت ${PORT} | پوشه داده: ${DATA_DIR}`);
  logLine(`DATABASE_URL: ${dbUrl}`);
  serverProc = spawn(process.execPath, [serverPath], {
    cwd: WEBAPP_DIR, // مسیر نسبی‌ها (prisma و ...) همیشه درست باشد
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: '1',
      NODE_ENV: 'production',
      PORT: String(PORT),
      HOSTNAME: '127.0.0.1',
      DATABASE_URL: dbUrl,
      PAYROLL_DATA_DIR: DATA_DIR,
      PAYROLL_WEBAPP_DIR: WEBAPP_DIR,
      NEXT_TELEMETRY_DISABLED: '1',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });
  serverProc.stdout.on('data', (d) => { logStream && logStream.write(d); });
  serverProc.stderr.on('data', (d) => { logStream && logStream.write(d); });
  serverProc.on('error', (e) => logLine('خطای فرایند سرور: ' + String(e)));
  serverProc.on('exit', (code) => {
    logLine('فرایند سرور بسته شد — کد ' + code);
    serverProc = null;
    if (mainWindow && code !== 0) mainWindow.close();
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    title: 'سامانه جامع حقوق و دستمزد و حضور و غیاب',
    backgroundColor: '#f6f7f9',
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: false,
    },
  });
  Menu.setApplicationMenu(null);
  mainWindow.webContents.on('will-navigate', (e, url) => {
    // ممیزی امنیتی ۱٫۴٫۳ (یافته ۱۲): پنجره اصلی فقط به سرور محلی خود برنامه ناوبری کند
    if (!url.startsWith(`http://127.0.0.1:${PORT}/`) && !url.startsWith('data:')) {
      e.preventDefault();
    }
  });
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    // خروجی‌های چاپ/دانلود برنامه (هم‌مبدا با سرور محلی یا blob:) در پنجره Electron جدید
    // باز می‌شوند — نشست (کوکی pd_session) حفظ می‌شود و خطای NO_SESSION رخ نمی‌دهد.
    if (url.startsWith('blob:') || url.startsWith(`http://127.0.0.1:${PORT}/`)) {
      return { action: 'allow', overrideBrowserWindowOptions: { autoHideMenuBar: true } };
    }
    // لینک‌های خارجی در مرورگر سیستم
    shell.openExternal(url);
    return { action: 'deny' };
  });
  mainWindow.loadURL(`http://127.0.0.1:${PORT}/`);
  mainWindow.on('closed', () => { mainWindow = null; });
}

function killServer() {
  if (!serverProc) return;
  try {
    if (process.platform === 'win32') {
      // کشتن کامل درخت فرایند — تضمین می‌کند سرور به‌عنوان فرایند پس‌زمینه باقی نماند
      const { execSync } = require('child_process');
      execSync(`taskkill /pid ${serverProc.pid} /t /f`, { stdio: 'ignore' });
    } else {
      serverProc.kill();
    }
  } catch {}
  serverProc = null;
}

app.whenReady().then(async () => {
  if (!gotLock) return;
  try {
    PORT = await findFreePort(BASE_PORT);
    startServer();
    await waitServer(`http://127.0.0.1:${PORT}/api/context`);
  } catch (e) {
    logLine('راه‌اندازی ناموفق: ' + String(e));
    const { dialog } = require('electron');
    dialog.showErrorBox(
      'خطای راه‌اندازی',
      'راه‌اندازی سرور محلی ناموفق بود:\n' + String(e) +
      '\n\nجزئیات کامل خطا در فایل لاگ زیر ذخیره شده است (در گزارش خطا این فایل را ارسال کنید):\n' + LOG_PATH,
    );
    app.quit();
    return;
  }
  logLine('سرور آماده است — باز کردن پنجره برنامه');
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// --- بک‌آپ اتوماتیک هنگام خروج — مورد ۱۱ نسخه ۱٫۴٫۳ ---
// بدون هیچ نمایشی، در پس‌زمینه یک کپی امن (VACUUM بهتر، در غیر این صورت کپی ساده)
// در پوشه ~/.payroll-backups گرفته می‌شود؛ نسخه‌های قدیمی‌تر از ۳۰ روز خودکار حذف می‌شوند.
function autoBackupOnExit() {
  try {
    const bdir = path.join(DATA_DIR, 'auto-backups');
    fs.mkdirSync(bdir, { recursive: true });
    const dbPath = path.join(DB_DIR, 'payroll.db');
    if (!fs.existsSync(dbPath)) return;
    const n = new Date();
    const stamp = `${n.getFullYear()}${String(n.getMonth() + 1).padStart(2, '0')}${String(n.getDate()).padStart(2, '0')}`;
    const dest = path.join(bdir, `exit-${stamp}.db`);
    fs.copyFileSync(dbPath, dest);
    // حذف بک‌آپ‌های اتوماتیک قدیمی‌تر از ۳۰ روز
    const cutoff = Date.now() - 30 * 86400000;
    for (const f of fs.readdirSync(bdir)) {
      if (!f.endsWith('.db')) continue;
      try {
        if (fs.statSync(path.join(bdir, f)).mtimeMs < cutoff) fs.unlinkSync(path.join(bdir, f));
      } catch {}
    }
    logLine('بک‌آپ اتوماتیک خروج ذخیره شد: ' + dest);
  } catch (e) {
    logLine('بک‌آپ اتوماتیک خروج ناموفق بود (بی‌صدا): ' + e);
  }
}

app.on('window-all-closed', () => {
  autoBackupOnExit();
  killServer();
  if (logStream) { logStream.end(); logStream = null; }
  app.quit();
});
app.on('before-quit', () => {
  autoBackupOnExit();
  killServer();
  if (logStream) { logStream.end(); logStream = null; }
});
