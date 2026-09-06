import {
  CARD,
} from '../card';
import {
  ELEMENT_TONE,
} from '../element-tone';
import {
  HOUR_UNKNOWN_LABEL,
} from '@/src/lib/input/query';
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
} from '@/src/lib/saju';
import {
  HorizontalScrollHint,
  PILLAR_COLUMNS,
} from './shared';


/**
 * 만세력 엔진은 순수 함수라 서버 없이 브라우저에서 그대로 돈다.
 * 제출한 입력만 계산하므로, 타이핑 도중의 반쪽 날짜로 계산하지 않는다.
 *
 * 화면이 묻는 것은 **무엇을 기준 시각으로 볼 것인가** 하나뿐이다.
 * 경도·균시차의 보정값 자체는 천문학적으로 정해지므로 선택지가 아니다.
 * 갈리는 것은 명리 계산에 출생기록 시각·지방평균태양시·진태양시 중 무엇을
 * 쓰느냐이고, 그것은 계통의 선택이다. 그래서 세 단계 하나로 묶었다.
 *
 * 두 값을 따로 켜게 두면 "경도 끔 + 균시차 켬" 같은 조합이 생긴다.
 * 그것은 출생지의 진태양시가 아니라 아무 곳의 시각도 아닌 값이다.
 *
 * 서머타임은 선택이 아니라 사실이라 묻지 않는다 — 1988년 7월 14시에
 * 태어난 사람의 시계는 실제로 UTC+10이었고, 되돌리는 것이 옳은 계산이다.
 * 시행 기간이 아닌 절대다수에게는 애초에 물어볼 것도 없는 질문이다.
 * 대신 되돌린 사실은 '적용된 보정' 표에 그대로 남는다.
 *
 * 예외가 하나 있다. 서머타임이 해제되던 날의 겹친 한 시간은 역사적 사실만으로
 * 어느 쪽인지 정할 수 없다. 이때는 전역 옵션이 아니라 그 계산에만 붙는
 * 경고로 알린다(앞선 쪽으로 해석했다고 밝힌다).
 *
 * 오행 색은 **정체성을 지지 않는다**(`app/element-tone.ts`).
 *
 * 전통색(청·적·황·백·흑)을 그대로 쓰지 않는다. 白(금)은 채움색으로 성립하지
 * 않고, 대체색을 넣으면 접근성 게이트를 넘지 못한다 — 토=갈색/금=금색은
 * 적↔갈 ΔE 2.5(deutan)로 사실상 같은 색이고, 은색·회색은 채도 하한에 걸린다.
 *
 * 그래서 오래 이 자리는 단일 색조였다. 지금 다섯 색조를 쓰는 것은 그 판단을
 * 뒤집은 것이 아니라 **조건을 지킨 채 들어온 것**이다: 글자 칸에도 막대에도
 * 오행 이름이 함께 붙어 있어서, 색을 못 가르는 사람에게 사라지는 정보가 없다.
 * 색이 유일한 단서가 되는 자리(범례만 있는 그림, 색으로만 갈리는 배지)에는
 * 여전히 쓰지 않는다 — 그 순간 위의 ΔE 문제가 그대로 돌아온다.
 */

/**
 * 궁성(宮星) — 각 기둥이 상징하는 자리와 시기.
 *
 * 계산이 아니라 **표시 규칙**이다. 여덟 글자에서 나오는 값이 아니라 자리에
 * 붙은 관습적 의미라서, 엔진이 아니라 화면이 들고 있는다.
 *
 * 육친을 성별로 단정하지 않는다 — "월간은 부친" 같은 배정은 계통과 성별에
 * 따라 갈리므로 관계(부모·형제) 수준까지만 적는다. 연령 구간도 대략이다.
 */
const PALACE: Record<'year' | 'month' | 'day' | 'hour', { role: string; period: string }> = {
  year: { role: '조상·뿌리', period: '초년' },
  month: { role: '부모·형제', period: '청년' },
  day: { role: '나·배우자', period: '중년' },
  hour: { role: '자녀·결실', period: '말년' },
};


/**
 * 기둥마다 한 칸씩 붙는 표식 — 12운성·12신살·공망이 같은 모양이다.
 *
 * 셋 다 "이 자리에 무엇이 붙는가"라서 행 하나로 충분하다. 기준이 갈리는
 * 것(년지/일지, 일주/년주)은 행을 나누고 무엇을 기준으로 삼았는지 왼쪽에
 * 적는다 — 기준을 안 적으면 두 줄이 왜 다른지 알 수 없다.
 */
