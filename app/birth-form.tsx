'use client';

import { useEffect, useRef, useState } from 'react';

import {
  CALENDARS,
  CALENDAR_KO,
  CITY_LONGITUDES,
  GENDERS,
  GENDER_KO,
  SUPPORTED_YEAR_RANGE,
  type Calendar,
  type CityName,
  type LateNightRule,
} from '@/src/lib/saju';

import { dateRefusal } from '@/src/lib/input/chart';
import {
  DEFAULT_QUERY,
  HOUR_UNKNOWN_CHOICE,
  NAME_MAX,
  TIME_BASES,
  TIME_BASIS,
  type DatePart,
  type Query,
} from '@/src/lib/input/query';

import { Icon } from './ui/icons';
import styles from './birth-form.module.css';
import { ChoiceField, DigitsField, SelectField, cx } from './birth-choices';
import {
  convertedLine,
  dateOfParts,
  digitOutOfRange,
  limitsOf,
  splitDate,
  splitTime,
  timeOfParts,
} from './birth-entry';

/**
 * 생년월일시 입력 한 벌.
 *
 * 원국 화면과 궁합 화면이 같은 것을 묻는다. 두 곳에 같은 폼을 따로 두면 한쪽만
 * 고쳐져서 "같은 값을 넣었는데 다른 사주가 나오는" 상태가 만들어진다.
 *
 * 제출 버튼은 여기 없다. 원국은 폼 하나에 버튼 하나지만 궁합은 두 사람을 채운
 * 뒤 한 번 누르므로, 버튼의 자리와 문구는 쓰는 화면이 정한다.
 *
 * ## 왜 `<input type="date">`·`<input type="time">` 을 쓰지 않는가
 *
 * 네이티브 컨트롤은 **기기가 모양과 규칙을 정한다.** 같은 폼이 iOS 에서는 휠,
 * 안드로이드에서는 달력, 데스크톱에서는 칸 세 개로 뜨고, 시각은 로케일에 따라
 * 오전/오후로 갈린다. 여기서 묻는 것은 사주 계산에 쓰이는 **24시간 기준의 시·분**
 * 이라 오전/오후가 한 번 접히면 「오후 12시」가 0시인지 12시인지에서 갈린다.
 * 그리고 태어난 해는 대개 40~90년 전이라, 달력 위젯으로는 그만큼을 넘겨야 한다.
 *
 * 그래서 년·월·일과 시·분을 각각 숫자로 적게 한다.
 *
 * **적은 숫자는 폼이 지우지 않는다.** 달력을 바꾸든 없는 날을 적든 칸의 숫자는 그대로 서고, 어긋난 칸만 붉어진다
 * (`dateRefusal`) — 무엇이 틀렸는지는 버튼 곁의 문장이 말하고(`missingAnswer`), 누르면 그 칸으로 초점이 간다(`focusBirthGap`).
 */

/**
 * 폼은 **칸 모양 한 벌**이고 이 폼을 쓰는 화면이 전부 같은 칸이다(ADR 0132 덧). 치수는 `birth-form.module.css` 머리에
 * 한 벌로 적혀 있다. 칸 모양 셋은 `birth-choices.tsx`, 숫자가 날짜 · 시각이 되는 규칙은 `birth-entry.ts` 에 산다.
 *
 * - **고르는 칸**(성별 · 달력 · 출생 시각)은 선택지가 펼침 없이 다 보인다 — 처음 오는 사람이 눌러 펼쳐 봐야 무엇을 고르는지
 *   아는 것보다 낫다(`ChoiceField`).
 * - **펼치는 칸**(출생지, 고급 설정의 자시 · 시간 기준)은 선택지가 많거나 덧말이 붙어 그 자리에서 아래로 펼친다(`SelectField`).
 * - **숫자 칸**(생년월일 · 시각)은 단위(년 · 월 · 일 · 시 · 분)를 칸 안 오른쪽에 든다(`DigitsField` · `NumberField`).
 */

const CITIES = Object.keys(CITY_LONGITUDES) as CityName[];

/**
 * 고칠 칸으로 데려간다 — 붉어진 칸, 없으면 아직 빈 칸. 데려갔으면 `true`.
 *
 * 폼을 쓰는 화면이 누름을 받았는데 넘어가지 못할 때 부른다. 라디오 · 잠긴 칸은 빼고 적는 칸만 본다.
 */
