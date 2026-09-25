import {
  CARD,
} from '../card';
import {
  ELEMENT_TONE,
  elementScope,
} from '../element-tone';
import {
  ElementSymbol,
} from '../ui/element-symbol';
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
  PILLAR_COLUMNS,
} from './shared';
import {
  Icon,
} from '../ui/icons';
import {
  PillarDetails,
  type PillarDetailTab,
} from './pillar-details';
import {
  DISCLOSURE_SUMMARY,
  TYPE_SECTION,
} from '../ui/surfaces';


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
const PALACE: Record<'year' | 'month' | 'day' | 'hour', { meaning: string; period: string }> = {
  year: { meaning: '집안·뿌리', period: '초년' },
  month: { meaning: '부모·성장 환경', period: '청년' },
  day: { meaning: '일지는 가까운 관계를 보는 자리', period: '중년' },
  hour: { meaning: '자녀·삶의 결실', period: '말년' },
};


/**
 * 사주팔자 — 여덟 글자는 언제나 한눈에, 부가 표식은 한 종류씩 비교한다.
 *
 * `일주=나`로 칠하지 않는다. 나는 일주의 위 글자인 일간이고, 아래 일지는 가까운
 * 관계를 보는 자리다. 시기·관계·글자를 한 셀에 합치던 표를 세 층으로 갈라서 이
 * 차이를 화면 자체가 설명하게 한다.
 */
