'use client';
// مرز خطا (ErrorBoundary) — اگر یک ماژول دچار خطای runtime شود، کل برنامه سفید/کرش نمی‌شود؛
// پیغام خطای فارسی + دکمه تلاش مجدد نمایش داده می‌شود (گزاره ۱۰ و ۱۲ درخواست کاربر)
import { Component, type ReactNode } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props { children: ReactNode }
interface State { error: Error | null }

export default class ModuleErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error) {
    // لاگ کنسول برای عیب‌یابی — برنامه نمی‌بند
    console.error('[ModuleErrorBoundary]', error);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-8 text-center max-w-lg mx-auto mt-10">
          <AlertTriangle className="mx-auto mb-3 h-10 w-10 text-destructive" />
          <p className="text-base font-bold">این بخش با خطا مواجه شد</p>
          <p className="mt-2 text-[13px] text-muted-foreground leading-relaxed">
            خطای داخلی: <span className="num" dir="ltr">{this.state.error.message}</span>
            <br />
            بقیه بخش‌های برنامه سالم هستند. با دکمه زیر این بخش را دوباره بارگذاری کنید.
          </p>
          <Button className="mt-4 gap-1.5" onClick={() => this.setState({ error: null })}>
            <RotateCcw size={14} /> تلاش مجدد
          </Button>
        </div>
      );
    }
    return this.props.children;
  }
}
