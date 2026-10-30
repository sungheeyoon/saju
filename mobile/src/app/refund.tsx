import { router, useLocalSearchParams } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { SERVICE_NAME } from '@brand';
import { REFUND_TERMS_POINTER, refundPolicyFor } from '@brand/refund';

import { appBusinessInfo } from '@/info/business';
import { FinePrint, InfoScreen, LegalHead } from '@/info/frame';
import { HomeButton } from '@/info/home-button';
import { LegalBody } from '@/info/legal-body';
import { TextButton } from '@/ui/parts';
import { goBack } from '@/ui/top-bar';
import { COLOR, FONT } from '@/ui/tokens';

/** 환불정책 — 웹의 `/refund` 와 같은 `refundPolicyFor` 다. 풀이권 구매에서 왔으면(`?from=credits`) 끝 단추가 그 화면으로 돌아간다 */
export default function RefundScreen() {
  const { from } = useLocalSearchParams<{ from?: string }>();
  const policy = refundPolicyFor(appBusinessInfo());
  return (
    <InfoScreen title="환불정책" fallback={from === 'credits' ? '/me/credits' : '/'}>
      <LegalHead title={`${SERVICE_NAME} 환불정책`} note={policy.effectiveDate ? '시행일 ' + policy.effectiveDate : null} />
      <LegalBody document={policy} />
      <FinePrint>
        {REFUND_TERMS_POINTER.before}
        <Text accessibilityRole="link" style={styles.link} onPress={() => router.push('/terms')}>
          {REFUND_TERMS_POINTER.link}
        </Text>
        {REFUND_TERMS_POINTER.after}
      </FinePrint>
      {from === 'credits' ? (
        <View style={styles.back}>
          <TextButton label="풀이권 구매로 돌아가기" onPress={() => goBack('/me/credits')} />
        </View>
      ) : (
        <HomeButton />
      )}
    </InfoScreen>
  );
}

const styles = StyleSheet.create({
  link: { fontFamily: FONT.bold, color: COLOR.foreground, textDecorationLine: 'underline' },
  back: { alignSelf: 'flex-start' },
});
