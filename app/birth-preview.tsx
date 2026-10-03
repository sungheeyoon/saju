import { useId } from 'react';

import { BRANCH_INFO, STEM_INFO, type LateNightRule, type Pillar } from '@/src/lib/saju';
import { TIME_BASIS, type TimeBasis } from '@/src/lib/input/query';

import type { BirthPreview } from './birth-hour';
import { PILLAR_COLUMNS } from './saju/shared';
import { ELEMENT_TONE } from './ui/element-tone';

/**
 * 입력 폼 밑에 서는 **확인 세 가지** — 무슨 시각으로 읽었나 · 자시를 어떻게 볼까 · 그래서 어떤 여덟 글자인가.
 *
 * 셋 다 그리기만 한다. 값은 `birth-hour.ts` 가 엔진(`calculateChart`)에서 읽어 온다.
 */

const signedMinutes = (n: number) => {
  const rounded = Math.round(n);
  return `${rounded > 0 ? '+' : rounded < 0 ? '−' : '±'}${Math.abs(rounded)}분`;
};

/**
 * 시계 시각이 **사주가 읽는 시각으로 몇 분 옮겨졌는가.**
 *
 * 다른 만세력과 시주가 갈리는 가장 흔한 까닭이 이것이다 — 서울에서 14:30 에 났으면 진태양시로는 14:01 이다. 결과
 * 화면의 「적용된 보정」에도 있지만, 시주 경계(예: 15:28)를 사이에 둔 사람은 **넣는 자리에서** 봐야 출생지 · 기준을
 * 고칠 수 있다. 보정이 없으면(출생기록 시각 · 서머타임 없음) 서지 않는다.
 */
export function SolarClockLine({ preview, basis }: { preview: BirthPreview; basis: TimeBasis }) {
  const { clock } = preview;
  if (clock === null || clock.corrections.length === 0) return null;
  return (
    <p className="px-4 text-xs leading-5 text-secondary">
      <span className="font-medium text-foreground">
        계산 시각 {clock.dayShift === 'previous' ? '전날 ' : clock.dayShift === 'next' ? '다음 날 ' : ''}
        <span className="tabular-nums">{clock.solar}</span>
      </span>{' '}
      ({TIME_BASIS[basis].label}) · 시계 <span className="tabular-nums">{clock.written}</span>에서{' '}
      {clock.corrections.map((correction) => `${correction.label} ${signedMinutes(correction.minutes)}`).join(' · ')}
    </p>
  );
}

/**
 * 자정 전 자시 — **그 자리에서 고른다.**
 *
 * 23시대에 난 사람은 조자시(23시에 날이 바뀜)와 야자시(자정에 날이 바뀜) 가운데 무엇으로 보느냐에 따라 일주가 다르다.
 * 고급 설정 안에 접어 두면 그 갈림을 아는 사람만 찾아 연다. 두 규칙이 **이 입력에서 실제로 세우는 일주**를 나란히
 * 보여 주고 고르게 한다 — 값은 고급 설정의 「자시」와 같은 `rule` 이다.
 */
export function LateNightChoice({
  choices,
  rule,
  onPick,
}: {
  choices: Record<LateNightRule, { day: Pillar; hour: Pillar | null }>;
  rule: LateNightRule;
  onPick: (rule: LateNightRule) => void;
}) {
  const name = useId();
  const options: { rule: LateNightRule; label: string; hint: string }[] = [
    { rule: 'jo', label: '조자시', hint: '23시에 날이 바뀜' },
    { rule: 'ya', label: '야자시', hint: '자정에 날이 바뀜' },
  ];
  return (
    <div role="radiogroup" aria-label="자시 규칙" className="flex flex-col gap-2 rounded-2xl bg-surface p-4 shadow-card">
      <p className="text-[15px] font-medium text-foreground">자정 전 자시에 태어났어요</p>
      <p className="text-[13px] leading-5 text-secondary">
        이 시각을 그날로 볼지 다음 날로 볼지는 보는 법마다 달라서 일주가 갈려요.
      </p>
      <div className="grid grid-cols-2 gap-2">
        {options.map((option) => {
          const checked = option.rule === rule;
          const { day } = choices[option.rule];
          return (
            <label
              key={option.rule}
              className={`relative flex cursor-pointer flex-col gap-0.5 rounded-xl p-3 has-[:focus-visible]:outline has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-1 has-[:focus-visible]:outline-accent-soft ${
                checked ? 'bg-accent-wash ring-2 ring-accent' : 'bg-surface-sunken'
              }`}
            >
              <input
                type="radio"
                name={name}
                checked={checked}
                onChange={() => onPick(option.rule)}
                className="absolute inset-0 cursor-pointer appearance-none opacity-0"
              />
              <span className="text-[15px] font-semibold text-foreground">{option.label}</span>
              <span className="text-xs text-secondary">{option.hint}</span>
              <span className="mt-1 text-[13px] text-foreground">
                일주 <PillarGlyphs pillar={day} />
              </span>
            </label>
          );
        })}
      </div>
    </div>
  );
}

