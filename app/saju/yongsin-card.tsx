import {
  ELEMENT_KO,
  ELEMENT_ROLE_KO,
  UNRESOLVED_FACTOR_KO,
  type Saju,
} from '@/src/lib/saju';
import {
  subjectParticle,
} from './shared';
import {
  CardTabs,
} from './card-tabs';
import {
  ClaimStrengthLegend,
} from '../utterances';
import { FACT_TAG } from './fact-tag';
import {
  FollowingCandidacyNote,
  PrecedenceTable,
  TonggwanFacts,
} from './yongsin-checks';


/**
 * 용신 — **한 답이 아니라 관점마다의 후보다.**
 *
 * 이 다섯이 신강·신약 카드 하나에 들어 있었다. 조후·억부·종격·통관·서열이 각자 딱지와
 * 해명 문단을 달고 세로로 쌓여, 카드 하나가 화면 두 개 높이였다 — 「신강인가 신약인가」를
 * 보러 온 사람이 그 답 아래로 스무 문단을 지나야 했다.
 *
 * **가르는 선은 「무엇을 재는가」다.** 강약은 일간의 세기 하나를 재고, 여기 다섯은 전부
 * 「그래서 무엇을 쓰나」에 서로 다른 길로 답한다. 답이 갈릴 수 있다는 것이 이 카드의
 * 내용이므로, 한 판씩 골라 보는 것이 나란히 쌓는 것보다 그 사실을 잘 말한다.
 *
 * **확정하지 않는다.** 어느 길이 먼저인지는 엔진이 판정하지 않고(`YONGSIN_POLICY`),
 * 서열 판은 그 규칙을 값으로 든다.
 */
export function YongsinCard({ saju }: { saju: Saju }) {
  const { eokbu, johu, tonggwan, yongsinAgreement, precedence } = saju.analysis;

  return (
    <CardTabs
      id="yongsin"
      anchorId="yongsin"
      title="용신 후보"
      note="관점마다 답이 다를 수 있어 확정하지 않고 나란히 둡니다."
      tablistLabel="용신 관점"
      initial="eokbu"
      tabs={[
        { key: 'eokbu', label: '억부', panel: <EokbuNote eokbu={eokbu} agreement={yongsinAgreement} /> },
        { key: 'johu', label: '조후', panel: <JohuNote johu={johu} /> },
        { key: 'following', label: '종격', panel: <FollowingCandidacyNote saju={saju} /> },
        { key: 'tonggwan', label: '통관', panel: <TonggwanFacts tonggwan={tonggwan} /> },
        { key: 'precedence', label: '서열', panel: <PrecedenceTable precedence={precedence} /> },
      ]}
      /*
        **딱지 범례가 여기 산다.**

        「이 명식에 대해 말할 수 있는 것」 카드가 들고 있었다. 그 카드를 걷으면서 범례만
        남길 자리를 찾았는데, 「시험」과 「참고표」가 실제로 붙는 곳이 이 다섯 판이다
        (「사실」은 낱말이 스스로 말한다). 설명이 그 딱지 옆에 있는 것이 화면 맨 위에
        모여 있는 것보다 낫다 — 고지를 모아 두면 읽는 사람이 그 덩어리를 건너뛴다.

        판 **밖에** 둔다. 안에 두면 다섯 판이 같은 문단을 다섯 번 들고, 그러면 판을
        옮길 때마다 같은 글이 다시 나타나 각주가 본문처럼 읽힌다.
      */
      footnote={<ClaimStrengthLegend />}
    />
  );
}


/** 조후 — 《궁통보감》 조건 요약. **확정 용신이 아니라 후보와 조건이다.** */
function JohuNote({ johu }: { johu: Saju['analysis']['johu'] }) {
  return (
    <div>
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className={FACT_TAG}>
          참고표
        </span>
        <span className="text-xs text-muted">조후 후보 천간</span>
        <span className="glyph text-lg font-medium">
          {(johu.halfStems ?? johu.stems).join(' · ')}
        </span>
        <span className="text-xs text-secondary">
          {johu.dayMaster}일간 · {johu.monthBranch}월
          {johu.half && (
            <>
              {' · '}
              {johu.half === 'first' ? '상반월' : '하반월'}
              {johu.midTerm && (
                <span className="text-muted">
                  {' '}
                  ({johu.midTerm.name} {johu.half === 'first' ? '전' : '후'})
                </span>
              )}
            </>
          )}
        </span>
      </div>
      <p className="mt-1.5 text-xs text-secondary">{johu.note}</p>
      {johu.halfStems && (
        <p className="mt-1 text-xs text-secondary">
          이 칸은 상·하반월로 갈려서 그 절반의 후보만 위에 적었습니다. 전체 후보는{' '}
          <span className="glyph">{johu.stems.join(' · ')}</span> 입니다.
        </p>
      )}
      {/*
        **줄인다.** 상·하반월만 판정하는 까닭(경계가 천문으로 정해진다)과 세력 조건을
        판정하지 않는 까닭이 각각 한 문장씩 있었다. 남는 것은 **사용자가 알아야 읽는 법이
        바뀌는 것** 하나다 — 이것은 확정 용신이 아니다.
      */}
      <p className="mt-2 text-xs text-muted">
        세력 조건(&lsquo;수가 왕하면 戊&rsquo;)은 판정하지 않으므로, 확정 용신이 아니라
        후보와 조건을 함께 읽어야 합니다.
      </p>
    </div>
  );
}


