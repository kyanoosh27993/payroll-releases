'use client';
// دستیار هوشمند آفلاین — چت دو لایه (موتور درونی + Ollama محلی اختیاری)
import { useCallback, useEffect, useRef, useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Sparkles, SendHorizonal, Cpu, WifiOff, RotateCcw, Compass } from 'lucide-react';
import { apiPost } from '@/lib/api-client';
import { useApp } from '@/components/app-state';
import { cn } from '@/lib/utils';

interface AssistantAction {
  type: string; module: string; title: string;
  personnelCode?: string; jm?: number; jy?: number;
}
interface Msg {
  role: 'user' | 'assistant';
  text: string;
  engine?: string;
  nav?: { module: string; title: string } | null;
  action?: AssistantAction | null;
}

const STARTERS = [
  'چطور ساعات کاری پرسنل را ببینم یا اصلاح کنم؟',
  'جمع خالص حقوق مهر ۱۴۰۵',
  'چطور فایل دستگاه را ایمپورت کنم؟',
  'مالیات علی محمدی',
  'تعداد پرسنل',
  'چطور دوره حقوق را محاسبه کنم؟',
];

function EngineBadge({ engine }: { engine?: string }) {
  if (engine === 'ollama') {
    return (
      <Badge variant="outline" className="gap-1 border-primary/40 bg-primary/5 text-primary text-[10px]">
        <Cpu className="h-3 w-3" /> Ollama محلی
      </Badge>
    );
  }
  if (engine === 'hybrid') {
    return (
      <Badge variant="outline" className="gap-1 border-primary/40 bg-primary/5 text-primary text-[10px]">
        <Cpu className="h-3 w-3" /> Ollama + داده محلی
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="gap-1 border-success/40 bg-success/5 text-success text-[10px]">
      <WifiOff className="h-3 w-3" /> آفلاین داخلی
    </Badge>
  );
}

export default function SmartAssistant({ open, onOpenChange, onNavigate }: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onNavigate?: (moduleKey: string) => void;
}) {
  const { company, fy } = useApp();
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>(STARTERS);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open && msgs.length === 0) {
      setMsgs([{
        role: 'assistant',
        text: 'سلام! من دستیار هوشمند آفلاین سامانه هستم و بدون نیاز به اینترنت به دو نوع پرسش پاسخ می‌دهم:\n\n۱) داده‌های حقوق، حضور و تقویم (مثل «خالص حقوق علی محمدی» یا «جمع خالص مهر ۱۴۰۵»)\n۲) سوالات کاربری «چگونه کار کنم» — طبق راهنمای هر بخش توضیح کامل می‌دهم و دکمه ورود مستقیم به همان بخش برنامه را نشان می‌دهم.\n\nنمونه‌ها را از پایین انتخاب کنید یا پرسش خود را بنویسید.',
        engine: 'local',
      }]);
    }
  }, [open, msgs.length]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [msgs, loading]);

  const send = useCallback(async (text: string) => {
    const q = text.trim();
    if (!q || loading) return;
    setInput('');
    setMsgs((m) => [...m, { role: 'user', text: q }]);
    setLoading(true);
    try {
      const res = await apiPost<{ answer: string; suggestions: string[]; engine: string; nav?: { module: string; title: string } | null; action?: AssistantAction | null }>(
        '/api/ai/chat',
        { message: q, companyId: company?.id, fyId: fy?.id },
      );
      setMsgs((m) => [...m, { role: 'assistant', text: res.answer, engine: res.engine, nav: res.nav ?? null, action: res.action ?? null }]);
      if (res.suggestions?.length) setSuggestions(res.suggestions.slice(0, 3));
    } catch (e) {
      setMsgs((m) => [...m, {
        role: 'assistant',
        text: 'خطا در ارتباط با موتور محلی: ' + (e instanceof Error ? e.message : 'نامشخص'),
        engine: 'local',
      }]);
    } finally {
      setLoading(false);
    }
  }, [company?.id, fy?.id, loading]);

  const reset = () => {
    setMsgs([]);
    setSuggestions(STARTERS);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="w-full sm:w-[420px] p-0 flex flex-col gap-0">
        <SheetHeader className="border-b p-4 space-y-1">
          <SheetTitle className="flex items-center gap-2 text-base">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Sparkles className="h-4 w-4" />
            </span>
            دستیار هوشمند آفلاین
          </SheetTitle>
          <SheetDescription className="sr-only">پرسش و پاسخ هوشمند از روی داده‌های سامانه بدون نیاز به اینترنت</SheetDescription>
          <div className="flex items-center gap-2 pt-0.5">
            <EngineBadge engine={msgs.find((m) => m.role === 'assistant' && m.engine)?.engine} />
            <span className="text-[11px] text-muted-foreground">پردازش کاملا روی همین سیستم</span>
            <Button variant="ghost" size="icon" className="h-7 w-7 mr-auto" onClick={reset} title="گفتگوی جدید">
              <RotateCcw className="h-3.5 w-3.5" />
            </Button>
          </div>
        </SheetHeader>

        {/* پیام‌ها */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
          {msgs.map((m, i) => (
            <div key={i} className={cn('flex', m.role === 'user' ? 'justify-start' : 'justify-end')}>
              <div
                className={cn(
                  'max-w-[88%] rounded-2xl px-3.5 py-2.5 text-[13px] leading-6 whitespace-pre-line shadow-sm',
                  m.role === 'user'
                    ? 'bg-primary text-primary-foreground rounded-tr-md'
                    : 'bg-muted/70 border border-border/60 rounded-tl-md',
                )}
              >
                {m.text}
                {m.role === 'assistant' && m.nav && (
                  <div className="mt-2.5 flex items-center gap-2">
                    <Button
                      size="sm"
                      className="h-8 gap-1.5 text-[12px] no-print"
                      onClick={() => {
                        if (m.action) {
                          // اتوماسیون روتین (مورد ۷ نسخه ۱٫۴٫۳): فرمان به ماژول هدف ارسال می‌شود
                          window.dispatchEvent(new CustomEvent('payroll-assistant-command', { detail: m.action }));
                        }
                        onNavigate?.(m.nav!.module);
                      }}
                    >
                      <Compass className="h-3.5 w-3.5" />
                      {m.action ? 'اجرای خودکار' : `رفتن به بخش «${m.nav.title}»`}
                    </Button>
                    {m.action && m.action.personnelCode && (
                      <span className="text-[10.5px] text-muted-foreground">کد {m.action.personnelCode}</span>
                    )}
                  </div>
                )}
                {m.role === 'assistant' && m.engine && i > 0 && (
                  <div className="mt-2 pt-1.5 border-t border-border/50">
                    <EngineBadge engine={m.engine} />
                  </div>
                )}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-end">
              <div className="rounded-2xl rounded-tl-md bg-muted/70 border border-border/60 px-4 py-3">
                <span className="flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary/70 animate-bounce [animation-delay:0ms]" />
                  <span className="h-1.5 w-1.5 rounded-full bg-primary/70 animate-bounce [animation-delay:150ms]" />
                  <span className="h-1.5 w-1.5 rounded-full bg-primary/70 animate-bounce [animation-delay:300ms]" />
                </span>
              </div>
            </div>
          )}
        </div>

        {/* پیشنهادها + ورودی */}
        <div className="border-t p-3 space-y-2.5 bg-card/60">
          <div className="flex flex-wrap gap-1.5">
            {suggestions.map((s) => (
              <button
                key={s}
                onClick={() => void send(s)}
                disabled={loading}
                className="rounded-full border border-border bg-background px-3 py-1 text-[11.5px] text-foreground/80 hover:bg-primary/10 hover:text-primary hover:border-primary/40 transition-colors disabled:opacity-50"
              >
                {s}
              </button>
            ))}
          </div>
          <form
            className="flex items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              void send(input);
            }}
          >
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="پرسش خود را بنویسید… (مثال: خالص حقوق علی محمدی)"
              disabled={loading}
              className="h-10 text-[13px]"
            />
            <Button type="submit" size="icon" className="h-10 w-10 shrink-0" disabled={loading || !input.trim()}>
              <SendHorizonal className="h-4 w-4 rotate-180" />
            </Button>
          </form>
          <p className="text-[10.5px] text-muted-foreground text-center">
            موتور درونی آفلاین + پشتیبانی اختیاری از مدل Ollama روی همین سیستم — پاسخ راهنماها بر اساس راهنمای داخلی (F1)
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
}
