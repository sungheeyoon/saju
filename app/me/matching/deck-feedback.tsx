import Link from 'next/link';

import { BUTTON_TERTIARY } from '../../ui/buttons';
import { ROW_CARD } from '../../ui/surfaces';
import { FailureLine } from '../../ui/failure-line';
import { HISTORY_HREF } from './history-href';
import { REQUEST_UNSURE } from './use-deck';

/**
 * 누른 뒤의 한 줄 — 되돌릴 길(덱이 빈 뒤 · 지나친 인연), 실패, 방금 한 일(2초). 확인 창을 띄우지 않고 둔 다음에 알린다.
 * 한 화면에 한 자리에만 선다(카드 위 · 빈 날 · 지나친 인연).
 */
export function Feedback({
  onCard = false,
  undo,
  working,
  failure,
  announcement,
  flash,
}: {
  /**
   * 사진 · 큰 첫 글자 위에 뜨는 자리 — 실패 줄을 줄 카드(`ROW_CARD`) 상자에 담는다. 맨 글자로 서면 배경 글자와 겹쳐 안 읽혔다
   * (운영자 시안 선택 2026-10-11). 그림자는 카드 위 자리가 단다. 공용 `FailureLine` 은 상자 없이 그대로다
   */
  onCard?: boolean;
  undo: (() => void) | null;
  working: boolean;
  failure: string | null;
  announcement: string;
  flash: string;
}) {
  return (
    <>
      {undo !== null && (
        <p className="flex flex-wrap items-center justify-between gap-x-4 rounded-row bg-surface px-4 py-1 text-note font-medium text-foreground ring-1 ring-border">
          <span className="py-2">지나친 인연에 보관했어요</span>
          <button type="button" onClick={undo} disabled={working} className={BUTTON_TERTIARY}>
            실행 취소
          </button>
        </p>
      )}
      {failure !== null && (
        <FailureLine
          className={onCard ? ROW_CARD : ''}
          action={
            failure === REQUEST_UNSURE ? (
              <Link href={HISTORY_HREF} className={BUTTON_TERTIARY}>
                인연 기록 보기
              </Link>
            ) : undefined
          }
        >
          {failure}
        </FailureLine>
      )}
      {/* 한 줄이 둘을 한다 — 보조기기에는 늘 읽히고, 눈에는 잠깐(`flash`)만 선다 */}
      <p
        role="status"
        className={
          flash !== '' && flash === announcement
            ? 'self-center rounded-full bg-surface px-3 py-1.5 text-center text-small font-medium text-foreground ring-1 ring-border'
            : 'sr-only'
        }
      >
        {announcement}
      </p>
    </>
  );
}