/** 억부 — 세력에서 나온 후보 하나와, 조후와 같은 곳을 가리키는지. */
function EokbuNote({
  eokbu,
  agreement,
}: {
  eokbu: Saju['analysis']['eokbu'];
  agreement: Saju['analysis']['yongsinAgreement'];
}) {
  return (
    <div>
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className={FACT_TAG}>
          시험
        </span>
        <span className="text-xs text-muted">억부 관점의 후보</span>
        <span className="glyph text-lg font-medium">{eokbu.suggestedElement}</span>
        <span className="text-sm font-medium">{ELEMENT_KO[eokbu.suggestedElement]}</span>
        <span className="text-sm text-secondary">{ELEMENT_ROLE_KO[eokbu.role]}</span>
        {!eokbu.presentInChart && (
          <span className="text-xs text-muted">여덟 글자에 없는 오행</span>
        )}
      </div>
      <p className="mt-1.5 text-xs text-secondary">{eokbu.reason}</p>

      {/*
        **두 칸이 서로 무슨 관계인지 말한다.**

        조후와 억부가 여태 나란히 서 있기만 했다. 하나는 「土를 쓰라」 하고 다른 하나는
        「壬·丙을 보라」 하는데, 그 둘이 같은 말인지는 읽는 사람이 오행 표를 외워 맞춰
        봐야 알 수 있었다 — 무작위 3000건에서 **어긋나는 명식이 43.2%** 다.

        판이 갈린 뒤로 이 줄이 더 필요해졌다. 조후는 이제 옆 탭에 있어 함께 보이지 않는다.
      */}
      <p className="mt-2 border-t border-border pt-2 text-xs text-secondary">
        <span className="font-medium">
          {agreement.aligned ? '조후와 같은 곳을 가리킵니다.' : '조후와 다른 곳을 가리킵니다.'}
        </span>{' '}
        {agreement.aligned ? (
          <>
            조후가 권한 글자 가운데{' '}
            <span className="glyph">{agreement.sharedStems.join(' · ')}</span>
            {subjectParticle(agreement.sharedStems[agreement.sharedStems.length - 1])}{' '}
            억부와 같은 {ELEMENT_KO[agreement.eokbuElement]}입니다.
          </>
        ) : (
          <>
            조후가 권한 <span className="glyph">{agreement.johuStems.join(' · ')}</span> 중에는
            억부가 권한 {ELEMENT_KO[agreement.eokbuElement]}
            {subjectParticle(ELEMENT_KO[agreement.eokbuElement])} 없습니다.
          </>
        )}{' '}
        <span className="text-muted">어느 쪽이 먼저인지는 「서열」 판이 답합니다.</span>
      </p>

      {/*
        **열두 문장이 두 문장이 됐다.**

        여기 있던 것은 대부분 **아직 판정하지 않은 것들의 목록**이었다 — 기신을 왜 안
        내는지, 희용기구한을 왜 화면에 안 세우는지, 통근·투출을 어디까지 쟀는지. 그것들은
        각자 제 자리(통근 칸·서열 판)에서 이미 말하고 있고, 여기서 다시 세면 **읽는 사람이
        후보 하나를 보려고 아직 없는 것 여섯을 지나야 한다.**

        남기는 것은 이 후보를 잘못 읽지 않게 하는 둘이다: 확정이 아니라는 것과, 무엇이
        아직 안 재어졌는가.
      */}
      <p className="mt-2 text-xs text-muted">
        <strong className="font-medium">용신 확정값이 아닙니다.</strong> 억부는 용신을 잡는
        네 길 중 하나이고, 아직 판정하지 않은 것이 남아 있습니다 —{' '}
        {eokbu.unresolved.map((factor) => UNRESOLVED_FACTOR_KO[factor]).join(', ')}.
      </p>
    </div>
  );
}
