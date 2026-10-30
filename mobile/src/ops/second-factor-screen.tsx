import { router, useLocalSearchParams, type Href } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SvgXml } from 'react-native-svg';

import { SERVICE_NAME } from '@brand';
import { opsReturnPath } from '@ops/return-path';
import { SECOND_FACTOR_COPY as COPY } from '@ops/second-factor-copy';

import { supabase } from '@/auth/client';
import { Panel, PrimaryButton, SecondaryButton } from '@/ui/parts';
import { COLOR, FONT } from '@/ui/tokens';

import { secondFactorOf } from './denial';
import { FailureLine, Fine, Mono, Note, PageHead } from './parts';

/** Auth 가 코드를 거절한 까닭 — 다시 넣으면 된다(웹 `app/ops/mfa/actions.ts` 와 같다) */
const RETRYABLE = new Set(['mfa_verification_failed', 'mfa_challenge_expired', 'mfa_verification_rejected']);
const refusal = (code: string | undefined, fallback: string): string => (RETRYABLE.has(code ?? '') ? COPY.wrongCode : fallback);

type Enrollment = { readonly qrXml: string; readonly secret: string };

/** 등록을 연다 — 확인 전 옛 TOTP 를 먼저 걷는다. 확인을 마친 요소가 있으면 새로 열지 않는다(ADR 0209) */
async function startEnrollment(): Promise<{ ok: true; enrollment: Enrollment } | { ok: false; message: string }> {
  if (supabase === null) return { ok: false, message: COPY.enrollFailed };
  const listed = await supabase.auth.mfa.listFactors();
  if (listed.error !== null) return { ok: false, message: refusal(listed.error.code, COPY.enrollFailed) };
  if (listed.data.totp.length > 0) return { ok: false, message: COPY.alreadyEnrolled };
  for (const stale of listed.data.all) {
    if (stale.factor_type !== 'totp' || stale.status === 'verified') continue;
    const { error } = await supabase.auth.mfa.unenroll({ factorId: stale.id });
    if (error !== null) return { ok: false, message: refusal(error.code, COPY.enrollFailed) };
  }
  const enrolled = await supabase.auth.mfa.enroll({ factorType: 'totp', issuer: SERVICE_NAME });
  if (enrolled.error !== null) return { ok: false, message: refusal(enrolled.error.code, COPY.enrollFailed) };
  const { qr_code: qr, secret } = enrolled.data.totp;
  return { ok: true, enrollment: { qrXml: qr.slice(qr.indexOf(',') + 1).trim(), secret } };
}

/** 코드를 확인한다 — 어느 요소인지는 그 사람의 목록에서 고른다. 성공하면 Auth 가 이 세션을 aal2 로 올리고 다른 세션을 끊는다 */
async function confirmCode(typed: string): Promise<string | null> {
  const code = typed.replace(/\s/g, '');
  if (!/^\d{6}$/.test(code)) return COPY.codeShape;
  if (supabase === null) return COPY.verifyFailed;
  const listed = await supabase.auth.mfa.listFactors();
  if (listed.error !== null) return refusal(listed.error.code, COPY.verifyFailed);
  const factor = listed.data.totp[0] ?? listed.data.all.find((one) => one.factor_type === 'totp' && one.status !== 'verified');
  if (factor === undefined) return COPY.noFactor;
  const verified = await supabase.auth.mfa.challengeAndVerify({ factorId: factor.id, code });
  return verified.error === null ? null : refusal(verified.error.code, COPY.verifyFailed);
}

/**
 * **운영 화면 앞의 2단계 인증** — 웹 `/ops/mfa` 와 같다(ADR 0209 · 0123). 「나는 운영자인가」를 묻지 않는다 — 누구든 제 계정에 등록할 수
 * 있고 그것으로 열리는 운영자 문은 없다. 등록한 적이 없으면 운영 화면이 여기로 보내지 않으므로, 처음은 주소로 직접 온다.
 */
export default function SecondFactorScreen() {
  const params = useLocalSearchParams<{ next?: string }>();
  const next = opsReturnPath(params.next);
  const [factor, setFactor] = useState<'challenge' | 'enroll' | 'unread' | null>(null);

  useEffect(() => {
    let live = true;
    void (async () => {
      const session = supabase === null ? null : (await supabase.auth.getSession()).data.session;
      if (session === null) {
        if (live) router.replace('/');
        return;
      }
      const read = await secondFactorOf();
      if (!live) return;
      if (read === 'passed') router.replace(next as Href);
      else setFactor(read);
    })();
    return () => {
      live = false;
    };
  }, [next]);

  return (
    <SafeAreaView style={styles.screen}>
      {factor !== null && (
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <PageHead title={COPY.title} />
          {factor === 'unread' ? <FailureLine>{COPY.unread}</FailureLine> : <SecondFactorForm enrolled={factor === 'challenge'} next={next} />}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function SecondFactorForm({ enrolled, next }: { enrolled: boolean; next: string }) {
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [code, setCode] = useState('');
  const [failure, setFailure] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const asking = enrolled || enrollment !== null;

  const start = async () => {
    setFailure(null);
    setStarting(true);
    const opened = await startEnrollment();
    setStarting(false);
    if (opened.ok) setEnrollment(opened.enrollment);
    else setFailure(opened.message);
  };

  const confirm = async () => {
    setFailure(null);
    setConfirming(true);
    const failed = await confirmCode(code);
    setConfirming(false);
    if (failed === null) router.replace(next as Href);
    else setFailure(failed);
  };

  return (
    <Panel style={styles.form}>
      {!asking && (
        <>
          <Note>{COPY.enrollNote}</Note>
          <SecondaryButton label={starting ? COPY.enrollStarting : COPY.enrollStart} onPress={start} disabled={starting} />
        </>
      )}
      {enrollment !== null && (
        <View style={styles.form}>
          <Note>{COPY.scanNote}</Note>
          <View accessibilityLabel={COPY.qrAlt} style={styles.qr}>
            <SvgXml xml={enrollment.qrXml} width={176} height={176} />
          </View>
          <Fine>{COPY.secretLabel}</Fine>
          <Mono>{enrollment.secret.match(/.{1,4}/g)?.join(' ')}</Mono>
        </View>
      )}
      {asking && (
        <View style={styles.form}>
          {enrolled && <Note>{COPY.challengeNote}</Note>}
          <Text style={styles.label}>{COPY.codeLabel}</Text>
          <TextInput
            style={styles.code}
            accessibilityLabel={COPY.codeLabel}
            value={code}
            onChangeText={(typed) => setCode(typed.replace(/\D/g, '').slice(0, 6))}
            keyboardType="number-pad"
            textContentType="oneTimeCode"
            autoComplete="one-time-code"
          />
          <PrimaryButton label={confirming ? COPY.confirming : COPY.confirm} onPress={confirm} disabled={confirming || code.length !== 6} />
        </View>
      )}
      {failure !== null && <FailureLine>{failure}</FailureLine>}
    </Panel>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLOR.background },
  content: { flexGrow: 1, padding: 16, gap: 16 },
  form: { gap: 14 },
  qr: { alignSelf: 'flex-start', padding: 8, borderRadius: 12, backgroundColor: '#ffffff' },
  label: { fontSize: 15, fontFamily: FONT.bold, color: COLOR.foreground },
  code: { minHeight: 48, width: 180, paddingHorizontal: 16, borderRadius: 12, borderWidth: 1, borderColor: COLOR.borderStrong, backgroundColor: COLOR.surface, fontSize: 17, letterSpacing: 5, color: COLOR.foreground },
});
