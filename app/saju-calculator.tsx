'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';

import {
  DEFAULT_QUERY,
  TIME_BASES,
  TIME_BASIS,
  queryFromSearchParams,
  toSearchParams,
  type Query,
  type TimeBasis,
} from './query';
import {
  BRANCH_INFO,
  CITY_LONGITUDES,
  DAEUN_DIRECTION_KO,
  ELEMENTS,
  ELEMENT_KO,
  GENDERS,
  GENDER_KO,
  ELEMENT_ROLE_KO,
  EMPTINESS_BASIS_KO,
  UNRESOLVED_FACTOR_KO,
  PILLAR_POSITION_KO,
  RELATION_KIND_KO,
  SPIRIT_BASIS_KO,
  STEM_INFO,
  TEN_GOD_KO,
  TWELVE_SPIRIT_ALIAS,
  TWELVE_SPIRIT_KO,
  TWELVE_STAGE_KO,
  computeSaju,
  directionParticipantsOf,
  toCivil,
  zoneIntervalAt,
  type CityName,
  type Gender,
  type LateNightRule,
  type PillarPosition,
  type Relation,
  type Saju,
  type StarNature,
  type StarTarget,
} from '@/src/lib/saju';

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
 * 오행별 전통색(청·적·황·백·흑)을 쓰지 않은 이유:
 * 白(금)은 채움색으로 성립하지 않고, 대체색을 넣으면 접근성 게이트를 넘지
 * 못한다 — 토=갈색/금=금색은 적↔갈 ΔE 2.5(deutan)로 사실상 같은 색이고,
 * 은색·회색은 채도 하한에 걸린다. 통과하는 조합은 금=보라뿐인데 근거가 없다.
 * 막대마다 이름이 붙어 색이 정체성을 지지 않으므로 단일 색조로 크기만 나타낸다.
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

/** 전통 표기 순서 — 시주가 왼쪽, 년주가 오른쪽 */
const PILLAR_COLUMNS = [
  { key: 'hour', label: '시주' },
  { key: 'day', label: '일주' },
  { key: 'month', label: '월주' },
  { key: 'year', label: '년주' },
] as const;

const CITIES = Object.keys(CITY_LONGITUDES) as CityName[];


type Result = { ok: true; saju: Saju } | { ok: false; message: string };

function calculate(query: Query): Result {
  const [year, month, day] = query.date.split('-').map(Number);
  const [hour, minute] = query.time.split(':').map(Number);

  if ([year, month, day].some((n) => !Number.isFinite(n))) {
    return { ok: false, message: '생년월일을 입력해 주세요.' };
  }
  if (!query.hourUnknown && ![hour, minute].every(Number.isFinite)) {
    return { ok: false, message: '출생시각을 입력하거나 시간 모름을 선택해 주세요.' };
  }

  // 엔진이 던지는 메시지를 그대로 보여준다. 검증 규칙을 UI에 복제하면
  // 두 곳이 어긋나는 순간 사용자만 헷갈린다.
  try {
    const { useLongitude, useEquationOfTime } = TIME_BASIS[query.basis];

    const saju = computeSaju(
      query.hourUnknown
        ? { year, month, day, hour: null, gender: query.gender }
        : { year, month, day, hour, minute, second: 0, gender: query.gender },
      {
        lateNightRule: query.rule,
        longitude: CITY_LONGITUDES[query.city],
        useLongitude,
        useEquationOfTime,
        saeun: { fromYear: query.saeunFrom, count: 10 },
        // useDst 는 넘기지 않는다 — 엔진 기본값이 '되돌린다'이고,
        // 그것이 물어볼 일 없는 사실이기 때문이다.
      },
    );
    return { ok: true, saju };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : '계산에 실패했습니다.',
    };
  }
}

const pad = (n: number) => String(n).padStart(2, '0');
const round1 = (n: number) => Math.round(n * 10) / 10;
const signedMinutes = (n: number) => `${round1(n) >= 0 ? '+' : ''}${round1(n)}분`;
const ageRangeLabel = (from: number, to: number) =>
  from === to ? `만 ${from}세` : `만 ${from}→${to}세`;
const koreaMonthDay = (date: Date) => {
  const local = toCivil(date, zoneIntervalAt(date).totalOffsetMinutes);
  return `${local.month}/${local.day}`;
};

const CARD =
  'rounded-xl border border-border bg-surface p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]';
const FIELD =
  'h-11 rounded-md border border-border bg-surface px-2.5 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent-wash sm:h-10';

/**
 * 제출된 입력은 주소창이 들고, 폼은 타이핑 중인 값만 들고 있다.
 *
 * 그래서 결과 화면을 그대로 링크로 줄 수 있고, 새로고침·뒤로가기에도 같은
 * 명식이 나온다. 계산은 여전히 브라우저 안에서만 일어난다 — 주소창은 서버로
 * 가는 통로가 아니라 이 페이지가 스스로 읽는 상태 저장소다.
 *
 * 주소는 `history` API 로 직접 바꾼다. Next 라우터가 이 호출을 함께 보므로
 * `useSearchParams` 가 따라 갱신되고, 라우트 전환 없이 주소만 바뀐다.
 *
 * 첫 계산은 `push`, 이후 수정은 `replace` 다. 첫 계산에는 "빈 화면으로
 * 되돌아간다"는 뒤로가기가 있어야 하지만, 세운 연도를 몇 번 옮겼다고 뒤로가기를
 * 그만큼 눌러야 하는 것은 아니다.
 */
