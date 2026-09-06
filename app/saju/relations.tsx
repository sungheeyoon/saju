import {
  CARD,
} from '../card';
import {
  UtteranceList,
} from '../utterances';
import {
  ELEMENT_KO,
  PILLAR_POSITION_KO,
  RELATION_KIND_KO,
  directionParticipantsOf,
  orderedParticipants,
  type Saju,
  type Utterance,
} from '@/src/lib/saju';
import {
  HorizontalScrollHint,
  objectParticle,
  relationKey,
  subjectParticle,
} from './shared';


export function RelationTable({ saju, coverage }: { saju: Saju; coverage: Utterance[] }) {
  const { relations } = saju;

  return (
    <section id="relations" className={`${CARD} scroll-mt-20`}>
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 className="text-base font-semibold">원국의 관계</h2>
        <p className="text-sm text-secondary">
          {relations.length === 0 ? '성립하는 관계가 없습니다' : `${relations.length}개`}
        </p>
      </div>

      {relations.length > 0 && (
        <>
          <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[30rem] border-collapse text-sm">
            <caption className="sr-only">
              여덟 글자 사이에 성립하는 합·충·형·해·파·원진·귀문
            </caption>
            <thead className="text-xs text-muted">
              <tr>
                <th className="pb-1.5 text-left font-normal whitespace-nowrap">종류</th>
                <th className="pb-1.5 pl-3 text-left font-normal whitespace-nowrap">글자</th>
                <th className="pb-1.5 pl-3 text-left font-normal whitespace-nowrap">이름</th>
                <th className="pb-1.5 pl-3 text-left font-normal whitespace-nowrap">자리</th>
                <th className="w-full pb-1.5 pl-3 text-left font-normal whitespace-nowrap">비고</th>
              </tr>
            </thead>
            <tbody>
              {relations.map((relation) => (
                <tr key={relationKey(relation)} className="border-t border-border">
                  <td className="py-1.5 whitespace-nowrap text-secondary">
                    {RELATION_KIND_KO[relation.kind]}
                  </td>
                  <td className="glyph py-1.5 pl-3 text-base whitespace-nowrap">
                    {orderedParticipants(relation)
                      .map((p) => p.char)
                      .join('')}
                  </td>
                  <td className="py-1.5 pl-3 whitespace-nowrap">
                    {relation.ko}
                    {relation.name && (
                      <span className="ml-1.5 text-xs text-muted">{relation.name}</span>
                    )}
                  </td>
                  <td className="py-1.5 pl-3 whitespace-nowrap text-secondary">
                    {orderedParticipants(relation)
                      .map((p) => PILLAR_POSITION_KO[p.position].charAt(0))
                      .join('·')}
                  </td>
                  <td className="py-1.5 pl-3 text-xs text-muted">
                    <span className="flex flex-wrap gap-x-2.5 gap-y-0.5">
                      {relation.targetElement && (
                        <span className="text-secondary">
                          합화 오행 {ELEMENT_KO[relation.targetElement]}
                        </span>
                      )}
                      {(() => {
                        const arrow = directionParticipantsOf(relation);
                        return (
                          arrow && (
                            <span>
                              {arrow.from.char}
                              {subjectParticle(arrow.from.char)} {arrow.to.char}
                              {objectParticle(arrow.to.char)} 형
                            </span>
                          )
                        );
                      })()}
                      {/*
                        세 글자가 다 모인 삼형은 화살표 하나로 못 적는다 — 고리로
                        적고 첫 글자로 되돌아오는 것까지 보인다. 시작점은 고전이
                        부르는 차례일 뿐이라 "丑이 먼저"라는 뜻이 아니다.
                      */}
                      {relation.cycle && (
                        <span className="glyph">
                          {orderedParticipants(relation)
                            .map((p) => p.char)
                            .concat(orderedParticipants(relation)[0].char)
                            .join('→')}{' '}
                          <span className="font-sans">순환</span>
                        </span>
                      )}
                      {/*
                        '반쪽' 이라고 적던 자리다. `full: false` 의 뜻은 그대로이고
                        (이 관계가 세 글자 구조에서 둘만 담았다) 낱말만 낡았다 —
                        삼형 안의 두 글자 형을 따로 내기로 하면서, 바로 위에 未 가
                        서 있는데도 "반쪽" 이 붙는 자리가 생겼다. 그때 '반쪽' 은
                        "나머지 글자가 명식에 없다" 로 읽힌다.

                        합에서는 지금도 참이다(흡수된 반합은 버리므로 진짜 반쪽이다).
                        그래도 한 낱말로 둔다 — '두 글자' 는 양쪽에서 다 참이고,
                        반합·반방합은 이름에 이미 반(半) 이 들어 있어 잃는 것이 없다.
                      */}
                      {!relation.full && <span>두 글자</span>}
                      {!relation.adjacent && <span>{relation.distance}칸 떨어짐</span>}
                      {relation.contested.length > 0 && (
                        <span className="text-accent">
                          쟁합 · {relation.contested[0].over.char}를 두고 다툼
                        </span>
                      )}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
          <HorizontalScrollHint />
        </>
      )}

      {/*
        손으로 적던 자리다: "시주를 몰라 시주가 걸린 관계는 빠져 있습니다."
        같은 말인데 **목록의 한계는 목록이 든다**는 규칙에서 나온 문장이 따로 있고,
        그 문장은 강도까지 달고 나온다(`relation.coverage`). 두 벌 적을 이유가 없다.
      */}
      {coverage.length > 0 && (
        <div className="mt-3 border-t border-border pt-3">
          <UtteranceList utterances={coverage} />
        </div>
      )}

      <p className="mt-3 border-t border-border pt-3 text-xs text-muted">
        성립 여부만 적습니다. 합이 이뤄지는지, 충이 합을 깨는지는 학파마다 갈려 판정하지 않습니다.
        원진과 귀문은 네 쌍이 겹치므로 같은 두 글자에 두 줄이 함께 나올 수 있습니다.
      </p>
    </section>
  );
}
