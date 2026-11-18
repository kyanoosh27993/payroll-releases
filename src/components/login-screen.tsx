'use client';
// صفحه ورود — قفل تلاش ورود، تغییر اجباری رمز در اولین ورود
import { useState } from 'react';
import { Calculator, LogIn, KeyRound, Lock, LifeBuoy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { apiPost } from '@/lib/api-client';
import { useApp } from '@/components/app-state';

export function LoginScreen() {
  const { login, refreshContext, setUser } = useApp();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [recoverOpen, setRecoverOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await login(username, password);
      await refreshContext().catch(() => { /* ignore */ });
    } catch (err) {
      setError(String(err instanceof Error ? err.message : err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950 p-6" dir="rtl">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-400 to-emerald-600 shadow-xl shadow-emerald-500/30">
            <Calculator className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-xl font-bold text-white">سامانه جامع حقوق و دستمزد و حضور و غیاب</h1>
          <p className="mt-1.5 text-sm text-white/60">اجرای کاملاً محلی — برای ورود، حساب کاربری خود را وارد کنید</p>
        </div>
        <form onSubmit={submit} className="rounded-2xl border border-white/10 bg-card/95 p-6 shadow-2xl backdrop-blur">
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="u">نام کاربری</Label>
              <Input id="u" value={username} onChange={(e) => setUsername(e.target.value)}
                placeholder="مثلاً admin" autoFocus autoComplete="username" dir="ltr" className="text-left" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="p">رمز عبور</Label>
              <Input id="p" type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••" autoComplete="current-password" dir="ltr" className="text-left" />
            </div>
            {error && (
              <p className="rounded-lg bg-destructive/10 px-3 py-2 text-[13px] text-destructive">{error}</p>
            )}
            <Button type="submit" disabled={busy || !username || !password} className="w-full gap-2">
              <LogIn size={16} />
              {busy ? 'در حال ورود…' : 'ورود به برنامه'}
            </Button>
            <button
              type="button"
              onClick={() => setRecoverOpen(true)}
              className="flex w-full items-center justify-center gap-1.5 text-[12.5px] text-primary hover:underline"
            >
              <LifeBuoy size={14} />
              فراموشی رمز عبور؟ بازیابی با کد بازیابی
            </button>
            <button
              type="button"
              onClick={() => setResetOpen(true)}
              className="flex w-full items-center justify-center gap-1.5 text-[12.5px] text-muted-foreground hover:underline"
            >
              <KeyRound size={14} />
              فراموشی رمز عبور؟ تنظیم مجدد با رمز سوپروایزر
            </button>
            <p className="text-center text-[11.5px] text-muted-foreground">
              پنج تلاش ناموفق، حساب را موقتاً قفل می‌کند
            </p>
          </div>
        </form>
      </div>
      <RecoverPasswordDialog open={recoverOpen} onOpenChange={setRecoverOpen} />
      <ForgotPasswordDialog open={resetOpen} onOpenChange={setResetOpen} />
      <MustChangePassword />
      {/* دکمه خروج مستقیم */}
      <button onClick={() => setUser(null)} className="fixed bottom-4 left-4 hidden" aria-hidden />
    </div>
  );
}

/** دیالوگ بازیابی رمز فراموش‌شده با کد بازیابی (فایل recovery-key.txt کنار پایگاه‌داده) */
export function RecoverPasswordDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const [rUser, setRUser] = useState('');
  const [code, setCode] = useState('');
  const [np, setNp] = useState('');
  const [np2, setNp2] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (np !== np2) { setError('تکرار رمز جدید مطابقت ندارد'); return; }
    if (np.length < 6) { setError('رمز جدید باید حداقل ۶ نویسه باشد'); return; }
    setBusy(true);
    try {
      await apiPost('/api/auth/recover', { username: rUser, code, newPassword: np });
      setDone(true);
    } catch (err) {
      setError(String(err instanceof Error ? err.message : err));
    } finally {
      setBusy(false);
    }
  };

  const close = () => {
    onOpenChange(false);
    setRUser(''); setCode(''); setNp(''); setNp2(''); setError(''); setDone(false);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? onOpenChange(v) : close())}>
      <DialogContent className="sm:max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <LifeBuoy size={18} className="text-primary" />
            بازیابی رمز عبور فراموش‌شده
          </DialogTitle>
          <DialogDescription>
            کد بازیابی در فایل <span dir="ltr">recovery-key.txt</span> کنار پایگاه‌داده برنامه
            (پوشه داده برنامه) ذخیره شده است. آن فایل را باز کنید و کد را همراه نام کاربری و رمز جدید وارد کنید.
          </DialogDescription>
        </DialogHeader>
        {done ? (
          <div className="space-y-3.5">
            <p className="rounded-lg bg-primary/10 px-3 py-2 text-[13px] text-primary">
              رمز با موفقیت تغییر کرد. اکنون با رمز جدید وارد شوید.
            </p>
            <Button className="w-full" onClick={close}>بستن و ورود با رمز جدید</Button>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-3.5">
            <div className="space-y-1.5">
              <Label htmlFor="ru">نام کاربری</Label>
              <Input id="ru" value={rUser} onChange={(e) => setRUser(e.target.value)} dir="ltr" className="text-left" placeholder="admin" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rc">کد بازیابی</Label>
              <Input id="rc" value={code} onChange={(e) => setCode(e.target.value)} dir="ltr" className="text-left" placeholder="PR-XXXXX-XXXXX" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rnp">رمز جدید (حداقل ۶ نویسه)</Label>
              <Input id="rnp" type="password" value={np} onChange={(e) => setNp(e.target.value)} dir="ltr" className="text-left" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rnp2">تکرار رمز جدید</Label>
              <Input id="rnp2" type="password" value={np2} onChange={(e) => setNp2(e.target.value)} dir="ltr" className="text-left" />
            </div>
            {error && (
              <p className="rounded-lg bg-destructive/10 px-3 py-2 text-[13px] text-destructive">{error}</p>
            )}
            <Button type="submit" disabled={busy || !rUser || !code || !np} className="w-full gap-2">
              <KeyRound size={15} />
              {busy ? 'در حال بازیابی…' : 'ثبت رمز جدید'}
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** دیالوگ تنظیم مجدد رمز با رمز سوپروایزر — رمز موقت صادر و در ورود بعدی اجباراً تغییر می‌کند */
export function ForgotPasswordDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const [fUser, setFUser] = useState('');
  const [supPass, setSupPass] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [tempPassword, setTempPassword] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const res = await apiPost<{ tempPassword: string }>('/api/auth/forgot-password', {
        username: fUser,
        adminPassword: supPass,
      });
      setTempPassword(res.tempPassword);
    } catch (err) {
      setError(String(err instanceof Error ? err.message : err));
    } finally {
      setBusy(false);
    }
  };

  const close = () => {
    onOpenChange(false);
    setFUser(''); setSupPass(''); setError(''); setTempPassword('');
  };

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? onOpenChange(v) : close())}>
      <DialogContent className="sm:max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound size={18} className="text-primary" />
            تنظیم مجدد رمز عبور با رمز سوپروایزر
          </DialogTitle>
          <DialogDescription>
            نام کاربری فراموش‌شده و رمز اکانت سوپروایزر را وارد کنید. رمز موقت جدید صادر می‌شود
            و هنگام ورود بعدی باید آن را تغییر دهید.
          </DialogDescription>
        </DialogHeader>
        {tempPassword ? (
          <div className="space-y-3.5">
            <p className="rounded-lg bg-primary/10 px-3 py-2 text-[13px] text-primary">
              رمز موقت با موفقیت صادر شد.
            </p>
            <div className="space-y-1.5">
              <Label>رمز موقت (یادداشت کنید)</Label>
              <Input value={tempPassword} readOnly dir="ltr" className="text-left font-mono" />
            </div>
            <p className="text-[12px] text-muted-foreground">
              در ورود بعدی، برنامه به‌صورت اجباری رمز جدید از شما می‌خواهد.
            </p>
            <Button className="w-full" onClick={close}>بستن و ورود با رمز موقت</Button>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-3.5">
            <div className="space-y-1.5">
              <Label htmlFor="fu">نام کاربری</Label>
              <Input id="fu" value={fUser} onChange={(e) => setFUser(e.target.value)} dir="ltr" className="text-left" placeholder="admin" autoFocus />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sp">رمز سوپروایزر</Label>
              <Input id="sp" type="password" value={supPass} onChange={(e) => setSupPass(e.target.value)} dir="ltr" className="text-left" placeholder="••••••••" />
            </div>
            {error && (
              <p className="rounded-lg bg-destructive/10 px-3 py-2 text-[13px] text-destructive">{error}</p>
            )}
            <Button type="submit" disabled={busy || !fUser || !supPass} className="w-full gap-2">
              <KeyRound size={15} />
              {busy ? 'در حال صدور رمز موقت…' : 'صدور رمز موقت'}
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** دیالوگ تغییر اجباری رمز — تا تغییر ندهد برنامه باز نمی‌شود */
export function MustChangePassword() {
  const { user, setUser, refreshUser, refreshContext } = useApp();
  const [oldP, setOldP] = useState('');
  const [newP, setNewP] = useState('');
  const [newP2, setNewP2] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const open = !!user?.mustChangePassword;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (newP !== newP2) { setError('تکرار رمز جدید مطابقت ندارد'); return; }
    if (newP.length < 6) { setError('رمز جدید باید حداقل ۶ نویسه باشد'); return; }
    setBusy(true);
    try {
      await apiPost('/api/auth/change-password', { oldPassword: oldP, newPassword: newP });
      setUser({ ...user!, mustChangePassword: false });
      await refreshUser();
      await refreshContext().catch(() => { /* ignore */ });
    } catch (err) {
      setError(String(err instanceof Error ? err.message : err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open}>
      <DialogContent className="sm:max-w-md" dir="rtl" onInteractOutside={(e) => e.preventDefault()} showCloseButton={false}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound size={18} className="text-primary" />
            تغییر رمز عبور
          </DialogTitle>
          <DialogDescription>
            برای امنیت حساب شما، باید رمز فعلی را عوض کنید. تا انجام این کار برنامه در دسترس نیست.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3.5">
          <div className="space-y-1.5">
            <Label htmlFor="op">رمز فعلی</Label>
            <Input id="op" type="password" value={oldP} onChange={(e) => setOldP(e.target.value)} dir="ltr" className="text-left" autoFocus />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="np">رمز جدید (حداقل ۶ نویسه)</Label>
            <Input id="np" type="password" value={newP} onChange={(e) => setNewP(e.target.value)} dir="ltr" className="text-left" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="np2">تکرار رمز جدید</Label>
            <Input id="np2" type="password" value={newP2} onChange={(e) => setNewP2(e.target.value)} dir="ltr" className="text-left" />
          </div>
          {error && (
            <p className="rounded-lg bg-destructive/10 px-3 py-2 text-[13px] text-destructive">{error}</p>
          )}
          <Button type="submit" disabled={busy || !oldP || !newP} className="w-full gap-2">
            <Lock size={15} />
            {busy ? 'در حال ثبت…' : 'ثبت رمز جدید'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
