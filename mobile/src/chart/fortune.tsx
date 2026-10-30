import { useRef, type ComponentRef, type ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import {
  BRANCH_INFO,
  DAEUN_DIRECTION_KO,
  PILLAR_POSITION_KO,
  STEM_INFO,
  TEN_GOD_KO,
  TWELVE_SPIRIT_ALIAS,
  TWELVE_SPIRIT_KO,
  TWELVE_STAGE_KO,
  type CurrentFortune,
  type Relation,
  type SaeunEntry,
  type Saju,
} from '@saju';
import {
  DAEUN_ABSENCE_KO,
  ageRangeLabel,
  crossedChartsKo,
  daeunSpanLabel,
  groupOverlaps,
  koreaMonthDay,
  relationKey,
  subjectParticle,
} from '@saju-view';
import {
  OVERLAPS_NOTE,
  SAEUN_BOUNDARY_NOTE,
  SAEUN_NOTE,
  WOLUN_BOUNDARY_NOTE,
  WOLUN_NOTE,
  daeunNote,
  daeunReasonNote,
  fortuneTabsNote,
} from '@saju-view/notes';

import { COLOR, ELEMENT_TONE, RADIUS, TYPE } from '@/ui/tokens';

import { Card, CardTabs, Rich, Ruled, ScrollHint, T, shared } from './parts';

/** 지금의 운이 원국의 같은 자리를 다시 밟는 것 — 겹칠 것이 없으면 안 선다(웹 `NowOverlaps`) */
export function NowOverlaps({ now }: { now: CurrentFortune }) {
  if (now.overlaps.length === 0) return null;
  return (
    <Card>
      <T size="lead" bold>지금이 원국의 같은 자리를 다시 밟는 것</T>
      <View style={styles.overlaps}>
        {[...groupOverlaps(now.overlaps)].map(([key, group]) => (
          <T key={key} tone="secondary">
            <T bold glyph>{group.char}</T>
            {subjectParticle(group.char)} 원국 {group.seats.map((seat) => PILLAR_POSITION_KO[seat]).join('·')}의 같은 자리를 다시 밟습니다 —{' '}
            <T>{group.names.join(' · ')}</T>
          </T>
        ))}
      </View>
      <T size="xs" tone="muted" style={styles.overlapNote}>{OVERLAPS_NOTE}</T>
    </Card>
  );
}

/** 운 표 셋 — 고르는 일만 한다(웹 `fortune-tabs.tsx`) */
export function FortuneTabs({ saju, now, asOf }: { saju: Saju; now: CurrentFortune; asOf: string }) {
  return (
    <CardTabs
      title="운 흐름"
      note={fortuneTabsNote(asOf)}
      label="운 종류"
      initial="saeun"
      tabs={[
        { key: 'daeun', label: '대운', panel: <DaeunTable saju={saju} now={now} /> },
        { key: 'saeun', label: '세운', panel: <SaeunTable saju={saju} now={now} /> },
        { key: 'wolun', label: '월운', panel: <WolunTable saju={saju} now={now} /> },
      ]}
    />
  );
}

/** 칸 하나의 폭 — 웹 표의 `min-w-[52rem]` 을 열 칸으로 나눈 값 언저리 */
const CELL = 84;

type ColumnOf = { key: string; current: boolean; head: ReactNode; cell: ReactNode; relations: ReactNode };

/** 운 표의 가로 칸 — 열 때 지금 칸이 가운데 온다. 그 뒤에는 사람이 민 자리를 건드리지 않는다(웹 `current-scroll.tsx`) */
function FortuneScroll({ columns, headHeight }: { columns: readonly ColumnOf[]; headHeight: number }) {
  const ref = useRef<ComponentRef<typeof ScrollView>>(null);
  const viewport = useRef(0);
  const placed = useRef(false);
  const currentIndex = columns.findIndex((column) => column.current);

  const place = () => {
    if (placed.current || viewport.current === 0 || currentIndex < 0) return;
    placed.current = true;
    ref.current?.scrollTo({ x: Math.max(0, currentIndex * CELL + CELL / 2 - viewport.current / 2), animated: false });
  };

  return (
    <ScrollView
      ref={ref}
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.scroll}
      onLayout={(event) => {
        viewport.current = event.nativeEvent.layout.width;
        place();
      }}
      onContentSizeChange={place}
    >
      {columns.map((column) => (
        <View key={column.key} style={styles.column}>
          <View style={[styles.head, { minHeight: headHeight }]}>{column.head}</View>
          {column.cell}
          <View style={styles.relationList}>{column.relations}</View>
        </View>
      ))}
    </ScrollView>
  );
}