export function focusBirthGap(scope: ParentNode | null | undefined): boolean {
  const fields = [
    ...(scope?.querySelectorAll<HTMLInputElement>(
      'input:not([type=hidden]):not([type=radio]):not([type=checkbox]):not(:disabled)',
    ) ?? []),
  ];
  const target = fields.find((one) => one.getAttribute('aria-invalid') === 'true') ?? fields.find((one) => one.value === '');
  target?.focus();
  return target !== undefined;
}

/**
 * 숫자 한 칸 — **적는 칸이면서 범위를 아는 칸.**
 *
 * 여섯 칸(년·월·일·시·분)이 같은 일을 한다: 숫자만 받고, 자릿수를 넘기지 않고,
 * 제 범위를 벗어나면 스스로 붉어진다. 한 벌로 두지 않으면 어느 칸 하나가
 * 「25시」를 조용히 받아들이는 날이 온다.
 *
 * **판정은 여기서 끝나지 않는다.** 이 칸이 아는 것은 자기 범위뿐이라 「2월 30일」이
 * 나 「없는 윤달」은 못 본다 — 그것은 날짜 한 벌이 다 모여야 알 수 있고, 모인 뒤에도
 * 폼이 아니라 변환·엔진이 판정한다(`convertedLine`).
 */
function NumberField({
  label,
  suffix,
  value,
  onChange,
  digits,
  min,
  max,
  placeholder,
  autoComplete,
  refused = false,
}: {
  label: string;
  /** 칸 안 오른쪽에 서는 우리말 — 「년」·「월」·「시」. 이것이 있어 자리 이름을 안 물어도 된다 */
  suffix: string;
  value: string;
  onChange: (next: string) => void;
  digits: number;
  min: number;
  max: number;
  placeholder: string;
  autoComplete?: string;
  /** 날짜 한 벌이 이 칸에서 거절됐는가 — 칸 범위 안이어도 없는 날(음력 29일까지인 달의 30일)이 있다 */
  refused?: boolean;
}) {
  /** 다 적힌 값만 판정한다 — 덜 적은 것은 아직 틀린 것이 아니다(`digitOutOfRange`) */
  const outOfRange = digitOutOfRange(value, digits, min, max);

  return (
    <label className={styles.digit}>
      <input
        type="text"
        inputMode="numeric"
        autoComplete={autoComplete}
        aria-label={label}
        // 붉어지는 것은 `aria-invalid` 를 셀렉터로 쓴다(`birth-form.module.css`) — 낭독기가 읽는 값과 눈에 보이는 색이 한 자리다
        aria-invalid={outOfRange || refused || undefined}
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value.replace(/\D/g, '').slice(0, digits))}
      />
      <span aria-hidden="true" className={styles.unit}>
        {suffix}
      </span>
    </label>
  );
}

/**
 * 년·월·일 세 칸 — **전부 적는 칸이다.**
 *
 * 고르는 칸으로 두면 연도는 백 줄이 넘는 목록이 되고, 그렇다고 흔한 해를 미리 넣어
 * 두면 연도를 손대지 않은 사람도 그 해를 고른 것이 된다 — 월·일만 채운 순간 **틀린
 * 해로 계산된 사주**가 나온다. 「고르지 않은 것을 골랐다고 치지 않는다」가 이 폼
 * 전체의 규율이다(`hourKnown` 이 셋인 이유). 숫자를 치는 것이 그 둘을 다 피한다.
 *
 * ## 대신 없는 날짜가 들어올 수 있다
 *
 * 고르는 칸이던 동안에는 「2월 30일」이 **만들어질 수가 없었다.** 적는 칸은 그
 * 보호막을 내주므로, 막는 자리를 대신 세워야 한다. 두 층으로 나눈다.
 *
 * 1. **자리마다의 범위**(월 1~12, 일 1~그 달의 마지막 날)는 칸이 붉어져 보이고, 다 적힌
 *    날짜는 범위 밖이어도 **그대로 낸다**(`dateOfParts`). 거절은 `missingAnswer` 가 무엇이
 *    틀렸는지 말하며 한다(「2월은 28일까지예요.」) — 판정하는 자리는 그 하나다.
 * 2. **날짜의 존재**(없는 윤달, 29일까지인 음력 달의 30일)는 음력 표가 이유를 붙여
 *    거절하고, 화면은 그 문장을 그대로 세우고 그 칸을 붉힌다(`refused`).
 *
 * 폼이 자기 조각을 따로 들고 있으므로 **밖에서 값이 바뀐 것과 자기가 방금 낸
 * 것을 구별해야 한다**(뒤로가기·링크로 들어옴). 마지막으로 올려 보낸 값을
 * 기억해 두고 그것과 다를 때만 조각을 다시 쪼갠다.
 */
