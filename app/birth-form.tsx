'use client';

import {
  CITY_LONGITUDES,
  GENDERS,
  GENDER_KO,
  type CityName,
  type Gender,
  type LateNightRule,
} from '@/src/lib/saju';

import { NAME_MAX, TIME_BASES, TIME_BASIS, type Query, type TimeBasis } from './query';

/**
 * 생년월일시 입력 한 벌.
 *
 * 원국 화면과 궁합 화면이 같은 것을 묻는다. 두 곳에 같은 폼을 따로 두면 한쪽만
 * 고쳐져서 "같은 값을 넣었는데 다른 사주가 나오는" 상태가 만들어진다.
 *
 * 제출 버튼은 여기 없다. 원국은 폼 하나에 버튼 하나지만 궁합은 두 사람을 채운
 * 뒤 한 번 누르므로, 버튼의 자리와 문구는 쓰는 화면이 정한다.
 */

export const FIELD =
  'h-11 rounded-md border border-border bg-surface px-2.5 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent-wash sm:h-10';

const CITIES = Object.keys(CITY_LONGITUDES) as CityName[];

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs text-secondary">{label}</span>
      {children}
    </label>
  );
}

/**
 * `Field` 와 같아 보이지만 **label 이 아니다.**
 *
 * 라디오는 저마다 제 label 을 달아야 하는데 `Field` 안에 넣으면 label 이
 * 중첩돼 클릭이 엉뚱한 곳으로 간다. 묶음 제목이 필요하지만 클릭 대상은 아닌
 * 자리에 쓴다.
 */
function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs text-secondary">{label}</span>
      {children}
    </div>
  );
}

/** 시간 기준 하나를 고르는 라디오. 세 개가 한 그룹이라 조합이 생기지 않는다. */
export function BasisRadio({
  name,
  basis,
  checked,
  onChange,
}: {
  /** 라디오 그룹 이름 — 궁합 화면에는 그룹이 둘이라 서로 달라야 한다 */
  name: string;
  basis: TimeBasis;
  checked: boolean;
  onChange: () => void;
}) {
  const { label, hint } = TIME_BASIS[basis];

  return (
    <label className="flex cursor-pointer items-center gap-1.5">
      <input
        type="radio"
        name={name}
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

export function BirthFields({
  value,
  onChange,
  idPrefix,
  namePlaceholder,
}: {
  value: Query;
  onChange: (next: Query) => void;
  /** 한 화면에 폼이 둘일 때 라디오 그룹이 섞이지 않게 하는 이름 */
  idPrefix: string;
  /** 이름 칸이 비었을 때 대신 보일 말 */
  namePlaceholder?: string;
}) {
  const set = <K extends keyof Query>(key: K, next: Query[K]) =>
    onChange({ ...value, [key]: next });

  // 시각 선택은 두 칸을 함께 옮긴다 — '모름'을 고르면 적어 둔 시각도 지운다.
  // 남겨 두면 "모름인데 14:30" 이 상태로 남고, 다시 '시각'을 고르는 순간
  // 사용자가 지웠다고 생각한 값으로 계산된다.
  const chooseHour = (known: boolean) =>
    onChange({ ...value, hourKnown: known, time: known ? value.time : '' });

  return (
    <>
      <div className="flex flex-wrap items-end gap-3">
        <Field label="이름">
          <input
            type="text"
            value={value.name}
            onChange={(e) => set('name', e.target.value.slice(0, NAME_MAX))}
            placeholder={namePlaceholder}
            maxLength={NAME_MAX}
            required
            className={`${FIELD} w-28`}
          />
        </Field>

        <Field label="생년월일">
          <input
            type="date"
            value={value.date}
            onChange={(e) => set('date', e.target.value)}
            min="1900-01-01"
            max="2100-12-31"
            required
            className={FIELD}
          />
        </Field>

        {/*
          체크박스가 아니라 라디오 둘이다. 체크박스는 **꺼진 상태가 답처럼
          보이지 않아서**, 시각을 안 넣고 체크도 안 한 사람이 자기가 아직
          아무것도 고르지 않았다는 것을 모른다. 라디오 둘은 하나를 고르기
          전까지 비어 있는 것이 눈에 보인다.
        */}
        <Group label="출생시각">
          <div className="flex h-11 items-center gap-3 sm:h-10">
            <label className="flex cursor-pointer items-center gap-1.5 text-sm whitespace-nowrap">
              <input
                type="radio"
                name={`${idPrefix}-hour`}
                checked={value.hourKnown === true}
                onChange={() => chooseHour(true)}
                className="accent-accent"
              />
              시각
            </label>

            <input
              type="time"
              value={value.time}
              onChange={(e) => set('time', e.target.value)}
              disabled={value.hourKnown !== true}
              required={value.hourKnown === true}
              className={`${FIELD} disabled:opacity-40`}
            />

            <label className="flex cursor-pointer items-center gap-1.5 text-sm whitespace-nowrap">
              <input
                type="radio"
                name={`${idPrefix}-hour`}
                checked={value.hourKnown === false}
                onChange={() => chooseHour(false)}
                className="accent-accent"
              />
              모름
            </label>
          </div>
        </Group>

        <Field label="성별">
          <select
            value={value.gender}
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
            value={value.city}
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
      </div>

      <details className="border-t border-border pt-3" open={TIME_BASIS[value.basis].advanced}>
        <summary className="flex min-h-10 cursor-pointer items-center text-sm font-medium text-secondary">
          고급 설정
          <span className="ml-2 text-xs font-normal text-muted">자시 · 시간 기준 · 세운 연도</span>
        </summary>

        <div className="mt-3 flex flex-wrap items-end gap-3">
          <Field label="자시 규칙">
            {/* 시간을 모르면 자시 경계에 걸릴 일이 없어 선택이 무의미하다 */}
            <select
              value={value.rule}
              onChange={(e) => set('rule', e.target.value as LateNightRule)}
              disabled={value.hourKnown === false}
              className={`${FIELD} disabled:opacity-40`}
            >
              <option value="jo">조자시 · 경계 23:00</option>
              <option value="ya">야자시 · 경계 자정</option>
            </select>
          </Field>

          <Field label="세운 시작">
            <input
              type="number"
              value={value.saeunFrom}
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
                name={`${idPrefix}-time-basis`}
                basis={basis}
                checked={value.basis === basis}
                onChange={() => set('basis', basis)}
              />
            ))}
          </div>
        </fieldset>
      </details>
    </>
  );
}
