import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { Element } from '@saju';

import type { ReadingTarget } from '@/reading/api';
import { ReadFailure, ReadingPanel, useReadingView } from '@/reading/panel';
import { TopBar } from '@/ui/top-bar';
import { COLOR, FONT, TYPE } from '@/ui/tokens';
import { Card } from '@/ui/surfaces';

/**
 * **한 사람의 사주풀이** — 웹의 `/me/readings/[subject]`. 주소의 `self` 가 내 사주이고, 저장한 사람은 Person id 다.
 * 목록에 없는 사람인지는 문이 답한다(404). 내 사주의 id 로 온 옛 링크는 `self` 로 모은다.
 */
export default function ReadingScreen() {
  const { subject, from } = useLocalSearchParams<{ subject: string; from?: string }>();
  const target = useMemo<ReadingTarget>(
    () => (subject === 'self' ? { kind: 'self' } : { kind: 'person', personId: subject }),
    [subject],
  );
  const { answer, reload } = useReadingView(target);
  const view = answer !== null && 'view' in answer ? answer.view : null;

  useEffect(() => {
    if (view?.view === 'no-self') router.replace('/me' as never);
    if (view?.view === 'is-self') router.replace('/me/readings/self' as never);
  }, [view?.view]);

  return (
    <SafeAreaView style={styles.screen} edges={['left', 'right']}>
      <TopBar title={view?.view === 'reading' ? view.subject?.name : undefined} fallback={from === 'shelf' ? '/me/readings' : '/me'} />
      <ScrollView contentContainerStyle={styles.content}>
        {answer !== null && 'refused' in answer && <ReadFailure refused={answer.refused} onRetry={reload} />}

        {view?.view === 'blocked' && (
          <Card>
            <Text style={styles.noticeTitle}>{view.title}</Text>
            <Text style={styles.line}>{view.detail}</Text>
          </Card>
        )}

        {view?.view === 'reading' && (
          <>
            <Text style={styles.eyebrow}>{view.subject?.title}</Text>
            <ReadingPanel target={target} view={view} tones={[(view.subject?.dayMaster?.element ?? null) as Element | null]} />
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLOR.background },
  content: { gap: 20, padding: 16, paddingBottom: 48 },
  eyebrow: { fontFamily: FONT.bold, fontSize: TYPE.small, color: COLOR.secondary },
  noticeTitle: { fontFamily: FONT.bold, fontSize: TYPE.lead, color: COLOR.foreground },
  line: { marginTop: 4, fontFamily: FONT.medium, fontSize: TYPE.body, lineHeight: 24, color: COLOR.secondary },
});
