'use client';
// اسکلت موقت ماژول — تا پیاده‌سازی کامل
import { EmptyState, PageHeader } from '@/components/shared';

export default function StubModule({ title }: { title: string }) {
  return (
    <div>
      <PageHeader title={title} />
      <EmptyState title="این ماژول در حال آماده‌سازی است" hint="پس از تکمیل پیاده‌سازی، این بخش فعال می‌شود." />
    </div>
  );
}
