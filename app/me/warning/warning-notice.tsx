import { WARNING_NOTICE_TITLE, warningNoticeLines } from '@/src/lib/account';

import { AcknowledgeWarning } from './acknowledge';
import { readWarningNotice } from './notice';

/**
 * **경고를 받은 사람에게 서는 안내** — 로그인한 화면의 맨 위, 「확인했습니다」를 누를 때까지 (ADR 0108, G-57).
 *
 * 싣는 것은 갈래 · 경고한 날 · 이의 제기의 길 · 안내번호뿐이고 문구는 표 승인 그대로다(`src/lib/account/warning.ts`).
 * 판단 근거 · 신고한 사람 · 경고 횟수는 문이 애초에 안 내준다. 못 읽었으면 아무것도 안 그린다 — 부속 정보다.
 */
export async function WarningNotice() {
  const found = await readWarningNotice();
  if (!found.ok || found.value === null) return null;

  const notice = found.value;
  return (
    <div className="app-shell w-full pt-6 sm:pt-8">
      <section
        aria-labelledby="warning-notice-title"
        className="flex flex-col gap-3 rounded-[1.75rem] border border-danger bg-danger-wash p-5 sm:p-6"
      >
        <h2 id="warning-notice-title" className="text-base font-bold text-danger">
          {WARNING_NOTICE_TITLE}
        </h2>
        <div className="flex flex-col gap-1 text-sm leading-6 text-foreground">
          {warningNoticeLines(notice).map((line) => (
            <p key={line}>{line}</p>
          ))}
        </div>
        <AcknowledgeWarning warningRef={notice.ref} />
      </section>
    </div>
  );
}
