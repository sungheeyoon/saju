import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { isBlocked, type AccountState } from '@account/index';
import { rpcArgs } from '@db';
import { userFacingDbMessage } from '@db-error';
import {
  EMPTY_ANSWERS,
  IMPROVE_LABEL,
  IMPROVE_OPTIONS,
  LIKED_LABEL,
  LIKED_OPTIONS,
  PRICE_FACTORS,
  PRICE_FACTOR_LABEL,
  PRICE_LABEL,
  PRICE_NOTE,
  PRICE_OPTIONS,
  PRICE_STEM,
  PRICE_SUBJECT_LABEL,
  QUESTION,
  SOLE_CHOICES,
  SURVEY_COPY,
  TEXT_LIMIT,
  UNKNOWN_LABEL,
  UNKNOWN_OPTIONS,
  WANT_LABEL,
  WANT_NEW_LABEL,
  WANT_NEW_NOTE,
  WANT_NEW_OPTIONS,
  WANT_OPTIONS,
  afterPicking,
  isAnswered,
  mySurveyOf,
  surveyContextOf,
  surveyRequest,
  withoutHidden,
  type MySurvey,
  type PriceOption,
  type PriceSubject,
  type SurveyAnswers,
  type SurveyContext,
} from '@survey';

import { supabase } from '@/auth/client';
import { NOT_READY } from '@/auth/signup';
import { CheckRow, Panel, PrimaryButton, SecondaryButton } from '@/ui/parts';
import { COLOR, FONT, RADIUS, TYPE } from '@/ui/tokens';

import { AccountNotice, BackButton, FailureLine, settingsText } from './parts';
import { readAccount, setOptionalConsent } from './settings';

type Row = Record<string, unknown>;
type SaveAnswer = { ok: true; submittedAt: string | null } | { ok: false; message: string };
type Loaded = { kind: 'blocked'; state: AccountState } | { kind: 'failed' } | { kind: 'ready'; context: SurveyContext; given: MySurvey | null };

/** 못 읽은 것을 「아직 안 썼다」로 내면 빈 칸으로 열리고 적어 둔 글이 덮인다 — 어느 하나라도 못 읽으면 실패 줄이다(웹 `read.ts`) */
async function load(): Promise<Loaded> {
  const { state } = await readAccount<{ status: string }>('status');
  if (isBlocked(state)) return { kind: 'blocked', state };
  if (supabase === null) return { kind: 'failed' };
  const [context, given] = await Promise.all([supabase.rpc('service_survey_context'), supabase.rpc('my_service_survey')]);
  if (context.error !== null || given.error !== null) return { kind: 'failed' };
  const contextRow = ((context.data ?? []) as Row[])[0];
  if (contextRow === undefined) return { kind: 'failed' };
  const givenRow = ((given.data ?? []) as Row[])[0];
  return { kind: 'ready', context: surveyContextOf(contextRow), given: givenRow === undefined ? null : mySurveyOf(givenRow) };
}

async function save(answers: SurveyAnswers, submit: boolean): Promise<SaveAnswer> {
  if (supabase === null) return { ok: false, message: NOT_READY };
  const { data, error } = await supabase.rpc('save_service_survey', rpcArgs<'save_service_survey'>(surveyRequest(answers, submit)));
  return error !== null ? { ok: false, message: userFacingDbMessage(error, 'save_service_survey') } : { ok: true, submittedAt: (data as string | null) ?? null };
}

