import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { PayrollThemeProvider } from "@/components/theme/payroll-theme";

export const metadata: Metadata = {
  title: "سامانه جامع حقوق و دستمزد و حضور و غیاب — نسخه ۱٫۴٫۷",
  description:
    "وب‌اپ لوکال مدیریت پرسنل، حضور و غیاب، حقوق و دستمزد با خروجی‌های استاندارد بانک، مالیات و بیمه + دستیار هوشمند آفلاین",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fa" dir="rtl" suppressHydrationWarning>
      <body className="antialiased bg-background text-foreground min-h-screen">
        <PayrollThemeProvider>
          {children}
          {/* توست‌های سرتاسر برنامه — همه ماژول‌ها از sonner استفاده می‌کنند و این تنها نقطه mount آن است */}
          <Toaster position="top-center" richColors closeButton dir="rtl" toastOptions={{ duration: 6000 }} />
        </PayrollThemeProvider>
      </body>
    </html>
  );
}
