'use client';

import { useState, useTransition } from 'react';

import type { Relation } from '@/src/lib/people';

import { RelationChoice } from '../../relation-choice';
import { setPairRelation } from '../actions';

/**
 * 결과 화면에서 사이를 고치는 칸 — **다음 풀이를 위한 자리다.**
 *
 * ## 왜 여기에도 서는가
 *
 * 사이는 고르는 칸에서만 물었다. 그런데 다시 풀이받는 길은 결과 화면에 있고
 * (`ReadingPanel` 의 「다시 풀이받기」), 거기에는 이 물음이 없었다. 그래서 처음에 안
 * 골랐거나 잘못 고른 사람은 **바꿀 방법이 없었다** — 고르는 칸으로 돌아가 같은 둘을
 * 다시 고르는 길뿐이었고, 그 길은 오히려 답을 지우고 있었다.
 *
 * ## 「읽기 전에 묻는다」와 어긋나지 않는다
 *
 * ADR 0019 가 물음을 결과 화면에서 걷어 낸 것은, 이미 나온 글이 그 답을 못 쓰기
 * 때문이다. 그 규칙은 그대로다 — 이 칸은 **지금 서 있는 글**이 아니라 **다음 글**을
 * 위해 선다. 그래서 만드는 버튼 옆에 서고, 지금 글은 안 바뀐다고 그 자리에서 말한다.
 *
 * ## 누르는 즉시 적는다
 *
 * 「저장」을 따로 두면 고르고 나가 버린 사람의 답이 사라진다. 값은 하나뿐이고 되돌리는
 * 길도 칸 안에 있으므로(다시 누르면 그만이다) 확인을 받을 일이 아니다.
 */
export function RelationForNext({
  personA,
  personB,
  initial,
}: {
  personA: string;
  personB: string;
  /** 저장돼 있는 답 — 서버가 읽어 넘긴다. 화면이 저장 상태를 그대로 보여 준다 */
  initial: Relation | null;
}) {
  const [value, setValue] = useState<Relation | null>(initial);
  const [failure, setFailure] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();

  const choose = (next: Relation | null) => {
    const previous = value;
    setValue(next);
    setFailure(null);

    startSaving(async () => {
      const result = await setPairRelation(personA, personB, next);
      // 못 적었으면 칸을 되돌린다 — 화면만 바뀌어 있으면 다음 풀이가 옛 값으로 난다.
      if (!result.ok) {
        setValue(previous);
        setFailure(result.message);
      }
    });
  };

  return (
    <div className="flex flex-col gap-2 rounded-xl bg-surface-sunken px-4 py-3">
      <RelationChoice value={value} onChange={choose} idPrefix="next" />

      <p className="text-xs leading-5 text-muted" aria-live="polite">
        {saving
          ? '적는 중이에요…'
          : '지금 서 있는 글은 그대로입니다. 다시 풀이받을 때부터 이 사이로 읽어 드려요.'}
      </p>

      {failure !== null && (
        <p role="alert" className="text-xs leading-5 text-danger">
          사이를 적지 못했습니다. {failure}
        </p>
      )}
    </div>
  );
}
