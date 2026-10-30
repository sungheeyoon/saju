import { router, useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useRef, useState, type ComponentRef } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SIGN_OUT_PENDING } from '@account/copy';
import { NOTICE_ACK_LABEL, NOTICE_ACK_NOTE, OPTIONAL_CONSENTS, OPTIONAL_CONSENT_NOTE, SIGNUP_CODE_NOTE } from '@consent/notice';
import {
  SIGNUP_CODE_MAX,
  SIGNUP_HEAD,
  SIGNUP_LABEL,
  SIGNUP_NOTICE_DISCOVERY,
  SIGNUP_NOTICE_USE,
  signupCodeOf,
  signupGap,
  signupNoticeDates,
  type SignupField,
} from '@consent/signup';
import { NICKNAME_AVAILABLE_NOTE, NICKNAME_MAX, NICKNAME_MIN, NICKNAME_TAKEN_NOTE, missingNickname, nicknameKey } from '@profile';

import { signOut } from '@/auth/sign-in';
import { checkNickname, completeSignup, readSignup, type SignupState } from '@/auth/signup';
import { Logo } from '@/ui/logo';
import { CheckRow, Field, FieldLabel, Panel, PrimaryButton, SecondaryButton, TextButton } from '@/ui/parts';
import { COLOR, FONT, TYPE } from '@/ui/tokens';

const CLOSED_TITLE = '비공개 테스트가 끝났습니다';
const SIGN_OUT_FAILED = '로그아웃하지 못했어요. 다시 시도해 주세요.';
const SITE_URL = process.env.EXPO_PUBLIC_SITE_URL;

