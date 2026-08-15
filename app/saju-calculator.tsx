'use client';

import { useMemo, useState } from 'react';

import {
  BRANCH_INFO,
  CITY_LONGITUDES,
  DAEUN_DIRECTION_KO,
  ELEMENTS,
  ELEMENT_KO,
  GENDERS,
  GENDER_KO,
  STEM_INFO,
  TEN_GOD_KO,
  computeSaju,
  type CityName,
  type Gender,
  type LateNightRule,
  type Saju,
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

/** 전통 표기 순서 — 시주가 왼쪽, 년주가 오른쪽 */
const PILLAR_COLUMNS = [
  { key: 'hour', label: '시주' },
  { key: 'day', label: '일주' },
  { key: 'month', label: '월주' },
  { key: 'year', label: '년주' },
] as const;

const CITIES = Object.keys(CITY_LONGITUDES) as CityName[];


/**
 * 시간 기준 — 시주·일주를 어느 시계로 읽을 것인가.
 *
 * 세 값이 경도·균시차 두 스위치를 대신한다. 성립하지 않는 조합(경도 없이
 * 균시차만)을 애초에 만들 수 없게 하려는 것이다.
 */
type TimeBasis = 'localMean' | 'record' | 'trueSolar';

const TIME_BASES = ['localMean', 'record', 'trueSolar'] as const satisfies readonly TimeBasis[];

const TIME_BASIS: Record<
  TimeBasis,
  {
    label: string;
    hint: string;
    useLongitude: boolean;
    useEquationOfTime: boolean;
    /** 고급 — 기본 화면에서는 접어둔다 */
    advanced?: boolean;
  }
> = {
  localMean: {
    label: '지방평균태양시',
    hint: '경도 보정 · 기본값',
    useLongitude: true,
    useEquationOfTime: false,
  },
  record: {
    label: '출생기록 시각',
    hint: '보정 없음',
    useLongitude: false,
    useEquationOfTime: false,
  },
  trueSolar: {
    label: '진태양시',
    hint: '경도 + 균시차 (±16분)',
    useLongitude: true,
    useEquationOfTime: true,
    advanced: true,
  },
};

type Query = {
  date: string;
  time: string;
  /** 출생 시각을 모름 — 시주를 뽑지 않는다 */
  hourUnknown: boolean;
  /** 성별. 여덟 글자는 바꾸지 않고 대운의 방향만 정한다 */
  gender: Gender;
  city: CityName;
  rule: LateNightRule;
  /** 시간 기준 — 경도·균시차를 함께 정한다 */
  basis: TimeBasis;
};

const DEFAULT_QUERY: Query = {
  // 고정 기본값 — 서버·클라이언트 렌더가 어긋나지 않도록 현재 시각을 쓰지 않는다.
  date: '1990-05-15',
  time: '14:30',
  hourUnknown: false,
  gender: 'female',
  city: '서울',
  rule: 'jo',
  basis: 'localMean',
};

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

const CARD =
  'rounded-xl border border-border bg-surface p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]';
const FIELD =
  'h-9 rounded-md border border-border bg-surface px-2.5 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent-wash';

export function SajuCalculator() {
  const [form, setForm] = useState<Query>(DEFAULT_QUERY);
  const [query, setQuery] = useState<Query>(DEFAULT_QUERY);

  const result = useMemo(() => calculate(query), [query]);
  const dirty = (Object.keys(form) as (keyof Query)[]).some((k) => form[k] !== query[k]);

  const set = <K extends keyof Query>(key: K, value: Query[K]) =>
    setForm({ ...form, [key]: value });

  return (
    <div className="flex flex-col gap-6">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          setQuery(form);
        }}
        className={`${CARD} flex flex-col gap-4`}
      >
        <div className="flex flex-wrap items-end gap-3">
          <Field label="생년월일">
            <input
              type="date"
              value={form.date}
              onChange={(e) => set('date', e.target.value)}
              className={FIELD}
            />
          </Field>

          <Field label="출생시각">
            <input
              type="time"
              value={form.time}
              onChange={(e) => set('time', e.target.value)}
              disabled={form.hourUnknown}
              className={`${FIELD} disabled:opacity-40`}
            />
          </Field>

          {/* Field 안에 넣으면 label 이 중첩된다 — 옆에 나란히 둔다 */}
          <label className="flex h-9 cursor-pointer items-center gap-1.5 text-sm whitespace-nowrap">
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

          <button
            type="submit"
            className="h-9 rounded-md bg-accent px-4 text-sm font-medium text-white transition-opacity hover:opacity-90"
          >
            사주 뽑기
          </button>
        </div>

        <fieldset className="border-t border-border pt-3">
          <legend className="text-xs uppercase tracking-wide text-muted">시간 기준</legend>

          <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
            {TIME_BASES.filter((basis) => !TIME_BASIS[basis].advanced).map((basis) => (
              <BasisRadio
                key={basis}
                basis={basis}
                checked={form.basis === basis}
                onChange={() => set('basis', basis)}
              />
            ))}
          </div>

          {/* 진태양시는 쓰는 계통이 드물어 접어둔다. 고른 상태면 펼쳐 보인다. */}
          <details className="mt-2" open={TIME_BASIS[form.basis].advanced}>
            <summary className="cursor-pointer text-xs text-muted">고급</summary>
            <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
              {TIME_BASES.filter((basis) => TIME_BASIS[basis].advanced).map((basis) => (
                <BasisRadio
                  key={basis}
                  basis={basis}
                  checked={form.basis === basis}
                  onChange={() => set('basis', basis)}
                />
              ))}
            </div>
          </details>
        </fieldset>

        {dirty && (
          <p className="text-sm text-secondary">
            입력이 바뀌었습니다. &lsquo;사주 뽑기&rsquo;를 누르면 결과가 갱신됩니다.
          </p>
        )}
      </form>

      {result.ok ? (
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
  return (
    <div className="flex flex-col gap-6">
      <PillarChart saju={saju} />
      <DaeunTable saju={saju} />
      <div className="grid gap-6 lg:grid-cols-2">
        <ElementChart saju={saju} />
        <StrengthMeter saju={saju} />
      </div>
      <TimeCorrections saju={saju} />
      <Warnings saju={saju} />
    </div>
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
        <h2 className="text-xs uppercase tracking-wide text-muted">대운</h2>
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

      <div className="mt-4 overflow-x-auto">
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
                <td key={entry.index} className="px-1">
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
    <section className={CARD}>
      <h2 className="mb-4 text-xs uppercase tracking-wide text-muted">사주팔자</h2>

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
          </tbody>
        </table>
      </div>

      <dl className="mt-5 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 border-t border-border pt-4 text-sm">
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
      <h2 className="text-xs uppercase tracking-wide text-muted">오행 분포</h2>
      <p className="mt-1 mb-4 text-xs text-secondary">
        개수는 {glyphCount === 8 ? '여덟' : '여섯'} 글자, 점수는 지장간을 사령 일수로 펼친 값
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
                className={`py-1 pl-3 text-right tabular-nums ${
                  counts[element] === 0 ? 'text-muted' : ''
                }`}
              >
                {counts[element]}
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
  const { strength } = saju.analysis;
  const percent = strength.ratio * 100;
  const threshold = 50;

  return (
    <section className={`${CARD} flex flex-col`}>
      <h2 className="text-xs uppercase tracking-wide text-muted">신강 · 신약</h2>

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
            아군 {strength.supportScore.toFixed(2)} · 적군 {strength.opposeScore.toFixed(2)}
          </span>
          <span className="tabular-nums">
            {percent.toFixed(1)}% <span className="text-muted">(기준 {threshold}%)</span>
          </span>
        </div>
      </div>

      <ul className="mt-4 flex flex-col gap-1 border-t border-border pt-3 text-sm">
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

      <p className="mt-3 text-xs text-secondary">
        억부 기준 필요 오행{' '}
        <strong className="font-medium">
          {strength.neededElements.map((e) => ELEMENT_KO[e]).join(', ')}
        </strong>
        <span className="text-muted"> · 격국·조후를 함께 보면 결론이 달라질 수 있습니다</span>
      </p>
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
    <section className={CARD}>
      <h2 className="text-xs uppercase tracking-wide text-muted">
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
      <h2 className="text-xs uppercase tracking-wide text-muted">경계 주의</h2>
      <ul className="mt-2 flex list-disc flex-col gap-1.5 pl-4 text-sm text-secondary">
        {saju.meta.warnings.map((warning) => (
          <li key={warning}>{warning}</li>
        ))}
      </ul>
    </section>
  );
}