export function PillarChart({ saju }: { saju: Saju }) {
  const { pillars, analysis } = saju;

  const detailTabs: readonly PillarDetailTab[] = [
    {
      key: 'hidden-stems',
      label: '지장간',
      panel: (
        <DetailPanel note="각 지지 안에 숨어 있는 천간과 십성입니다.">
          <PillarValueGrid
            values={(key) => {
              const hiddenStems = analysis.tenGods[key]?.hiddenStems;
              if (!hiddenStems || hiddenStems.length === 0) return null;
              return (
                <ul className="flex flex-col gap-1">
                  {hiddenStems.map((hidden) => (
                    <li key={hidden.stem + hidden.role} className="whitespace-nowrap">
                      <span className="glyph font-medium text-foreground">{hidden.stem}</span>{' '}
                      {TEN_GOD_KO[hidden.tenGod]}
                    </li>
                  ))}
                </ul>
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
        <DetailPanel
          note={`일간 기준 · ${saju.stages.yinReverse ? '음양순역' : '양포태'} 방식`}
        >
          <PillarValueGrid
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
          <div className="flex flex-col gap-4">
            {saju.sinsal.twelveSpirits.map((chart) => (
              <BasisBlock key={chart.basis} label={`${SPIRIT_BASIS_KO[chart.basis]} 기준`}>
                <PillarValueGrid
                  values={(key) => {
                    const spirit = chart.byPosition[key];
                    if (!spirit) return null;
                    return TWELVE_SPIRIT_ALIAS[spirit] ?? TWELVE_SPIRIT_KO[spirit];
                  }}
                />
              </BasisBlock>
            ))}
          </div>
        </DetailPanel>
      ),
    },
    {
      key: 'emptiness',
      label: '공망',
      panel: (
        <DetailPanel note="기준 간지가 속한 순에서 짝이 비는 두 지지를 봅니다.">
          <div className="flex flex-col gap-4">
            {saju.sinsal.emptiness.map((emptiness) => (
              <BasisBlock
                key={emptiness.basis}
                label={`${EMPTINESS_BASIS_KO[emptiness.basis]} 기준 · ${emptiness.branches.join('')}`}
              >
                <PillarValueGrid
                  values={(key) => (emptiness.positions.includes(key) ? '공망' : null)}
                />
              </BasisBlock>
            ))}
          </div>
        </DetailPanel>
      ),
    },
  ];

  return (
    <section id="chart" className={`${CARD} scroll-mt-36`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className={TYPE_SECTION}>사주팔자</h2>
        <p
          className={`${ELEMENT_TONE[STEM_INFO[pillars.dayMaster].element].scope} inline-flex min-h-9 items-center gap-1.5 rounded-full bg-[var(--tile)] py-1 pl-1.5 pr-3 text-[13px] font-semibold text-[var(--ink)]`}
        >
          <span className="grid size-7 place-items-center rounded-full bg-surface">
            <ElementSymbol element={STEM_INFO[pillars.dayMaster].element} className="size-5" />
          </span>
          일간 <span className="glyph text-base font-bold">{pillars.dayMaster}</span> ·{' '}
          {STEM_INFO[pillars.dayMaster].ko}{ELEMENT_KO[STEM_INFO[pillars.dayMaster].element]}
        </p>
      </div>

      <PillarTable saju={saju} />

      {(pillars.meta.sajuYear !== saju.meta.inputTime.year || pillars.meta.lateNightShiftApplied) && (
        <ul
          aria-label="사주를 바꾼 입력 안내"
          className="mt-4 flex flex-col gap-1.5 rounded-2xl border border-warning/25 bg-warning-wash px-4 py-3 text-[13px] leading-5 text-secondary sm:mx-auto sm:max-w-3xl"
        >
          {pillars.meta.sajuYear !== saju.meta.inputTime.year && (
            <li>
              <strong className="font-semibold text-foreground">사주년 {pillars.meta.sajuYear}년</strong>
              {' '}· 입춘 전이라 달력연도 {saju.meta.inputTime.year}년과 다릅니다.
            </li>
          )}
          {pillars.meta.lateNightShiftApplied && (
            <li>
              <strong className="font-semibold text-foreground">조자시 적용</strong>
              {' '}· 일주를 다음 날로 넘겼습니다.
            </li>
          )}
        </ul>
      )}

      <PillarDetails tabs={detailTabs} />

      <details className="group mt-5 border-t border-border pt-4 sm:mx-auto sm:max-w-3xl">
        <summary className={DISCLOSURE_SUMMARY}>
          네 기둥은 무엇을 뜻하나요?
          <span aria-hidden="true" className="grid size-8 place-items-center rounded-full bg-surface-sunken text-secondary transition-transform group-open:rotate-180"><Icon name="chevron" className="size-4 rotate-90" /></span>
        </summary>
        <div className="grid grid-cols-2 gap-2 pb-2 pt-2 sm:grid-cols-4">
          {PILLAR_COLUMNS.map(({ key, label }) => (
            <div key={key} className="rounded-2xl bg-surface-soft p-3">
              <p className="text-[13px] font-semibold text-foreground">{label} · {PALACE[key].period}</p>
              <p className="mt-1 text-[13px] leading-5 text-secondary">{PALACE[key].meaning}</p>
            </div>
          ))}
        </div>
        <p className="pb-2 pt-1 text-xs leading-5 text-secondary">
          궁은 계산값이 아니라 자리에 붙는 전통적 상징입니다. 관계와 연령 구간은 넓게 참고해 주세요.
        </p>
      </details>

      <details className="group border-t border-border pt-1 sm:mx-auto sm:max-w-3xl">
        <summary className={DISCLOSURE_SUMMARY}>
          계산 기준과 출생 정보
          <span aria-hidden="true" className="grid size-8 place-items-center rounded-full bg-surface-sunken text-secondary transition-transform group-open:rotate-180"><Icon name="chevron" className="size-4 rotate-90" /></span>
        </summary>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 pb-2 pt-2 text-sm">
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
          </dd>
          <Term>절기</Term>
          <dd>{pillars.meta.monthTerm.name} ~ {pillars.meta.nextTerm.name}</dd>
          {pillars.meta.hourKnown ? (
            <>
              <Term>자시 규칙</Term>
              <dd>
                {pillars.meta.lateNightRule === 'jo' ? '조자시' : '야자시'}
              </dd>
            </>
          ) : (
            <>
              <Term>출생 시각</Term>
              <dd>미상 <span className="text-muted">· 시주를 뽑지 않았습니다</span></dd>
            </>
          )}
        </dl>
      </details>
    </section>
  );
}

/**
 * 결과 화면과 회원 홈이 함께 쓰는 네 기둥의 핵심 표 — **여덟 글자가 이 화면의 주인공이다**(5차, 부드러움).
 *
 * 글자마다 제 오행의 파스텔 판 위에 크게 선다(폰 40px · 넓은 화면 60px). 색은 혼자 말하지 않는다 — 판 아래에
 * 상징(`ElementSymbol`)과 「갑·목」 같은 이름이 함께 붙는다. 일주는 두꺼운 먹색 테로 짚고, 위 글자에 「나」
 * 딱지, 아래 글자에 「관계 자리」가 선다(일간과 일지의 뜻을 가르는 것이 이 표의 일이다).
 *
 * 표(`table`)로 남는다. 칸 이름(시주 · 일주 …)이 열 머리이고, 낭독기는 칸마다 「일주 천간과 지지」로 부른다.
 */
function PillarTable({ saju }: { readonly saju: Saju }) {
  const { pillars, analysis } = saju;

  return (
    <table className="mt-5 w-full table-fixed border-separate border-spacing-x-1.5 text-center sm:mx-auto sm:max-w-3xl sm:border-spacing-x-3">
      <caption className="sr-only">시주, 일주, 월주, 년주의 천간과 지지</caption>
      <thead>
        <tr>
          {PILLAR_COLUMNS.map(({ key }) => (
            <th key={`${key}-period`} className="pb-0.5 text-xs font-medium text-secondary">
              {PALACE[key].period}
            </th>
          ))}
        </tr>
        <tr>
          {PILLAR_COLUMNS.map(({ key, label }) => (
            <th
              key={key}
              scope="col"
              className={`pb-2 text-sm font-bold ${key === 'day' ? 'text-foreground' : 'text-secondary'}`}
            >
              {label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        <tr>
          {PILLAR_COLUMNS.map(({ key, label }) => {
            const pillar = pillars[key];
            const tenGods = analysis.tenGods[key];
            return (
              <td key={key} className="align-top">
                <div
                  aria-label={`${label} 천간과 지지`}
                  className={`flex flex-col gap-1.5 rounded-[1.4rem] p-1 sm:gap-2 sm:p-1.5 ${
                    key === 'day' ? 'bg-foreground/[0.06] ring-2 ring-foreground' : ''
                  }`}
                >
                  <PillarGlyph
                    glyph={pillar && pillar.stem}
                    element={pillar ? STEM_INFO[pillar.stem].element : null}
                    caption={
                      pillar
                        ? `${STEM_INFO[pillar.stem].ko}·${ELEMENT_KO[STEM_INFO[pillar.stem].element]}`
                        : HOUR_UNKNOWN_LABEL
                    }
                    tenGod={tenGods?.stem ?? null}
                    dayMaster={key === 'day'}
                  />
                  <PillarGlyph
                    glyph={pillar && pillar.branch}
                    element={pillar ? BRANCH_INFO[pillar.branch].element : null}
                    caption={
                      pillar
                        ? `${BRANCH_INFO[pillar.branch].ko}·${ELEMENT_KO[BRANCH_INFO[pillar.branch].element]}`
                        : HOUR_UNKNOWN_LABEL
                    }
                    tenGod={tenGods?.branch ?? null}
                    relationshipSeat={key === 'day'}
                  />
                </div>
              </td>
            );
          })}
        </tr>
      </tbody>
    </table>
  );
}


/**
 * 글자 한 판 — 위에서부터 십성(일간이면 「나」) · 큰 글자 · 상징과 이름.
 *
 * 폰 360px 에서 한 칸은 약 64px 이다. 글자 40px 과 12px 이름은 그 안에 들어가지만 「출생 시각 모름」은 안
 * 들어가서, 모를 때만 두 줄로 접는다(어절 단위 줄바꿈이 전역이다).
 */
function PillarGlyph({
  glyph,
  caption,
  element,
  tenGod,
  dayMaster = false,
  relationshipSeat = false,
}: {
  readonly glyph: string | null;
  readonly caption: string;
  readonly element: Element | null;
  readonly tenGod: keyof typeof TEN_GOD_KO | null;
  readonly dayMaster?: boolean;
  readonly relationshipSeat?: boolean;
}) {
  return (
    <div
      className={`${elementScope(element)} flex min-h-[8.5rem] flex-col items-center justify-center gap-1 rounded-[1.1rem] bg-[var(--tile)] px-0.5 py-2.5 sm:min-h-[10.5rem] sm:py-3.5 ${
        glyph === null ? 'border-2 border-dashed border-[color-mix(in_srgb,var(--ink)_30%,transparent)]' : ''
      }`}
    >
      <span
        className={`min-h-5 text-xs font-semibold leading-5 ${
          dayMaster ? 'rounded-full bg-foreground px-2 text-background' : 'text-[var(--ink)]'
        }`}
      >
        {dayMaster ? '나' : tenGod ? TEN_GOD_KO[tenGod] : glyph === null ? '—' : ''}
      </span>
      <span
        className={`glyph text-[2.5rem] font-bold leading-none tracking-normal sm:text-[3.75rem] ${
          glyph === null ? 'text-muted' : 'text-[var(--ink)]'
        }`}
      >
        {glyph ?? '?'}
      </span>
      <span
        className={`flex items-center justify-center gap-0.5 text-xs font-semibold leading-4 text-[var(--ink)] ${
          glyph === null ? 'px-1 text-center' : 'whitespace-nowrap'
        }`}
      >
        {glyph !== null && <ElementSymbol element={element} className="size-3.5 sm:size-4" />}
        {caption}
      </span>
      {relationshipSeat && (
        <span className="rounded-full bg-surface px-1.5 text-xs font-semibold leading-5 text-foreground">관계 자리</span>
      )}
    </div>
  );
}


function Term({ children }: { children: React.ReactNode }) {
  return <dt className="text-muted">{children}</dt>;
}


function DetailPanel({
  note,
  children,
}: {
  readonly note: string;
  readonly children: React.ReactNode;
}) {
  return (
    <div>
      <p className="mb-3 text-[13px] leading-5 text-secondary">{note}</p>
      {children}
    </div>
  );
}


function PillarValueGrid({
  values,
}: {
  readonly values: (position: PillarPosition) => React.ReactNode | null;
}) {
  return (
    <div className="grid grid-cols-4 gap-1 text-center sm:gap-2">
      {PILLAR_COLUMNS.map(({ key, label }) => {
        const value = values(key);
        return (
          <div key={key} className={`min-w-0 rounded-xl px-0.5 py-2 text-xs sm:px-2 sm:text-[13px] ${key === 'day' ? 'bg-cream text-foreground ring-1 ring-border-strong' : 'bg-surface-soft text-secondary'}`}>
            <p className="mb-1 text-xs font-semibold text-secondary">{label}</p>
            {value ?? <span className="opacity-40">·</span>}
          </div>
        );
      })}
    </div>
  );
}


function BasisBlock({ label, children }: { readonly label: string; readonly children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 text-xs font-semibold text-secondary">{label}</p>
      <div>
        {children}
      </div>
    </div>
  );
}
