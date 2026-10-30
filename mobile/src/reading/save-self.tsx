import { calculateChart } from '@input/chart';
import type { Query } from '@input/query';
import type { SameChart } from '@input/same-chart';
import { noRoomToSave, type PersonSlots } from '@people';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { supabase } from '@/auth/client';
import { SelfCard } from '@/home/self-card';
import { addPerson, readSlots } from '@/people/data';
import { SameChartAsk, type SameChartQuestion } from '@/people/same-chart-ask';
import { Card } from '@/ui/surfaces';
import { PrimaryButton, SecondaryButton, TextButton } from '@/ui/parts';
import { COLOR, FONT, RADIUS, TYPE } from '@/ui/tokens';

import { saveSelfPerson } from './chart-writes';

const reading = '사주풀이';
const saveWhat = '출생 정보';

/**
 * `self` 는 내 사주를 등록했는가와 등록하면 설 이름 — 못 읽었으면 `null` 이고 그때는 묻지 않는다(`app/self-person-state.ts`).
 * `slots` 가 `null` 이면 못 읽은 것이고 막지 않는다.
 */
type SaveContext = { self: { saved: boolean; nickname: string | null } | null; slots: PersonSlots | null };

function useSaveContext(): SaveContext | null {
  const [context, setContext] = useState<SaveContext | null>(null);

  useEffect(() => {
    let live = true;
    void (async () => {
      if (supabase === null) return;
      /* 세션이 없으면 안 선다 — 정책이 빈 답을 내 「내 사주가 없다」로 읽히지 않게 */
      const { data: session } = await supabase.auth.getSession();
      if (session.session === null) return;
      const [account, slots] = await Promise.all([supabase.from('app_user').select('self_person_id, nickname').maybeSingle(), readSlots()]);
      if (!live) return;
      const self = account.error !== null ? null : { saved: account.data !== null && account.data.self_person_id !== null, nickname: account.data?.nickname ?? null };
      setContext({ self, slots });
    })();
    return () => {
      live = false;
    };
  }, []);

  return context;
}

/**
 * **결과 화면에서 저장해 풀이로 가는 길** — 갈래와 글자는 웹의 `app/save-for-reading.tsx` 다. 내 사주가 없으면 내 사주인지 먼저 묻고(ADR 0128),
 * 아니면 「저장한 사람」으로 저장한다. 웹이 함께 잇는 로그인 전 맛보기는 앱에 없어 그 갈래도 없다.
 */
export function SavePersonForReading({ query }: { query: Query }) {
  const context = useSaveContext();
  /** 「다른 사람의 사주예요」를 눌렀다 — 이 화면에서는 다시 묻지 않는다 */
  const [someoneElse, setSomeoneElse] = useState(false);

  if (context === null) return null;
  if (context.self !== null && !context.self.saved && !someoneElse) {
    return <SelfConfirm query={query} name={context.self.nickname ?? query.name.trim()} onSomeoneElse={() => setSomeoneElse(true)} />;
  }
  return <SaveCard query={query} slots={context.slots} />;
}

/** 저장한 사람으로 저장한다 — 같은 명식이면 먼저 묻고, 자리가 없으면 버튼 자리에 할 일이 선다 */
function SaveCard({ query, slots }: { query: Query; slots: PersonSlots | null }) {
  const [saving, setSaving] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  /** 물음이 서 있는 동안 저장 버튼은 자리를 비운다 — 답하지 않고 다시 누르면 같은 물음이 또 온다 */
  const [question, setQuestion] = useState<SameChartQuestion | null>(null);

  const noRoom = noRoomToSave(1, slots);
  const name = query.name.trim();

  /** 「맞다」면 아무것도 저장하지 않고 그 사람에게 간다 — 자리도 안 쓰고 대상도 안 는다 */
  const goTo = (same: SameChart) => {
    setQuestion(null);
    router.push((same.isSelfPerson ? '/me/readings/self' : `/me/readings/${same.personId}`) as never);
  };

  const save = async (evenIfSameChart: boolean) => {
    setSaving(true);
    setFailure(null);
    const saved = await addPerson(query, '', evenIfSameChart);
    setSaving(false);
    if (saved.ok) {
      setQuestion(null);
      router.push(`/me/readings/${saved.personId}` as never);
    } else if (saved.kind === 'failed') {
      setQuestion(null);
      setFailure(saved.message);
    } else {
      const { same } = saved;
      setQuestion({ label: same.label, answer: (sameperson) => (sameperson ? goTo(same) : void save(true)) });
    }
  };

  return (
    <Card style={styles.card}>
      <View style={styles.head}>
        <Text accessibilityRole="header" style={styles.title}>
          {reading}로 이어 보기
        </Text>
        <Text style={styles.line}>
          {reading}는 저장한 출생 정보로만 받을 수 있어요.{' '}
          {saveWhat}를 저장하면 {reading}를 받고, 다음에 다시 볼 수도 있어요.
        </Text>
      </View>

      {question !== null ? (
        <SameChartAsk question={question} busy={saving} />
      ) : noRoom !== null ? (
        <View style={styles.noRoom}>
          <Text style={styles.line}>{noRoom}</Text>
          <TextButton label="저장한 사람 관리 →" onPress={() => router.push('/me/people' as never)} />
        </View>
      ) : (
        <>
          <PrimaryButton label={saving ? '저장하는 중…' : '저장하고 계속하기'} onPress={() => void save(false)} disabled={saving} />
          <Text style={styles.fine}>
            {name !== '' ? `저장한 사람 목록에 「${name}」 이름으로 추가돼요.` : '저장한 사람 목록에 이 사람이 추가돼요.'} 저장하면 {reading}를 받는 화면으로 넘어가요.
            {slots !== null && ` 앞으로 ${slots.remaining}명 더 저장할 수 있어요.`} 목록에서 빼려면 ‘저장한 사람’으로 이동해 주세요.
          </Text>
        </>
      )}

      {failure !== null && <Text accessibilityRole="alert" style={styles.failure}>저장하지 못했어요. {failure}</Text>}
    </Card>
  );
}

