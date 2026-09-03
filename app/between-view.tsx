import {
  PILLAR_POSITION_KO,
  RELATION_KIND_KO,
  RELATION_SCOPE_KO,
  assembleCompatText,
  compatSideOf,
  resolveRelation,
  type Compatibility,
  type CompatSide,
  type ResolvedRelation,
  type Utterance,
} from '@/src/lib/saju';

import { CARD } from './card';
import {
  TOPICS_THE_TABLE_HOLDS,
  TOPIC_TABLE_FOOTNOTE,
  ClaimStrengthLegend,
  UtteranceList,
  said,
  warningsToShow,
} from './utterances';

/**
 * 두 사람 **사이**에 대해 말할 수 있는 것 — 명식은 받지 않는다.
 *
 * 이 세 칸(관계 표 · 문장 · 남은 경고)은 두 화면에 함께 선다. 궁합 화면은 두 명식을
 * 나란히 놓은 다음 이것을 놓고, Match 결과 화면은 **이것만** 놓는다.
 *
 * 그래서 받는 것이 `Compatibility` 와 부를 이름뿐이다. `Saju` 를 받으면 Match 결과
 * 화면이 상대의 원국 전체 판정과 출생 메타까지 브라우저로 들고 와야 하고(이 파일은
 * 클라이언트 쪽에서도 그려진다), 그 순간 「자르는 것은 서버가 한다」가 화면 코드의
 * 약속으로 내려앉는다(ADR 0008·0010·0012). 관계 참가자를 합쳐 여덟 글자가 드러나는
 * 것은 동의 범위 안이지만 `Saju` 전체는 아니다. **못 받게 해 두면 약속이 아니라 사실이
 * 된다.**
 */
