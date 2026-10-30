import { StyleSheet, View } from 'react-native';

import {
  ELEMENT_KO,
  ELEMENT_ROLE_KO,
  FOLLOWING_DIRECTION_KO,
  FOLLOWING_PATTERN_POLICY,
  FOLLOWING_PATTERN_STATUS_KO,
  JUDGEMENT_KO,
  PRECEDENCE_REASON_KO,
  type Saju,
} from '@saju';
import { percent1, percentOfRatio } from '@saju-view';
import {
  CLAIM_STRENGTH_LEGEND,
  JOHU_NOTE,
  PRECEDENCE_NOTE,
  agreementNote,
  eokbuNote,
  followingNote,
  johuHalfNote,
  tonggwanBridgeNote,
  tonggwanNote,
} from '@saju-view/notes';

import { COLOR } from '@/ui/tokens';

import { CardTabs, FactTag, Rich, T, shared } from './parts';

/** 용신 — 한 답이 아니라 관점마다의 후보다. 확정하지 않는다(웹 `yongsin-card.tsx` · `yongsin-checks.tsx`) */
export function YongsinCard({ saju }: { saju: Saju }) {
  const { eokbu, johu, tonggwan, yongsinAgreement, precedence } = saju.analysis;
  return (
    <CardTabs
      title="용신 후보"
      note="관점마다 답이 다를 수 있어 확정하지 않고 나란히 둡니다."
      label="용신 관점"
      initial="eokbu"
      tabs={[
        { key: 'eokbu', label: '억부', panel: <Eokbu eokbu={eokbu} agreement={yongsinAgreement} /> },
        { key: 'johu', label: '조후', panel: <Johu johu={johu} /> },
        { key: 'following', label: '종격', panel: <Following saju={saju} /> },
        { key: 'tonggwan', label: '통관', panel: <Tonggwan tonggwan={tonggwan} /> },
        { key: 'precedence', label: '서열', panel: <Precedence precedence={precedence} /> },
      ]}
      footnote={<Rich parts={CLAIM_STRENGTH_LEGEND} tone="secondary" />}
    />
  );
}

function Johu({ johu }: { johu: Saju['analysis']['johu'] }) {
  return (
    <View>
      <View style={shared.wrapBaseline}>
        <FactTag>참고표</FactTag>
        <T size="xs" tone="muted">조후 후보 천간</T>
        <T size="lg" glyph>{(johu.halfStems ?? johu.stems).join(' · ')}</T>
        <T size="xs" tone="secondary">
          {johu.dayMaster}일간 · {johu.monthBranch}월
          {johu.half && (
            <>
              {' · '}
              {johu.half === 'first' ? '상반월' : '하반월'}
              {johu.midTerm && (
                <T size="xs" tone="muted"> ({johu.midTerm.name} {johu.half === 'first' ? '전' : '후'})</T>
              )}
            </>
          )}
        </T>
      </View>
      <T size="xs" tone="secondary" style={styles.m6}>{johu.note}</T>
      {johu.halfStems && <Rich parts={johuHalfNote(johu.stems)} tone="secondary" style={styles.m4} />}
      <T size="xs" tone="muted" style={styles.m8}>{JOHU_NOTE}</T>
    </View>
  );
}

function Eokbu({ eokbu, agreement }: { eokbu: Saju['analysis']['eokbu']; agreement: Saju['analysis']['yongsinAgreement'] }) {
  return (
    <View>
      <View style={shared.wrapBaseline}>
        <FactTag>시험</FactTag>
        <T size="xs" tone="muted">억부 관점의 후보</T>
        <T size="lg" glyph>{eokbu.suggestedElement}</T>
        <T bold>{ELEMENT_KO[eokbu.suggestedElement]}</T>
        <T tone="secondary">{ELEMENT_ROLE_KO[eokbu.role]}</T>
        {!eokbu.presentInChart && <T size="xs" tone="muted">여덟 글자에 없는 오행</T>}
      </View>
      <T size="xs" tone="secondary" style={styles.m6}>{eokbu.reason}</T>
      <View style={styles.agreement}>
        <Rich parts={agreementNote(agreement)} tone="secondary" />
      </View>
      <Rich parts={eokbuNote(eokbu)} style={styles.m8} />
    </View>
  );
}