function MarkRow({
  label,
  hint,
  value,
}: {
  label: string;
  hint: string;
  value: (position: PillarPosition) => string | null;
}) {
  return (
    <tr>
      <td className="py-1.5 pr-2 text-right align-middle text-xs whitespace-nowrap text-muted">
        {label}
        <span className="block text-[10px] opacity-70">{hint}</span>
      </td>
      {PILLAR_COLUMNS.map(({ key }) => {
        const mark = value(key);
        return (
          <td
            key={key}
            className={`px-2 py-1.5 text-xs ${key === 'day' ? 'font-medium' : 'text-secondary'}`}
          >
            {mark ?? <span className="text-muted opacity-40">·</span>}
          </td>
        );
      })}
    </tr>
  );
}


/** 사주팔자 — 차트가 아니라 표다. 일주(나) 열만 강조한다. */
export function PillarChart({ saju }: { saju: Saju }) {
  const { pillars, analysis } = saju;

  return (
    <section id="chart" className={`${CARD} scroll-mt-20`}>
      <h2 className="mb-4 text-base font-semibold">사주팔자</h2>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[30rem] border-collapse text-center">
          <thead>
            <tr>
              <th className="w-16" />
              {PILLAR_COLUMNS.map(({ key, label }) => (
                <th
                  key={key}
                  className={`px-2 pb-2 text-xs font-medium ${
                    key === 'day' ? 'text-accent' : 'text-secondary'
                  }`}
                >
                  {label}
                  {key === 'day' && <span className="ml-1 opacity-70">나</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <TenGodRow label="십성" saju={saju} position="stem" />

            <tr>
              <RowLabel>천간</RowLabel>
              {PILLAR_COLUMNS.map(({ key }) => {
                const pillar = pillars[key];
                return (
                  <GlyphCell
                    key={key}
                    emphasis={key === 'day'}
                    glyph={pillar && pillar.stem}
                    element={pillar ? STEM_INFO[pillar.stem].element : null}
                    caption={
                      pillar
                        ? `${STEM_INFO[pillar.stem].ko} · ${ELEMENT_KO[STEM_INFO[pillar.stem].element]}`
                        : HOUR_UNKNOWN_LABEL
                    }
                  />
                );
              })}
            </tr>

            <tr>
              <RowLabel>지지</RowLabel>
              {PILLAR_COLUMNS.map(({ key }) => {
                const pillar = pillars[key];
                return (
                  <GlyphCell
                    key={key}
                    emphasis={key === 'day'}
                    glyph={pillar && pillar.branch}
                    element={pillar ? BRANCH_INFO[pillar.branch].element : null}
                    caption={
                      pillar
                        ? `${BRANCH_INFO[pillar.branch].ko} · ${ELEMENT_KO[BRANCH_INFO[pillar.branch].element]}`
                        : HOUR_UNKNOWN_LABEL
                    }
                  />
                );
              })}
            </tr>

            <TenGodRow label="십성" saju={saju} position="branch" />

            <tr>
              <RowLabel>지장간</RowLabel>
              {PILLAR_COLUMNS.map(({ key }) => (
                <td key={key} className="px-2 pt-2 align-top">
                  <ul className="flex flex-col gap-0.5 text-[11px] text-muted">
                    {analysis.tenGods[key]?.hiddenStems.map((hidden) => (
                      <li key={hidden.stem + hidden.role}>
                        <span className="glyph">{hidden.stem}</span> {TEN_GOD_KO[hidden.tenGod]}
                      </li>
                    ))}
                  </ul>
                </td>
              ))}
            </tr>

            <MarkRow
              label="궁"
              hint="자리의 상징"
              value={(key) => `${PALACE[key].role} · ${PALACE[key].period}`}
            />

            {/*
              **계통을 밝힌다.** 「일간 기준」만으로는 부족하다 — 음간을 역행시키느냐
              (음양순역, 연해자평 이래의 정통) 양간과 같이 보느냐(양포태)에 따라 같은
              일간·지지에서 다른 운성이 나온다. 산출법이 갈리는 신살은 기준을 밝힌다고
              해 놓고 이 줄만 안 밝히고 있었다.

              값은 명식이 들고 있다(`stages.yinReverse`) — 화면이 기본값을 다시 적으면
              옵션을 바꾼 명식에서 거짓말이 된다.
            */}
            <MarkRow
              label="12운성"
              hint={`일간 기준 · ${saju.stages.yinReverse ? '음양순역' : '양포태'}`}
              value={(key) => {
                const stage = saju.stages.byDayMaster[key];
                return stage ? TWELVE_STAGE_KO[stage] : null;
              }}
            />

            {saju.sinsal.twelveSpirits.map((chart) => (
              <MarkRow
                key={chart.basis}
                label="12신살"
                hint={`${SPIRIT_BASIS_KO[chart.basis]} 기준`}
                value={(key) => {
                  const spirit = chart.byPosition[key];
                  if (!spirit) return null;
                  return TWELVE_SPIRIT_ALIAS[spirit] ?? TWELVE_SPIRIT_KO[spirit];
                }}
              />
            ))}

            {saju.sinsal.emptiness.map((emptiness) => (
              <MarkRow
                key={emptiness.basis}
                label="공망"
                hint={`${EMPTINESS_BASIS_KO[emptiness.basis]} 기준 ${emptiness.branches.join('')}`}
                value={(key) => (emptiness.positions.includes(key) ? '공망' : null)}
              />
            ))}
          </tbody>
        </table>
      </div>
      <HorizontalScrollHint />

      <p className="mt-3 text-xs text-muted">
        궁(宮)은 계산 결과가 아니라 자리에 붙은 관습적 의미입니다. 육친을 성별로
        단정하지 않았고(월간=부친 같은 배정은 계통마다 갈립니다), 연령 구간도
        대략입니다.
      </p>

      <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 border-t border-border pt-4 text-sm">
        <Term>일간</Term>
        <dd>
          <span className="glyph">{pillars.dayMaster}</span> {STEM_INFO[pillars.dayMaster].ko} ·{' '}
          {ELEMENT_KO[STEM_INFO[pillars.dayMaster].element]}
        </dd>

        {saju.meta.gender && (
          <>
            <Term>성별</Term>
            <dd>
              {GENDER_KO[saju.meta.gender]}
              <span className="text-muted"> · 여덟 글자는 성별로 달라지지 않습니다</span>
            </dd>
          </>
        )}

        <Term>사주년</Term>
        <dd>
          {pillars.meta.sajuYear}년 <span className="text-muted">입춘 기준</span>
          {pillars.meta.sajuYear !== saju.meta.inputTime.year && (
            <span className="text-muted"> · 달력연도와 다릅니다</span>
          )}
        </dd>

        <Term>절기</Term>
        <dd>
          {pillars.meta.monthTerm.name} ~ {pillars.meta.nextTerm.name}
        </dd>

        {pillars.meta.hourKnown ? (
          <>
            <Term>자시 규칙</Term>
            <dd>
              {pillars.meta.lateNightRule === 'jo' ? '조자시' : '야자시'}
              {pillars.meta.lateNightShiftApplied && (
                <span className="text-muted"> · 일주를 다음 날로 넘겼습니다</span>
              )}
            </dd>
          </>
        ) : (
          <>
            <Term>출생 시각</Term>
            <dd>
              미상 <span className="text-muted">· 시주를 뽑지 않았습니다</span>
            </dd>
          </>
        )}
      </dl>
    </section>
  );
}


function RowLabel({ children }: { children: React.ReactNode }) {
  return (
    <td className="pr-2 text-right align-middle text-xs text-muted whitespace-nowrap">
      {children}
    </td>
  );
}


function Term({ children }: { children: React.ReactNode }) {
  return <dt className="text-muted">{children}</dt>;
}


function TenGodRow({
  label,
  saju,
  position,
}: {
  label: string;
  saju: Saju;
  position: 'stem' | 'branch';
}) {
  return (
    <tr>
      <RowLabel>{label}</RowLabel>
      {PILLAR_COLUMNS.map(({ key }) => {
        const chart = saju.analysis.tenGods[key];
        // 시주가 없으면 십성도 없다. 일간 자리의 null 과 구분해야 한다.
        if (chart === null) {
          return (
            <td key={key} className="px-2 py-1 text-xs text-muted">
              —
            </td>
          );
        }
        const god = chart[position];
        return (
          <td key={key} className="px-2 py-1 text-xs text-secondary">
            {god ? TEN_GOD_KO[god] : <span className="text-accent">일간</span>}
          </td>
        );
      })}
    </tr>
  );
}


function GlyphCell({
  glyph,
  caption,
  emphasis,
  element,
}: {
  /** `null` 이면 빈 자리 — 시각을 모르는 시주 */
  glyph: string | null;
  caption: string;
  emphasis: boolean;
  element: Element | null;
}) {
  const tone = element === null ? null : ELEMENT_TONE[element];
  return (
    <td className="px-2 py-1">
      <div
        className={`mx-auto flex w-full max-w-24 flex-col items-center gap-1 rounded-xl border py-3 ${
          glyph === null ? 'border-dashed border-border' : `${tone?.border} ${tone?.surface}`
        } ${emphasis ? 'ring-2 ring-foreground/15 ring-offset-2 ring-offset-surface' : ''}`}
      >
        <span
          className={`glyph text-4xl font-semibold leading-none ${glyph === null ? 'text-muted' : tone?.text}`}
        >
          {glyph ?? '?'}
        </span>
        <span className="text-[11px] text-secondary">{caption}</span>
      </div>
    </td>
  );
}
