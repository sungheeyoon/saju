import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState, type ComponentRef } from 'react';
import { Keyboard, KeyboardAvoidingView, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SERVICE_NAME } from '@brand';
import { calculateChart, dateRefusal } from '@input/chart';
import { convertedLine, dateOfParts, limitsOf, timeOfParts } from '@input/entry';
import { DEFAULT_QUERY, HOUR_UNKNOWN_CHOICE, NAME_MAX, TIME_BASES, TIME_BASIS, type Query } from '@input/query';
import { CALENDARS, CALENDAR_KO, CITY_LONGITUDES, GENDERS, GENDER_KO, SUPPORTED_YEAR_RANGE, type CityName, type LateNightRule } from '@saju';

import { signInWithGoogle } from '@/auth/sign-in';
import { readGate } from '@/home/gate';
import { Choices, DigitField, Field, FieldLabel, KeyboardDoneBar, Panel, PrimaryButton, Select } from '@/ui/parts';
import { Logo } from '@/ui/logo';
import { COLOR, FONT, TYPE } from '@/ui/tokens';

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
 * 입구 — 로그인과 가입을 끝낸 사람은 앱을 열면 홈이다. 아니면(모르면) 입력 화면이다.
 * 홈의 「다른 사람 사주 보기」는 `another` 를 들고 와 입력 화면을 그대로 연다.
 */
export default function EntryScreen() {
  const { another } = useLocalSearchParams<{ another?: string }>();
  const [entry, setEntry] = useState<'checking' | 'home' | 'birth'>(another === undefined ? 'checking' : 'birth');

  useEffect(() => {
    if (another !== undefined) return;
    let watching = true;
    void readGate().then((gate) => {
      if (watching) setEntry(gate.kind === 'in' ? 'home' : 'birth');
    });
    return () => {
      watching = false;
    };
  }, [another]);

  if (entry === 'checking') return <View style={styles.screen} />;
  if (entry === 'home') return <Redirect href={'/me' as never} />;
  return <BirthScreen />;
}

