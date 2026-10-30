import { useMemo, type ReactNode } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';

import { buildMatchPreview, matchBasisOf } from '@matching';
import { pairSeatsOf } from '@reading-display';
import { RELATION_LABEL, relationOf, type Relation } from '@people';
import {
  ELEMENT_KO,
  GENDER_KO,
  PILLAR_POSITION_KO,
  RELATION_KIND_KO,
  RELATION_SCOPE_KO,
  STEM_INFO,
  analyzeCompatibility,
  assembleCompatText,
  compatSideOf,
  resolveRelation,
  type Compatibility,
  type CompatSide,
  type Saju,
  type Stem,
} from '@saju';
import { TOPICS_THE_TABLE_HOLDS, TOPIC_TABLE_FOOTNOTE, said, warningsToShow } from '@saju-view';
import { CLAIM_STRENGTH_LEGEND } from '@saju-view/notes';

import { Fold, Rich, Ruled, ScrollHint, T } from '@/chart/parts';
import { UtteranceList } from '@/chart/relations';
import { DayMasterChip, PillarStrip, styles as shared } from '@/people/parts';
import { StemSymbol } from '@/people/stem-symbol';
import type { ReadingTarget } from '@/reading/api';
import { ReadFailure, ReadingPanel, useReadingView } from '@/reading/panel';
import { Panel } from '@/ui/parts';
import { COLOR, ELEMENT_TONE, FONT, RADIUS, TYPE } from '@/ui/tokens';

import type { PairOutcome } from './data';

type Ok = Extract<PairOutcome, { kind: 'ok' }>;

const SIDES: readonly CompatSide[] = ['a', 'b'];
const SIDE_PERSON: Record<CompatSide, string> = { a: '첫 번째 사람', b: '두 번째 사람' };
/** 카드 위 딱지 — 운영자 확정 문구 #7(2026-09-25) */
const POLICY_BADGE = { romantic: '연인·배우자 기준', general: '일반 관계 기준' } as const;

/** 궁합 결과 — 두 명식 → 접은 표 → 베타 지표 → 사이 → 풀이 칸, 웹과 같은 차례다(`app/me/compat/screen.tsx`) */
export function CompatResult({ outcome, onReadingChanged }: { outcome: Ok; onReadingChanged: () => void }) {
  const { charts, names, relation, reading, personA, personB } = outcome;
  const compat = analyzeCompatibility(charts.a, charts.b);
  /* 눈금은 풀이가 정한다 — 있으면 그 풀이를 잰 판, 없으면 지금 적어 둔 사이로 지금 잰다(ADR 0113) */
  const basis = matchBasisOf(reading?.scoreScale ?? null, { matched: false, relation: relation.ok ? relation.relation : null });
  const preview = buildMatchPreview(charts, compat, names, basis);
  const readWith = reading === null ? null : relationOf(reading.scoreScale.relation);

  return (
    <View style={styles.stack}>
      <View style={styles.titleRow}>
        <View style={styles.pairMark}>
          {SIDES.map((side, index) => (
            <PairCircle key={side} stem={charts[side].pillars.dayMaster} shifted={index === 1} />
          ))}
        </View>
        <View style={styles.titleText}>
          <Text style={shared.title}>
            {names.a} <Text style={{ color: COLOR.secondary }}>×</Text> {names.b}
          </Text>
        </View>
      </View>

      <Panel tone="cream" style={styles.board}>
        <Text style={styles.boardEyebrow}>각자의 사주</Text>
        <Text style={shared.section}>궁합의 출발점</Text>
        {SIDES.map((side) => (
          <PairSide key={side} side={side} name={names[side]} saju={charts[side]} />
        ))}
      </Panel>

      <Fold title="두 사주를 맞대어 본 표" note="사이에 걸리는 관계와, 그 표에서 말할 수 있는 것.">
        <Between compat={compat} names={names} />
      </Fold>

      <Panel style={styles.index}>
        <View style={styles.indexHead}>
          <Text style={styles.betaTag}>궁합 베타</Text>
          {preview.policy === null ? (
            <Text style={shared.meta}>검증 중인 판정은 지표에서 제외</Text>
          ) : (
            <Text style={styles.policyTag}>{POLICY_BADGE[preview.policy]}</Text>
          )}
        </View>
        <View style={styles.score}>
          <Text style={styles.scoreNames}>
            {names.a} × {names.b}
          </Text>
          <Text style={styles.scoreValue}>{preview.index}</Text>
          <Text style={styles.scoreNames}>100점 만점 베타 탐색 지표</Text>
        </View>
        {preview.dimensions.map((dimension) => (
          <View key={dimension.key}>
            <View style={styles.dimensionHead}>
              <Text style={styles.dimensionLabel}>
                {dimension.label}
                <Text style={shared.meta}>{`  점수 반영 ${Math.round(dimension.weight * 100)}%`}</Text>
              </Text>
              <Text style={styles.dimensionValue}>{dimension.score}</Text>
            </View>
            <View style={styles.track}>
              <View style={[styles.bar, { width: `${dimension.score}%` }]} />
            </View>
            <Text style={[shared.meta, styles.dimensionNote]}>{dimension.description}</Text>
          </View>
        ))}
      </Panel>

      <Text style={shared.meta}>이 점수는 명리 자료에서 자주 다루는 기준을 조합한 베타 참고값입니다. 실제 관계의 결과를 예측하거나 두 사람의 좋고 나쁨을 판정하지 않습니다.</Text>

      <PairReadingPanel
        personA={personA}
        personB={personB}
        names={names}
        ask={relation.ok && relation.relation !== null ? <RelationNote readWith={readWith} next={relation.relation} /> : undefined}
        onReadingChanged={onReadingChanged}
      />
    </View>
  );
}