export function BetweenSections({
  compat,
  names,
}: {
  compat: Compatibility;
  /** 두 사람을 부르는 말 — 관계 한 줄에서 어느 글자가 누구 것인지가 이름으로 붙는다 */
  names: Record<CompatSide, string>;
}) {
  // L3 는 `Compatibility` 와 사람마다 이름 하나만 받는다. `Saju` 를 통째로 넘기면
  // 문장이 다시 계산할 길이 생기고, 화면의 궁합과 문장의 궁합이 언젠가 어긋난다.
  // 시각을 알았는가는 넘기지 않는다 — 궁합이 이미 값으로 든다.
  const utterances = assembleCompatText(compat, {
    a: { label: names.a },
    b: { label: names.b },
  });

  return (
    <>
      <BetweenRelations
        compat={compat}
        names={names}
        coverage={said(utterances, (topic) => topic === TOPIC_TABLE_FOOTNOTE)}
      />
      <SaidBetween
        utterances={said(utterances, (topic) => !TOPICS_THE_TABLE_HOLDS.includes(topic))}
      />

      {/*
        엔진 경고 중 **발화가 대신 말하지 않는 것만** 여기 선다. 시간 미상 둘은
        L3 가 이름을 부르며 제자리에서 말하므로 빠진다 — 엔진은 사람을 이름으로
        부를 수 없고('두 번째 사람의'), 그것은 이름을 계산에 넣지 않기로 한
        결정의 대가다. 카드째 걷어내지 않은 것은 나중에 생길 경고를 조용히 지우지
        않기 위해서다(`WARNINGS_SAID_BY_UTTERANCES`).
      */}
      {warningsToShow(compat.warnings).length > 0 && (
        <section className={CARD}>
          <h2 className="text-base font-semibold">주의</h2>
          <ul className="mt-2 flex flex-col gap-1 text-sm text-secondary">
            {warningsToShow(compat.warnings).map((warning) => (
              <li key={warning.kind}>{warning.text}</li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

/**
 * 사이 관계 — 거리 대신 **자리**로 말한다.
 *
 * 두 사람의 기둥 사이에는 선형 거리가 없어 엔진이 `distance` 를 `null` 로 낸다.
 * 대신 누구의 어느 자리인지를 적는다. 일지끼리 걸린 것은 따로 앞세운다 — 그건
 * 계산이 아니라 자리에 붙은 관습적 의미라 화면의 몫이다.
 */
function BetweenRelations({
  compat,
  names,
  coverage,
}: {
  compat: Compatibility;
  names: Record<CompatSide, string>;
  /** 목록의 한계는 목록이 든다 — 시각을 둘 다 알면 비어 있다 */
  coverage: Utterance[];
}) {
  /**
   * 인덱스를 푼 꼴로 한 번만 바꾸고 그것만 읽는다.
   *
   * 화면은 여태 `orderedParticipants` 로 그때그때 풀었고 그것으로 충분했다.
   * 부족해진 것은 `relation.cycle` 을 인덱스인 채로 읽는 자리가 남아 있어서다 —
   * 같은 관계를 한 줄에서는 글자로, 다른 줄에서는 인덱스로 읽으면 어느 쪽이
   * 배치에 딸린 값인지 화면만 보고는 알 수 없다.
   */
  const relations: ResolvedRelation[] = compat.relations.map(resolveRelation);

  const dayToDay = relations.filter(
    (relation) =>
      relation.participants.length === 2 &&
      relation.participants.every((participant) => participant.position === 'day'),
  );

  return (
    <section className={CARD}>
      <div className="flex flex-wrap items-baseline gap-x-3">
        <h2 className="text-base font-semibold">두 원국 사이의 관계</h2>
        <p className="text-sm text-secondary">
          {relations.length === 0 ? '걸리는 것이 없습니다' : `${relations.length}개`}
        </p>
      </div>

      {dayToDay.length > 0 && (
        <div className="mt-3 rounded-md border border-border bg-surface-sunken p-3">
          <p className="text-xs text-muted">일지끼리 — 부부 자리로 읽는 자리입니다</p>
          <ul className="mt-1.5 flex flex-col gap-1 text-sm">
            {dayToDay.map((relation) => (
              <li key={relation.id}>
                <span className="glyph">
                  {relation.participants.map((participant) => participant.char).join(' ')}
                </span>{' '}
                <span className="font-medium">{relation.ko}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {relations.length > 0 && (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[34rem] border-collapse text-left text-sm">
            <thead className="text-xs text-muted">
              <tr>
                <th className="pb-1.5 font-normal whitespace-nowrap">종류</th>
                <th className="pb-1.5 pl-3 font-normal whitespace-nowrap">글자</th>
                <th className="pb-1.5 pl-3 font-normal whitespace-nowrap">이름</th>
                <th className="pb-1.5 pl-3 font-normal whitespace-nowrap">누구의 어느 자리</th>
              </tr>
            </thead>
            <tbody>
              {relations.map((relation) => (
                <tr key={relation.id} className="border-t border-border align-top">
                  <td className="py-1.5 whitespace-nowrap text-secondary">
                    {RELATION_KIND_KO[relation.kind]}
                  </td>
                  <td className="glyph py-1.5 pl-3 whitespace-nowrap">
                    {relation.participants.map((participant) => participant.char).join(' ')}
                  </td>
                  <td className="py-1.5 pl-3 whitespace-nowrap">{relation.ko}</td>
                  <td className="py-1.5 pl-3 text-xs text-secondary">
                    {relation.participants
                      .map((participant) => {
                        const side = compatSideOf(participant.chartId);
                        // 계산판을 못 알아보면 이름 대신 그 이름표를 보인다 —
                        // 한쪽으로 기본값을 주면 남의 기둥이 조용히 내 것으로 적힌다.
                        const who = side === null ? participant.chartId : names[side];

                        return `${who} ${PILLAR_POSITION_KO[participant.position]}`;
                      })
                      // 완전 삼형은 고리라 `↔`(짝) 가 아니라 `→`(도는 순서) 로 잇는다.
                      .join(relation.cycle ? ' → ' : ' ↔ ')}
                    {relation.cycle && <span className="text-muted"> → 처음으로</span>}
                    {relation.scope === 'combinedFormation' && (
                      <span className="ml-1.5 text-accent">
                        {RELATION_SCOPE_KO.combinedFormation}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/*
        손으로 적던 자리다: "시주를 모르는 쪽이 있어 실제보다 적게 나옵니다."
        **누구인지를 못 적었다** — 한쪽만 모르는 것과 둘 다 모르는 것은 같은 칸이지만
        같은 문장이 아니고, 그것을 아는 것은 발화 쪽이다(`relation.coverage`).
      */}
      {coverage.length > 0 && (
        <div className="mt-3 border-t border-border pt-3">
          <UtteranceList utterances={coverage} />
        </div>
      )}

      <p className="mt-3 border-t border-border pt-3 text-xs text-muted">
        각자의 원국 안에서 닫힌 관계는 빠져 있습니다 — 그건 각자의 명식이 이미 보여준
        사실입니다. 두 사람의 기둥 사이에는 거리라는 것이 없어 몇 칸 떨어졌는지는 적지
        않습니다. 성립 여부만 적고 좋고 나쁨은 판정하지 않습니다.
      </p>
    </section>
  );
}

/**
 * 두 사람 사이에 대해 **말할 수 있는 것** — L3 가 낸 발화를 그대로 놓는다.
 *
 * 여기 있던 카드 셋(십성 · 오행 보완 · 억부 부합)은 같은 값을 손으로 쓴 산문과
 * 각주로 냈다. 문제는 **같은 문제를 다른 규율로 다뤘다**는 것이다 — 화면은 시간
 * 미상을 아래쪽 경고 카드로 알렸고, 계약은 강도를 내리거나 입을 닫기로 했다.
 * 둘을 나란히 두면 시각을 모르는 명식에서 카드는 "없습니다"라고 말하고 문장은
 * 침묵한다. 그래서 카드를 걷어내고 발화를 그대로 놓는다.
 *
 * **정책 고지는 화면이 든다.** 점수를 내지 않는다거나 억부가 확정 용신이 아니라는
 * 말은 이 명식에 대한 주장이 아니라 저장소가 무엇을 하지 않기로 했는가라서,
 * 명식마다 나오는 발화에 얹을 것이 아니다.
 */
function SaidBetween({ utterances }: { utterances: Utterance[] }) {
  return (
    <section className={CARD}>
      <h2 className="text-base font-semibold">두 사람 사이에 대해 말할 수 있는 것</h2>

      <div className="mt-3">
        <UtteranceList utterances={utterances} />
      </div>

      <div className="mt-3 flex flex-col gap-2 border-t border-border pt-3 text-xs text-muted">
        <ClaimStrengthLegend />
        <p>
          십성은 일간끼리만 본 값이라 양쪽이 서로 다를 수 있고, 육친(누가 누구의 무엇인가)
          으로 단정하지 않습니다. 오행은 있고 없음만 셉니다 — 부족을 채우는 쪽이 좋다는
          읽기와 용신에 맞아야 한다는 읽기가 갈려서 좋고 나쁨으로 환산하지 않습니다.
        </p>
        <p>
          억부 부합은 <strong className="font-medium">각자의 억부 판정을 그대로 물려받은
          값</strong>입니다. 억부는 용신을 잡는 네 길 중 하나일 뿐이라 확정 용신이 아니고,
          &lsquo;상대가 내 용신을 갖고 있다&rsquo;로 읽으면 안 됩니다.
        </p>
      </div>
    </section>
  );
}
