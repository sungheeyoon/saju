import { SERVICE_NAME } from '@brand';
import { SERVICE_FEATURES, type ServiceFeatureIcon } from '@brand/features';
import { Redirect, router } from 'expo-router';
import { useEffect, useState, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { readGate } from '@/home/gate';
import { Mark, SunMark } from '@/share/marks';
import { useStart } from '@/share/start';
import { Icon } from '@/ui/icons';
import { Logo } from '@/ui/logo';
import { TopBar } from '@/ui/top-bar';
import { COLOR, ELEMENT_TONE, FONT, RADIUS, TYPE } from '@/ui/tokens';
import { CardFrame, Paper } from '@/ui/surfaces';

/**
 * 첫 화면의 소개 — 웹 `/` 의 머리와 「할 수 있는 것」이다(`app/home-hero.tsx` · `app/landing-guide.tsx`). **앱의 입구는 입력 화면이고**
 * (운영자 결정) 이 화면은 소개에서 들어온다. 그래서 웹의 두 탭은 입력 칸을 고르는 대신 그 일을 하는 자리로 간다: 「내 사주 보기」는 입력 화면,
 * 「궁합 보기」는 로그인을 지나 궁합(앱에는 비로그인 전용 결과가 없다). 로그인한 사람은 웹처럼 홈으로 옮긴다.
 */
export default function LandingScreen() {
  const [gate, setGate] = useState<'checking' | 'in' | 'out'>('checking');
  const { start, going, failure } = useStart('/me/compat');

  useEffect(() => {
    let live = true;
    void readGate().then((next) => {
      if (live) setGate(next.kind === 'in' ? 'in' : 'out');
    });
    return () => {
      live = false;
    };
  }, []);

  if (gate === 'checking') {
    return (
      <View style={styles.screen}>
        <TopBar fallback="/" />
      </View>
    );
  }
  if (gate === 'in') return <Redirect href={'/me' as never} />;

  return (
    <SafeAreaView style={styles.screen} edges={['left', 'right', 'bottom']}>
      <TopBar fallback="/">
        <Logo size={32} />
        <Text style={styles.brand}>{SERVICE_NAME}</Text>
      </TopBar>
      <ScrollView contentContainerStyle={styles.content}>
        <Paper style={styles.paper}>
          <Text accessibilityRole="header" style={styles.title}>
            나는 어떤 사람일까?
          </Text>
          <View style={styles.entries}>
            <Entry label="내 사주 보기" onPress={() => router.push({ pathname: '/', params: { another: '1' } })}>
              <SunMark />
            </Entry>
            <Entry label="궁합 보기" onPress={start} disabled={going}>
              <Icon name="taiji" size={20} />
            </Entry>
          </View>
          {failure !== null && <Text style={styles.failure}>{failure}</Text>}
        </Paper>

        <View style={styles.guide}>
          <View style={styles.guideHead}>
            <Text accessibilityRole="header" style={styles.section}>
              할 수 있는 것
            </Text>
            <Pressable accessibilityRole="link" onPress={() => router.push('/about' as never)} style={styles.aboutLink}>
              <Text style={styles.aboutText}>서비스 소개</Text>
              <Mark name="arrow" size={16} />
            </Pressable>
          </View>
          {SERVICE_FEATURES.filter((feature) => feature.title !== '사주').map((feature) => (
            <CardFrame key={feature.title} style={styles.card}>
              <FeatureMark icon={feature.icon} />
              <View style={styles.cardBody}>
                <Text style={styles.cardTitle}>{feature.title}</Text>
                <Text style={styles.cardText}>{feature.body}</Text>
              </View>
            </CardFrame>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Entry({ label, onPress, disabled = false, children }: { label: string; onPress: () => void; disabled?: boolean; children: ReactNode }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.entry, pressed && styles.pressed, disabled && styles.off]}
    >
      {children}
      <Text style={styles.entryText}>{label}</Text>
    </Pressable>
  );
}

/** 카드 그림의 면 — 일의 그림에 오행 파스텔 하나씩이다. 웹의 `TONES` 와 같은 짝이다 */
function FeatureMark({ icon }: { icon: ServiceFeatureIcon }) {
  const tone = icon === 'reading' ? ELEMENT_TONE.火 : icon === 'taiji' ? ELEMENT_TONE.水 : ELEMENT_TONE.木;
  return (
    <View style={[styles.mark, { backgroundColor: tone.soft }]}>
      {icon === 'reading' && <Mark name="reading" size={22} color={tone.ink} />}
      {icon === 'taiji' && <Icon name="taiji" size={22} color={tone.ink} />}
      {icon === 'people' && <Icon name="people" size={22} color={tone.ink} />}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLOR.background },
  content: { flexGrow: 1, padding: 16, gap: 32 },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 4, marginBottom: -20 },
  brand: { fontSize: TYPE.heading, fontFamily: FONT.bold, color: COLOR.foreground },
  paper: { gap: 16, padding: 16 },
  title: { fontSize: TYPE.title, lineHeight: 35, fontFamily: FONT.bold, color: COLOR.foreground, marginHorizontal: 4 },
  entries: { flexDirection: 'row', gap: 2, padding: 2, borderRadius: RADIUS.control, backgroundColor: COLOR.surfaceSunken },
  entry: { flex: 1, minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 8, borderRadius: RADIUS.control, backgroundColor: COLOR.surface },
  entryText: { fontSize: TYPE.body, fontFamily: FONT.bold, color: COLOR.foreground },
  pressed: { transform: [{ scale: 0.98 }] },
  off: { opacity: 0.55 },
  failure: { fontSize: TYPE.small, lineHeight: 19, fontFamily: FONT.medium, color: COLOR.danger, marginHorizontal: 4 },
  guide: { gap: 12, paddingTop: 32, borderTopWidth: 1, borderTopColor: COLOR.border },
  guideHead: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', columnGap: 12 },
  section: { fontSize: TYPE.heading, fontFamily: FONT.bold, color: COLOR.foreground },
  aboutLink: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 4 },
  aboutText: { fontSize: TYPE.sm, fontFamily: FONT.bold, color: COLOR.foreground },
  card: { flexDirection: 'row', gap: 16, padding: 20 },
  mark: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: RADIUS.control },
  cardBody: { flex: 1, minWidth: 0 },
  cardTitle: { fontSize: TYPE.lead, fontFamily: FONT.bold, color: COLOR.foreground },
  cardText: { marginTop: 4, fontSize: TYPE.body, lineHeight: 28, fontFamily: FONT.medium, color: COLOR.secondary },
});