/** 궁합풀이 칸 — 받기 · 기다림 · 보기가 네 갈래 한 벌이다(`ReadingPanel`, ADR 0211). 글은 자리 호칭으로 와서 두 사람의 지금 이름으로 바꿔 세운다 */
function PairReadingPanel({
  personA,
  personB,
  names,
  ask,
  onReadingChanged,
}: {
  personA: string;
  personB: string;
  names: { a: string; b: string };
  ask: ReactNode;
  onReadingChanged: () => void;
}) {
  const target = useMemo<ReadingTarget>(() => ({ kind: 'private', personA, personB }), [personA, personB]);
  const { answer, reload } = useReadingView(target);

  if (answer === null) return <ActivityIndicator color={COLOR.secondary} />;
  if ('refused' in answer) return <ReadFailure refused={answer.refused} onRetry={reload} />;
  if (answer.view.view === 'blocked') {
    return (
      <Panel style={styles.reading}>
        <Text style={shared.noticeTitle}>{answer.view.title}</Text>
        <Text style={shared.body}>{answer.view.detail}</Text>
      </Panel>
    );
  }
  if (answer.view.view !== 'reading') return null;
  return (
    <ReadingPanel
      target={target}
      view={answer.view}
      nicknames={pairSeatsOf({ personId: personA, name: names.a }, { personId: personB, name: names.b })}
      ask={ask}
      onReadingChanged={onReadingChanged}
    />
  );
}

function PairCircle({ stem, shifted }: { stem: Stem; shifted: boolean }) {
  return (
    <View style={[styles.circle, { backgroundColor: ELEMENT_TONE[STEM_INFO[stem].element].soft }, shifted && styles.circleShifted]}>
      <StemSymbol stem={stem} size={28} />
    </View>
  );
}

function PairSide({ side, name, saju }: { side: CompatSide; name: string; saju: Saju }) {
  const stem = saju.pillars.dayMaster;
  const dayMaster = STEM_INFO[stem];
  return (
    <View style={[styles.tile, { backgroundColor: ELEMENT_TONE[dayMaster.element].soft }]}>
      <View style={styles.watermark}>
        <StemSymbol stem={stem} size={112} opacity={0.14} />
      </View>
      <DayMasterChip stem={stem} />
      <View>
        <Text style={shared.meta}>{SIDE_PERSON[side]}</Text>
        <Text style={shared.name} numberOfLines={1}>{name}</Text>
        <Text style={shared.meta}>
          {GENDER_KO[saju.meta.gender]} · {dayMaster.ko}
          {ELEMENT_KO[dayMaster.element]} 일간
        </Text>
      </View>
      <PillarStrip pillars={saju.pillars} name={name} large />
    </View>
  );
}

