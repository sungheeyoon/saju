import { useRef, useState, type ComponentRef } from 'react';
import { Keyboard, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { dateRefusal } from '@input/chart';
import { convertedLine, dateOfParts, limitsOf, timeOfParts } from '@input/entry';
import { DEFAULT_QUERY, HOUR_UNKNOWN_CHOICE, NAME_MAX, TIME_BASES, TIME_BASIS, type Query } from '@input/query';
import { CALENDARS, CALENDAR_KO, CITY_LONGITUDES, GENDERS, GENDER_KO, SUPPORTED_YEAR_RANGE, type CityName, type LateNightRule } from '@saju';

import { Choices, DigitField, Field, FieldLabel, Select } from '@/ui/parts';
import { COLOR, FONT, RADIUS, TYPE } from '@/ui/tokens';

const CITIES = Object.keys(CITY_LONGITUDES) as CityName[];
const HOUR_CHOICES = [
  { value: 'known', label: '직접 입력' },
  { value: 'unknown', label: HOUR_UNKNOWN_CHOICE },
] as const;
const RULES: readonly { value: LateNightRule; label: string; hint: string }[] = [
  { value: 'jo', label: '조자시', hint: '경계 23:00' },
  { value: 'ya', label: '야자시', hint: '경계 자정' },
];

/**
 * 출생 정보 칸의 값 — 입력 화면(`mobile/src/app/index.tsx`)과 같은 차례 · 같은 함수다. 저장하는 화면이라고 다른 폼을 두면 한쪽만
 * 고쳐져 같은 값에서 다른 사주가 난다(`app/me/people/manage.tsx`).
 */
export function useBirthForm() {
  const [name, setName] = useState('');
  const [gender, setGender] = useState<Query['gender']>(DEFAULT_QUERY.gender);
  const [year, setYear] = useState('');
  const [month, setMonth] = useState('');
  const [day, setDay] = useState('');
  const [calendar, setCalendar] = useState<Query['calendar']>(DEFAULT_QUERY.calendar);
  const [hourChoice, setHourChoice] = useState<'known' | 'unknown'>('known');
  const [hour, setHour] = useState('');
  const [minute, setMinute] = useState('');
  const [city, setCity] = useState<CityName>(DEFAULT_QUERY.city);
  const [advanced, setAdvanced] = useState(false);
  const [rule, setRule] = useState<LateNightRule>(DEFAULT_QUERY.rule);
  const [basis, setBasis] = useState<Query['basis']>(DEFAULT_QUERY.basis);
  const [saeunFrom, setSaeunFrom] = useState(String(DEFAULT_QUERY.saeunFrom));

  const hourKnown = hourChoice === 'known';
  const query: Query = {
    ...DEFAULT_QUERY,
    name,
    gender,
    calendar,
    date: dateOfParts({ year, month, day }),
    hourKnown,
    /* 범위 밖의 시각은 값이 안 된다 — 「33시」는 계산에 안 간다 */
    time: hourKnown ? timeOfParts({ hour, minute }) : '',
    city,
    rule,
    basis,
    saeunFrom: Number(saeunFrom),
  };

  return {
    query,
    values: { name, gender, year, month, day, calendar, hourChoice, hour, minute, city, advanced, rule, basis, saeunFrom },
    set: { setName, setGender, setYear, setMonth, setDay, setCalendar, setHour, setMinute, setCity, setAdvanced, setRule, setBasis, setSaeunFrom },
    chooseHour: (next: 'known' | 'unknown') => {
      /* 「모름」이면 적어 둔 시각도 지운다 — 다시 「직접 입력」을 골랐을 때 지운 줄 안 값으로 계산되지 않게 */
      if (next === 'unknown') {
        setHour('');
        setMinute('');
      }
      setHourChoice(next);
    },
  };
}

export function BirthFields({ form, namePlaceholder }: { form: ReturnType<typeof useBirthForm>; namePlaceholder?: string }) {
  const { query, values, set, chooseHour } = form;
  const monthRef = useRef<ComponentRef<typeof TextInput>>(null);
  const dayRef = useRef<ComponentRef<typeof TextInput>>(null);
  const hourRef = useRef<ComponentRef<typeof TextInput>>(null);
  const minuteRef = useRef<ComponentRef<typeof TextInput>>(null);

  const { years, maxDay } = limitsOf(values.calendar, values.year, values.month);
  const refused = dateRefusal(query)?.part ?? null;
  const converted = convertedLine(query);

  return (
    <View style={styles.fields}>
      <View style={styles.pair}>
        <View style={styles.half}>
          <FieldLabel>이름</FieldLabel>
          <Field value={values.name} onChange={set.setName} maxLength={NAME_MAX} placeholder={namePlaceholder} label="이름" />
        </View>
        <View style={styles.half}>
          <FieldLabel>성별</FieldLabel>
          <Choices value={values.gender} onPick={set.setGender} options={GENDERS.map((one) => ({ value: one, label: GENDER_KO[one] }))} />
        </View>
      </View>

      <View style={styles.group}>
        <FieldLabel>생년월일</FieldLabel>
        <View style={styles.row}>
          <DigitField value={values.year} onChange={set.setYear} unit="년" placeholder={String(years.max - 30)} digits={4} min={years.min} max={years.max} refused={refused === 'year'} onFull={() => monthRef.current?.focus()} />
          <DigitField inputRef={monthRef} value={values.month} onChange={set.setMonth} unit="월" placeholder="1~12" digits={2} min={1} max={12} advanceEarly refused={refused === 'month'} onFull={() => dayRef.current?.focus()} />
          <DigitField inputRef={dayRef} value={values.day} onChange={set.setDay} unit="일" placeholder={`1~${maxDay}`} digits={2} min={1} max={maxDay} advanceEarly refused={refused === 'day'} onFull={() => (values.hourChoice === 'known' ? hourRef.current?.focus() : Keyboard.dismiss())} />
        </View>
        {converted !== null && <Text style={[styles.converted, !converted.ok && styles.refused]}>{converted.text}</Text>}
        <View style={styles.row}>
          <Choices value={values.calendar} onPick={set.setCalendar} options={CALENDARS.map((one) => ({ value: one, label: CALENDAR_KO[one] }))} />
        </View>
      </View>

      <View style={styles.rail}>
        <Text style={styles.railLabel}>출생 시각</Text>
        <Choices value={values.hourChoice} onPick={chooseHour} options={HOUR_CHOICES} />
      </View>

      {values.hourChoice === 'known' && (
        <View style={styles.rail}>
          <View style={styles.railHead}>
            <Text style={styles.railLabel}>시각</Text>
            <Text style={styles.railNote}>24시간</Text>
          </View>
          <View style={styles.railBody}>
            <DigitField inputRef={hourRef} value={values.hour} onChange={set.setHour} unit="시" placeholder="0~23" digits={2} min={0} max={23} onFull={() => minuteRef.current?.focus()} />
            <DigitField inputRef={minuteRef} value={values.minute} onChange={set.setMinute} unit="분" placeholder="0~59" digits={2} min={0} max={59} onFull={Keyboard.dismiss} />
          </View>
        </View>
      )}

      <View style={styles.rail}>
        <Text style={styles.railLabel}>출생지</Text>
        <Select value={values.city} onPick={set.setCity} options={CITIES.map((one) => ({ value: one, label: one }))} />
      </View>

      <Pressable accessibilityRole="button" accessibilityState={{ expanded: values.advanced }} onPress={() => set.setAdvanced(!values.advanced)} style={styles.disclosure}>
        <Text style={styles.disclosureLabel}>고급 설정</Text>
        <Text style={styles.disclosureSummary}>자시 · 시간 기준 · 세운 {values.advanced ? '⌃' : '⌄'}</Text>
      </Pressable>

      {values.advanced && (
        <View style={styles.fields}>
          <View style={styles.rail}>
            <Text style={styles.railLabel}>자시</Text>
            <Select value={values.rule} onPick={set.setRule} options={RULES} disabled={values.hourChoice === 'unknown'} />
          </View>
          <View style={styles.rail}>
            <Text style={styles.railLabel}>시간 기준</Text>
            <Select value={values.basis} onPick={set.setBasis} options={TIME_BASES.map((one) => ({ value: one, label: TIME_BASIS[one].label, hint: TIME_BASIS[one].hint }))} />
          </View>
          <View style={styles.rail}>
            <Text style={styles.railLabel}>세운 연도</Text>
            <DigitField value={values.saeunFrom} onChange={set.setSaeunFrom} unit="년" placeholder="2026" digits={4} min={SUPPORTED_YEAR_RANGE.min} max={SUPPORTED_YEAR_RANGE.max} />
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  fields: { gap: 18 },
  pair: { flexDirection: 'row', gap: 12 },
  half: { flex: 1 },
  group: { gap: 6 },
  row: { flexDirection: 'row', gap: 6 },
  rail: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  railHead: { width: 64, minHeight: 44, justifyContent: 'center' },
  railLabel: { width: 64, minHeight: 44, lineHeight: 44, fontSize: TYPE.small, fontFamily: FONT.bold, color: COLOR.secondary },
  railNote: { fontFamily: FONT.medium, fontSize: TYPE.fine, color: COLOR.muted, marginTop: -14 },
  railBody: { flex: 1, flexDirection: 'row', gap: 6 },
  converted: { fontFamily: FONT.medium, fontSize: TYPE.small, color: COLOR.secondary, marginVertical: 2 },
  refused: { color: COLOR.danger },
  disclosure: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, borderRadius: RADIUS.control, borderWidth: 1, borderColor: COLOR.borderStrong, backgroundColor: COLOR.surface },
  disclosureLabel: { fontSize: TYPE.body, fontFamily: FONT.bold, color: COLOR.foreground },
  disclosureSummary: { fontFamily: FONT.medium, fontSize: TYPE.small, color: COLOR.secondary },
});
