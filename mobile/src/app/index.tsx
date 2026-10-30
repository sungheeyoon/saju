import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { calculateChart } from '@input/chart';
import { DEFAULT_QUERY } from '@input/query';
import type { Gender, Saju } from '@saju';

const GENDER_CHOICES: readonly { value: Gender; label: string }[] = [
  { value: 'male', label: '남자' },
  { value: 'female', label: '여자' },
];

const PILLAR_ROWS = [
  ['시', 'hour'],
  ['일', 'day'],
  ['월', 'month'],
  ['년', 'year'],
] as const;

export default function HomeScreen() {
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [gender, setGender] = useState<Gender>('female');
  const [saju, setSaju] = useState<Saju | null>(null);
  const [failure, setFailure] = useState<string | null>(null);

  const calculate = () => {
    /* 웹과 같은 기본값 · 같은 함수다 — 여기서 따로 세면 웹과 다른 사주가 나온다 */
    const result = calculateChart({ ...DEFAULT_QUERY, date, time, gender, hourKnown: time !== '' });
    setSaju(result.ok ? result.saju : null);
    setFailure(result.ok ? null : result.message);
  };

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>나는 어떤 사람일까?</Text>

        <Text style={styles.label}>생년월일</Text>
        <TextInput
          style={styles.input}
          value={date}
          onChangeText={setDate}
          placeholder="1990-05-15"
          placeholderTextColor={MUTED}
          keyboardType="numbers-and-punctuation"
        />

        <Text style={styles.label}>태어난 시각</Text>
        <TextInput
          style={styles.input}
          value={time}
          onChangeText={setTime}
          placeholder="14:30 (모르면 비워 두세요)"
          placeholderTextColor={MUTED}
          keyboardType="numbers-and-punctuation"
        />

        <View style={styles.choices}>
          {GENDER_CHOICES.map(({ value, label }) => (
            <Pressable
              key={value}
              onPress={() => setGender(value)}
              style={[styles.choice, gender === value && styles.chosen]}
            >
              <Text style={gender === value ? styles.chosenText : styles.choiceText}>{label}</Text>
            </Pressable>
          ))}
        </View>

        <Pressable onPress={calculate} style={styles.button}>
          <Text style={styles.buttonText}>사주 보기</Text>
        </Pressable>

        {failure !== null && <Text style={styles.failure}>{failure}</Text>}

        {saju !== null && (
          <View style={styles.pillars}>
            {PILLAR_ROWS.map(([label, key]) => {
              const pillar = saju.pillars[key];
              return (
                <View key={key} style={styles.pillar}>
                  <Text style={styles.pillarLabel}>{label}</Text>
                  <Text style={styles.glyph}>{pillar?.stem ?? '-'}</Text>
                  <Text style={styles.glyph}>{pillar?.branch ?? '-'}</Text>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const PAPER = '#faf6ef';
const INK = '#1f1a14';
const MUTED = '#8a8175';

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: PAPER },
  content: { padding: 24, gap: 10 },
  title: { fontSize: 26, fontWeight: '700', color: INK, marginBottom: 14 },
  label: { fontSize: 14, color: INK, marginTop: 6 },
  input: { borderWidth: 1, borderColor: '#d9d0c2', borderRadius: 10, padding: 14, fontSize: 16, color: INK },
  choices: { flexDirection: 'row', gap: 8, marginTop: 10 },
  choice: { flex: 1, alignItems: 'center', padding: 13, borderRadius: 10, borderWidth: 1, borderColor: '#d9d0c2' },
  chosen: { backgroundColor: INK, borderColor: INK },
  choiceText: { color: INK, fontSize: 15 },
  chosenText: { color: PAPER, fontSize: 15, fontWeight: '600' },
  button: { alignItems: 'center', padding: 15, borderRadius: 10, backgroundColor: INK, marginTop: 12 },
  buttonText: { color: PAPER, fontSize: 16, fontWeight: '700' },
  failure: { color: '#b3261e', fontSize: 14, marginTop: 8 },
  pillars: { flexDirection: 'row', gap: 8, marginTop: 20 },
  pillar: { flex: 1, alignItems: 'center', paddingVertical: 14, borderRadius: 10, backgroundColor: '#f1eadd' },
  pillarLabel: { fontSize: 13, color: MUTED, marginBottom: 8 },
  glyph: { fontSize: 30, fontWeight: '700', color: INK },
});
