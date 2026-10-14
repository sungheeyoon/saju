/**
 * 「아까 보던 내용」 — 가입 전에 읽던 로그인 전 사주 문단의 **저장된 원문**(ADR 0143). 모델이 쓴 문단이라 줄 나눔만 살린다.
 */
export function CarryCard({ preview }: { preview: string }) {
  const paragraphs = preview.split(/\n\s*\n/).map((paragraph) => paragraph.trim()).filter((paragraph) => paragraph !== '');
  return (
    <section aria-labelledby="carry-heading" className="rounded-card border border-border bg-surface px-5 py-5 sm:px-6">
      <h3 id="carry-heading" className="text-small font-semibold text-secondary">
        아까 보던 내용
      </h3>
      <div className="mt-2 flex flex-col gap-3">
        {paragraphs.map((paragraph, at) => (
          <p key={at} className="text-body leading-7 text-foreground">
            {paragraph}
          </p>
        ))}
      </div>
    </section>
  );
}
