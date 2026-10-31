import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { isBlocked } from '@account/index';

import { readPicker, type PickerData } from '@/compat/data';
import { CompatPicker } from '@/compat/picker';
import { RelationMap } from '@/compat/relation-map';
import { CompatResultStep } from '@/compat/result-step';
import type { Read } from '@/people/data';
import { AccountNotice, FailureLine, ScreenFrame, go, styles as shared } from '@/people/parts';
import { COLOR, FONT, TYPE } from '@/ui/tokens';
import { RowLine } from '@/ui/surfaces';
import { settled } from '@/ui/settled';
import { UNREACHABLE } from '@/auth/signup';

/**
 * 궁합 — 앱에는 `/compat` 이 없어(입구 결정) 이 주소가 두 걸음을 다 든다. `a` · `b` 가 있으면 두 명식을 보고, 없으면 두 사람을 정한다.
 * `pickA` · `pickB` 는 고르는 칸을 채워 연다 — 주소에는 person id 만 실린다.
 */
export default function CompatScreen() {
  const params = useLocalSearchParams<{ a?: string; b?: string; pickA?: string; pickB?: string }>();
  if (params.a !== undefined && params.b !== undefined) return <CompatResultStep a={params.a} b={params.b} back="/me/compat" />;
  return <PickStep pickA={params.pickA} pickB={params.pickB} />;
}

function Loading() {
  return (
    <ScreenFrame>
      <ActivityIndicator color={COLOR.secondary} style={styles.loading} />
    </ScreenFrame>
  );
}

function PickStep({ pickA, pickB }: { pickA?: string; pickB?: string }) {
  const [read, setRead] = useState<Read<PickerData> | null>(null);

  const load = useCallback(() => {
    void settled(readPicker(), 'readPicker', () => ({ kind: 'failed', message: UNREACHABLE }) as const).then((next) => {
      if (next.kind === 'signed-out') router.replace('/');
      else setRead(next);
    });
  }, []);
  /* 고르는 칸의 값이 날아가지 않게 처음 한 번만 — 저장한 사람이 늘어도 칸을 다시 세우지 않는다 */
  useFocusEffect(useCallback(() => {
    if (read === null) load();
  }, [load, read]));

  if (read === null || read.kind === 'signed-out') return <Loading />;
  if (read.kind === 'failed') {
    return (
      <ScreenFrame>
        <Text style={shared.section}>궁합 새로 보기</Text>
        <FailureLine onRetry={load}>{read.message}</FailureLine>
      </ScreenFrame>
    );
  }

  const { state, people, compats, map } = read.value;
  const latest = compats[0];

  return (
    <ScreenFrame keyboard>
      <Text style={shared.section}>궁합 새로 보기</Text>
      {isBlocked(state) ? (
        <AccountNotice state={state} onRetry={load} />
      ) : (
        <>
          <CompatPicker people={people} pickA={pickA} pickB={pickB} />
          <Text style={shared.meta}>
            직접 입력한 사람은 <Text style={shared.bodyStrong}>저장한 사람에 추가되지 않아요.</Text>
          </Text>
          {latest !== undefined && (
            <RowLine accessibilityRole="link" onPress={() => go('/me/readings?kind=compat&from=compat')} style={styles.summary}>
              <View style={styles.summaryBody}>
                <Text style={styles.summaryTitle}>
                  궁합풀이 <Text style={shared.meta}>{compats.length}</Text>
                </Text>
                <Text style={shared.meta} numberOfLines={1}>최근 {`${latest.labelA ?? ''} × ${latest.labelB ?? ''}`}</Text>
              </View>
              <Text style={styles.chevron}>›</Text>
            </RowLine>
          )}
          {map !== null && <RelationMap model={map.model} canAdd={map.canAdd} />}
        </>
      )}
    </ScreenFrame>
  );
}

const styles = StyleSheet.create({
  loading: { marginTop: 48 },
  summary: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  summaryBody: { flex: 1, minWidth: 0 },
  summaryTitle: { fontSize: TYPE.body, fontFamily: FONT.bold, color: COLOR.foreground },
  chevron: { fontSize: TYPE.lead, color: COLOR.muted },
});