function DateFields({
  value,
  onDate,
  refused,
}: {
  value: Query;
  onDate: (date: string) => void;
  /** 날짜 한 벌이 거절된 칸 — 없으면 `null` */
  refused: DatePart | null;
}) {
  const [parts, setParts] = useState(() => splitDate(value.date));
  const lastEmitted = useRef(value.date);

  useEffect(() => {
    if (value.date === lastEmitted.current) return;
    setParts(splitDate(value.date));
    lastEmitted.current = value.date;
  }, [value.date]);

  const { years, maxDay } = limitsOf(value.calendar, parts.year, parts.month);

  const update = (key: keyof typeof parts, next: string) => {
    const changed = { ...parts, [key]: next };
    setParts(changed);
    const date = dateOfParts(changed);
    lastEmitted.current = date;
    onDate(date);
  };

  return (
    <DigitsField label="생년월일" groupStart>
      <NumberField
        label="출생연도"
        suffix="년"
        value={parts.year}
        onChange={(next) => update('year', next)}
        digits={4}
        min={years.min}
        max={years.max}
        placeholder={String(years.max - 30)}
        autoComplete="bday-year"
        refused={refused === 'year'}
      />
      <NumberField
        label="출생월"
        suffix="월"
        value={parts.month}
        onChange={(next) => update('month', next)}
        digits={2}
        min={1}
        max={12}
        placeholder="1~12"
        autoComplete="bday-month"
        refused={refused === 'month'}
      />
      <NumberField
        label="출생일"
        suffix="일"
        value={parts.day}
        onChange={(next) => update('day', next)}
        digits={2}
        min={1}
        max={maxDay}
        placeholder={`1~${maxDay}`}
        autoComplete="bday-day"
        refused={refused === 'day'}
      />
    </DigitsField>
  );
}

/**
 * 출생시각 — **24시간으로만 묻는다.**
 *
 * 오전·오후를 따로 고르게 하면 「오후 12시 30분」이 0시 30분인지 12시 30분인지에서
 * 갈리고, 그 한 칸이 시주를 통째로 바꾼다. 자시 규칙(조자시 23:00 경계)도 23시가
 * 23시로 적혀 있을 때만 사람이 대조할 수 있다.
 *
 * 시각을 아는가는 「출생 시각」 고르는 칸이다(「직접 입력 · 모름」). 체크박스는 **꺼진 상태가 답처럼
 * 보이지 않아서** 쓰지 않는다 — 시각을 안 넣고 체크도 안 한 사람이 자기가 아직 아무것도 고르지 않았다는 것을 모른다
 * (`hourKnown` 이 `null`·`false`·`true` 셋인 이유). 주소에서 온 입력이 `null` 이면 두 선택지 모두 꺼져 있고 시각 칸은
 * 서지 않는다 — 고르기 전에는 어느 쪽도 고른 것이 아니다.
 *
 * 「모름」을 고르면 적어 둔 시각도 지운다. 남겨 두면 "모름인데 14:30" 이 상태로
 * 남고, 다시 「직접 입력」을 고르는 순간 사용자가 지웠다고 생각한 값으로 계산된다.
 */
function TimeFields({ value, onChange }: { value: Query; onChange: (next: Query) => void }) {
  const [parts, setParts] = useState(() => splitTime(value.time));
  const lastEmitted = useRef(value.time);

  useEffect(() => {
    if (value.time === lastEmitted.current) return;
    setParts(splitTime(value.time));
    lastEmitted.current = value.time;
  }, [value.time]);

  const update = (key: keyof typeof parts, next: string) => {
    const changed = { ...parts, [key]: next };
    setParts(changed);
    const time = timeOfParts(changed);
    lastEmitted.current = time;
    onChange({ ...value, hourKnown: true, time });
  };

  const choose = (known: boolean) => {
    if (!known) {
      setParts({ hour: '', minute: '' });
      lastEmitted.current = '';
      onChange({ ...value, hourKnown: false, time: '' });
      return;
    }
    const time = timeOfParts(parts);
    lastEmitted.current = time;
    onChange({ ...value, hourKnown: true, time });
  };

  const known = value.hourKnown === true;

  return (
    <>
      <ChoiceField
        label="출생 시각"
        labelAt="rail"
        groupStart
        value={value.hourKnown === null ? '' : value.hourKnown ? 'known' : 'unknown'}
        onPick={(next) => choose(next === 'known')}
        options={[
          { value: 'known', label: '직접 입력' },
          { value: 'unknown', label: HOUR_UNKNOWN_CHOICE, hint: '출생 시각 없이 풀이해요' },
        ]}
      />
      {/*
        시·분도 **적는 칸**이다. 24시간이라 시는 스물넷, 분은 예순 줄짜리 목록이 되는데, 두 자리를 치는 편이
        어느 쪽이든 빠르다. 범위를 벗어나면 시각을 내보내지 않으므로 「25:70」이 계산으로 흘러가지 않는다.
        「직접 입력」일 때만 선다 — 「모름」이거나 아직 안 골랐으면(주소에서 온 `null`) 이 칸이 빠진다.
      */}
      {known && (
        <DigitsField label="시각" hint="24시간" rail>
          <NumberField
            label="출생 시"
            suffix="시"
            value={parts.hour}
            onChange={(next) => update('hour', next)}
            digits={2}
            min={0}
            max={23}
            placeholder="0~23"
          />
          <NumberField
            label="출생 분"
            suffix="분"
            value={parts.minute}
            onChange={(next) => update('minute', next)}
            digits={2}
            min={0}
            max={59}
            placeholder="0~59"
          />
        </DigitsField>
      )}
    </>
  );
}