function Precedence({ precedence }: { precedence: Saju['analysis']['precedence'] }) {
  const shaken = precedence.rows.filter((row) => row.disagrees === true);
  return (
    <View>
      <View style={shared.wrapBaseline}>
        <FactTag>사실</FactTag>
        <T size="xs" tone="muted">판정이 어긋날 때</T>
        <T bold>{JUDGEMENT_KO[precedence.primary]}를 봅니다</T>
        {shaken.length > 0 && <T tone="secondary">지금 어긋나는 것 {shaken.map((row) => row.ko).join(' · ')}</T>}
      </View>
      <View style={styles.rows}>
        {precedence.rows.map((row) => (
          <View key={row.key} style={shared.wrapBaseline}>
            <T size="xs" bold={row.key === precedence.primary} tone={row.key === precedence.primary ? 'foreground' : 'secondary'} style={styles.rowName}>{row.ko}</T>
            <T size="xs" tone={row.overrides ? 'foreground' : 'muted'}>{row.overrides ? '기준' : '안 뒤집음'}</T>
            <T size="xs" tone="muted">{PRECEDENCE_REASON_KO[row.reason]}</T>
            {row.disagrees !== false && (
              <T size="xs" tone="secondary">{row.disagrees === null ? '견줄 수 없음' : '지금 억부와 어긋남'}</T>
            )}
          </View>
        ))}
      </View>
      <Rich parts={PRECEDENCE_NOTE} style={styles.m8} />
    </View>
  );
}

function Tonggwan({ tonggwan }: { tonggwan: Saju['analysis']['tonggwan'] }) {
  const { tightest } = tonggwan;
  return (
    <View>
      <View style={shared.wrapBaseline}>
        <FactTag>사실</FactTag>
        <T size="xs" tone="muted">가장 팽팽한 대치</T>
        <T size="lg" glyph>{tightest.controller} → {tightest.controlled}</T>
        <T tone="secondary" num>
          {ELEMENT_KO[tightest.controller]} {percent1(tightest.shares.controller)} ↔ {ELEMENT_KO[tightest.controlled]} {percent1(tightest.shares.controlled)}
        </T>
        <T size="xs" tone="muted">점수 기준(지장간·국 반영)</T>
      </View>
      <Rich parts={tonggwanBridgeNote(tightest)} tone="secondary" style={styles.m6} />
      <Rich parts={tonggwanNote(tightest)} style={styles.m8} />
    </View>
  );
}

function Following({ saju }: { saju: Saju }) {
  const { followingCandidacy: candidacy, following } = saju.analysis;
  const { dominance } = FOLLOWING_PATTERN_POLICY;
  return (
    <View>
      <View style={shared.wrapBaseline}>
        <FactTag>시험</FactTag>
        <T size="xs" tone="muted">종격</T>
        <T size="lg">{FOLLOWING_PATTERN_STATUS_KO[following.verdict]}</T>
        <T tone="secondary">
          자당(비겁·인성) 몫 <T tone="secondary" num>{percent1(following.selfShare)}</T>
          <T tone="muted"> (밖으로 종 ≤{percentOfRatio(dominance.outwardMaxSelfShare)} · 안으로 종 ≥{percentOfRatio(dominance.inwardMinSelfShare)})</T>
          {following.direction && <T tone="secondary"> {FOLLOWING_DIRECTION_KO[following.direction]}</T>}
        </T>
      </View>
      <View style={[shared.wrapBaseline, styles.m8]}>
        <FactTag>사실</FactTag>
        <T size="xs" tone="muted">판정의 재료</T>
        <T>
          일간 {candidacy.dayMasterRootless ? '무근' : '유근'}
          <T tone="muted"> · </T>
          가장 무거운 세력 {ELEMENT_ROLE_KO[candidacy.dominant.role]} <T num>{percent1(candidacy.dominant.ratio)}</T>
          <T tone="muted"> · </T>
          월령 {candidacy.monthCommandsDominant ? '그 세력이 잡음' : '다른 세력'}
          <T tone="muted"> · </T>
          투간한 생부 {candidacy.supportStems.length === 0 ? '없음' : <T glyph>{candidacy.supportStems.map((support) => support.stem).join(' ')}</T>}
        </T>
      </View>
      <Rich parts={followingNote(dominance.externalCheck)} style={styles.m8} />
    </View>
  );
}

const styles = StyleSheet.create({
  m4: { marginTop: 4 },
  m6: { marginTop: 6 },
  m8: { marginTop: 8 },
  agreement: { marginTop: 8, borderTopWidth: 1, borderTopColor: COLOR.border, paddingTop: 8 },
  rows: { marginTop: 8, gap: 4 },
  rowName: { width: 32 },
});