export function SajuCalculator() {
  const searchParams = useSearchParams();
  const query = useMemo(() => queryFromSearchParams(searchParams), [searchParams]);

  const [form, setForm] = useState<Query>(query ?? DEFAULT_QUERY);

  // 주소가 밖에서 바뀌면(뒤로가기·앞으로가기·링크로 들어옴) 폼도 그 값으로 되돌린다.
  // 화면은 주소가 가리키는 명식을 보여주는데 폼만 옛 입력을 들고 있으면,
  // '입력이 바뀌었습니다' 가 사용자가 바꾼 적 없는데도 떠 있게 된다.
  const shown = useRef(searchParams.toString());
  useEffect(() => {
    const current = searchParams.toString();
    if (current === shown.current) return;
    shown.current = current;
    setForm(queryFromSearchParams(searchParams) ?? DEFAULT_QUERY);
  }, [searchParams]);

  const result = useMemo(() => (query === null ? null : calculate(query)), [query]);
  const dirty =
    query !== null && (Object.keys(form) as (keyof Query)[]).some((k) => form[k] !== query[k]);

  const set = <K extends keyof Query>(key: K, value: Query[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  const submit = (next: Query) => {
    const params = toSearchParams(next).toString();
    shown.current = params;
    if (query === null) window.history.pushState(null, '', `?${params}`);
    else window.history.replaceState(null, '', `?${params}`);
  };

  return (
    <div className="flex flex-col gap-6">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          submit(form);
        }}
        className={`${CARD} flex flex-col gap-4`}
      >
        <div className="flex flex-wrap items-end gap-3">
          <Field label="생년월일">
            <input
              type="date"
              value={form.date}
              onChange={(e) => set('date', e.target.value)}
              min="1900-01-01"
              max="2100-12-31"
              required
              className={FIELD}
            />
          </Field>

          <Field label="출생시각">
            <input
              type="time"
              value={form.time}
              onChange={(e) => set('time', e.target.value)}
              disabled={form.hourUnknown}
              required={!form.hourUnknown}
              className={`${FIELD} disabled:opacity-40`}
            />
          </Field>

          {/* Field 안에 넣으면 label 이 중첩된다 — 옆에 나란히 둔다 */}
          <label className="flex h-11 cursor-pointer items-center gap-2 text-sm whitespace-nowrap sm:h-10">
            <input
              type="checkbox"
              checked={form.hourUnknown}
              onChange={(e) => set('hourUnknown', e.target.checked)}
              className="accent-accent"
            />
            시간 모름
          </label>

          <Field label="성별">
            <select
              value={form.gender}
              onChange={(e) => set('gender', e.target.value as Gender)}
              className={FIELD}
            >
              {GENDERS.map((gender) => (
                <option key={gender} value={gender}>
                  {GENDER_KO[gender]}
                </option>
              ))}
            </select>
          </Field>

          <Field label="출생지">
            <select
              value={form.city}
              onChange={(e) => set('city', e.target.value as CityName)}
              className={FIELD}
            >
              {CITIES.map((city) => (
                <option key={city} value={city}>
                  {city} ({CITY_LONGITUDES[city].toFixed(2)}°E)
                </option>
              ))}
            </select>
          </Field>

          <button
            type="submit"
            className="h-11 w-full rounded-md bg-accent-strong px-5 text-sm font-medium text-on-accent transition-opacity hover:opacity-90 sm:h-10 sm:w-auto"
          >
            {query === null ? '사주 보기' : '결과 업데이트'}
          </button>
        </div>

        <details className="border-t border-border pt-3" open={TIME_BASIS[form.basis].advanced}>
          <summary className="flex min-h-10 cursor-pointer items-center text-sm font-medium text-secondary">
            고급 설정
            <span className="ml-2 text-xs font-normal text-muted">자시 · 시간 기준 · 세운 연도</span>
          </summary>

          <div className="mt-3 flex flex-wrap items-end gap-3">
            <Field label="자시 규칙">
              {/* 시간을 모르면 자시 경계에 걸릴 일이 없어 선택이 무의미하다 */}
              <select
                value={form.rule}
                onChange={(e) => set('rule', e.target.value as LateNightRule)}
                disabled={form.hourUnknown}
                className={`${FIELD} disabled:opacity-40`}
              >
                <option value="jo">조자시 · 경계 23:00</option>
                <option value="ya">야자시 · 경계 자정</option>
              </select>
            </Field>

            <Field label="세운 시작">
              <input
                type="number"
                value={form.saeunFrom}
                min={1900}
                max={2100}
                onChange={(e) => set('saeunFrom', Number(e.target.value))}
                className={`${FIELD} w-28`}
              />
            </Field>
          </div>

          <fieldset className="mt-4">
            <legend className="text-xs uppercase tracking-wide text-muted">시간 기준</legend>
            <div className="mt-2 flex flex-col gap-2 text-sm sm:flex-row sm:flex-wrap sm:gap-x-5">
              {TIME_BASES.map((basis) => (
                <BasisRadio
                  key={basis}
                  basis={basis}
                  checked={form.basis === basis}
                  onChange={() => set('basis', basis)}
                />
              ))}
            </div>
          </fieldset>
        </details>

        {dirty && (
          <p className="text-sm text-secondary">
            입력이 바뀌었습니다. &lsquo;결과 업데이트&rsquo;를 누르면 반영됩니다.
          </p>
        )}
      </form>

      {result === null ? (
        <section className={`${CARD} bg-surface-sunken`} aria-labelledby="empty-title">
          <h2 id="empty-title" className="text-base font-semibold">
            생년월일시를 입력해 주세요
          </h2>
          <p className="mt-1.5 text-sm text-secondary">
            입력 전에는 예시 명식을 보여주지 않습니다. 계산은 서버 전송 없이 이 브라우저에서
            처리됩니다.
          </p>
        </section>
      ) : result.ok ? (
        <SajuView saju={result.saju} />
      ) : (
        <p role="alert" className={`${CARD} text-sm`}>
          {result.message}
        </p>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs text-secondary">{label}</span>
      {children}
    </label>
  );
}

/** 시간 기준 하나를 고르는 라디오. 세 개가 한 그룹이라 조합이 생기지 않는다. */
function BasisRadio({
  basis,
  checked,
  onChange,
}: {
  basis: TimeBasis;
  checked: boolean;
  onChange: () => void;
}) {
  const { label, hint } = TIME_BASIS[basis];

  return (
    <label className="flex cursor-pointer items-center gap-1.5">
      <input
        type="radio"
        name="time-basis"
        value={basis}
        checked={checked}
        onChange={onChange}
        className="accent-accent"
      />
      <span>{label}</span>
      <span className="text-xs text-muted">{hint}</span>
    </label>
  );
}

function SajuView({ saju }: { saju: Saju }) {
  const [fortuneView, setFortuneView] = useState<'daeun' | 'saeun' | 'wolun'>('saeun');
  const [viewedAt] = useState(() => Date.now());

  return (
    <div className="flex flex-col gap-6">
      <ResultNav />
      <PillarChart saju={saju} />
      <div id="analysis" className="scroll-mt-20 grid gap-6 lg:grid-cols-2">
        <ElementChart saju={saju} />
        <StrengthMeter saju={saju} />
      </div>
      <RelationTable saju={saju} />
      <FortuneTabs view={fortuneView} onChange={setFortuneView} saju={saju} viewedAt={viewedAt} />
      <StarTable saju={saju} />
      <TimeCorrections saju={saju} />
      <Warnings saju={saju} />
    </div>
  );
}

const RESULT_LINKS = [
  ['chart', '명식'],
  ['analysis', '분석'],
  ['relations', '관계'],
  ['fortune', '운'],
  ['stars', '신살'],
  ['corrections', '보정'],
] as const;

function ResultNav() {
  return (
    <nav
      aria-label="결과 바로가기"
      className="sticky top-2 z-20 -my-2 overflow-x-auto rounded-xl border border-border bg-surface/95 px-2 py-2 shadow-sm backdrop-blur"
    >
      <ul className="flex min-w-max items-center gap-1">
        {RESULT_LINKS.map(([target, label]) => (
          <li key={target}>
            <a
              href={`#${target}`}
              className="flex min-h-10 items-center rounded-lg px-3 text-sm text-secondary hover:bg-surface-sunken hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              {label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

function FortuneTabs({
  view,
  onChange,
  saju,
  viewedAt,
}: {
  view: 'daeun' | 'saeun' | 'wolun';
  onChange: (view: 'daeun' | 'saeun' | 'wolun') => void;
  saju: Saju;
  viewedAt: number;
}) {
  const tabs = [
    { key: 'daeun', label: '대운' },
    { key: 'saeun', label: '세운' },
    { key: 'wolun', label: '월운' },
  ] as const;

  const selectByKeyboard = (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    let nextIndex = index;
    if (event.key === 'ArrowRight') nextIndex = (index + 1) % tabs.length;
    else if (event.key === 'ArrowLeft') nextIndex = (index - 1 + tabs.length) % tabs.length;
    else if (event.key === 'Home') nextIndex = 0;
    else if (event.key === 'End') nextIndex = tabs.length - 1;
    else return;

    event.preventDefault();
    onChange(tabs[nextIndex].key);
    event.currentTarget
      .closest('[role="tablist"]')
      ?.querySelectorAll<HTMLButtonElement>('[role="tab"]')
      [nextIndex]?.focus();
  };

  return (
    <div id="fortune" className="scroll-mt-20 flex flex-col gap-3">
      <div className={`${CARD} flex flex-wrap items-center justify-between gap-3 py-3`}>
        <div>
          <h2 className="text-base font-semibold">운 흐름</h2>
          <p className="mt-0.5 text-xs text-secondary">기간을 골라 한 표씩 집중해서 봅니다.</p>
        </div>
        <div
          role="tablist"
          aria-label="운 종류"
          className="grid min-h-11 grid-cols-3 rounded-lg bg-surface-sunken p-1"
        >
          {tabs.map((tab, index) => {
            const selected = view === tab.key;
            return (
              <button
                key={tab.key}
                id={`fortune-tab-${tab.key}`}
                type="button"
                role="tab"
                aria-selected={selected}
                aria-controls="fortune-panel"
                tabIndex={selected ? 0 : -1}
                onClick={() => onChange(tab.key)}
                onKeyDown={(event) => selectByKeyboard(event, index)}
                className={`min-h-9 rounded-md px-4 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
                  selected
                    ? 'bg-surface text-foreground shadow-sm'
                    : 'text-secondary hover:text-foreground'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      <div
        id="fortune-panel"
        role="tabpanel"
        aria-labelledby={`fortune-tab-${view}`}
      >
        {view === 'daeun' && <DaeunTable saju={saju} />}
        {view === 'saeun' && <SaeunTable saju={saju} viewedAt={viewedAt} />}
        {view === 'wolun' && <WolunTable saju={saju} viewedAt={viewedAt} />}
      </div>
    </div>
  );
}

function HorizontalScrollHint() {
  return (
    <p className="mt-2 text-right text-xs text-muted sm:hidden" aria-hidden="true">
      ← 좌우로 넘겨 전체 보기 →
    </p>
  );
}

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

function StarTable({ saju }: { saju: Saju }) {
  const { stars } = saju.sinsal;

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

      <p className="mt-3 border-t border-border pt-3 text-xs text-muted">
        채택한 고전 기준으로만 뽑습니다. 현침은 甲辛卯午申 중 3자 이상,
        천문은 戌亥가 함께 있어야 성립합니다. 역마·도화·화개는 12신살에서, 귀문관살·
        원진살은 관계 표에서 가져온 값이라 그쪽과 언제나 일치합니다 — 두 글자가 서로
        어떻게 걸렸는지는 &lsquo;원국의 관계&rsquo;에 있습니다. 길신·흉신은 전통적
        분류일 뿐 좋고 나쁨의 판정이 아닙니다.
        {!saju.meta.hourKnown && ' 시주를 몰라 시주에 걸린 신살은 빠져 있습니다.'}
      </p>
    </section>
  );
}

/**
 * 원국의 관계 — 여덟 글자 안에서 성립하는 형충회합.
 *
 * 길흉을 말하지 않는다. 무엇이 무엇과 어떤 관계인지, 어느 자리에서인지만 적는다.
 * 붙어 있어야 성립한다고 보는 학파를 위해 떨어진 것은 거리를 밝히고, 반쪽만
 * 모인 것은 반쪽이라고 밝힌다. 걸러내는 것은 읽는 사람의 몫이다.
 */
function RelationTable({ saju }: { saju: Saju }) {
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
                    {relation.participants.map((p) => p.char).join('')}
                  </td>
                  <td className="py-1.5 pl-3 whitespace-nowrap">
                    {relation.ko}
                    {relation.name && (
                      <span className="ml-1.5 text-xs text-muted">{relation.name}</span>
                    )}
                  </td>
                  <td className="py-1.5 pl-3 whitespace-nowrap text-secondary">
                    {relation.participants
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
                              {arrow.from.char}이 {arrow.to.char}를 형
                            </span>
                          )
                        );
                      })()}
                      {!relation.full && <span>반쪽</span>}
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

      <p className="mt-3 border-t border-border pt-3 text-xs text-muted">
        성립 여부만 적습니다. 합이 이뤄지는지, 충이 합을 깨는지는 학파마다 갈려 판정하지 않습니다.
        원진과 귀문은 네 쌍이 겹치므로 같은 두 글자에 두 줄이 함께 나올 수 있습니다.
        {!saju.meta.hourKnown && ' 시주를 몰라 시주가 걸린 관계는 빠져 있습니다.'}
      </p>
    </section>
  );
}

/**
 * 관계 하나를 가리키는 키.
 *
 * 이름만으로는 모자란다. 같은 관계가 **자리만 달리해** 여러 번 나오고
 * (원국에 辰이 둘이면 월운 卯와 묘진해가 둘 성립한다), 계산판이 섞이면
 * 자리 이름마저 겹친다(원국 년주와 세운 년주가 둘 다 'year'). 글자가 아니라
 * 계산판+자리가 관계의 정체성이다.
 */
function relationKey(relation: Relation): string {
  return `${relation.kind}:${relation.ko}:${relation.participants
    .map((p) => `${p.chartId}.${p.position}`)
    .join('-')}`;
}

/**
 * 세운 — 해마다의 간지.
 *
 * 대운 표와 같은 모양으로 늘어놓되, 세운은 **원국과 무엇을 하는가**가 본론이라
 * 관계를 칸 아래에 함께 적는다. 그 관계는 원국 안에서 닫힌 것을 뺀 것이다 —
 * 그건 해마다 같아서 세운 칸에 적을 이유가 없다.
 *
 * 해의 경계는 입춘이다. 1월에 일어난 일은 아직 전 해의 세운이라, 각 칸에
 * 입춘 날짜를 적어 둔다.
 */
function SaeunTable({ saju, viewedAt }: { saju: Saju; viewedAt: number }) {
  const { entries } = saju.saeun;
  const currentChartId = entries.find(
    (entry) =>
      viewedAt >= entry.startTerm.date.getTime() &&
      viewedAt < entry.nextStartTerm.date.getTime(),
  )?.chartId;

  return (
    <section className={CARD}>
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 className="text-base font-semibold">세운</h2>
        <p className="text-sm text-secondary">
          {entries[0].year}년 ~ {entries[entries.length - 1].year}년
        </p>
      </div>

      <p className="mt-1.5 text-xs text-secondary">
        해의 경계는 입춘입니다. 양력 1월에 일어난 일은 아직 전 해의 세운입니다.
      </p>

      <div className="mt-4 snap-x snap-proximity overflow-x-auto">
        <table className="w-full min-w-[52rem] border-collapse text-center">
          <caption className="sr-only">해마다의 간지와 원국과의 관계</caption>
          <thead>
            <tr>
              {entries.map((entry) => {
                const current = entry.chartId === currentChartId;
                return (
                  <th
                    key={entry.year}
                    className={`px-1 pb-2 text-xs font-normal ${current ? 'text-accent' : 'text-secondary'}`}
                  >
                    {entry.year}
                    {current && <span className="ml-1 text-[10px] font-medium">현재</span>}
                    <span className="block text-[11px] text-muted">
                      {ageRangeLabel(entry.ageAtStart, entry.ageAtEnd)}
                    </span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            <tr>
              {entries.map((entry) => {
                const current = entry.chartId === currentChartId;
                return (
                  <td key={entry.year} className="snap-start px-1 align-top">
                    <div
                      className={`mx-auto flex w-full max-w-24 flex-col items-center gap-0.5 rounded-lg border py-2.5 ${
                        current
                          ? 'border-accent bg-accent-wash'
                          : 'border-border bg-surface-sunken'
                      }`}
                    >
                    <span className="text-[10px] text-muted">
                      {TEN_GOD_KO[entry.tenGods.stem]}
                    </span>
                    <span className="glyph text-2xl leading-none">{entry.pillar.stem}</span>
                    <span className="glyph text-2xl leading-none">{entry.pillar.branch}</span>
                    <span className="text-[10px] text-muted">
                      {TEN_GOD_KO[entry.tenGods.branch]}
                    </span>
                    <span className="mt-1 text-[11px] text-secondary">
                      {TWELVE_STAGE_KO[entry.stage]}
                    </span>
                    <span className="text-[10px] text-muted">
                      {TWELVE_SPIRIT_ALIAS[entry.spirits.year] ??
                        TWELVE_SPIRIT_KO[entry.spirits.year]}
                    </span>
                    </div>

                    <ul className="mt-1.5 flex flex-col gap-0.5 text-[10px] text-secondary">
                      {entry.relations.map((relation) => (
                        <li key={relationKey(relation)}>
                          {relation.ko}
                          {relation.scope === 'combinedFormation' && (
                            <span className="text-muted"> 합쳐서</span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </td>
                );
              })}
            </tr>
          </tbody>
        </table>
      </div>
      <HorizontalScrollHint />

      <p className="mt-3 border-t border-border pt-3 text-xs text-muted">
        칸 안은 위에서부터 천간 십성 · 간지 · 지지 십성 · 12운성(일간 기준) ·
        12신살(년지 기준)입니다. 아래 목록은 그 해가 원국과 맺는 관계로, 원국
        안에서만 성립하는 관계는 뺐습니다.
      </p>
    </section>
  );
}

/**
 * 월운 — 한 해의 열두 달.
 *
 * 세운 표와 같은 모양이되 경계가 다르다. 달력 월이 아니라 절입이라, 각 칸에
 * 그 달이 시작되는 절과 날짜를 적는다 — 3월 3일이 아직 인월이라는 것이
 * 월운에서 가장 자주 어긋나는 지점이다.
 */
function WolunTable({ saju, viewedAt }: { saju: Saju; viewedAt: number }) {
  const { year, entries } = saju.wolun;
  const currentChartId = entries.find(
    (entry) =>
      viewedAt >= entry.startTerm.date.getTime() && viewedAt < entry.nextTerm.date.getTime(),
  )?.chartId;

  return (
    <section className={CARD}>
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 className="text-base font-semibold">월운</h2>
        <p className="text-sm text-secondary">{year}년 (사주년)</p>
      </div>

      <p className="mt-1.5 text-xs text-secondary">
        경계는 절입입니다. 달력 월이 아니라 절기가 달을 가릅니다 — 3월 초 경칩
        전까지는 아직 인월(寅月)입니다.
      </p>

      <div className="mt-4 snap-x snap-proximity overflow-x-auto">
        <table className="w-full min-w-[60rem] border-collapse text-center">
          <caption className="sr-only">한 해 열두 달의 간지와 원국·세운과의 관계</caption>
          <thead>
            <tr>
              {entries.map((entry) => (
                <th
                  key={entry.chartId}
                  className={`px-1 pb-2 text-xs font-normal ${
                    entry.chartId === currentChartId ? 'text-accent' : 'text-secondary'
                  }`}
                >
                  {entry.startTerm.name}
                  {entry.chartId === currentChartId && (
                    <span className="ml-1 text-[10px] font-medium">현재</span>
                  )}
                  <span className="block text-[11px] text-muted">
                    {koreaMonthDay(entry.startTerm.date)}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              {entries.map((entry) => (
                <td key={entry.chartId} className="snap-start px-1 align-top">
                  <div
                    className={`mx-auto flex w-full max-w-20 flex-col items-center gap-0.5 rounded-lg border py-2.5 ${
                      entry.chartId === currentChartId
                        ? 'border-accent bg-accent-wash'
                        : 'border-border bg-surface-sunken'
                    }`}
                  >
                    <span className="text-[10px] text-muted">
                      {TEN_GOD_KO[entry.tenGods.stem]}
                    </span>
                    <span className="glyph text-xl leading-none">{entry.pillar.stem}</span>
                    <span className="glyph text-xl leading-none">{entry.pillar.branch}</span>
                    <span className="text-[10px] text-muted">
                      {TEN_GOD_KO[entry.tenGods.branch]}
                    </span>
                    <span className="mt-1 text-[11px] text-secondary">
                      {TWELVE_STAGE_KO[entry.stage]}
                    </span>
                  </div>

                  <ul className="mt-1.5 flex flex-col gap-0.5 text-[10px] text-secondary">
                    {entry.relations.map((relation) => (
                      <li key={relationKey(relation)}>{relation.ko}</li>
                    ))}
                  </ul>
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
      <HorizontalScrollHint />

      <p className="mt-3 border-t border-border pt-3 text-xs text-muted">
        아래 목록은 그 달이 <strong className="font-medium">원국과 세운</strong>에 대해
        맺는 관계입니다. 그 달이 끼지 않은 관계는 빼두었습니다 — 원국 안에서
        닫힌 것도, 원국과 세운 사이의 것도 여기 적을 이유가 없습니다.
      </p>
    </section>
  );
}

/**
 * 대운 — 10년마다 갈아입는 간지. 시간 순서가 있으므로 가로로 늘어놓는다.
 *
 * 나이는 만 나이(출생일로부터의 경과 연수)다. 세는나이로 적는 만세력과는
 * 한 살 차이가 나므로 화면에 밝혀 둔다.
 */
function DaeunTable({ saju }: { saju: Saju }) {
  const { daeun } = saju;

  return (
    <section className={CARD}>
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 className="text-base font-semibold">대운</h2>
        <p className="text-sm">
          <span className="font-medium">{DAEUN_DIRECTION_KO[daeun.direction]}</span>
          <span className="mx-1.5 text-muted">·</span>
          대운수 <span className="tabular-nums font-medium">{daeun.startAge}</span>
          {daeun.approximate && <span className="ml-1.5 text-xs text-muted">근사</span>}
        </p>
      </div>

      <p className="mt-1.5 text-xs text-secondary">
        {daeun.directionReason} {daeun.boundaryTerm.name} 절입까지{' '}
        {round1(daeun.daysToBoundary)}일이라 3으로 나눠 {round1(daeun.startAgeExact)}년입니다.
      </p>

      <div className="mt-4 snap-x snap-proximity overflow-x-auto">
        <table className="w-full min-w-[36rem] border-collapse text-center">
          <caption className="sr-only">10년 단위 대운</caption>
          <thead>
            <tr>
              {daeun.entries.map((entry) => (
                <th key={entry.index} className="px-1 pb-2 text-xs font-normal text-secondary">
                  {entry.startAge}세
                  <span className="block text-[11px] text-muted">{entry.startYear}년</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              {daeun.entries.map((entry) => (
                <td key={entry.index} className="snap-start px-1">
                  <div className="mx-auto flex w-full max-w-20 flex-col items-center gap-0.5 rounded-lg border border-border bg-surface-sunken py-2.5">
                    <span className="glyph text-2xl leading-none">{entry.pillar.stem}</span>
                    <span className="glyph text-2xl leading-none">{entry.pillar.branch}</span>
                    <span className="mt-0.5 text-[11px] text-secondary">{entry.pillar.ko}</span>
                  </div>
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
      <HorizontalScrollHint />

      <p className="mt-3 border-t border-border pt-3 text-xs text-muted">
        나이는 만 나이입니다. 세는나이로 적는 만세력과 한 살 차이가 날 수 있습니다.
        {daeun.approximate && ' 출생 시각을 몰라 정오 기준으로 계산해 대운수가 두어 달 흔들립니다.'}
      </p>
    </section>
  );
}

/** 사주팔자 — 차트가 아니라 표다. 일주(나) 열만 강조한다. */
function PillarChart({ saju }: { saju: Saju }) {
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
                    caption={
                      pillar
                        ? `${STEM_INFO[pillar.stem].ko} · ${ELEMENT_KO[STEM_INFO[pillar.stem].element]}`
                        : '시각 미상'
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
                    caption={
                      pillar
                        ? `${BRANCH_INFO[pillar.branch].ko} · ${ELEMENT_KO[BRANCH_INFO[pillar.branch].element]}`
                        : '시각 미상'
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

            <MarkRow
              label="12운성"
              hint="일간 기준"
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
            <Term>출생시각</Term>
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
}: {
  /** `null` 이면 빈 자리 — 시각을 모르는 시주 */
  glyph: string | null;
  caption: string;
  emphasis: boolean;
}) {
  return (
    <td className="px-2 py-1">
      <div
        className={`mx-auto flex w-full max-w-24 flex-col items-center gap-0.5 rounded-lg border py-3 ${
          emphasis
            ? 'border-accent bg-accent-wash'
            : glyph === null
              ? 'border-dashed border-border'
              : 'border-border bg-surface-sunken'
        }`}
      >
        <span
          className={`glyph text-4xl leading-none ${glyph === null ? 'text-muted' : ''}`}
        >
          {glyph ?? '?'}
        </span>
        <span className="text-[11px] text-secondary">{caption}</span>
      </div>
    </td>
  );
}

/**
 * 오행 분포 — 크기 비교가 일이므로 단일 색조 막대.
 * 값을 전부 옆에 적으므로 표 역할도 겸한다(툴팁 불필요).
 */
function ElementChart({ saju }: { saju: Saju }) {
  const { counts, scores, ratios, missing, strongest, glyphCount } = saju.analysis.elements;
  const needed = new Set(saju.analysis.strength.neededElements);
  const max = Math.max(...ELEMENTS.map((e) => ratios[e]), 0.0001);

  return (
    <section className={CARD}>
      <h2 className="text-base font-semibold">오행 분포</h2>
      <p className="mt-1 mb-4 text-xs text-secondary">
        개수는 {glyphCount === 8 ? '여덟' : '여섯'} 글자를 그대로 센 것(옆의 %는 그
        비중), 점수는 지장간을 사령 일수로 펼친 값입니다. 다른 만세력은 대개
        앞쪽 기준으로 %를 냅니다
        {glyphCount !== 8 && <span className="text-muted"> · 시주 제외</span>}
      </p>

      <table className="w-full border-collapse text-sm">
        <caption className="sr-only">오행별 개수와 지장간 가중 점수</caption>
        <thead className="text-xs text-muted">
          <tr>
            <th className="pb-1.5 text-left font-normal whitespace-nowrap">오행</th>
            <th className="pb-1.5 pl-3 text-right font-normal whitespace-nowrap">개수</th>
            <th className="pb-1.5 pl-3 text-right font-normal whitespace-nowrap">점수</th>
            <th className="w-full pb-1.5 pl-3 text-left font-normal whitespace-nowrap">비중</th>
          </tr>
        </thead>
        <tbody>
          {ELEMENTS.map((element) => (
            <tr key={element}>
              <td className="py-1 whitespace-nowrap">
                <span className="glyph">{element}</span>{' '}
                <span className="text-secondary">{ELEMENT_KO[element]}</span>
                {element === strongest && <span className="ml-1.5 text-xs text-muted">최강</span>}
                {needed.has(element) && <span className="ml-1.5 text-xs text-accent">필요</span>}
              </td>
              <td
                className={`py-1 pl-3 text-right tabular-nums whitespace-nowrap ${
                  counts[element] === 0 ? 'text-muted' : ''
                }`}
              >
                {counts[element]}
                <span className="ml-1 text-xs text-muted">
                  {Math.round((counts[element] / glyphCount) * 100)}%
                </span>
              </td>
              <td className="py-1 pl-3 text-right tabular-nums text-secondary">
                {scores[element].toFixed(2)}
              </td>
              <td className="py-1 pl-3">
                <div className="flex items-center gap-2">
                  <div className="h-2.5 min-w-0 flex-1 rounded-sm bg-track">
                    <div
                      className="h-full rounded-r-[4px] bg-accent"
                      style={{ width: `${(ratios[element] / max) * 100}%` }}
                    />
                  </div>
                  <span className="w-9 shrink-0 text-right text-xs tabular-nums text-secondary">
                    {Math.round(ratios[element] * 100)}%
                  </span>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {missing.length > 0 && (
        <p className="mt-3 border-t border-border pt-3 text-xs text-secondary">
          없는 오행 {missing.map((e) => ELEMENT_KO[e]).join(', ')}
          {glyphCount !== 8 && (
            <span className="text-muted"> · 시주에 있었을지는 알 수 없습니다</span>
          )}
        </p>
      )}
    </section>
  );
}

/** 신강·신약 — 임계값 대비 단일 비율이므로 메터. */
function StrengthMeter({ saju }: { saju: Saju }) {
  const { strength, eokbu, johu } = saju.analysis;
  const percent = strength.ratio * 100;
  const threshold = 50;

  return (
    <section className={`${CARD} flex flex-col`}>
      <h2 className="text-base font-semibold">신강 · 신약</h2>

      <p className="mt-2 flex items-baseline gap-2">
        <span className="text-3xl font-semibold">
          {strength.verdict === 'strong' ? '신강' : '신약'}
        </span>
        <span className="text-sm text-secondary">세 기준 중 {strength.metCount}개 충족</span>
      </p>

      <div className="mt-4">
        <div className="relative h-3 rounded-sm bg-track">
          <div
            className="h-full rounded-r-[4px] bg-accent"
            style={{ width: `${percent}%` }}
          />
          <div
            className="absolute inset-y-[-3px] w-px bg-border-strong"
            style={{ left: `${threshold}%` }}
            aria-hidden
          />
        </div>
        <div className="mt-1.5 flex justify-between text-xs text-secondary">
          <span>
            보조 {strength.supportScore.toFixed(2)} · 소모 {strength.opposeScore.toFixed(2)}
          </span>
          <span className="tabular-nums">
            보조세력 {percent.toFixed(1)}%{' '}
            <span className="text-muted">(기준 {threshold}%)</span>
          </span>
        </div>
      </div>

      <p className="mt-3 text-xs text-muted">
        세력비에 태약·중화·태왕 같은 등급 이름은 붙이지 않습니다. 근거 있는 구간
        경계를 아직 확보하지 못했습니다. 아래 세 기준도 서로 겹칩니다 — 득세
        점수에 월지·일지가 이미 들어 있습니다.
      </p>

      <ul className="mt-3 flex flex-col gap-1 border-t border-border pt-3 text-sm">
        {strength.criteria.map((criterion) => (
          <li key={criterion.key} className="flex gap-2">
            <span className={criterion.met ? 'text-accent' : 'text-muted'}>
              {criterion.met ? '○' : '✕'}
            </span>
            <span className="w-8 shrink-0">{criterion.label}</span>
            <span className="text-secondary">{criterion.detail}</span>
          </li>
        ))}
      </ul>

      <div className="mt-4 border-t border-border pt-3">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <span className="rounded-sm border border-border px-1.5 py-0.5 text-[10px] text-muted">
            참고표
          </span>
          <span className="text-xs text-muted">조후 후보 천간</span>
          <span className="glyph text-lg font-medium">{johu.stems.join(' · ')}</span>
          <span className="text-xs text-secondary">
            {johu.dayMaster}일간 · {johu.monthBranch}월
          </span>
        </div>
        <p className="mt-1.5 text-xs text-secondary">{johu.note}</p>
        <p className="mt-2 text-xs text-muted">
          《궁통보감》 120조합의 조건 요약입니다. 원국 구성과 월의 상·하순 조건을
          모두 자동 판정한 확정 용신이 아니므로 후보와 조건을 함께 읽어야 합니다.
        </p>
      </div>

      <div className="mt-4 border-t border-border pt-3">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <span className="rounded-sm border border-border px-1.5 py-0.5 text-[10px] text-muted">
            시험
          </span>
          <span className="text-xs text-muted">억부 관점의 후보</span>
          <span className="glyph text-lg font-medium">{eokbu.suggestedElement}</span>
          <span className="text-sm font-medium">{ELEMENT_KO[eokbu.suggestedElement]}</span>
          <span className="text-sm text-secondary">{ELEMENT_ROLE_KO[eokbu.role]}</span>
          {!eokbu.presentInChart && (
            <span className="text-xs text-muted">원국에 없는 오행</span>
          )}
        </div>
        <p className="mt-1.5 text-xs text-secondary">{eokbu.reason}</p>
        <p className="mt-2 text-xs text-muted">
          <strong className="font-medium">용신 확정값이 아닙니다.</strong> 억부는 용신을
          잡는 네 길 중 하나일 뿐이고, 아직 판정하지 않은 것이 남아 있습니다 —{' '}
          {eokbu.unresolved.map((factor) => UNRESOLVED_FACTOR_KO[factor]).join(', ')}.
          위 조후표도 조건을 전부 자동 판정하지 않은 참고값입니다.
          꺼리는 오행(기신)도 내지 않습니다 — 오행 상극표 한 줄로 정해지는 것이
          아니기 때문입니다.
        </p>
      </div>
    </section>
  );
}

function TimeCorrections({ saju }: { saju: Saju }) {
  const { meta, pillars } = saju;
  const civil = pillars.meta.civilTime;

  // 요청한 값이 아니라 실제로 적용된 보정에서 읽는다.
  const applied = new Set(meta.corrections.map((correction) => correction.kind));
  const basis = applied.has('equationOfTime')
    ? 'trueSolar'
    : applied.has('longitude')
      ? 'localMean'
      : 'record';

  return (
    <section id="corrections" className={`${CARD} scroll-mt-20`}>
      <h2 className="text-base font-semibold">
        적용된 보정
        <span className="ml-2 text-secondary normal-case">{TIME_BASIS[basis].label}</span>
      </h2>

      {meta.inputTime.hour === null ? (
        <p className="mt-2 mb-3 text-sm text-secondary">
          시각 미상이라 정오를 기준으로 계산했습니다. 아래는 그 시각에 적용된 보정
          기록일 뿐입니다 — 시주는 뽑지 않았고, 연·월주는 절대 시각으로 판정하며,
          일주는 정오라 이 보정으로는 넘어가지 않습니다.
        </p>
      ) : (
        <p className="mt-2 mb-3 text-sm">
          <span className="tabular-nums">
            {pad(meta.inputTime.hour)}:{pad(meta.inputTime.minute)}
          </span>
          <span className="mx-2 text-muted">→</span>
          <span className="tabular-nums font-medium">
            {pad(civil.hour)}:{pad(civil.minute)}
          </span>
          <span className="ml-2 text-secondary">
            총 {signedMinutes(meta.totalCorrectionMinutes)}
          </span>
        </p>
      )}

      <table className="w-full border-collapse text-sm">
        <tbody>
          {meta.corrections.map((correction) => (
            <tr key={correction.kind} className="border-t border-border">
              <td className="py-1.5 pr-3 whitespace-nowrap">{correction.label}</td>
              <td className="py-1.5 pr-3 text-right tabular-nums whitespace-nowrap">
                {correction.minutes === 0 ? (
                  <span className="text-muted">—</span>
                ) : (
                  signedMinutes(correction.minutes)
                )}
              </td>
              <td className="py-1.5 text-secondary">{correction.detail}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function Warnings({ saju }: { saju: Saju }) {
  if (saju.meta.warnings.length === 0) return null;

  return (
    <section className={`${CARD} bg-surface-sunken`}>
      <h2 className="text-base font-semibold">경계 주의</h2>
      <ul className="mt-2 flex list-disc flex-col gap-1.5 pl-4 text-sm text-secondary">
        {saju.meta.warnings.map((warning) => (
          <li key={warning}>{warning}</li>
        ))}
      </ul>
    </section>
  );
}