/** 가입 — 웹의 `/signup` 과 같은 한 폼이다(ADR 0042). 마치면 들고 온 출생 정보로 만세력 결과에 간다 */
export default function SignupScreen() {
  const { query } = useLocalSearchParams<{ query?: string }>();
  const [state, setState] = useState<SignupState | null>(null);
  const finish = () => (query ? router.replace({ pathname: '/chart', params: { query } }) : router.replace('/'));

  useEffect(() => {
    let live = true;
    readSignup().then((next) => {
      if (live) setState(next);
    });
    return () => {
      live = false;
    };
  }, []);

  useEffect(() => {
    if (state?.kind === 'done') finish();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 끝났다는 답에 한 번 간다
  }, [state?.kind]);

  /* 첫 읽기 동안은 판만 — 안 된다는 말과 폼이 번갈아 비치지 않게 */
  if (state === null || state.kind === 'done') return <SafeAreaView style={styles.screen} />;

  const head = state.kind === 'form' && state.again ? SIGNUP_HEAD.again : SIGNUP_HEAD.first;

  return (
    <SafeAreaView style={styles.screen}>
      <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
          <Panel tone="cream" style={styles.head}>
            <Logo size={44} />
            {state.kind === 'closed' ? (
              <Text style={styles.title}>{CLOSED_TITLE}</Text>
            ) : (
              <>
                <Text style={styles.eyebrow}>{head.eyebrow}</Text>
                <Text style={styles.title}>{head.title}</Text>
                <Text style={styles.headNote}>{head.note}</Text>
              </>
            )}
          </Panel>

          {state.kind === 'form' ? (
            <SignupForm form={state} onDone={finish} />
          ) : (
            <Panel>
              <Text style={styles.line}>{state.message}</Text>
            </Panel>
          )}

          <LeaveLink />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function SignupForm({ form, onDone }: { form: Extract<SignupState, { kind: 'form' }>; onDone: () => void }) {
  const { needsCode, needsName, scheduleId, endsOn, purgeBy } = form;
  const [code, setCode] = useState('');
  const [nickname, setNickname] = useState('');
  const [acknowledged, setAcknowledged] = useState(false);
  const [chosen, setChosen] = useState<Record<string, boolean>>({ improvement: false, contact: false });
  const [failure, setFailure] = useState<{ message: string; field: SignupField | null } | null>(null);
  const [working, setWorking] = useState(false);
  const [checked, setChecked] = useState<{ key: string; available: boolean } | null>(null);
  const [checking, setChecking] = useState(false);
  const [checkTried, setCheckTried] = useState(false);
  const [tried, setTried] = useState(false);
  const codeField = useRef<ComponentRef<typeof TextInput>>(null);
  const nicknameField = useRef<ComponentRef<typeof TextInput>>(null);

  const missing = needsName ? missingNickname(nickname) : null;
  const answer = checked?.key === nicknameKey(nickname) ? checked : null;
  /* 단추를 잠그지 않고, 누르면 처음 걸린 칸 하나를 말한다 — 웹과 같다 */
  const gap = signupGap({ needsCode, code, nicknameGap: missing, acknowledged });
  const shownGap = tried ? gap : null;
  const dates = signupNoticeDates(endsOn, purgeBy);
  const refusedHere = (field: SignupField) => failure?.field === field;
  const focus = (field: SignupField) => (field === 'code' ? codeField : nicknameField).current?.focus();

  const check = async () => {
    if (missing !== null) {
      setCheckTried(true);
      nicknameField.current?.focus();
      return;
    }
    setCheckTried(false);
    setFailure(null);
    setChecking(true);
    const result = await checkNickname(nickname);
    setChecking(false);
    if (result.ok) setChecked({ key: nicknameKey(nickname), available: result.available });
    else setFailure({ message: result.message, field: 'nickname' });
  };

  const send = async () => {
    setFailure(null);
    if (gap !== null) {
      setTried(true);
      if (gap.field !== 'ack') focus(gap.field);
      return;
    }
    setTried(false);
    setWorking(true);
    const result = await completeSignup({
      code,
      nickname,
      scheduleId,
      improvement: chosen.improvement === true,
      contact: chosen.contact === true,
    });
    setWorking(false);
    if (result.ok) {
      onDone();
      return;
    }
    setFailure({ message: result.message, field: result.field });
    if (result.field !== null) focus(result.field);
  };

  return (
    <Panel style={styles.form}>
      {needsCode && (
        <View style={styles.group}>
          <FieldLabel>{SIGNUP_LABEL.code}</FieldLabel>
          <Field
            inputRef={codeField}
            label={SIGNUP_LABEL.code}
            value={code}
            maxLength={SIGNUP_CODE_MAX}
            autoCapitalize="characters"
            placeholder={SIGNUP_LABEL.codePlaceholder}
            refused={shownGap?.field === 'code' || refusedHere('code')}
            onChange={(typed) => {
              setCode(signupCodeOf(typed));
              if (failure?.field === 'code') setFailure(null);
            }}
          />
          {refusedHere('code') && <Text style={styles.failure}>{failure?.message}</Text>}
          <Text style={styles.fine}>{SIGNUP_CODE_NOTE}</Text>
        </View>
      )}

      {needsName && (
        <View style={styles.group}>
          <FieldLabel>{SIGNUP_LABEL.nickname}</FieldLabel>
          <View style={styles.nameRow}>
            <View style={styles.nameField}>
              <Field
                inputRef={nicknameField}
                label={SIGNUP_LABEL.nickname}
                value={nickname}
                maxLength={NICKNAME_MAX}
                autoCapitalize="none"
                placeholder={`${NICKNAME_MIN}~${NICKNAME_MAX}자`}
                refused={shownGap?.field === 'nickname' || refusedHere('nickname') || (checkTried && missing !== null)}
                onChange={(typed) => {
                  setNickname(typed);
                  if (failure?.field === 'nickname') setFailure(null);
                }}
              />
            </View>
            <SecondaryButton label={checking ? SIGNUP_LABEL.checking : SIGNUP_LABEL.check} onPress={check} disabled={checking} />
          </View>
          {answer !== null && (
            <Text style={answer.available ? styles.note : styles.failure}>
              {answer.available ? NICKNAME_AVAILABLE_NOTE : NICKNAME_TAKEN_NOTE}
            </Text>
          )}
          {checkTried && missing !== null && <Text style={styles.failure}>{missing}</Text>}
          {refusedHere('nickname') && <Text style={styles.failure}>{failure?.message}</Text>}
          <Text style={styles.fine}>{SIGNUP_LABEL.nicknameNote}</Text>
        </View>
      )}

      <View style={styles.notice}>
        <View style={styles.noticeHead}>
          <Text style={styles.noticeTitle}>{SIGNUP_LABEL.noticeHead}</Text>
          {/* 주소가 없는 빌드에서는 열 곳이 없다 — 전문은 웹에 로그인 없이 열린다 */}
          {SITE_URL ? (
            <TextButton label={SIGNUP_LABEL.privacy} onPress={() => WebBrowser.openBrowserAsync(`${SITE_URL}/privacy`)} />
          ) : null}
        </View>
        <NoticeLine>{SIGNUP_NOTICE_USE}</NoticeLine>
        <NoticeLine>
          {dates.parts[0]}
          <Text style={styles.strong}>{dates.ends}</Text>
          {dates.parts[1]}
          <Text style={styles.strong}>{dates.purge}</Text>
          {dates.parts[2]}
        </NoticeLine>
        <NoticeLine>{SIGNUP_NOTICE_DISCOVERY}</NoticeLine>
      </View>

      <CheckRow checked={acknowledged} onToggle={setAcknowledged} refused={shownGap?.field === 'ack'}>
        <Text style={styles.checkLabel}>{NOTICE_ACK_LABEL}</Text>
        <Text style={styles.note}>{NOTICE_ACK_NOTE}</Text>
      </CheckRow>

      <View style={styles.group}>
        <FieldLabel>{SIGNUP_LABEL.optional}</FieldLabel>
        <Text style={styles.note}>{OPTIONAL_CONSENT_NOTE}</Text>
      </View>
      {OPTIONAL_CONSENTS.map((one) => (
        <CheckRow
          key={one.key}
          checked={chosen[one.key] === true}
          onToggle={(next) => setChosen((current) => ({ ...current, [one.key]: next }))}
        >
          <Text style={styles.checkLabel}>{one.label}</Text>
          <Text style={styles.note}>{one.detail}</Text>
          <Text style={styles.fine}>{one.erasure}</Text>
        </CheckRow>
      ))}

      <View style={styles.action}>
        {failure !== null && failure.field === null && <Text style={styles.failure}>{failure.message}</Text>}
        {shownGap !== null && <Text style={styles.failure}>{shownGap.message}</Text>}
        <PrimaryButton
          label={working ? SIGNUP_LABEL.signingUp : needsCode ? SIGNUP_LABEL.signUp : SIGNUP_LABEL.confirm}
          onPress={send}
          disabled={working}
        />
      </View>
    </Panel>
  );
}

function NoticeLine({ children }: { children: React.ReactNode }) {
  return (
    <View style={styles.noticeRow}>
      <Text style={styles.bullet}>•</Text>
      <Text style={styles.noticeText}>{children}</Text>
    </View>
  );
}

/** 나가는 길 — 코드가 없는 사람, 다른 구글 계정으로 들어와야 하는 사람의 자리. 적어 둔 출생 정보는 앞 화면에 그대로 있다 */
function LeaveLink() {
  const [leaving, setLeaving] = useState(false);
  const [failed, setFailed] = useState(false);
  const leave = async () => {
    setLeaving(true);
    setFailed(false);
    const left = await signOut();
    setLeaving(false);
    if (!left) {
      setFailed(true);
      return;
    }
    if (router.canGoBack()) router.back();
    else router.replace('/');
  };
  return (
    <View style={styles.leave}>
      <TextButton label={leaving ? SIGN_OUT_PENDING : SIGNUP_LABEL.otherAccount} onPress={leave} disabled={leaving} />
      {failed && <Text style={styles.failure}>{SIGN_OUT_FAILED}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLOR.background },
  content: { flexGrow: 1, padding: 16, gap: 16 },
  head: { gap: 10 },
  eyebrow: { fontSize: TYPE.small, fontFamily: FONT.bold, color: COLOR.creamInk },
  title: { fontSize: TYPE.heading, lineHeight: 28, fontFamily: FONT.bold, color: COLOR.foreground },
  headNote: { fontSize: TYPE.body, lineHeight: 24, fontFamily: FONT.medium, color: COLOR.creamInk },
  line: { fontSize: TYPE.sm, lineHeight: 22, fontFamily: FONT.medium, color: COLOR.foreground },
  form: { gap: 20 },
  group: { gap: 6 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  nameField: { flex: 1 },
  fine: { fontSize: TYPE.small, lineHeight: 19, fontFamily: FONT.medium, color: COLOR.muted },
  note: { fontSize: TYPE.sm, lineHeight: 21, fontFamily: FONT.medium, color: COLOR.secondary },
  failure: { fontSize: TYPE.small, lineHeight: 19, fontFamily: FONT.medium, color: COLOR.danger },
  notice: { gap: 6, padding: 16, borderRadius: 20, backgroundColor: COLOR.surfaceSunken },
  noticeHead: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', columnGap: 12 },
  noticeTitle: { fontSize: TYPE.body, fontFamily: FONT.bold, color: COLOR.foreground },
  noticeRow: { flexDirection: 'row', gap: 8 },
  bullet: { fontSize: TYPE.sm, lineHeight: 22, color: COLOR.muted },
  noticeText: { flex: 1, fontSize: TYPE.sm, lineHeight: 22, fontFamily: FONT.medium, color: COLOR.secondary },
  strong: { fontFamily: FONT.bold, color: COLOR.foreground },
  checkLabel: { fontSize: TYPE.sm, lineHeight: 21, fontFamily: FONT.bold, color: COLOR.foreground },
  action: { gap: 10, paddingTop: 20, borderTopWidth: 1, borderTopColor: COLOR.border },
  leave: { alignItems: 'center' },
});
