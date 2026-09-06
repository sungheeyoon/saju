import {
  CARD,
} from '../card';
import {
  SPIRIT_BASIS_KO,
  type PillarPosition,
  type Saju,
  type StarNature,
  type StarTarget,
} from '@/src/lib/saju';
import {
  PILLAR_COLUMNS,
} from './shared';


/**
 * 신살 — 어느 자리에 걸렸는지가 본론이므로 기둥별 표로 놓는다.
 *
 * 목록으로 늘어놓으면 "천을귀인이 있다"까지는 알아도 그게 월지인지 일지인지
 * 표에서 눈으로 못 찾는다. 원국 표와 같은 네 열을 쓰고, 천간에 걸린 것과
 * 지지에 걸린 것을 행으로 가른다 — 만세력이 관습적으로 그렇게 보여준다.
 *
 * 칸마다 무엇을 기준으로 뽑았는지(일간·년지 따위)를 작게 붙인다. 특히
 * 역마·도화는 년지 기준과 일지 기준이 서로 다른 자리를 가리키므로, 기준을
 * 안 적으면 같은 이름이 왜 두 자리에 있는지 알 수 없다.
 *
 * 길흉 분류는 표에 섞지 않고 아래 한 줄로 뺀다. 자리를 읽는 것과 좋고 나쁨을
 * 재는 것은 다른 일이고, 표 안에 색이나 기호로 섞으면 판정처럼 읽힌다.
 */
const STAR_ROWS = [
  { target: 'stem', label: '천간' },
  { target: 'branch', label: '지지' },
  { target: 'pillar', label: '간지' },
] as const satisfies readonly { target: StarTarget; label: string }[];


const STAR_NATURE_KO: Record<StarNature, string> = {
  auspicious: '길신',
  inauspicious: '흉신',
  neutral: '특수',
};


/**
 * 12신살에서 옮겨 온 셋 — 기준마다 걸린 자리가 없을 수 있다.
 *
 * 걸린 자리가 없으면 항목이 아예 안 나오는데, 그러면 "계산했는데 없다"와
 * "여기서는 안 본다"가 화면에서 같아 보인다. 도화를 년지 기준으로만 보는
 * 만세력과 결과를 맞춰볼 때 바로 이 구분이 필요하다. 그래서 없는 기준을
 * 따로 적어 준다. 값은 12신살 결과에서 그대로 읽으므로 신살 표와 갈릴 수 없다.
 */
const RESTATED_SPIRIT_KO: Record<string, string> = {
  驛馬殺: '역마',
  年殺: '도화',
  華蓋殺: '화개',
};


function missingSpiritNotes(saju: Saju): string[] {
  return saju.sinsal.twelveSpirits.flatMap((chart) => {
    const present = new Set(PILLAR_COLUMNS.map(({ key }) => chart.byPosition[key]));
    const missing = Object.entries(RESTATED_SPIRIT_KO)
      .filter(([spirit]) => !present.has(spirit as never))
      .map(([, ko]) => ko);

    if (missing.length === 0) return [];
    return [
      `${SPIRIT_BASIS_KO[chart.basis]} ${chart.basisBranch} 기준으로는 ${missing.join('·')}가 걸린 자리가 없습니다.`,
    ];
  });
}