export function BirthFields({
  value,
  onChange,
  surface,
  namePlaceholder,
  showName = true,
}: {
  value: Query;
  onChange: (next: Query) => void;
  /**
   * 폼이 서는 바탕 — 칸은 어디서나 같고 **판을 누가 그리는가**만 갈린다.
   *
   * - `panel`: 크림 종이 위다. 폼이 제 흰 판을 그린다(첫 화면 · 내 사주 등록).
   * - `flat`: 이미 흰 판(카드) 안이다. 판을 다시 그리면 두 겹이 되므로 칸만 선다(`/saju` · 궁합 · 사람 추가 · 출생 정보 수정).
   */
  surface: 'panel' | 'flat';
  /** 이름 칸이 비었을 때 대신 보일 말 */
  namePlaceholder?: string;
  /** 본인은 계정 닉네임으로 부르므로 출생 정보에서 이름을 다시 묻지 않는다 */
  showName?: boolean;
}) {
  const panel = surface === 'panel' && styles.panel;
  const set = <K extends keyof Query>(key: K, next: Query[K]) => onChange({ ...value, [key]: next });

  /** 한 폼에서 펼치는 칸은 하나만 열린다 — 다른 칸을 누르면 앞의 것이 접힌다 */
  const [open, setOpen] = useState<SelectKey | null>(null);
  const toggle = (key: SelectKey) => () => setOpen((current) => (current === key ? null : key));
  const pick = <K extends keyof Query>(key: K) => (next: Query[K]) => set(key, next);

  /**
   * 고급 설정을 편 채인가. **기본값이 아닌 값이 숨어 있으면 늘 펴져 있다** — 주소로 들어온 입력이나 고쳐 온
   * 판본이 진태양시가 아닐 때, 무엇으로 세운 명식인지가 접힘 뒤에 가린다. 기본값을 옮겨도 이 규칙은 따라온다.
   */
  const [advanced, setAdvanced] = useState(false);
  const advancedShown = advanced || value.basis !== DEFAULT_QUERY.basis;

  /**
   * 달력을 바꿔도 **날짜는 그대로다.** 양력 1908년을 음력으로 옮기면 그 해는 음력 표 밖(1912~)이지만, 지우지 않고
   * 해 칸을 붉힌다 — 지우면 사용자가 다시 적어야 하고, 무엇이 틀렸는지는 버튼 곁의 문장이 말한다(ADR 0132 「2026-10-11 덧」).
   */
  const chooseCalendar = (calendar: Calendar) => onChange({ ...value, calendar });

  // 미리보기도 계산과 **같은 함수**를 부른다. 폼이 따로 변환하면 화면에 보인
  // 양력과 계산에 들어간 양력이 갈릴 수 있다.
  const converted = convertedLine(value);
  const refused = dateRefusal(value)?.part ?? null;

  return (
    /*
      묻는 것을 성질끼리 모은다: 누구인가(이름 · 성별) → 언제(생년월일 · 달력 · 시각) → 어디서(출생지). 계산 옵션은
      따로 떨어진 「고급 설정」이다(ADR 0132).
    */
    <div className={styles.form}>
      <div className={styles.main}>
        <div className={cx(styles.fields, panel)}>
          {showName && (
            <label className={styles.name}>
              <span className={styles.label}>이름</span>
              <input
                type="text"
                value={value.name}
                onChange={(event) => set('name', event.target.value.slice(0, NAME_MAX))}
                placeholder={namePlaceholder}
                maxLength={NAME_MAX}
                /* 이 칸은 대개 남의 이름이다(「엄마」 · 궁합 상대) — 브라우저가 내 이름을 채우지 않게 한다 */
                autoComplete="off"
              />
            </label>
          )}

          <ChoiceField
            label="성별"
            value={value.gender}
            onPick={pick('gender')}
            options={GENDERS.map((gender) => ({ value: gender, label: GENDER_KO[gender] }))}
          />

          <DateFields value={value} onDate={(date) => set('date', date)} refused={refused} />

          {/*
            **달력은 날짜 바로 아래다.** 「1984-10-05」는 양력인지 음력인지가 정해져야 비로소 하루를 가리키고,
            음력이면 평달인지 윤달인지에 따라 실제 날이 한 달 떨어진다.
          */}
          <ChoiceField
            label="달력"
            name="달력 기준"
            labelAt="hidden"
            value={value.calendar}
            onPick={chooseCalendar}
            options={CALENDARS.map((calendar) => ({ value: calendar, label: CALENDAR_KO[calendar] }))}
          />

          <TimeFields value={value} onChange={onChange} />

          {/*
            **출생지는 폼 안에 선다** — 진태양시의 경도라 계산에 들고(운영자 2026-09-29 「출생지도 폼에 넣어야」),
            서울이 아닌 사람이 접힌 칸을 열어 볼 까닭이 없다.
          */}
          <SelectField
            label="출생지"
            value={value.city}
            open={open === 'city'}
            onToggle={toggle('city')}
            onPick={pick('city')}
            options={CITIES.map((city) => ({ value: city, label: city }))}
          />
        </div>

        {/*
          달력 형식과 날짜는 **함께 읽어야 뜻이 생긴다.** 그래서 변환 결과를 칸들 바로 밑에 적는다 — **저장이나
          계산 전에.** 사용자가 아는 것은 음력 날짜뿐인데, 우리가 무엇을 양력으로 잡았는지 못 보면 잘못 골랐다는
          것을 결과 화면에 가서야 알게 된다.
        */}
        {converted !== null && (
          <p
            role={converted.ok ? undefined : 'alert'}
            // 색으로만 가르지 않는다 — 못 바꾼 줄은 문장 자체가 이유를 말한다.
            className={`${styles.converted} ${converted.ok ? 'text-secondary' : 'font-medium text-danger'}`}
          >
            {converted.text}
          </p>
        )}
      </div>

      {/* 고급 설정 — 여는 칸 하나. 열면 그 아래에 같은 칸들이 선다(판이 있는 바탕에서는 제 판 안에) */}
      <div className={styles.advanced}>
        <button
          type="button"
          aria-expanded={advancedShown}
          onClick={() => setAdvanced(!advancedShown)}
          className={styles.disclosure}
        >
          <span className={styles.disclosureLabel}>고급 설정</span>
          <span className={styles.disclosureSummary}>자시 · 시간 기준 · 세운</span>
          <Icon name="chevron" className={`${styles.chevron} ${advancedShown ? '-rotate-90' : 'rotate-90'}`} />
        </button>

        {advancedShown && (
          <div className={cx(styles.advancedBody, panel)}>
            {/* 시간을 모르면 자시 경계에 걸릴 일이 없어 선택이 무의미하다 */}
            <SelectField
              label="자시"
              name="자시 규칙"
              value={value.rule}
              open={open === 'rule'}
              onToggle={toggle('rule')}
              onPick={pick('rule')}
              disabled={value.hourKnown === false}
              options={[
                { value: 'jo' as LateNightRule, label: '조자시', hint: '경계 23:00' },
                { value: 'ya' as LateNightRule, label: '야자시', hint: '경계 자정' },
              ]}
            />
            <SelectField
              label="시간 기준"
              value={value.basis}
              open={open === 'basis'}
              onToggle={toggle('basis')}
              onPick={pick('basis')}
              options={TIME_BASES.map((basis) => ({ value: basis, label: TIME_BASIS[basis].label, hint: TIME_BASIS[basis].hint }))}
            />
            <label className={styles.yearRow}>
              <span className={styles.rail}>세운 연도</span>
              <input
                type="number"
                aria-label="세운 시작"
                value={value.saeunFrom}
                min={SUPPORTED_YEAR_RANGE.min}
                max={SUPPORTED_YEAR_RANGE.max}
                onChange={(event) => set('saeunFrom', Number(event.target.value))}
                className={styles.yearInput}
              />
            </label>
          </div>
        )}
      </div>
    </div>
  );
}

/** 펼치는 칸 — 고르는 칸(성별 · 달력 · 출생 시각)은 펼침이 없어 여기 없다 */
type SelectKey = 'city' | 'rule' | 'basis';