/** 서비스 설문 — 웹 `app/me/survey/` 와 같다. 어느 문항이 서는지는 DB 가 답한다(`service_survey_context`) */
export function SurveyScreen() {
  const [data, setData] = useState<Loaded | null>(null);
  const reload = useCallback(async () => setData(await load()), []);
  useEffect(() => {
    void reload();
  }, [reload]);

  if (data === null) return <View style={styles.screen} />;

  return (
    <View style={styles.screen}>
      <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
          <BackButton label="설정" to="/me/settings" />
          {data.kind === 'blocked' ? (
            <AccountNotice state={data.state} onRetry={() => void reload()} />
          ) : (
            <>
              <Panel tone="cream" style={styles.header}>
                <Text style={settingsText.title} accessibilityRole="header">
                  {SURVEY_COPY.title}
                </Text>
                <Text style={styles.intro}>{SURVEY_COPY.intro}</Text>
                <Text style={styles.editable}>{SURVEY_COPY.editable}</Text>
              </Panel>
              {data.kind === 'failed' ? (
                <Panel>
                  <FailureLine onRetry={() => void reload()}>설문을 불러오지 못했어요.</FailureLine>
                </Panel>
              ) : data.context.consented ? (
                <SurveyForm context={data.context} given={data.given} />
              ) : (
                <Panel style={styles.section}>
                  <View style={styles.tight}>
                    <Text style={settingsText.section}>먼저 동의가 필요합니다</Text>
                    <Text style={styles.sm}>{SURVEY_COPY.consentNeeded}</Text>
                  </View>
                  <ConsentSwitch onDone={() => void reload()} />
                </Panel>
              )}
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

/** 여기서 켜는 단추 하나 — 문은 설정과 같다. 끄는 단추는 안 세운다(지움의 경고가 선 설정 화면의 일이다) */
function ConsentSwitch({ onDone }: { onDone: () => void }) {
  const [failure, setFailure] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const turnOn = async () => {
    setFailure(null);
    setSaving(true);
    const result = await setOptionalConsent('improvement', true);
    setSaving(false);
    if (result.ok) onDone();
    else setFailure(result.message);
  };
  return (
    <View style={styles.consent}>
      <PrimaryButton label={saving ? '켜는 중…' : '동의하고 설문 열기'} onPress={() => void turnOn()} disabled={saving} />
      <Text style={styles.small}>설정 화면에서 언제든 다시 끄실 수 있습니다. 끄시면 지금까지 남기신 설문 답도 함께 지웁니다.</Text>
      {failure !== null && <FailureLine>{failure}</FailureLine>}
    </View>
  );
}

/** 쓰는 동안 저절로 남고(손이 멈춘 뒤 1.2초), 제출은 손으로 한다. 숨은 문항은 보내기 전에 비운다 — 웹 `form.tsx` */
function SurveyForm({ context, given }: { context: SurveyContext; given: MySurvey | null }) {
  const [answers, setAnswers] = useState<SurveyAnswers>(given?.answers ?? EMPTY_ANSWERS);
  const [submittedAt, setSubmittedAt] = useState<string | null>(given?.submittedAt ?? null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<'idle' | 'saving' | 'saved' | 'failed'>('idle');
  const [failure, setFailure] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const saved = useRef(JSON.stringify(given?.answers ?? EMPTY_ANSWERS));
  const { readSolo, readPair } = context;
  const shown = useMemo(() => ({ readSolo, readPair }), [readSolo, readPair]);
  const open = submittedAt === null || editing;

  useEffect(() => {
    if (!open) return;
    const next = JSON.stringify(answers);
    if (next === saved.current) return;
    const timer = setTimeout(() => {
      setDraft('saving');
      void save(withoutHidden(answers, shown), false).then((result) => {
        if (result.ok) {
          saved.current = next;
          setDraft('saved');
        } else {
          setDraft('failed');
        }
      });
    }, 1200);
    return () => clearTimeout(timer);
  }, [answers, open, shown]);

  const send = async () => {
    setFailure(null);
    setSending(true);
    const result = await save(withoutHidden(answers, shown), true);
    setSending(false);
    if (!result.ok) {
      setFailure(result.message);
      return;
    }
    saved.current = JSON.stringify(answers);
    setSubmittedAt(result.submittedAt);
    setDraft('idle');
    setEditing(false);
  };

  if (!open) {
    return (
      <Panel style={styles.section}>
        <View style={styles.tight}>
          <Text style={settingsText.section}>{SURVEY_COPY.thanks}</Text>
          <Text style={styles.sm}>{SURVEY_COPY.editable}</Text>
        </View>
        <SecondaryButton label="답 고치기" onPress={() => setEditing(true)} />
      </Panel>
    );
  }

  const pick = <K extends keyof SurveyAnswers>(key: K, value: SurveyAnswers[K]) => setAnswers((now) => ({ ...now, [key]: value }));
  const asked: PriceSubject[] = [...(context.readSolo ? (['solo'] as const) : []), ...(context.readPair ? (['pair'] as const) : [])];
  const total = asked.length > 0 ? 7 : 5;
  const step = (n: number) => `${n}/${total}`;
  const both = `${SURVEY_COPY.multiple} · ${SURVEY_COPY.optional}`;

  return (
    <View style={styles.form}>
      <Text style={styles.meta}>{SURVEY_COPY.autosave}</Text>

      <Picks step={step(1)} question={QUESTION.liked} hint={SURVEY_COPY.multiple} options={LIKED_OPTIONS} label={LIKED_LABEL} sole={SOLE_CHOICES.liked} picked={answers.liked} onPick={(next) => pick('liked', next)} />
      <Picks step={step(2)} question={QUESTION.unknown} hint={both} options={UNKNOWN_OPTIONS} label={UNKNOWN_LABEL} sole={SOLE_CHOICES.unknown} picked={answers.unknown} onPick={(next) => pick('unknown', next)} />
      <Picks step={step(3)} question={QUESTION.improve} hint={SURVEY_COPY.multiple} options={IMPROVE_OPTIONS} label={IMPROVE_LABEL} sole={SOLE_CHOICES.improve} picked={answers.improve} onPick={(next) => pick('improve', next)}>
        <Writing label={QUESTION.improveText} limit={TEXT_LIMIT.improve} value={answers.improveText} onChange={(next) => pick('improveText', next)} ruled />
      </Picks>
      <Picks step={step(4)} question={QUESTION.wants} hint={SURVEY_COPY.multiple} options={WANT_OPTIONS} label={WANT_LABEL} sole={SOLE_CHOICES.wants} picked={answers.wants} onPick={(next) => pick('wants', next)}>
        <Picks question={QUESTION.wantsNew} hint={both} note={WANT_NEW_NOTE} options={WANT_NEW_OPTIONS} label={WANT_NEW_LABEL} sole={SOLE_CHOICES.wantsNew} picked={answers.wantsNew} onPick={(next) => pick('wantsNew', next)} nested />
      </Picks>

      {asked.length > 0 && (
        <Panel style={styles.panel}>
          <Text style={styles.step}>{step(5)}</Text>
          <Text style={styles.ask}>{PRICE_STEM}</Text>
          <Text style={styles.small}>{PRICE_NOTE}</Text>
          {asked.map((subject) => {
            const key = subject === 'solo' ? 'priceSolo' : 'pricePair';
            return (
              <View key={subject} style={styles.ruled}>
                <Text style={styles.subject}>{PRICE_SUBJECT_LABEL[subject]}</Text>
                <View accessibilityRole="radiogroup" style={styles.options}>
                  {PRICE_OPTIONS.map((option) => {
                    const on = answers[key] === option;
                    return (
                      <Pressable
                        key={option}
                        accessibilityRole="radio"
                        accessibilityState={{ checked: on }}
                        /* 잘못 고른 값을 지울 길 — 같은 것을 다시 누르면 풀린다 */
                        onPress={() => pick(key, on ? null : (option as PriceOption))}
                        style={[styles.radio, on && styles.radioOn]}
                      >
                        <View style={[styles.dot, on && styles.dotOn]}>{on && <View style={styles.dotInner} />}</View>
                        <Text style={styles.choice}>{PRICE_LABEL[option]}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            );
          })}
        </Panel>
      )}

      {asked.length > 0 && <Picks step={step(6)} question={QUESTION.priceFactors} hint={both} options={PRICE_FACTORS} label={PRICE_FACTOR_LABEL} sole={[]} picked={answers.priceFactors} onPick={(next) => pick('priceFactors', next)} />}

      <Panel style={styles.panel}>
        <Text style={styles.step}>{step(total)}</Text>
        <Writing label={QUESTION.freeText} limit={TEXT_LIMIT.free} value={answers.freeText} onChange={(next) => pick('freeText', next)} />
      </Panel>

      <View style={styles.send}>
        <Text style={styles.small}>{SURVEY_COPY.drafting}</Text>
        <PrimaryButton label={submittedAt === null ? SURVEY_COPY.submit : SURVEY_COPY.resubmit} onPress={() => void send()} disabled={sending || !isAnswered(answers)} />
        <DraftMark state={draft} />
        {failure !== null && <FailureLine>{failure}</FailureLine>}
      </View>
    </View>
  );
}

function DraftMark({ state }: { state: 'idle' | 'saving' | 'saved' | 'failed' }) {
  if (state === 'idle') return null;
  if (state === 'failed') return <Text style={styles.draftFailed}>{`${SURVEY_COPY.draftFailed} 답을 다시 고치면 한 번 더 저장해 볼게요.`}</Text>;
  return <Text style={styles.small}>{state === 'saving' ? '임시 저장하는 중…' : SURVEY_COPY.draftSaved}</Text>;
}

function Picks<T extends string>({
  step,
  question,
  hint,
  note,
  options,
  label,
  sole,
  picked,
  onPick,
  nested = false,
  children,
}: {
  step?: string;
  question: string;
  hint: string;
  note?: string;
  options: readonly T[];
  label: Record<T, string>;
  sole: readonly string[];
  picked: readonly T[];
  onPick: (next: T[]) => void;
  nested?: boolean;
  children?: ReactNode;
}) {
  const body = (
    <>
      {step !== undefined && <Text style={styles.step}>{step}</Text>}
      <Text style={nested ? styles.nestedAsk : styles.ask}>{question}</Text>
      <Text style={styles.small}>{hint}</Text>
      {note !== undefined && <Text style={styles.small}>{note}</Text>}
      <View style={styles.options}>
        {options.map((option) => (
          <CheckRow key={option} checked={picked.includes(option)} onToggle={() => onPick(afterPicking(picked, option, sole))}>
            <Text style={styles.choice}>{label[option]}</Text>
          </CheckRow>
        ))}
      </View>
      {children}
    </>
  );
  return nested ? <View style={styles.ruled}>{body}</View> : <Panel style={styles.panel}>{body}</Panel>;
}

function Writing({ label, limit, value, onChange, ruled = false }: { label: string; limit: number; value: string; onChange: (next: string) => void; ruled?: boolean }) {
  return (
    <View style={ruled ? styles.ruled : styles.writing}>
      <Text style={styles.subject}>{label}</Text>
      <Text style={styles.small}>{`${SURVEY_COPY.optional} · 최대 ${limit}자`}</Text>
      <TextInput accessibilityLabel={label} multiline value={value} maxLength={limit} onChangeText={onChange} style={styles.area} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLOR.background },
  content: { flexGrow: 1, gap: 16, padding: 16, paddingBottom: 40 },
  header: { gap: 8 },
  intro: { fontSize: TYPE.body, lineHeight: 26, fontFamily: FONT.medium, color: COLOR.creamInk },
  editable: { fontSize: TYPE.small, lineHeight: 20, fontFamily: FONT.medium, color: COLOR.creamInk },
  section: { gap: 16 },
  tight: { gap: 4 },
  sm: { fontSize: TYPE.sm, lineHeight: 22, fontFamily: FONT.medium, color: COLOR.secondary },
  consent: { gap: 8, paddingTop: 16, borderTopWidth: 1, borderTopColor: COLOR.border },
  small: { fontSize: TYPE.small, lineHeight: 20, fontFamily: FONT.medium, color: COLOR.muted },
  meta: { paddingHorizontal: 4, fontSize: TYPE.small, lineHeight: 20, fontFamily: FONT.medium, color: COLOR.secondary },
  form: { gap: 20 },
  panel: { gap: 12 },
  step: { fontSize: TYPE.small, lineHeight: 20, fontFamily: FONT.bold, color: COLOR.muted },
  ask: { fontSize: TYPE.lead, lineHeight: 26, fontFamily: FONT.bold, color: COLOR.foreground },
  nestedAsk: { fontSize: TYPE.body, lineHeight: 24, fontFamily: FONT.bold, color: COLOR.foreground },
  subject: { fontSize: TYPE.body, lineHeight: 24, fontFamily: FONT.bold, color: COLOR.foreground },
  options: { gap: 8 },
  choice: { fontSize: TYPE.body, lineHeight: 24, fontFamily: FONT.medium, color: COLOR.foreground },
  ruled: { gap: 8, paddingTop: 16, borderTopWidth: 1, borderTopColor: COLOR.border },
  writing: { gap: 8 },
  radio: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 48, paddingHorizontal: 16, paddingVertical: 10, borderRadius: RADIUS.control, borderWidth: 1, borderColor: COLOR.border, backgroundColor: COLOR.surface },
  radioOn: { borderColor: COLOR.foreground, backgroundColor: COLOR.cream },
  dot: { width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: COLOR.borderStrong, backgroundColor: COLOR.surface },
  dotOn: { borderColor: COLOR.accent },
  dotInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: COLOR.accent },
  area: { minHeight: 112, paddingHorizontal: 16, paddingVertical: 12, borderRadius: RADIUS.control, borderWidth: 1, borderColor: COLOR.borderStrong, backgroundColor: COLOR.surface, fontFamily: FONT.medium, fontSize: TYPE.field, lineHeight: 24, color: COLOR.foreground, textAlignVertical: 'top' },
  send: { gap: 12, paddingHorizontal: 4 },
  draftFailed: { fontSize: TYPE.small, lineHeight: 20, fontFamily: FONT.bold, color: COLOR.danger },
});
