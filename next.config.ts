import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // کاهش مصرف حافظه build روی ماشین‌های کم‌حافظه (NEXT_NO_MINIFY=1)
  ...(process.env.NEXT_NO_MINIFY === '1'
    ? {
        webpack: (cfg: { optimization: { minimize: boolean } }) => { cfg.optimization.minimize = false; return cfg; },
        webpackBuildWorker: false,
      }
    : {}),
  // اسکیمای SQL برای مهاجرت خودکار اولین اجرا داخل بیلد standalone همراه شود
  outputFileTracingIncludes: {
    "/**": ["./prisma/init.sql", "./node_modules/.prisma/client/**"],
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
};

export default nextConfig;