function FortuneCell({
  entry,
  current,
  showSpirits = true,
}: {
  entry: Pick<SaeunEntry, 'pillar' | 'tenGods' | 'stage' | 'spirits'>;
  current: boolean;
  showSpirits?: boolean;
}) {
  return (
    <View style={[styles.cell, current && styles.cellCurrent]}>
      <T size="xs" tone="muted">{TEN_GOD_KO[entry.tenGods.stem]}</T>
      <T glyph bold color={ELEMENT_TONE[STEM_INFO[entry.pillar.stem].element].ink} style={styles.cellGlyph}>{entry.pillar.stem}</T>
      <T glyph bold color={ELEMENT_TONE[BRANCH_INFO[entry.pillar.branch].element].ink} style={styles.cellGlyph}>{entry.pillar.branch}</T>
      <T size="xs" tone="muted">{TEN_GOD_KO[entry.tenGods.branch]}</T>
      <T size="xs" tone="secondary" style={styles.stage}>{TWELVE_STAGE_KO[entry.stage]}</T>
      {showSpirits && (
        <T size="xs" tone="muted" style={styles.center}>{TWELVE_SPIRIT_ALIAS[entry.spirits.year] ?? TWELVE_SPIRIT_KO[entry.spirits.year]}</T>
      )}
    </View>
  );
}

function RelationLines({ relations, selfChartId }: { relations: readonly Relation[]; selfChartId?: string }) {
  return relations.map((relation) => {
    const crossed = selfChartId === undefined ? null : crossedChartsKo(relation, selfChartId);
    return (
      <T key={relationKey(relation)} size="xs" tone="secondary" style={styles.center}>
        {relation.ko}
        {crossed !== null && <T size="xs" tone="muted"> · {crossed}</T>}
        {relation.scope === 'combinedFormation' && <T size="xs" tone="muted"> · 합쳐서</T>}
      </T>
    );
  });
}

function HeadLine({ current, children }: { current: boolean; children: ReactNode }) {
  return (
    <T size="xs" tone={current ? 'foreground' : 'secondary'} bold={current} style={styles.center}>
      {children}
      {current && ' 현재'}
    </T>
  );
}

function TableHead({ title, value }: { title: string; value: ReactNode }) {
  return (
    <View style={shared.wrapBaseline}>
      <T size="base" bold>{title}</T>
      {value}
    </View>
  );
}

function SaeunTable({ saju, now }: { saju: Saju; now: CurrentFortune }) {
  const { entries } = saju.saeun;
  return (
    <View>
      <TableHead title="세운" value={<T tone="secondary">{entries[0].year}년 ~ {entries[entries.length - 1].year}년</T>} />
      <T size="xs" tone="secondary" style={styles.lead}>{SAEUN_BOUNDARY_NOTE}</T>
      <FortuneScroll
        headHeight={62}
        columns={entries.map((entry) => {
          const current = entry.chartId === now.saeun.chartId;
          return {
            key: String(entry.year),
            current,
            head: (
              <>
                <HeadLine current={current}>{entry.year}</HeadLine>
                <T size="xs" tone="muted" style={styles.center}>{ageRangeLabel(entry.ageAtStart, entry.ageAtEnd)}</T>
                <T size="xs" tone="muted" style={styles.center}>
                  {daeunSpanLabel(entry.daeunSpans) ?? (entry.daeunAbsence ? DAEUN_ABSENCE_KO[entry.daeunAbsence] : '')}
                </T>
              </>
            ),
            cell: <FortuneCell entry={entry} current={current} />,
            relations: <RelationLines relations={entry.relations} selfChartId={entry.chartId} />,
          };
        })}
      />
      <ScrollHint />
      <Ruled>
        <Rich parts={SAEUN_NOTE} />
      </Ruled>
    </View>
  );
}

