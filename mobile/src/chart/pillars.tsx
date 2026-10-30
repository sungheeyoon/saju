import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { HOUR_UNKNOWN_LABEL } from '@input/query';
import {
  BRANCH_INFO,
  ELEMENT_KO,
  EMPTINESS_BASIS_KO,
  GENDER_KO,
  SPIRIT_BASIS_KO,
  STEM_INFO,
  TEN_GOD_KO,
  TWELVE_SPIRIT_ALIAS,
  TWELVE_SPIRIT_KO,
  TWELVE_STAGE_KO,
  type Element,
  type PillarPosition,
  type Saju,
} from '@saju';
import { PALACE, PILLAR_COLUMNS } from '@saju-view';

import { ElementSymbol } from '@/ui/element-symbol';
import { COLOR, ELEMENT_TONE, RADIUS, TYPE } from '@/ui/tokens';

import { Card, Disclosure, T, Tabs, type Tab } from './parts';

/** 사주팔자 — 여덟 글자는 언제나 한눈에, 부가 표식은 한 종류씩(웹 `pillars.tsx`) */
export function PillarChart({ saju }: { saju: Saju }) {
  const { pillars, analysis } = saju;
  const dayElement = STEM_INFO[pillars.dayMaster].element;

  const tabs: readonly Tab[] = [
    {
      key: 'hidden-stems',
      label: '지장간',
      panel: (
        <DetailPanel note="각 지지 안에 숨어 있는 천간과 십성입니다.">
          <ValueGrid
            values={(key) => {
              const hiddenStems = analysis.tenGods[key]?.hiddenStems;
              if (!hiddenStems || hiddenStems.length === 0) return null;
              return (
                <View style={styles.hiddenList}>
                  {hiddenStems.map((hidden) => (
                    <T key={hidden.stem + hidden.role} size="xs" tone="secondary" style={styles.center}>
                      <T size="xs" glyph>{hidden.stem}</T> {TEN_GOD_KO[hidden.tenGod]}
                    </T>
                  ))}
                </View>
              );
            }}
          />
        </DetailPanel>
      ),
    },
    {
      key: 'stages',
      label: '12운성',
      panel: (
        <DetailPanel note={`일간 기준 · ${saju.stages.yinReverse ? '음양순역' : '양포태'} 방식`}>
          <ValueGrid
            values={(key) => {
              const stage = saju.stages.byDayMaster[key];
              return stage ? TWELVE_STAGE_KO[stage] : null;
            }}
          />
        </DetailPanel>
      ),
    },
    {
      key: 'spirits',
      label: '12신살',
      panel: (
        <DetailPanel note="같은 자리도 무엇을 기준으로 보느냐에 따라 이름이 달라집니다.">
          <View style={styles.blocks}>
            {saju.sinsal.twelveSpirits.map((chart) => (
              <BasisBlock key={chart.basis} label={`${SPIRIT_BASIS_KO[chart.basis]} 기준`}>
                <ValueGrid
                  values={(key) => {
                    const spirit = chart.byPosition[key];
                    if (!spirit) return null;
                    return TWELVE_SPIRIT_ALIAS[spirit] ?? TWELVE_SPIRIT_KO[spirit];
                  }}
                />
              </BasisBlock>
            ))}
          </View>
        </DetailPanel>
      ),
    },
    {
      key: 'emptiness',
      label: '공망',
      panel: (
        <DetailPanel note="기준 간지가 속한 순에서 짝이 비는 두 지지를 봅니다.">
          <View style={styles.blocks}>
            {saju.sinsal.emptiness.map((emptiness) => (
              <BasisBlock key={emptiness.basis} label={`${EMPTINESS_BASIS_KO[emptiness.basis]} 기준 · ${emptiness.branches.join('')}`}>
                <ValueGrid values={(key) => (emptiness.positions.includes(key) ? '공망' : null)} />
              </BasisBlock>
            ))}
          </View>
        </DetailPanel>
      ),
    },
  ];

  return (
    <Card>
      <View style={styles.head}>
        <T size="heading" bold>사주팔자</T>
        <View style={[styles.dayBadge, { backgroundColor: ELEMENT_TONE[dayElement].soft }]}>
          <View style={styles.dayBadgeIcon}>
            <ElementSymbol element={dayElement} size={20} />
          </View>
          <T size="small" bold color={ELEMENT_TONE[dayElement].ink}>
            일간 <T size="base" glyph bold color={ELEMENT_TONE[dayElement].ink}>{pillars.dayMaster}</T> · {STEM_INFO[pillars.dayMaster].ko}{ELEMENT_KO[dayElement]}
          </T>
        </View>
      </View>

      <PillarTable saju={saju} />

      {(pillars.meta.sajuYear !== saju.meta.inputTime.year || pillars.meta.lateNightShiftApplied) && (
        <View accessibilityLabel="사주를 바꾼 입력 안내" style={styles.notice}>
          {pillars.meta.sajuYear !== saju.meta.inputTime.year && (
            <T size="small" tone="secondary">
              <T size="small" bold>사주년 {pillars.meta.sajuYear}년</T> · 입춘 전이라 달력연도 {saju.meta.inputTime.year}년과 다릅니다.
            </T>
          )}
          {pillars.meta.lateNightShiftApplied && (
            <T size="small" tone="secondary">
              <T size="small" bold>조자시 적용</T> · 일주를 다음 날로 넘겼습니다.
            </T>
          )}
        </View>
      )}

      <View style={styles.details}>
        <Tabs tabs={tabs} label="사주팔자 상세 정보" small />
      </View>

      <Disclosure title="네 기둥은 무엇을 뜻하나요?" style={styles.firstDisclosure}>
        <View style={styles.palaces}>
          {PILLAR_COLUMNS.map(({ key, label }) => (
            <View key={key} style={styles.palace}>
              <T size="small" bold>{label} · {PALACE[key].period}</T>
              <T size="small" tone="secondary" style={styles.palaceMeaning}>{PALACE[key].meaning}</T>
            </View>
          ))}
        </View>
        <T size="xs" tone="secondary" style={styles.palaceNote}>
          궁은 계산값이 아니라 자리에 붙는 전통적 상징입니다. 관계와 연령 구간은 넓게 참고해 주세요.
        </T>
      </Disclosure>

      <Disclosure title="계산 기준과 출생 정보">
        <View style={styles.terms}>
          {saju.meta.gender && (
            <Term label="성별">
              {GENDER_KO[saju.meta.gender]}
              <T tone="muted"> · 여덟 글자는 성별로 달라지지 않습니다</T>
            </Term>
          )}
          <Term label="사주년">
            {pillars.meta.sajuYear}년 <T tone="muted">입춘 기준</T>
          </Term>
          <Term label="절기">{pillars.meta.monthTerm.name} ~ {pillars.meta.nextTerm.name}</Term>
          {pillars.meta.hourKnown ? (
            <Term label="자시 규칙">{pillars.meta.lateNightRule === 'jo' ? '조자시' : '야자시'}</Term>
          ) : (
            <Term label="출생 시각">
              미상 <T tone="muted">· 시주를 뽑지 않았습니다</T>
            </Term>
          )}
        </View>
      </Disclosure>
    </Card>
  );
}