function PillarGlyphs({ pillar }: { pillar: Pillar }) {
  return (
    <span className="font-semibold">
      <span className={ELEMENT_TONE[STEM_INFO[pillar.stem].element].text}>{pillar.stem}</span>
      <span className={ELEMENT_TONE[BRANCH_INFO[pillar.branch].element].text}>{pillar.branch}</span>
      <span className="ml-1 font-normal text-secondary">{pillar.ko}</span>
    </span>
  );
}

/**
 * **넣은 값으로 서는 여덟 글자** — 제출 전에 본다.
 *
 * 다른 만세력에서 본 사주와 견주는 사람이 많다. 결과를 열고 나서야 다르다는 것을 알면 무엇을 고쳐야 할지(달력? 시각?
 * 출생지?) 다시 찾아야 한다. 칸을 고치는 그 자리에서 글자가 바뀌어야 원인이 보인다. 순서는 전통 표기(시 · 일 · 월 · 년)다.
 *
 * 입춘 전 출생은 띠와 년주가 달력의 해와 다르다 — 가장 흔한 「내 띠가 왜 이래요」라서 한 줄로 적는다. 절입 · 시지 경계
 * · 서머타임처럼 엔진이 경계라고 남긴 문장은 그대로 옮긴다(`meta.warnings`).
 */
export function PillarPreview({ preview }: { preview: BirthPreview }) {
  const { pillars } = preview.saju;
  return (
    <section aria-label="입력한 정보로 세운 사주" className="flex flex-col gap-3 rounded-2xl bg-surface p-4 shadow-card">
      <p className="text-[13px] font-medium text-secondary">입력한 정보로 세운 사주</p>
      <dl className="grid grid-cols-4 gap-1.5">
        {PILLAR_COLUMNS.map(({ key, label }) => {
          const pillar = pillars[key];
          return (
            <div key={key} className="flex flex-col items-center gap-1 rounded-xl bg-surface-sunken py-2.5">
              <dt className="text-[11px] text-secondary">{label}</dt>
              <dd className="flex flex-col items-center leading-7">
                {pillar === null ? (
                  <span className="text-[13px] leading-[3.5rem] text-muted">모름</span>
                ) : (
                  <>
                    <span className={`text-2xl font-semibold ${ELEMENT_TONE[STEM_INFO[pillar.stem].element].text}`}>
                      {pillar.stem}
                    </span>
                    <span className={`text-2xl font-semibold ${ELEMENT_TONE[BRANCH_INFO[pillar.branch].element].text}`}>
                      {pillar.branch}
                    </span>
                  </>
                )}
                <span className="text-[11px] leading-4 text-secondary">{pillar?.ko ?? ''}</span>
              </dd>
            </div>
          );
        })}
      </dl>
      {(preview.beforeIpchun !== null || preview.warnings.length > 0) && (
        <ul className="flex flex-col gap-1 text-xs leading-5 text-secondary">
          {preview.beforeIpchun !== null && (
            <li>
              입춘 전이라 년주는 {preview.beforeIpchun.sajuYear}년의 {preview.beforeIpchun.year.name}(
              {BRANCH_INFO[preview.beforeIpchun.year.branch].zodiac}띠)로 세워요.
            </li>
          )}
          {preview.warnings.map((warning) => (
            <li key={warning}>{warning}</li>
          ))}
        </ul>
      )}
    </section>
  );
}
