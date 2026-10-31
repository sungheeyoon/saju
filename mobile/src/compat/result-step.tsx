import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState, type ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, Text } from 'react-native';

import { UNREADABLE_INPUT_NOTE } from '@input/stored';

import type { Read } from '@/people/data';
import { AccountNotice, FailureLine, NotFound, ScreenFrame, styles as shared } from '@/people/parts';
import { PrimaryButton, SecondaryButton } from '@/ui/parts';
import { TopBar } from '@/ui/top-bar';
import { COLOR } from '@/ui/tokens';
import { Card } from '@/ui/surfaces';

import { readPair, type PairOutcome } from './data';
import { CompatResult } from './result';

function Loading({ bar }: { bar: ReactNode }) {
  return (
    <ScreenFrame bar={bar}>
      <ActivityIndicator color={COLOR.secondary} style={styles.loading} />
    </ScreenFrame>
  );
}

/** 두 사람의 결과 한 화면 — 궁합 탭(`/me/compat`)과 보관함(`/me/readings/compat`)이 같은 부품을 부른다. `<` 만 온 곳을 따른다(`app/me/compat/screen.tsx`) */
export function CompatResultStep({ a, b, back: to }: { a: string; b: string; back: string }) {
  const [read, setRead] = useState<Read<PairOutcome> | null>(null);

  const load = useCallback(() => {
    void readPair(a, b).then((next) => {
      if (next.kind === 'signed-out') router.replace('/');
      else setRead(next);
    });
  }, [a, b]);
  useFocusEffect(load);

  const bar = <TopBar title="궁합" fallback={to} />;
  if (read === null || read.kind === 'signed-out') return <Loading bar={bar} />;

  if (read.kind === 'failed') {
    return (
      <ScreenFrame bar={bar}>
        <FailureLine onRetry={load}>{read.message}</FailureLine>
      </ScreenFrame>
    );
  }

  const outcome = read.value;
  if (outcome.kind === 'ok') {
    return (
      <ScreenFrame bar={bar}>
        <CompatResult outcome={outcome} onReadingChanged={load} />
      </ScreenFrame>
    );
  }
  if (outcome.kind === 'blocked') {
    return (
      <ScreenFrame bar={bar}>
        <AccountNotice state={outcome.state} onRetry={load} />
      </ScreenFrame>
    );
  }
  if (outcome.kind === 'not-found') {
    return (
      <ScreenFrame bar={bar}>
        <NotFound>
          <PrimaryButton label="궁합 보러 가기" onPress={() => router.replace('/me/compat')} />
          <SecondaryButton label="저장한 사람" onPress={() => router.replace('/me/people')} />
        </NotFound>
      </ScreenFrame>
    );
  }

  /* 거절은 그 자리에서 말한다 — 고르는 자리로 되돌려 보내면 왜 되돌아왔는지 모른다 */
  return (
    <ScreenFrame bar={<TopBar title="궁합" fallback="/me/compat" />}>
      <Text style={shared.title}>궁합을 볼 수 없습니다</Text>
      <Card style={styles.refusal}>
        {outcome.kind === 'same' ? (
          <Text style={shared.body}>같은 사람은 한 번만 고를 수 있어요. 서로 다른 두 사람을 골라 주세요.</Text>
        ) : (
          <>
            <Text style={shared.body}>{outcome.message}</Text>
            <Text style={shared.meta}>{UNREADABLE_INPUT_NOTE}</Text>
          </>
        )}
      </Card>
    </ScreenFrame>
  );
}

const styles = StyleSheet.create({
  loading: { marginTop: 48 },
  refusal: { gap: 8 },
});