function PillarTable({ saju }: { saju: Saju }) {
  const { pillars, analysis } = saju;
  return (
    <View style={styles.table}>
      {PILLAR_COLUMNS.map(({ key, label }) => {
        const pillar = pillars[key];
        const tenGods = analysis.tenGods[key];
        return (
          <View key={key} style={styles.column}>
            <T size="xs" tone="secondary" style={styles.center}>{PALACE[key].period}</T>
            <T size="sm" bold tone={key === 'day' ? 'foreground' : 'secondary'} style={styles.columnLabel}>{label}</T>
            <View accessibilityLabel={`${label} 천간과 지지`} style={[styles.stack, key === 'day' && styles.stackDay]}>
              <Glyph
                glyph={pillar ? pillar.stem : null}
                element={pillar ? STEM_INFO[pillar.stem].element : null}
                caption={pillar ? `${STEM_INFO[pillar.stem].ko}·${ELEMENT_KO[STEM_INFO[pillar.stem].element]}` : HOUR_UNKNOWN_LABEL}
                tenGod={tenGods?.stem ?? null}
                dayMaster={key === 'day'}
              />
              <Glyph
                glyph={pillar ? pillar.branch : null}
                element={pillar ? BRANCH_INFO[pillar.branch].element : null}
                caption={pillar ? `${BRANCH_INFO[pillar.branch].ko}·${ELEMENT_KO[BRANCH_INFO[pillar.branch].element]}` : HOUR_UNKNOWN_LABEL}
                tenGod={tenGods?.branch ?? null}
                relationshipSeat={key === 'day'}
              />
            </View>
          </View>
        );
      })}
    </View>
  );
}

function Glyph({
  glyph,
  caption,
  element,
  tenGod,
  dayMaster = false,
  relationshipSeat = false,
}: {
  glyph: string | null;
  caption: string;
  element: Element | null;
  tenGod: keyof typeof TEN_GOD_KO | null;
  dayMaster?: boolean;
  relationshipSeat?: boolean;
}) {
  const ink = element === null ? COLOR.none : ELEMENT_TONE[element].ink;
  const soft = element === null ? COLOR.noneSoft : ELEMENT_TONE[element].soft;
  return (
    <View style={[styles.glyphBox, { backgroundColor: soft }, glyph === null && styles.glyphUnknown]}>
      {dayMaster ? (
        <View style={styles.me}>
          <T size="xs" bold color={COLOR.background}>나</T>
        </View>
      ) : (
        <T size="xs" bold color={ink} style={styles.tenGod}>{tenGod ? TEN_GOD_KO[tenGod] : glyph === null ? '—' : ''}</T>
      )}
      <T glyph bold color={glyph === null ? COLOR.muted : ink} style={styles.glyph}>{glyph ?? '?'}</T>
      <View style={styles.captionRow}>
        {glyph !== null && <ElementSymbol element={element} size={14} />}
        <T size="xs" bold color={ink} style={styles.caption}>{caption}</T>
      </View>
      {relationshipSeat && (
        <View style={styles.seat}>
          <T size="xs" bold>관계 자리</T>
        </View>
      )}
    </View>
  );
}