/** 무엇으로 읽는지 적는 한 줄 — 바꾸는 길은 두 사람을 고르는 자리다(`app/me/compat/relation-note.tsx`, ADR 0054) */
function RelationNote({ readWith, next }: { readWith: Relation | null; next: Relation }) {
  return (
    <Text style={shared.meta}>
      {readWith !== null && readWith !== next && (
        <>
          지금 글과 점수는 <Text style={shared.bodyStrong}>{RELATION_LABEL[readWith]}</Text> 사이로 읽었어요. 다음 풀이는{' '}
        </>
      )}
      <Text style={shared.bodyStrong}>{RELATION_LABEL[next]}</Text> 사이로 읽어 드려요. 바꾸려면 두 사람을 고르는 자리에서 다시 골라 주세요.
    </Text>
  );
}

/** 두 사람 사이에 대해 말할 수 있는 것 — 관계 표 · 문장 · 남은 경고. 값은 웹과 같은 함수에서 온다(`app/between-view.tsx`) */
function Between({ compat, names }: { compat: Compatibility; names: Record<CompatSide, string> }) {
  const utterances = assembleCompatText(compat, { a: { label: names.a }, b: { label: names.b } });
  const relations = compat.relations.map(resolveRelation);
  const coverage = said(utterances, (topic) => topic === TOPIC_TABLE_FOOTNOTE);
  const dayToDay = relations.filter((relation) => relation.participants.length === 2 && relation.participants.every((one) => one.position === 'day'));
  const warnings = warningsToShow(compat.warnings);

  return (
    <View style={styles.between}>
      <View style={styles.part}>
        <T size="lead" bold>두 사주 사이의 관계</T>
        <T tone="secondary">{relations.length === 0 ? '걸리는 것이 없습니다' : `${relations.length}개`}</T>
        {dayToDay.length > 0 && (
          <View style={styles.dayToDay}>
            <T size="xs" tone="muted">일지끼리 — 부부 자리로 읽는 자리입니다</T>
            {dayToDay.map((relation) => (
              <T key={relation.id}>
                <T glyph>{relation.participants.map((one) => one.char).join(' ')}</T> {relation.ko}
              </T>
            ))}
          </View>
        )}
        {relations.length > 0 && (
          <>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.table}>
                <View style={styles.tableRow}>
                  {['종류', '글자', '이름', '누구의 어느 자리'].map((head, index) => (
                    <View key={head} style={COLUMN[index]}>
                      <T size="xs" tone="muted">{head}</T>
                    </View>
                  ))}
                </View>
                {relations.map((relation) => (
                  <View key={relation.id} style={[styles.tableRow, styles.tableLine]}>
                    <View style={COLUMN[0]}><T tone="secondary">{RELATION_KIND_KO[relation.kind]}</T></View>
                    <View style={COLUMN[1]}><T glyph>{relation.participants.map((one) => one.char).join(' ')}</T></View>
                    <View style={COLUMN[2]}><T>{relation.ko}</T></View>
                    <View style={COLUMN[3]}>
                      <T size="xs" tone="secondary">
                        {relation.participants
                          .map((one) => {
                            const side = compatSideOf(one.chartId);
                            /* 계산판을 못 알아보면 이름 대신 그 이름표를 보인다 — 한쪽으로 기본값을 주면 남의 기둥이 내 것으로 적힌다 */
                            return `${side === null ? one.chartId : names[side]} ${PILLAR_POSITION_KO[one.position]}`;
                          })
                          .join(relation.cycle ? ' → ' : ' ↔ ')}
                        {relation.cycle && ' → 처음으로'}
                        {relation.scope === 'combinedFormation' && ` ${RELATION_SCOPE_KO.combinedFormation}`}
                      </T>
                    </View>
                  </View>
                ))}
              </View>
            </ScrollView>
            <ScrollHint />
          </>
        )}
        {coverage.length > 0 && (
          <Ruled>
            <UtteranceList utterances={coverage} />
          </Ruled>
        )}
        <Ruled>
          <T size="xs" tone="muted">각자의 원국 안에서 닫힌 관계는 빠져 있습니다 — 그건 각자의 명식이 이미 보여준 사실입니다. 두 사람의 기둥 사이에는 거리라는 것이 없어 몇 칸 떨어졌는지는 적지 않습니다. 성립 여부만 적고 좋고 나쁨은 판정하지 않습니다.</T>
        </Ruled>
      </View>

      <View style={styles.part}>
        <T size="lead" bold>두 사람 사이에 대해 말할 수 있는 것</T>
        <UtteranceList utterances={said(utterances, (topic) => !TOPICS_THE_TABLE_HOLDS.includes(topic))} />
        <Ruled>
          <Rich parts={CLAIM_STRENGTH_LEGEND} />
          <>
            <T size="xs" tone="muted">십성은 일간끼리만 본 값이라 양쪽이 서로 다를 수 있고, 육친(누가 누구의 무엇인가) 으로 단정하지 않습니다. 오행은 있고 없음만 셉니다 — 부족을 채우는 쪽이 좋다는 읽기와 용신에 맞아야 한다는 읽기가 갈려서 좋고 나쁨으로 환산하지 않습니다.</T>
            <T size="xs" tone="muted">
              억부 부합은 <T size="xs" bold>각자의 억부 판정을 그대로 물려받은 값</T>입니다. 억부는 용신을 잡는 네 길 중 하나일 뿐이라 확정 용신이 아니고, {'‘'}상대가 내 용신을 갖고 있다{'’'}로 읽으면 안 됩니다.
            </T>
          </>
        </Ruled>
      </View>

      {warnings.length > 0 && (
        <View style={styles.part}>
          <T size="lead" bold>주의</T>
          {warnings.map((warning) => (
            <T key={warning.kind} tone="secondary">{warning.text}</T>
          ))}
        </View>
      )}
    </View>
  );
}

