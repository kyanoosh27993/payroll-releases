'use client';
// رجیستری ماژول‌ها — هر ماژول یک کامپوننت مستقل در src/components/modules/
import { lazy, Suspense } from 'react';
import { LoadingBlock } from '@/components/shared';

const Dashboard = lazy(() => import('./dashboard'));
const Companies = lazy(() => import('./companies'));
const Personnel = lazy(() => import('./personnel'));
const Contracts = lazy(() => import('./contracts'));
const Shifts = lazy(() => import('./shifts'));
const Attendance = lazy(() => import('./attendance'));
const Payroll = lazy(() => import('./payroll'));
const StdExports = lazy(() => import('./std-exports'));
const Reports = lazy(() => import('./reports'));
const Calendar = lazy(() => import('./calendar'));
const Settings = lazy(() => import('./settings'));
const Help = lazy(() => import('./help'));
const Users = lazy(() => import('./users'));
const Audit = lazy(() => import('./audit'));
const Settlement = lazy(() => import('./settlement'));
const PrintForms = lazy(() => import('./print-forms'));
const DatabaseManager = lazy(() => import('./database'));

export type ModuleKey =
  | 'dashboard' | 'personnel' | 'contracts' | 'shifts' | 'attendance'
  | 'payroll' | 'std-exports' | 'reports' | 'calendar' | 'companies'
  | 'settings' | 'help' | 'users' | 'audit'
  | 'settlement' | 'print-forms' | 'database';

export const MODULE_REGISTRY: Record<ModuleKey, React.ComponentType> = {
  dashboard: () => <Suspense fallback={<LoadingBlock />}><Dashboard /></Suspense>,
  companies: () => <Suspense fallback={<LoadingBlock />}><Companies /></Suspense>,
  personnel: () => <Suspense fallback={<LoadingBlock />}><Personnel /></Suspense>,
  contracts: () => <Suspense fallback={<LoadingBlock />}><Contracts /></Suspense>,
  shifts: () => <Suspense fallback={<LoadingBlock />}><Shifts /></Suspense>,
  attendance: () => <Suspense fallback={<LoadingBlock />}><Attendance /></Suspense>,
  payroll: () => <Suspense fallback={<LoadingBlock />}><Payroll /></Suspense>,
  'std-exports': () => <Suspense fallback={<LoadingBlock />}><StdExports /></Suspense>,
  reports: () => <Suspense fallback={<LoadingBlock />}><Reports /></Suspense>,
  calendar: () => <Suspense fallback={<LoadingBlock />}><Calendar /></Suspense>,
  settings: () => <Suspense fallback={<LoadingBlock />}><Settings /></Suspense>,
  help: () => <Suspense fallback={<LoadingBlock />}><Help /></Suspense>,
  users: () => <Suspense fallback={<LoadingBlock />}><Users /></Suspense>,
  audit: () => <Suspense fallback={<LoadingBlock />}><Audit /></Suspense>,
  settlement: () => <Suspense fallback={<LoadingBlock />}><Settlement /></Suspense>,
  'print-forms': () => <Suspense fallback={<LoadingBlock />}><PrintForms /></Suspense>,
  database: () => <Suspense fallback={<LoadingBlock />}><DatabaseManager /></Suspense>,
};

export function ModuleView({ moduleKey }: { moduleKey: ModuleKey }) {
  const Comp = MODULE_REGISTRY[moduleKey];
  return <Comp />;
}
