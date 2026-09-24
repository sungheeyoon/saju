import { WARNING_ACKNOWLEDGE_LABEL, WARNING_NOTICE_TITLE, warningNoticeLines, type WarningNotice } from '@/src/lib/account';

/**
 * 경고 안내 사본 — `app/me/warning/warning-notice.tsx` 의 모양과 승인된 문구 그대로다(ADR 0108).
 * 원본은 문(`my_warning_notice`)을 읽고 「확인했습니다」가 서버 액션이라, 여기서는 단추가 모양만 선다.
 * 실제 안내는 `/me` 레이아웃이 이 화면 위에도 따로 세운다 — 여기 것은 가짜 경고다.
 */
export function WarningBanner({ notice }: { notice: WarningNotice | null }) {
  if (notice === null) return null;

  return (
    <section
      aria-label={WARNING_NOTICE_TITLE}
      className="flex flex-col gap-3 rounded-[1.75rem] border border-danger bg-danger-wash p-5 sm:p-6"
    >
      <h2 className="text-base font-bold text-danger">{WARNING_NOTICE_TITLE}</h2>
      <div className="flex flex-col gap-1 text-sm leading-6 text-foreground">
        {warningNoticeLines(notice).map((line) => (
          <p key={line}>{line}</p>
        ))}
      </div>
      <span className="self-start rounded-full bg-accent px-4 py-2 text-sm font-semibold text-on-accent">
        {WARNING_ACKNOWLEDGE_LABEL}
      </span>
    </section>
  );
}