function Term({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View style={styles.term}>
      <T tone="muted">{label}</T>
      <T style={styles.termValue}>{children}</T>
    </View>
  );
}

function DetailPanel({ note, children }: { note: string; children: ReactNode }) {
  return (
    <View>
      <T size="small" tone="secondary" style={styles.detailNote}>{note}</T>
      {children}
    </View>
  );
}

function ValueGrid({ values }: { values: (position: PillarPosition) => ReactNode | null }) {
  return (
    <View style={styles.grid}>
      {PILLAR_COLUMNS.map(({ key, label }) => {
        const value = values(key);
        return (
          <View key={key} style={[styles.gridCell, key === 'day' && styles.gridCellDay]}>
            <T size="xs" tone="secondary" bold style={styles.gridLabel}>{label}</T>
            {value === null ? (
              <T size="xs" tone="secondary" style={styles.dot}>·</T>
            ) : typeof value === 'string' ? (
              <T size="xs" tone={key === 'day' ? 'foreground' : 'secondary'} style={styles.center}>{value}</T>
            ) : (
              value
            )}
          </View>
        );
      })}
    </View>
  );
}

function BasisBlock({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View>
      <T size="xs" tone="secondary" bold style={styles.basisLabel}>{label}</T>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { textAlign: 'center' },
  head: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  dayBadge: { minHeight: 36, flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: RADIUS.pill, paddingVertical: 4, paddingLeft: 6, paddingRight: 12 },
  dayBadgeIcon: { width: 28, height: 28, borderRadius: RADIUS.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: COLOR.surface },
  table: { flexDirection: 'row', gap: 6, marginTop: 20 },
  column: { flex: 1, minWidth: 0 },
  columnLabel: { textAlign: 'center', marginBottom: 8 },
  stack: { gap: 6, padding: 3, borderRadius: RADIUS.cell, borderWidth: 2, borderColor: 'transparent' },
  stackDay: { borderColor: COLOR.foreground, backgroundColor: 'rgba(38, 36, 31, 0.06)' },
  glyphBox: { minHeight: 136, alignItems: 'center', justifyContent: 'center', gap: 4, borderRadius: RADIUS.cell, paddingHorizontal: 2, paddingVertical: 10 },
  glyphUnknown: { borderWidth: 2, borderStyle: 'dashed', borderColor: 'rgba(95, 100, 93, 0.3)' },
  me: { minHeight: 20, justifyContent: 'center', borderRadius: RADIUS.pill, paddingHorizontal: 8, backgroundColor: COLOR.foreground },
  /* 칸 폭이 소수라 안드로이드가 글자 폭을 화소에 맞춰 내리면 마지막 글자가 다음 줄로 밀려 잘린다(월지 「정관」→「정」). 글자에 꼭 맞는 폭을 안 주면 안 밀린다 */
  tenGod: { alignSelf: 'stretch', minHeight: 20, lineHeight: 20, textAlign: 'center' },
  glyph: { fontSize: TYPE.figure, lineHeight: 46 },
  captionRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: 2 },
  /* 같은 까닭 — 「사·화」보다 조금 넓게 잡는다 */
  caption: { minWidth: TYPE.fine * 2.75, lineHeight: 16, textAlign: 'center' },
  seat: { borderRadius: RADIUS.pill, paddingHorizontal: 5, backgroundColor: COLOR.surface },
  notice: { marginTop: 16, gap: 6, borderRadius: RADIUS.cell, borderWidth: 1, borderColor: COLOR.warningBorder, backgroundColor: COLOR.warningWash, paddingHorizontal: 16, paddingVertical: 12 },
  details: { marginTop: 20, borderTopWidth: 1, borderTopColor: COLOR.border, paddingTop: 20 },
  firstDisclosure: { marginTop: 20, paddingTop: 12 },
  palaces: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  palace: { width: '48%', flexGrow: 1, borderRadius: RADIUS.cell, backgroundColor: COLOR.surfaceSoft, padding: 12 },
  palaceMeaning: { marginTop: 4 },
  palaceNote: { marginTop: 8 },
  terms: { gap: 6 },
  term: { flexDirection: 'row', gap: 16 },
  termValue: { flex: 1 },
  detailNote: { marginBottom: 12 },
  blocks: { gap: 16 },
  hiddenList: { gap: 4 },
  grid: { flexDirection: 'row', gap: 4 },
  gridCell: { flex: 1, minWidth: 0, borderRadius: RADIUS.cell, borderWidth: 1, borderColor: 'transparent', backgroundColor: COLOR.surfaceSoft, paddingHorizontal: 2, paddingVertical: 8 },
  gridCellDay: { backgroundColor: COLOR.cream, borderColor: COLOR.borderStrong },
  gridLabel: { textAlign: 'center', marginBottom: 4 },
  dot: { textAlign: 'center', opacity: 0.4 },
  basisLabel: { marginBottom: 6 },
});