/** 출생 정보 — 칸의 차례와 말은 웹의 `app/birth-form.tsx` 와 같다. 계산은 웹과 같은 `calculateChart` 다 */
function BirthScreen() {
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
  const [going, setGoing] = useState(false);

  const monthRef = useRef<ComponentRef<typeof TextInput>>(null);
  const dayRef = useRef<ComponentRef<typeof TextInput>>(null);
  const hourRef = useRef<ComponentRef<typeof TextInput>>(null);
  const minuteRef = useRef<ComponentRef<typeof TextInput>>(null);

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
  const { years, maxDay } = limitsOf(calendar, year, month);
  const refused = dateRefusal(query)?.part ?? null;
  const converted = convertedLine(query);

  const chooseHour = (next: 'known' | 'unknown') => {
    /* 「모름」이면 적어 둔 시각도 지운다 — 다시 「직접 입력」을 골랐을 때 지운 줄 안 값으로 계산되지 않게 */
    if (next === 'unknown') {
      setHour('');
      setMinute('');
    }
    setHourChoice(next);
  };

  const submit = async () => {
    const result = calculateChart(query);
    if (!result.ok) {
      setFailure(result.message);
      return;
    }
    setFailure(null);
    setGoing(true);
    /* 적은 값은 이 화면이 들고 있다 — 로그인을 다녀와도 그대로다 */
    const signIn = await signInWithGoogle();
    setGoing(false);
    if (signIn.kind === 'failed') setFailure(signIn.message);
    const params = { query: JSON.stringify(query) };
    if (signIn.kind === 'needs-signup') router.push({ pathname: '/signup', params });
    if (signIn.kind === 'signed-in') router.push({ pathname: '/chart', params });
  };

  return (
    <SafeAreaView style={styles.screen}>
      <KeyboardAvoidingView style={styles.screen} behavior="padding">
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
          <View style={styles.brandRow}>
            {/* 로고는 웹의 그 파일이다 — 앱에 사본을 두지 않는다 */}
            <Logo size={32} />
            <Text style={styles.brand}>{SERVICE_NAME}</Text>
          </View>
          <Panel tone="cream" style={styles.paper}>
            <Text style={styles.title}>출생 정보를 입력해 주세요</Text>

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
                  <DigitField value={year} onChange={setYear} unit="년" placeholder={String(years.max - 30)} digits={4} min={years.min} max={years.max} refused={refused === 'year'} onFull={() => monthRef.current?.focus()} />
                  <DigitField inputRef={monthRef} value={month} onChange={setMonth} unit="월" placeholder="1~12" digits={2} min={1} max={12} advanceEarly refused={refused === 'month'} onFull={() => dayRef.current?.focus()} />
                  <DigitField inputRef={dayRef} value={day} onChange={setDay} unit="일" placeholder={`1~${maxDay}`} digits={2} min={1} max={maxDay} advanceEarly refused={refused === 'day'} onFull={() => (hourKnown ? hourRef.current?.focus() : Keyboard.dismiss())} />
                </View>
                {converted !== null && (
                  <Text style={[styles.converted, !converted.ok && styles.failure]}>{converted.text}</Text>
                )}
                <View style={styles.row}>
                  <Choices value={calendar} onPick={setCalendar} options={CALENDARS.map((one) => ({ value: one, label: CALENDAR_KO[one] }))} />
                </View>
              </View>

              <View style={styles.rail}>
                <Text style={styles.railLabel}>출생 시각</Text>
                <Choices value={hourChoice} onPick={chooseHour} options={HOUR_CHOICES} />
              </View>

              {hourChoice === 'known' && (
                <View style={styles.rail}>
                  <View style={styles.railHead}>
                    <Text style={styles.railLabel}>시각</Text>
                    <Text style={styles.railNote}>24시간</Text>
                  </View>
                  <View style={styles.railBody}>
                    <DigitField inputRef={hourRef} value={hour} onChange={setHour} unit="시" placeholder="0~23" digits={2} min={0} max={23} onFull={() => minuteRef.current?.focus()} />
                    <DigitField inputRef={minuteRef} value={minute} onChange={setMinute} unit="분" placeholder="0~59" digits={2} min={0} max={59} onFull={Keyboard.dismiss} />
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
                  <DigitField value={saeunFrom} onChange={setSaeunFrom} unit="년" placeholder="2026" digits={4} min={SUPPORTED_YEAR_RANGE.min} max={SUPPORTED_YEAR_RANGE.max} />
                </View>
              </Panel>
            )}

            {/* 폼이 짧은 화면에서도 단추는 엄지가 닿는 맨 아래에 선다 */}
            <View style={styles.action}>
              {failure !== null && <Text style={styles.failure}>{failure}</Text>}
              <PrimaryButton label="사주 보기" onPress={submit} disabled={going} />
            </View>
          </Panel>
        </ScrollView>
        <KeyboardDoneBar />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLOR.background },
  content: { flexGrow: 1, padding: 16 },
  paper: { flexGrow: 1, padding: 14, gap: 12 },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 4, marginBottom: 12 },
  brand: { fontSize: TYPE.heading, fontFamily: FONT.bold, color: COLOR.foreground },
  title: { fontSize: TYPE.heading, fontFamily: FONT.bold, color: COLOR.foreground, marginHorizontal: 6, marginTop: 6, marginBottom: 2 },
  form: { padding: 16, gap: 18 },
  pair: { flexDirection: 'row', gap: 12 },
  half: { flex: 1 },
  group: { gap: 6 },
  row: { flexDirection: 'row', gap: 6 },
  rail: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  railHead: { width: 64, minHeight: 44, justifyContent: 'center' },
  railLabel: { width: 64, minHeight: 44, lineHeight: 44, fontSize: TYPE.small, fontFamily: FONT.bold, color: COLOR.secondary },
  railNote: { fontFamily: FONT.medium, fontSize: TYPE.fine, color: COLOR.muted, marginTop: -14 },
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
  disclosureLabel: { fontSize: TYPE.body, fontFamily: FONT.bold, color: COLOR.foreground },
  disclosureSummary: { fontFamily: FONT.medium, fontSize: TYPE.small, color: COLOR.secondary },
  action: { marginTop: 'auto', paddingTop: 12, gap: 10 },
  converted: { fontFamily: FONT.medium, fontSize: TYPE.small, color: COLOR.secondary, marginVertical: 2 },
  failure: { fontSize: TYPE.small, fontFamily: FONT.medium, color: COLOR.danger, marginHorizontal: 6 },
});
