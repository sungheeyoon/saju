import { useMemo, useState } from 'react';

import type { Saju } from '@saju';
import { TOPIC_TABLE_FOOTNOTE, asOf, said, sajuViewModelOf } from '@saju-view';

import { TimeCorrections, Warnings } from '@/chart/corrections';
import { ElementChart } from '@/chart/elements';
import { FortuneTabs, NowOverlaps } from '@/chart/fortune';
import { PillarChart } from '@/chart/pillars';
import { RelationTable } from '@/chart/relations';
import { StarTable } from '@/chart/stars';
import { StrengthMeter } from '@/chart/strength';
import { YongsinCard } from '@/chart/yongsin';

/** 저장한 사람의 만세력 — 절의 차례는 만세력 결과 화면(`mobile/src/app/chart.tsx`)과 같다 */
export function SajuSections({ saju }: { saju: Saju }) {
  /* 기준 시각은 화면을 연 때 하나다 — 표의 「현재」와 옆에 적은 시각이 갈리지 않는다 */
  const [viewedAt] = useState(() => Date.now());
  const model = useMemo(() => sajuViewModelOf(saju, viewedAt), [saju, viewedAt]);

  return (
    <>
      <PillarChart saju={model.saju} />
      <StarTable saju={model.saju} />
      <ElementChart saju={model.saju} />
      <StrengthMeter saju={model.saju} />
      <YongsinCard saju={model.saju} />
      <RelationTable saju={model.saju} coverage={said(model.utterances, (topic) => topic === TOPIC_TABLE_FOOTNOTE)} />
      <NowOverlaps now={model.now} />
      <FortuneTabs saju={model.saju} now={model.now} asOf={asOf(model.now)} />
      <TimeCorrections saju={model.saju} />
      <Warnings saju={model.saju} />
    </>
  );
}