const COLUMN = [{ width: 64 }, { width: 72 }, { width: 96 }, { width: 200 }] as const;

const styles = StyleSheet.create({
  stack: { gap: 14 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  titleText: { flex: 1, minWidth: 0 },
  pairMark: { flexDirection: 'row' },
  circle: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center', borderRadius: RADIUS.pill, borderWidth: 3, borderColor: COLOR.background },
  circleShifted: { marginLeft: -12 },
  board: { padding: 16, gap: 10 },
  boardEyebrow: { fontSize: TYPE.small, fontFamily: FONT.bold, color: COLOR.creamInk },
  tile: { gap: 10, padding: 16, borderRadius: 16, overflow: 'hidden' },
  watermark: { position: 'absolute', right: -20, top: -20 },
  index: { padding: 16, gap: 16 },
  indexHead: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  betaTag: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: RADIUS.pill, overflow: 'hidden', backgroundColor: COLOR.cream, fontSize: TYPE.small, fontFamily: FONT.bold, color: COLOR.creamInk },
  policyTag: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: RADIUS.pill, borderWidth: 1, borderColor: COLOR.border, fontSize: TYPE.small, fontFamily: FONT.bold, color: COLOR.secondary },
  score: { alignItems: 'center', gap: 4, paddingVertical: 20, paddingHorizontal: 16, borderRadius: 16, backgroundColor: COLOR.cream },
  scoreNames: { fontSize: TYPE.small, fontFamily: FONT.bold, color: COLOR.creamInk, textAlign: 'center' },
  scoreValue: { fontSize: 56, lineHeight: 62, fontFamily: FONT.bold, color: COLOR.foreground },
  dimensionHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 },
  dimensionLabel: { flex: 1, fontSize: TYPE.body, lineHeight: 22, fontFamily: FONT.bold, color: COLOR.foreground },
  dimensionValue: { fontSize: TYPE.body, fontFamily: FONT.bold, color: COLOR.foreground },
  track: { height: 10, marginTop: 8, borderRadius: RADIUS.pill, overflow: 'hidden', backgroundColor: COLOR.track },
  bar: { height: '100%', borderRadius: RADIUS.pill, backgroundColor: COLOR.accent },
  dimensionNote: { marginTop: 6 },
  reading: { padding: 16, gap: 10 },
  between: { gap: 20 },
  part: { gap: 8 },
  dayToDay: { gap: 4, padding: 12, borderRadius: 10, borderWidth: 1, borderColor: COLOR.border, backgroundColor: COLOR.surfaceSunken },
  table: { gap: 2 },
  tableRow: { flexDirection: 'row', gap: 8, paddingVertical: 6 },
  tableLine: { borderTopWidth: 1, borderTopColor: COLOR.border },
});
