import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { BETA_SIGNUP_CODE_NOTE } from '@account/copy';
import { SERVICE_NAME_TOPIC, SERVICE_TAGLINE } from '@brand';
import { SERVICE_FEATURES } from '@brand/features';
import { ABOUT_LEAD, ABOUT_STEPS } from '@brand/guide';

import { InfoScreen } from '@/info/frame';
import { goHome } from '@/info/go-home';
import { Icon } from '@/ui/icons';
import { Logo } from '@/ui/logo';
import { Panel, PrimaryButton, SecondaryButton } from '@/ui/parts';
import { COLOR, FONT, RADIUS, TYPE } from '@/ui/tokens';

/** 앱은 로그인 뒤에야 결과를 보여 준다 — 로그인 없이 된다는 조건 줄은 앱에서 사실이 아니라 세우지 않는다 */
const SIGNED_OUT_ONLY = '로그인 없이';

/** 서비스 소개 — 웹의 `/about`. 로그인 없이 열리고 세션도 DB 도 안 읽는다 */
export default function AboutScreen() {
  return (
    <InfoScreen gap={40} title="서비스 소개" fallback="/">
      <Panel tone="cream" style={styles.head}>
        <Logo size={44} />
        <Text style={styles.meta}>{SERVICE_TAGLINE}</Text>
        <Text style={styles.title}>{SERVICE_NAME_TOPIC} 이런 곳이에요</Text>
        <Text style={styles.lead}>{ABOUT_LEAD.join(' ')}</Text>
      </Panel>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>할 수 있는 것</Text>
        {SERVICE_FEATURES.map((feature) => (
          <Panel key={feature.title} style={styles.feature}>
            <View style={styles.iconBadge}>
              <Icon name={feature.icon} />
            </View>
            <Text style={styles.name}>{feature.title}</Text>
            <Text style={styles.body}>{feature.body}</Text>
            {!feature.note.includes(SIGNED_OUT_ONLY) && <Text style={styles.meta}>{feature.note}</Text>}
          </Panel>
        ))}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>시작하는 차례</Text>
        <View style={styles.steps}>
          {ABOUT_STEPS.map((step, index) => (
            <View key={step.title} style={styles.step}>
              <View style={styles.stepNumber}>
                <Text style={styles.stepNumberText}>{index + 1}</Text>
              </View>
              <View style={styles.stepBody}>
                <Text style={styles.stepTitle}>{step.title}</Text>
                <Text style={styles.stepText}>{step.body}</Text>
              </View>
            </View>
          ))}
        </View>
        <Text style={styles.stepText}>{BETA_SIGNUP_CODE_NOTE}</Text>
      </View>

      <View style={styles.actions}>
        <PrimaryButton label="무료로 내 사주 보기" onPress={() => void goHome()} />
        <SecondaryButton label="자주 묻는 질문" onPress={() => router.push('/help')} />
      </View>
    </InfoScreen>
  );
}

const styles = StyleSheet.create({
  head: { gap: 12 },
  meta: { fontFamily: FONT.medium, fontSize: TYPE.small, lineHeight: 20, color: COLOR.secondary },
  title: { fontFamily: FONT.bold, fontSize: TYPE.title, lineHeight: 34, color: COLOR.foreground },
  lead: { fontFamily: FONT.medium, fontSize: TYPE.body, lineHeight: 26, color: COLOR.creamInk },
  section: { gap: 16 },
  sectionTitle: { fontFamily: FONT.bold, fontSize: TYPE.heading, lineHeight: 28, color: COLOR.foreground },
  feature: { gap: 8 },
  iconBadge: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: RADIUS.pill, backgroundColor: COLOR.surfaceSoft },
  name: { fontFamily: FONT.bold, fontSize: TYPE.lead, lineHeight: 24, color: COLOR.foreground },
  body: { fontFamily: FONT.medium, fontSize: TYPE.body, lineHeight: 24, color: COLOR.secondary },
  steps: { gap: 8 },
  step: { flexDirection: 'row', gap: 16, padding: 16, borderRadius: RADIUS.panel, borderWidth: 1, borderColor: COLOR.border, backgroundColor: COLOR.surface },
  stepNumber: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center', borderRadius: RADIUS.pill, backgroundColor: COLOR.accent },
  stepNumberText: { fontFamily: FONT.bold, fontSize: TYPE.sm, color: COLOR.onAccent },
  stepBody: { flex: 1, gap: 2 },
  stepTitle: { fontFamily: FONT.bold, fontSize: TYPE.body, lineHeight: 24, color: COLOR.foreground },
  stepText: { fontFamily: FONT.medium, fontSize: TYPE.sm, lineHeight: 24, color: COLOR.secondary },
  actions: { gap: 8 },
});