export function StarTable({ saju }: { saju: Saju }) {
  const { stars } = saju.sinsal;
  const missingSpirits = missingSpiritNotes(saju);

  /** 자리·대상별로 나눠 담는다 — 한 신살이 여러 칸에 걸릴 수 있다 */
  const at = (target: StarTarget, position: PillarPosition) =>
    stars.flatMap((star) =>
      star.hits
        .filter((hit) => hit.target === target && hit.position === position)
        .map((hit) => ({ star, hit })),
    );

  // 괴강·백호가 없으면 간지 행은 통째로 비므로 아예 내지 않는다.
  const rows = STAR_ROWS.filter(
    ({ target }) => target !== 'pillar' || stars.some((s) => s.hits.some((h) => h.target === target)),
  );

  return (
    <section id="stars" className={`${CARD} scroll-mt-20`}>
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 className="text-base font-semibold">신살</h2>
        <p className="text-sm text-secondary">
          {stars.length === 0 ? '걸린 신살이 없습니다' : `${stars.length}개`}
        </p>
      </div>

      {stars.length > 0 && (
        <>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[30rem] border-collapse text-left">
              <thead>
                <tr>
                  <th className="w-14 pb-2" />
                  {PILLAR_COLUMNS.map(({ key, label }) => (
                    <th
                      key={key}
                      className={`px-2 pb-2 text-xs font-normal ${
                        key === 'day' ? 'text-foreground' : 'text-muted'
                      }`}
                    >
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map(({ target, label }) => (
                  <tr key={target} className="border-t border-border align-top">
                    <td className="py-2 pr-2 text-right text-xs whitespace-nowrap text-muted">
                      {label}
                    </td>
                    {PILLAR_COLUMNS.map(({ key }) => {
                      const found = at(target, key);
                      return (
                        <td key={key} className="px-2 py-2">
                          {found.length === 0 ? (
                            <span className="text-xs text-muted opacity-40">·</span>
                          ) : (
                            <ul className="flex flex-col gap-1.5">
                              {found.map(({ star, hit }) => (
                                <li key={`${star.id}:${hit.char}`}>
                                  <span className="text-sm">{star.ko}</span>
                                  {star.basis && (
                                    <span className="block text-[10px] text-muted">
                                      {star.basis.label} {star.basis.char}
                                    </span>
                                  )}
                                </li>
                              ))}
                            </ul>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <dl className="mt-4 flex flex-col gap-1 border-t border-border pt-3 text-xs">
            {(Object.keys(STAR_NATURE_KO) as StarNature[]).map((nature) => {
              const named = [
                ...new Set(stars.filter((s) => s.nature === nature).map((s) => s.ko)),
              ];
              if (named.length === 0) return null;
              return (
                <div key={nature} className="flex gap-2">
                  <dt className="w-8 shrink-0 text-muted">{STAR_NATURE_KO[nature]}</dt>
                  <dd className="text-secondary">{named.join(' · ')}</dd>
                </div>
              );
            })}
          </dl>
        </>
      )}

      {missingSpirits.length > 0 && (
        <ul className="mt-3 flex flex-col gap-0.5 border-t border-border pt-3 text-xs text-secondary">
          {missingSpirits.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      )}

      {/*
        **결과를 읽는 데 필요한 것과 계산을 검산하는 데 필요한 것을 가른다.**

        여덟 줄이 한 문단으로 서 있었다. 그중 사용자가 이 표를 **해석**하는 데 필요한
        것은 둘뿐이다 — 기준이 갈린다는 사실과, 길신·흉신이 좋고 나쁨이 아니라는 것.
        「현침은 甲辛卯午申 중 3자 이상」부터는 우리 계산이 맞는지 되짚을 때 필요한
        것이라, 같은 카드 안에서 한 겹 아래로 내린다.

        딴 화면으로 보내지 않은 이유: 그때 후보였던 `/evidence` 는 걸어 두지 않은
        주소였고(ADR 0025), 지금은 아예 없다(ADR 0047). 접는 것은 **읽는 차례에서
        빼는 것**이고 그것이 여기서 고치려던 문제다.
      */}
      <div className="mt-3 border-t border-border pt-3 text-xs text-muted">
        <p>
          산출법이 갈리는 신살은 채택한 기준을 밝히고 그 기준으로만 뽑습니다 — 고전 하나로
          통일한 것이 아닙니다. 길신·흉신은 전통적 분류일 뿐 좋고 나쁨의 판정이 아닙니다.
          {!saju.meta.hourKnown && ' 시주를 몰라 시주에 걸린 신살은 빠져 있습니다.'}
        </p>

        <details className="mt-2">
          <summary className="cursor-pointer hover:text-accent">어떤 기준으로 뽑았나</summary>
          <p className="mt-1.5 leading-5">
            현침은 甲辛卯午申 중 3자 이상, 천문은 戌亥가 함께 있어야 성립하고, 천의성은 월지
            바로 앞 지지입니다. 귀문관살·원진살은 원국 네 지지의{' '}
            <strong className="font-medium">모든 쌍</strong>에서 찾습니다(일지 기준으로 좁히는
            계통은 쓰지 않습니다). 역마·도화·화개는 12신살에서, 귀문관살·원진살은 관계 표에서
            가져온 값이라 그쪽과 언제나 일치합니다 — 두 글자가 서로 어떻게 걸렸는지는
            &lsquo;원국의 관계&rsquo;에 있습니다.
          </p>
        </details>
      </div>
    </section>
  );
}
