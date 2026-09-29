'use client';

import { RELATION_LABEL, type Relation } from '@/src/lib/people';

/**
 * **무엇으로 읽는지 적는 한 줄** — 궁합풀이 만드는 버튼 곁에 선다(`ReadingPanel` 의 `ask`, ADR 0054).
 *
 * **클라이언트 잎이다 — 값 둘만 경계를 넘는다.** 이 줄은 서버의 `Result` 가 JSX 로 지어 `ask` 로 넘기고 있었고, 서버가 지은
 * 요소 나무(조건부 조각 · `<strong>` 둘)가 RSC 로 실려 클라이언트의 `ReadingPanel` 안에 그려졌다. 운영자의 개발 서버 콘솔에
 * 「Check the render method of `ReadingPanel`. It was passed a child from Result」가 떴다(2026-09-29, 화면을 연 지 몇 분 뒤 두 번 —
 * `.next/dev/logs`). 로컬 스택에서는 같은 화면 · 새로고침 · 생성 완료 뒤 되그리기 어느 것으로도 재현하지 못했다. 재현이 안 되는
 * 갈래를 짐작으로 막지 않고 **갈래 자체를 없앤다** — 문장을 여기서 지으면 경계를 넘는 것은 사이 값 둘뿐이고, 요소는 모두
 * 클라이언트가 제 손으로 짓는다(정적 자식이라 key 가 필요 없다).
 */
export function RelationNote({ readWith, next }: { readWith: Relation | null; next: Relation }) {
  return (
    <p className="text-[13px] leading-5 text-secondary">
      {readWith !== null && readWith !== next && (
        <>
          지금 글과 점수는{' '}
          <strong className="font-semibold text-foreground">{RELATION_LABEL[readWith]}</strong> 사이로
          읽었어요. 다음 풀이는{' '}
        </>
      )}
      <strong className="font-semibold text-foreground">{RELATION_LABEL[next]}</strong>{' '}
      사이로 읽어 드려요. 바꾸려면 두 사람을 고르는 자리에서 다시 골라 주세요.
    </p>
  );
}
