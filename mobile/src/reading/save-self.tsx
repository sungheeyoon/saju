import type { Query } from '@input/query';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text } from 'react-native';

import { supabase } from '@/auth/client';
import { Panel, PrimaryButton } from '@/ui/parts';
import { COLOR, FONT, TYPE } from '@/ui/tokens';

import { saveSelfPerson } from './chart-writes';

const reading = '사주풀이';
const saveWhat = '출생 정보';

/**
 * **이 사주를 내 사주로 저장하고 풀이로 간다** — 웹의 `app/save-for-reading.tsx` 와 같은 글자다. 내 사주가 이미 있거나 세션이 없거나
 * 못 읽었으면 안 선다. 저장은 앱의 문을 지난다(ADR 0211) — 여덟 글자는 서버가 이 입력에서 센다.
 */
export function SaveSelfCard({ query }: { query: Query }) {
  const [asks, setAsks] = useState(false);
  const [saving, setSaving] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    void supabase
      ?.from('app_user')
      .select('self_person_id')
      .maybeSingle()
      .then(({ data, error }) => {
        if (live && error === null && data !== null && data.self_person_id === null) setAsks(true);
      });
    return () => {
      live = false;
    };
  }, []);

  if (!asks) return null;

  const save = async () => {
    setSaving(true);
    setFailure(null);
    const answer = await saveSelfPerson(query);
    setSaving(false);
    if (answer.ok && answer.value.ok) {
      router.replace('/me/readings/self' as never);
      return;
    }
    setFailure(answer.ok ? (answer.value.ok ? null : answer.value.message) : answer.refused.refused === 'unavailable' ? answer.refused.message : null);
    if (!answer.ok && answer.refused.refused !== 'unavailable') router.replace(answer.refused.refused === 'sign-in' ? '/' : '/signup');
  };

  return (
    <Panel style={styles.card}>
      <Text accessibilityRole="header" style={styles.title}>
        {reading}로 이어 보기
      </Text>
      <Text style={styles.line}>
        {reading}는 저장한 출생 정보로만 받을 수 있어요.{' '}
        {saveWhat}를 저장하면 {reading}를 받고, 다음에 다시 볼 수도 있어요.
      </Text>
      <PrimaryButton label={saving ? '저장하는 중…' : '저장하고 계속하기'} onPress={() => void save()} disabled={saving} />
      {failure !== null && <Text accessibilityRole="alert" style={styles.failure}>저장하지 못했어요. {failure}</Text>}
    </Panel>
  );
}

const styles = StyleSheet.create({
  card: { gap: 12 },
  title: { fontFamily: FONT.bold, fontSize: TYPE.field, color: COLOR.foreground },
  line: { fontFamily: FONT.medium, fontSize: TYPE.sm, lineHeight: 22, color: COLOR.secondary },
  failure: { fontFamily: FONT.medium, fontSize: TYPE.small, lineHeight: 20, color: COLOR.danger },
});
