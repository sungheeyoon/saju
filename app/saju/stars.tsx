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
 * 신살 — 어느 자리에 걸렸는지가 본론이므로 기둥별 카드로 놓는다.
 *
 * 네 기둥을 작은 화면의 네 열에 밀어 넣으면 이름과 기준이 잘린다. 모바일에서는
 * 한 기둥씩 세로로, 넓은 화면에서는 네 기둥을 나란히 놓는다. 각 항목은 「일간 庚」,
 * 「년간 庚」처럼 자리·대상·글자를 한 덩어리로 적는다 — 카드 머리만 보고 자리를
 * 추론하게 하면 같은 신살이 두 번 찍힌 버그처럼 보인다.
 *
 * 길신·흉신은 항목의 점수나 판정이 아니다. 개수 칩과 항목 딱지는 점수판처럼 읽히므로
 * 본문에는 섞지 않고, 전통 분류 이름만 아래 상세 정보에 둔다.
 */
const HIT_POSITION_KO: Record<PillarPosition, Record<StarTarget, string>> = {
  hour: { stem: '시간', branch: '시지', pillar: '시주' },
  day: { stem: '일간', branch: '일지', pillar: '일주' },
  month: { stem: '월간', branch: '월지', pillar: '월주' },
  year: { stem: '년간', branch: '년지', pillar: '년주' },
};


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

  /** 자리별로 나눠 담는다 — 천간·지지·간지는 항목 안의 작은 표식으로 밝힌다. */
  const at = (position: PillarPosition) =>
    stars.flatMap((star) =>
      star.hits
        .filter((hit) => hit.position === position)
        .map((hit) => ({ star, hit })),
    );

  return (
    <section id="stars" className={`${CARD} scroll-mt-20`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-baseline gap-2">
            <h2 className="text-base font-semibold">신살</h2>
            {stars.length > 0 && <span className="text-sm text-secondary">{stars.length}개</span>}
          </div>
          <p className="mt-0.5 text-xs text-secondary">어떤 신살이 어느 자리에 걸렸는지 모아봅니다</p>
        </div>

      </div>

      {stars.length === 0 ? (
        <div className="mt-4 rounded-xl bg-surface-soft px-4 py-5 text-center text-sm text-secondary">
          걸린 신살이 없습니다
        </div>
      ) : (
        <div className="mt-4 grid items-start gap-2 lg:grid-cols-4">
          {PILLAR_COLUMNS.map(({ key, label }) => {
            const found = at(key);
            return (
              <section
                key={key}
                aria-label={`${label}에 걸린 신살`}
                className={`min-w-0 rounded-xl border p-2.5 sm:p-3 ${
                  key === 'day' ? 'border-accent/35 bg-accent-wash/40' : 'border-border bg-surface-soft'
                }`}
              >
                <div className="mb-2 flex items-baseline justify-between gap-1">
                  <h3 className={`text-sm font-semibold ${key === 'day' ? 'text-accent' : 'text-foreground'}`}>
                    {label}
                  </h3>
                  <span className="text-[10px] text-muted">{found.length}개</span>
                </div>

                {found.length === 0 ? (
                  <p className="py-3 text-center text-xs text-muted">걸린 항목 없음</p>
                ) : (
                  <ul className="flex flex-col gap-1.5">
                    {found.map(({ star, hit }) => (
                      <li key={`${star.id}:${hit.target}:${hit.char}`} className="rounded-lg bg-surface-raised px-2 py-2 shadow-sm">
                        <span className="text-xs font-medium text-foreground sm:text-sm">{star.ko}</span>
                        <p className="mt-0.5 text-[9px] leading-4 text-muted sm:text-[10px]">
                          {HIT_POSITION_KO[hit.position][hit.target]} <span className="glyph">{hit.char}</span>
                          {star.basis && <> · {star.basis.label} <span className="glyph">{star.basis.char}</span></>}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            );
          })}
        </div>
      )}

      {/*
        **길흉 고지는 낱말을 따라 접이칸으로 갔다.** 개수 칩과 항목 딱지를 걷고 나니
        본문에 「길신」·「흉신」이 한 번도 안 나오는데, 그것이 판정이 아니라는 해명만
        본문에 남아 있었다 — 없는 것을 해명하는 문장이다. 그 낱말이 실제로 서는 자리가
        아래 접이칸이므로 고지도 거기 선다.

        시주 이야기는 남는다. 저 위 시주 카드가 실제로 비어 있고, 이 줄이 그 빈 칸의
        까닭이다 — 시각을 아는 명식에서는 아예 안 선다.
      */}
      {!saju.meta.hourKnown && (
        <p className="mt-3 text-xs text-muted">
          시주를 몰라 시주에 걸린 신살은 빠져 있습니다.
        </p>
      )}

      <details className="group mt-4 border-t border-border pt-1">
        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 text-sm font-medium [&::-webkit-details-marker]:hidden">
          전통 분류와 산출 기준
          <span aria-hidden="true" className="text-muted transition-transform group-open:rotate-180">⌄</span>
        </summary>
        <div className="pb-2 pt-2 text-xs leading-5 text-secondary">
          <dl className="mb-3 flex flex-col gap-1 rounded-xl bg-surface-soft p-3">
            {(Object.keys(STAR_NATURE_KO) as StarNature[]).map((nature) => {
              const named = [...new Set(stars.filter((star) => star.nature === nature).map((star) => star.ko))];
              if (named.length === 0) return null;
              return (
                <div key={nature} className="flex gap-2">
                  <dt className="w-8 shrink-0 text-muted">{STAR_NATURE_KO[nature]}</dt>
                  <dd>{named.join(' · ')}</dd>
                </div>
              );
            })}
          </dl>
          <p className="mb-3">
            길신·흉신·특수는 전통적 분류일 뿐, 좋고 나쁨의 판정이 아닙니다.
          </p>
          {missingSpirits.length > 0 && (
            <ul className="mb-3 flex flex-col gap-0.5 rounded-xl bg-surface-soft p-3">
              {missingSpirits.map((note) => <li key={note}>{note}</li>)}
            </ul>
          )}
          <p>
            산출법이 갈리는 신살은 채택한 기준을 밝히고 그 기준으로만 뽑습니다.{' '}
            현침은 甲辛卯午申 중 3자 이상, 천문은 戌亥가 함께 있어야 성립하고, 천의성은 월지
            바로 앞 지지입니다. 귀문관살·원진살은 원국 네 지지의{' '}
            <strong className="font-medium">모든 쌍</strong>에서 찾습니다(일지 기준으로 좁히는
            계통은 쓰지 않습니다). 역마·도화·화개는 12신살에서, 귀문관살·원진살은 관계 표에서
            가져온 값이라 그쪽과 언제나 일치합니다 — 두 글자가 서로 어떻게 걸렸는지는
            &lsquo;원국의 관계&rsquo;에 있습니다.
          </p>
        </div>
      </details>
    </section>
  );
}
