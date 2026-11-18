'use client';
// وضعیت سراسری برنامه: کاربر جاری، شرکت فعال، سال مالی، دوره حقوق + پیش‌بارگذاری context
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { apiGet, apiPost } from '@/lib/api-client';

export interface SessionUser {
  id: number;
  username: string;
  fullName: string;
  role: string;
  isSupervisor: boolean;
  mustChangePassword: boolean;
  /** تاریخ انقضای اعتبار اکانت (ISO) — برای پیغام ۷ روز مانده */
  expiresAt?: string | null;
}
export interface Company {
  id: number; name: string; nationalId: string; economicCode: string;
  ssoBranchCode: string; ssoWorkshopCode: string; ssoContractRow: string;
  taxFileCode: string; postalCode: string; managerName: string;
  logoPath: string; address: string; phone: string; active: boolean;
}
export interface FiscalYear { id: number; companyId: number; jy: number; title: string }
export interface PayrollPeriod { id: number; fiscalYearId: number; jy: number; jm: number; status: string }
export interface PersonLite { id: number; personnelCode: string; firstName: string; lastName: string; status: string }

interface AppState {
  ready: boolean;
  user: SessionUser | null;
  setUser: (u: SessionUser | null) => void;
  login: (username: string, password: string) => Promise<{ ok: boolean; error?: string; mustChangePassword?: boolean }>;
  logout: () => Promise<void>;
  companies: Company[];
  company: Company | null;
  setCompany: (c: Company | null) => void;
  fiscalYears: FiscalYear[];
  fy: FiscalYear | null;
  setFy: (f: FiscalYear | null) => void;
  periods: PayrollPeriod[];
  refreshContext: () => Promise<void>;
  refreshUser: () => Promise<void>;
  version: string;
}

const Ctx = createContext<AppState | null>(null);

export function AppStateProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<SessionUser | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [company, setCompanyState] = useState<Company | null>(null);
  const [fiscalYears, setFiscalYears] = useState<FiscalYear[]>([]);
  const [fy, setFyState] = useState<FiscalYear | null>(null);
  const [periods, setPeriods] = useState<PayrollPeriod[]>([]);
  const version = '1.4.7';

  const refreshContext = useCallback(async () => {
    const data = await apiGet<{
      companies: Company[]; fiscalYears: FiscalYear[];
      activeCompanyId: number | null; activeFyId: number | null; version: string;
    }>('/api/context');
    setCompanies(data.companies);
    setFiscalYears(data.fiscalYears);
    const c = data.companies.find((x) => x.id === data.activeCompanyId) ?? data.companies[0] ?? null;
    setCompanyState(c);
    const fys = c ? data.fiscalYears.filter((f) => f.companyId === c.id) : [];
    const f = fys.find((x) => x.id === data.activeFyId) ?? fys[0] ?? null;
    setFyState(f);
    if (f) {
      const p = await apiGet<{ periods: PayrollPeriod[] }>(`/api/payroll/periods?fyId=${f.id}`);
      setPeriods(p.periods);
    } else {
      setPeriods([]);
    }
    setReady(true);
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const me = await apiGet<{ user: SessionUser | null }>('/api/auth/login');
      setUser(me.user);
      return;
    } catch {
      setUser(null);
    }
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    const res = await apiPost<{ user: SessionUser }>('/api/auth/login', { username, password });
    setUser(res.user);
    return { ok: true, mustChangePassword: res.user.mustChangePassword };
  }, []);

  const logout = useCallback(async () => {
    try { await apiPost('/api/auth/logout', {}); } catch { /* ignore */ }
    setUser(null);
    setCompanies([]);
    setCompanyState(null);
    setFiscalYears([]);
    setFyState(null);
    setPeriods([]);
  }, []);

  useEffect(() => {
    const run = async () => {
      await refreshUser();
      try {
        await refreshContext();
      } catch {
        setReady(true);
      }
    };
    void run();
  }, [refreshUser, refreshContext]);

  const setCompany = useCallback((c: Company | null) => {
    setCompanyState(c);
    const fys = c ? fiscalYears.filter((f) => f.companyId === c.id) : [];
    setFyState(fys[0] ?? null);
  }, [fiscalYears]);

  const value = useMemo<AppState>(() => ({
    ready, user, setUser, login, logout, companies, company, setCompany,
    fiscalYears, fy, setFy: setFyState, periods, refreshContext, refreshUser, version,
  }), [ready, user, login, logout, companies, company, setCompany, fiscalYears, fy, periods, refreshContext, refreshUser, version]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp(): AppState {
  const v = useContext(Ctx);
  if (!v) throw new Error('useApp باید داخل AppStateProvider استفاده شود');
  return v;
}