function WolunTable({ saju, now }: { saju: Saju; now: CurrentFortune }) {
  const { year, entries } = saju.wolun;
  return (
    <View>
      <TableHead title="월운" value={<T tone="secondary">{year}년 (사주년)</T>} />
      <T size="xs" tone="secondary" style={styles.lead}>{WOLUN_BOUNDARY_NOTE}</T>
      <FortuneScroll
        headHeight={44}
        columns={entries.map((entry) => {
          const current = entry.chartId === now.wolun.chartId;
          return {
            key: entry.chartId,
            current,
            head: (
              <>
                <HeadLine current={current}>{entry.startTerm.name}</HeadLine>
                <T size="xs" tone="muted" style={styles.center}>{koreaMonthDay(entry.startTerm.date)}</T>
              </>
            ),
            cell: <FortuneCell entry={entry} current={current} showSpirits={false} />,
            relations: <RelationLines relations={entry.relations} selfChartId={entry.chartId} />,
          };
        })}
      />
      <ScrollHint />
      <Ruled>
        <Rich parts={WOLUN_NOTE} />
      </Ruled>
    </View>
  );
}

function DaeunTable({ saju, now }: { saju: Saju; now: CurrentFortune }) {
  const { daeun } = saju;
  const currentChartId = now.daeun?.chartId;
  return (
    <View>
      <TableHead
        title="대운"
        value={
          <T>
            <T bold>{DAEUN_DIRECTION_KO[daeun.direction]}</T>
            <T tone="muted"> · </T>
            대운수 <T bold num>{daeun.startAge}</T>
            {daeun.approximate && <T size="xs" tone="muted"> 근사</T>}
          </T>
        }
      />
      <T size="xs" tone="secondary" style={styles.lead}>{daeunReasonNote(daeun)}</T>
      <FortuneScroll
        headHeight={44}
        columns={daeun.entries.map((entry) => {
          const current = entry.chartId === currentChartId;
          return {
            key: entry.chartId,
            current,
            head: (
              <>
                <HeadLine current={current}>{entry.startAge}세</HeadLine>
                <T size="xs" tone="muted" style={styles.center}>{entry.startYear}년</T>
              </>
            ),
            cell: <FortuneCell entry={entry} current={current} />,
            relations: <RelationLines relations={entry.relations} />,
          };
        })}
      />
      <ScrollHint />
      <Ruled>
        <Rich parts={daeunNote(daeun.approximate)} />
      </Ruled>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { textAlign: 'center' },
  overlaps: { marginTop: 12, gap: 6 },
  overlapNote: { marginTop: 12 },
  lead: { marginTop: 6 },
  scroll: { marginTop: 16 },
  column: { width: CELL, paddingHorizontal: 3 },
  head: { paddingBottom: 8 },
  cell: { minHeight: 116, alignItems: 'center', gap: 2, borderRadius: RADIUS.control, borderWidth: 1, borderColor: 'transparent', backgroundColor: COLOR.surfaceSoft, paddingVertical: 10 },
  cellCurrent: { borderColor: COLOR.foreground, backgroundColor: COLOR.cream },
  cellGlyph: { fontSize: TYPE.title, lineHeight: 28 },
  stage: { marginTop: 4 },
  relationList: { marginTop: 6, gap: 2 },
});
