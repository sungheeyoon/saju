'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';

import type { Relation } from '@/src/lib/people';

import { CARD } from '../card';
import { calculateChart } from '../chart';
import { useHashParams } from '../hash-query';
import { EvidencePanel } from '../evidence-panel';
import { PREFIX, queryFromSearchParams } from '../query';
import { RelationChoice } from '../relation-choice';

/**
 * 넘길 자료를 **손으로 들여다보는 자리** — 사용자 화면이 아니다.
 *
 * 이 칸은 원래 사주 결과(`/`)와 궁합 결과(`/compat`) 아래에 그대로 서 있었다.
 * 거기서 사용자가 만나는 것은 「프롬프트 + 자료 복사」·「JSON 내려받기」·
 * 「붙여 넣을 분량 46KB」·`relations-v1` 같은 것들이었다 — 전부 **우리가 계약을
 * 검산하려고 세운 것**이지 사주를 보러 온 사람이 쓰는 것이 아니다.
 *
 * 그래서 여기로 옮긴다. 지우지 않은 이유는 이 칸이 재는 것이 값이 아니라 **계약**이기
 * 때문이다 — 상한 표(`claims`)가 시각을 아는 명식과 모르는 명식에서 다르게 서는지,
 * 프롬프트가 자료보다 앞에 실리는지, 고른 사이가 실제로 그 글에 들어가는지. 화면에서
 * 내리면서 함께 지우면 그것을 한 번도 안 재게 된다.
 *
 * ## 입력은 여전히 `#` 뒤에서 온다
 *
 * 결과 화면과 **같은 링크를 그대로 붙여 넣으면 열린다.** 코덱도 계산도 그쪽과 한
 * 함수라(`queryFromSearchParams` · `calculateChart`), 여기서 보는 여덟 글자와
 * 결과 화면의 여덟 글자가 갈릴 자리가 없다. 서버로는 아무것도 가지 않는다(ADR 0007).
 *
 * 링크는 어디에도 걸지 않는다. `/me/reading/inspect` 와 같은 규율이다 — 주소를 아는
 * 사람이 주소로 온다.
 */
export function EvidenceView() {
  const params = useHashParams();

  /** 결과를 보는 기준 시각 — 한 번 잡고 두지 않으면 렌더마다 운이 움직인다 */
  const [viewedAt] = useState(() => Date.now());

  /**
   * 사이는 여기서 고른다 — **프롬프트에만 실리는 값이라 프롬프트 옆에 있어야 한다.**
   *
   * 익명 궁합 화면에 서 있었다. 거기서 이 라디오가 움직이는 것은 복사해 가는 글
   * 하나뿐이었으므로, 패널이 옮겨 오면서 함께 온다. 두고 왔으면 아무것도 바꾸지
   * 않는 칸이 결과 화면에 남았을 것이다.
   */
  const [relation, setRelation] = useState<Relation | null>(null);

  const charts = useMemo(() => {
    const a = queryFromSearchParams(params, PREFIX.a) ?? queryFromSearchParams(params);
    if (a === null) return null;

    const first = calculateChart(a);
    if (!first.ok) return { failure: first.message } as const;

    // 두 번째는 있을 수도 없을 수도 있다. 한 사람짜리 링크(`#date=…`)도 그대로 연다.
    const b = queryFromSearchParams(params, PREFIX.b);
    if (b === null) return { a: first.saju } as const;

    const second = calculateChart(b);
    if (!second.ok) return { failure: second.message } as const;

    return { a: first.saju, b: second.saju } as const;
  }, [params]);

  if (charts === null) {
    return (
      <section className={`${CARD} bg-surface-sunken`}>
        <h2 className="text-base font-semibold">입력이 주소에 없습니다</h2>
        <p className="mt-1.5 text-sm text-secondary">
          결과 화면에서 「결과 링크 복사」로 얻은 주소의 <code>#</code> 뒤를 그대로 붙여
          넣으면 같은 명식으로 자료가 섭니다. 한 사람짜리 링크도 열립니다.
        </p>
        <p className="mt-3 flex flex-wrap gap-3 text-sm">
          <Link href="/" className="text-accent underline underline-offset-2">
            사주 보기
          </Link>
          <Link href="/compat" className="text-accent underline underline-offset-2">
            궁합 보기
          </Link>
        </p>
      </section>
    );
  }

  if ('failure' in charts) {
    return <p className={`${CARD} text-sm text-secondary`}>{charts.failure}</p>;
  }

  return (
    <div className="flex flex-col gap-6">
      {charts.b !== undefined && (
        <RelationChoice
          value={relation}
          onChange={setRelation}
          idPrefix="evidence"
          className={CARD}
        />
      )}

      <EvidencePanel a={charts.a} b={charts.b} viewedAt={viewedAt} relation={relation} />
    </div>
  );
}