/**
 * **「이 사주가 내 사주 맞나요?」** — 홈의 내 사주 카드 그대로 보인다. 묻지 않고 저장하면 남의 사주가 내 것이 된다.
 * 풀이를 대신 누르지 않는다 — 풀이권을 쓰는 누름은 도착한 화면에서 사용자가 한다(ADR 0028).
 */
function SelfConfirm({ query, name, onSomeoneElse }: { query: Query; name: string; onSomeoneElse: () => void }) {
  const chart = useMemo(() => calculateChart(query), [query]);
  const [saving, setSaving] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  /* 결과 화면이 이미 그린 입력이라 못 푸는 일은 없다 — 그래도 지어낸 카드를 세우지 않는다 */
  if (!chart.ok) return null;

  const save = async () => {
    setSaving(true);
    setFailure(null);
    /* 내 사주의 이름은 닉네임이다 — 적은 이름이 비어 있어도 막히지 않게 그 이름으로 보낸다 */
    const answer = await saveSelfPerson({ ...query, name });
    setSaving(false);
    if (answer.ok && answer.value.ok) {
      router.replace('/me/readings/self' as never);
      return;
    }
    setFailure(answer.ok ? (answer.value.ok ? null : answer.value.message) : answer.refused.refused === 'unavailable' ? answer.refused.message : null);
    if (!answer.ok && answer.refused.refused !== 'unavailable') router.replace(answer.refused.refused === 'sign-in' ? '/' : '/signup');
  };

  /* 아직 저장 전이라 사람도 글도 사진도 없다. 단추 자리는 아래 둘이라 `personId` 를 쓰는 길이 안 선다 */
  const card = { kind: 'ok' as const, personId: '', label: name, query, saju: chart.saju, metaphor: null, hasReading: false, making: false, face: null };

  return (
    <View style={styles.confirm}>
      <View style={styles.head}>
        <Text accessibilityRole="header" style={styles.title}>이 사주가 내 사주 맞나요?</Text>
        <Text style={styles.line}>첫 화면에 입력한 정보예요.</Text>
      </View>
      <SelfCard
        card={card}
        actions={
          <View style={styles.answers}>
            <PrimaryButton label={saving ? '저장하는 중…' : '내 사주로 저장'} onPress={() => void save()} disabled={saving} />
            <SecondaryButton label="다른 사람의 사주예요" onPress={onSomeoneElse} disabled={saving} />
          </View>
        }
      />
      {failure !== null && <Text accessibilityRole="alert" style={styles.failure}>저장하지 못했어요. {failure}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: 12 },
  confirm: { gap: 12 },
  head: { gap: 4 },
  answers: { gap: 8 },
  noRoom: { gap: 4, padding: 12, borderRadius: RADIUS.cell, backgroundColor: COLOR.background },
  title: { fontFamily: FONT.bold, fontSize: TYPE.field, color: COLOR.foreground },
  line: { fontFamily: FONT.medium, fontSize: TYPE.note, lineHeight: 22, color: COLOR.secondary },
  fine: { fontFamily: FONT.medium, fontSize: TYPE.fine, lineHeight: 18, color: COLOR.muted },
  failure: { fontFamily: FONT.medium, fontSize: TYPE.small, lineHeight: 20, color: COLOR.danger },
});
