'use client';

import { BUTTON_PRIMARY, BUTTON_SECONDARY } from './ui/buttons';
import { NoticeScreen } from './ui/notice-screen';
import { HomeLink } from './home-link';

/**
 * **오류 경계 둘이 세우는 한 화면** — `app/error.tsx`(화면 한 칸)와 `app/global-error.tsx`(루트 레이아웃).
 *
 * 2026-09-28 까지 앱에는 오류 경계가 없었다. 열아홉 파일의 `throw dbFailure(…)` 가 던지면 받는 것은 Next 의
 * 기본 화면이었고, 그 화면은 영어다. 문구는 운영자가 확정했다(2026-09-28) — 앱 대부분의 합쇼체와 달리
 * 해요체다. 「저장된 값은 그대로 있습니다」는 같은 날 뺐다: 경계는 저장하다 난 실패인지 모르므로 보장할 수 없다.
 *
 * **`error` 는 받지 않는다.** 운영의 Next 는 서버 컴포넌트가 던진 오류의 `message` 를 일반 문장으로 바꾸고
 * `digest` 만 남긴다(`node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/error.md`) —
 * 개발에서는 원문이 온다. 어느 쪽이든 화면에 세우지 않는다: 원문은 DB 오류일 수 있고, digest 는 사용자가
 * 할 일이 아니다. 원문은 서버 기록에 이미 있다(`app/db-error.ts` 의 `record`, 그리고 Next 가 digest 와 함께 남긴다).
 *
 * `retry` 는 경계 안을 **다시 받아서** 다시 그린다. 같은 문서의 `reset` 은 다시 받지 않고 그리기만 해서,
 * 서버에서 난 오류는 그대로 다시 선다 — 그래서 `retry` 다.
 *
 * 모양은 404 와 같은 안내 화면의 틀이다(`app/ui/notice-screen.tsx`, 2026-10-09 화면 점검 A5).
 */
export function ErrorScreen({ retry }: { retry: () => void }) {
  return (
    <NoticeScreen
      title="화면을 불러오지 못했어요"
      description={<p role="alert">잠시 후 다시 시도해 주세요.</p>}
      actions={
        <>
          <button type="button" onClick={() => retry()} className={BUTTON_PRIMARY}>
            다시 시도하기
          </button>
          <HomeLink className={BUTTON_SECONDARY}>홈으로</HomeLink>
        </>
      }
    />
  );
}
