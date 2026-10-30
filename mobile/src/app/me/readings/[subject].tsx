import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { Element } from '@saju';

import type { ReadingTarget } from '@/reading/api';
import { ReadFailure, ReadingPanel, useReadingView } from '@/reading/panel';
import { SHELF_TITLE } from '@/reading/shelf';
import { Panel } from '@/ui/parts';
import { COLOR, FONT, TYPE } from '@/ui/tokens';

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

  const fromShelf = from === 'shelf';
  const back = () => {
    if (router.canGoBack()) router.back();
    else router.replace((fromShelf ? '/me/readings' : '/me') as never);
  };

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <Pressable accessibilityRole="button" onPress={back} style={styles.back}>
          <Text style={styles.backText}>← {fromShelf ? SHELF_TITLE : '홈'}</Text>
        </Pressable>

        {answer !== null && 'refused' in answer && <ReadFailure refused={answer.refused} onRetry={reload} />}

        {view?.view === 'blocked' && (
          <Panel>
            <Text style={styles.noticeTitle}>{view.title}</Text>
            <Text style={styles.line}>{view.detail}</Text>
          </Panel>
        )}

        {view?.view === 'reading' && (
          <>
            <View style={styles.head}>
              <Text style={styles.eyebrow}>{view.subject?.title}</Text>
              <Text accessibilityRole="header" style={styles.title}>
                {view.subject?.name}
              </Text>
            </View>
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
  back: { alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center' },
  backText: { fontFamily: FONT.bold, fontSize: TYPE.sm, color: COLOR.secondary },
  head: { gap: 6 },
  eyebrow: { fontFamily: FONT.bold, fontSize: TYPE.small, color: COLOR.secondary },
  title: { fontFamily: FONT.bold, fontSize: TYPE.title, color: COLOR.foreground },
  noticeTitle: { fontFamily: FONT.bold, fontSize: TYPE.lead, color: COLOR.foreground },
  line: { marginTop: 4, fontFamily: FONT.medium, fontSize: TYPE.body, lineHeight: 24, color: COLOR.secondary },
});
