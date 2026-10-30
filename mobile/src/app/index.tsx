import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { calculateChart } from '@input/chart';
import { DEFAULT_QUERY, HOUR_UNKNOWN_CHOICE, NAME_MAX, TIME_BASES, TIME_BASIS, type Query } from '@input/query';
import { CALENDARS, CALENDAR_KO, CITY_LONGITUDES, GENDERS, GENDER_KO, type CityName, type LateNightRule } from '@saju';

import { Choices, DigitField, Field, FieldLabel, Panel, PrimaryButton, Select } from '@/ui/parts';
import { COLOR, TYPE } from '@/ui/tokens';

const CITIES = Object.keys(CITY_LONGITUDES) as CityName[];
const HOUR_CHOICES = [
  { value: 'known', label: '직접 입력' },
  { value: 'unknown', label: HOUR_UNKNOWN_CHOICE },
] as const;
const RULES: readonly { value: LateNightRule; label: string; hint: string }[] = [
  { value: 'jo', label: '조자시', hint: '경계 23:00' },
  { value: 'ya', label: '야자시', hint: '경계 자정' },
];

const pad = (digits: string) => digits.padStart(2, '0');

/** 출생 정보 — 칸의 차례와 말은 웹의 `app/birth-form.tsx` 와 같다. 계산은 웹과 같은 `calculateChart` 다 */
export default function BirthScreen() {
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
  const [failure, setFailure] = useState<string | null>(null);

  const submit = () => {
    const hourKnown = hourChoice === 'known';
    const query: Query = {
      ...DEFAULT_QUERY,
      name,
      gender,
      calendar,
      date: year.length === 4 && month !== '' && day !== '' ? `${year}-${pad(month)}-${pad(day)}` : '',
      hourKnown,
      time: hourKnown && hour !== '' && minute !== '' ? `${pad(hour)}:${pad(minute)}` : '',
      city,
      rule,
      basis,
      saeunFrom: Number(saeunFrom),
    };
    const result = calculateChart(query);
    if (!result.ok) {
      setFailure(result.message);
      return;
    }
    setFailure(null);
    router.push({ pathname: '/chart', params: { query: JSON.stringify(query) } });
  };

  return (
    <SafeAreaView style={styles.screen}>
      <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Panel tone="cream" style={styles.paper}>
            <Text style={styles.title}>나는 어떤 사람일까?</Text>

            <Panel style={styles.form}>
              <View style={styles.pair}>
                <View style={styles.half}>
                  <FieldLabel>이름</FieldLabel>
                  <Field value={name} onChange={setName} maxLength={NAME_MAX} />
                </View>
                <View style={styles.half}>
                  <FieldLabel>성별</FieldLabel>
                  <Choices value={gender} onPick={setGender} options={GENDERS.map((one) => ({ value: one, label: GENDER_KO[one] }))} />
                </View>
              </View>

              <View style={styles.group}>
                <FieldLabel>생년월일</FieldLabel>
                <View style={styles.row}>
                  <DigitField value={year} onChange={setYear} unit="년" placeholder="2000" digits={4} />
                  <DigitField value={month} onChange={setMonth} unit="월" placeholder="1~12" digits={2} />
                  <DigitField value={day} onChange={setDay} unit="일" placeholder="1~31" digits={2} />
                </View>
                <View style={styles.row}>
                  <Choices value={calendar} onPick={setCalendar} options={CALENDARS.map((one) => ({ value: one, label: CALENDAR_KO[one] }))} />
                </View>
              </View>

              <View style={styles.rail}>
                <Text style={styles.railLabel}>출생 시각</Text>
                <Choices value={hourChoice} onPick={setHourChoice} options={HOUR_CHOICES} />
              </View>

              {hourChoice === 'known' && (
                <View style={styles.rail}>
                  <View style={styles.railHead}>
                    <Text style={styles.railLabel}>시각</Text>
                    <Text style={styles.railNote}>24시간</Text>
                  </View>
                  <View style={styles.railBody}>
                    <DigitField value={hour} onChange={setHour} unit="시" placeholder="0~23" digits={2} />
                    <DigitField value={minute} onChange={setMinute} unit="분" placeholder="0~59" digits={2} />
                  </View>
                </View>
              )}

              <View style={styles.rail}>
                <Text style={styles.railLabel}>출생지</Text>
                <Select value={city} onPick={setCity} options={CITIES.map((one) => ({ value: one, label: one }))} />
              </View>
            </Panel>

            <Pressable
              accessibilityRole="button"
              accessibilityState={{ expanded: advanced }}
              onPress={() => setAdvanced(!advanced)}
              style={styles.disclosure}
            >
              <Text style={styles.disclosureLabel}>고급 설정</Text>
              <Text style={styles.disclosureSummary}>자시 · 시간 기준 · 세운 {advanced ? '⌃' : '⌄'}</Text>
            </Pressable>

            {advanced && (
              <Panel style={styles.form}>
                <View style={styles.rail}>
                  <Text style={styles.railLabel}>자시</Text>
                  <Select value={rule} onPick={setRule} options={RULES} disabled={hourChoice === 'unknown'} />
                </View>
                <View style={styles.rail}>
                  <Text style={styles.railLabel}>시간 기준</Text>
                  <Select
                    value={basis}
                    onPick={setBasis}
                    options={TIME_BASES.map((one) => ({ value: one, label: TIME_BASIS[one].label, hint: TIME_BASIS[one].hint }))}
                  />
                </View>
                <View style={styles.rail}>
                  <Text style={styles.railLabel}>세운 연도</Text>
                  <DigitField value={saeunFrom} onChange={setSaeunFrom} unit="년" placeholder="2026" digits={4} />
                </View>
              </Panel>
            )}

            {failure !== null && <Text style={styles.failure}>{failure}</Text>}

            <PrimaryButton label="사주 보기" onPress={submit} />
          </Panel>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLOR.background },
  content: { padding: 16 },
  paper: { padding: 14, gap: 12 },
  title: { fontSize: TYPE.title, fontWeight: '700', color: COLOR.foreground, marginHorizontal: 6, marginTop: 6, marginBottom: 2 },
  form: { padding: 16, gap: 14 },
  pair: { flexDirection: 'row', gap: 12 },
  half: { flex: 1 },
  group: { gap: 6 },
  row: { flexDirection: 'row', gap: 6 },
  rail: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  railHead: { width: 64, minHeight: 44, justifyContent: 'center' },
  railLabel: { width: 64, minHeight: 44, lineHeight: 44, fontSize: TYPE.small, fontWeight: '600', color: COLOR.secondary },
  railNote: { fontSize: TYPE.fine, color: COLOR.muted, marginTop: -14 },
  railBody: { flex: 1, flexDirection: 'row', gap: 6 },
  disclosure: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLOR.borderStrong,
    backgroundColor: COLOR.surface,
  },
  disclosureLabel: { fontSize: TYPE.body, fontWeight: '600', color: COLOR.foreground },
  disclosureSummary: { fontSize: TYPE.small, color: COLOR.secondary },
  failure: { fontSize: TYPE.small, fontWeight: '500', color: COLOR.danger, marginHorizontal: 6 },
});
