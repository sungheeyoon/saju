import {
  Fold,
} from './fold';
import {
  UtteranceList,
} from '../utterances';
import {
  type Saju,
  type Utterance,
} from '@/src/lib/saju';
import { relationCells, relationKey, relationRemarks } from '@/src/lib/saju/view';
import { RELATIONS_NOTE } from '@/src/lib/saju/view/notes';
import { HorizontalScrollHint } from './shared';


export function RelationTable({ saju, coverage }: { saju: Saju; coverage: Utterance[] }) {
  const { relations } = saju;

  return (
    <Fold
      id="relations"
      title="원국의 관계"
      meta={relations.length === 0 ? '성립하는 관계가 없습니다' : `${relations.length}개`}
    >

      {relations.length > 0 && (
        <>
          <div className="overflow-x-auto">
          <table className="w-full min-w-[30rem] border-collapse text-sm">
            <caption className="sr-only">
              여덟 글자 사이에 성립하는 합·충·형·해·파·원진·귀문
            </caption>
            <thead className="text-xs font-semibold text-secondary">
              <tr>
                <th className="pb-1.5 text-left font-normal whitespace-nowrap">종류</th>
                <th className="pb-1.5 pl-3 text-left font-normal whitespace-nowrap">글자</th>
                <th className="pb-1.5 pl-3 text-left font-normal whitespace-nowrap">이름</th>
                <th className="pb-1.5 pl-3 text-left font-normal whitespace-nowrap">자리</th>
                <th className="w-full pb-1.5 pl-3 text-left font-normal whitespace-nowrap">비고</th>
              </tr>
            </thead>
            <tbody>
              {relations.map((relation) => {
                const cells = relationCells(relation);
                const remarks = relationRemarks(relation);
                return (
                <tr key={relationKey(relation)} className="border-t border-border">
                  <td className="py-1.5 whitespace-nowrap text-secondary">
                    {cells.kind}
                  </td>
                  <td className="glyph py-1.5 pl-3 text-base whitespace-nowrap">
                    {cells.chars}
                  </td>
                  <td className="py-1.5 pl-3 whitespace-nowrap">
                    {relation.ko}
                    {relation.name && (
                      <span className="ml-1.5 text-xs text-muted">{relation.name}</span>
                    )}
                  </td>
                  <td className="py-1.5 pl-3 whitespace-nowrap text-secondary">
                    {cells.seats}
                  </td>
                  <td className="py-1.5 pl-3 text-xs text-muted">
                    <span className="flex flex-wrap gap-x-2.5 gap-y-0.5">
                      {remarks.target !== null && (
                        <span className="text-secondary">
                          {remarks.target}
                        </span>
                      )}
                      {remarks.arrow !== null && <span>{remarks.arrow}</span>}
                      {remarks.cycle !== null && (
                        <span className="glyph">
                          {remarks.cycle}{' '}
                          <span className="font-sans">순환</span>
                        </span>
                      )}
                      {remarks.twoLetters !== null && <span>{remarks.twoLetters}</span>}
                      {remarks.distance !== null && <span>{remarks.distance}</span>}
                      {remarks.contested !== null && (
                        <span className="text-accent">
                          {remarks.contested}
                        </span>
                      )}
                    </span>
                  </td>
                </tr>
                );
              })}
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
        {RELATIONS_NOTE}
      </p>
    </Fold>
  );
}
