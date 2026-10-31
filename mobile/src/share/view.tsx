import { BETA_SIGNUP_CODE_NOTE } from '@account/copy';
import { SERVICE_NAME } from '@brand';
import { SHARE_COPY, sharedTitle, type ShareKind, type SharedReading } from '@reading/shared';
import { router } from 'expo-router';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Markdown } from '@/reading/markdown';
import { Icon } from '@/ui/icons';
import { Logo } from '@/ui/logo';
import { PrimaryButton, SecondaryButton } from '@/ui/parts';
import { COLOR, ELEMENT_TONE, FONT, RADIUS, TYPE } from '@/ui/tokens';
import { settled } from '@/ui/settled';
import { TopBar } from '@/ui/top-bar';
import { Card, Paper, Tile } from '@/ui/surfaces';

import { Mark } from './marks';
import { readShared, type ShareRead } from './read';
import { useStart } from './start';

/** 받은 사람이 보는 화면 — 세 주소가 같은 이것을 쓴다(웹의 `app/share/view.tsx`). 로그인도 테스트 코드도 없이 열린다 */
export function SharedReadingScreen({ token, expect }: { token: string; expect: ShareKind }) {
  const [read, setRead] = useState<ShareRead | null>(null);

  const load = useCallback(() => {
    setRead(null);
    void settled(readShared(token, expect), 'shared_reading', () => ({ kind: 'failed' }) as const).then(setRead);
  }, [token, expect]);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- 주소가 바뀌면 옛 공유본을 먼저 걷고 빈 화면에서 새로 읽는다. 다시 시도 단추도 같은 걸음이다
  useEffect(load, [load]);

  if (read === null) {
    return (
      <View style={styles.screen}>
        <TopBar fallback="/" />
      </View>
    );
  }
  if (read.kind === 'gone') return <GoneScreen />;
  if (read.kind === 'failed') return <FailedScreen onRetry={load} />;
  return <OpenScreen shared={read.shared} expect={expect} />;
}

function OpenScreen({ shared, expect }: { shared: SharedReading; expect: ShareKind }) {
  const { metaphor, score, body } = shared;
  const { eyebrow, invitation } = SHARE_COPY[expect];
  const { start, going, failure } = useStart('/me');

  return (
    <SafeAreaView style={styles.screen} edges={['left', 'right', 'bottom']}>
      <TopBar title={sharedTitle(expect, shared.nameA, shared.nameB)} fallback="/" />
      <ScrollView contentContainerStyle={styles.content}>
        <Pressable accessibilityRole="link" accessibilityLabel={SERVICE_NAME} onPress={() => router.replace('/')} style={styles.brandRow}>
          <Logo size={32} />
          <Text style={styles.brand}>{SERVICE_NAME}</Text>
        </Pressable>

        <View style={styles.head}>
          <Text style={styles.eyebrow}>{eyebrow}</Text>
        </View>

        {(metaphor !== null || score !== null) && (
          <Paper style={styles.cover}>
            {metaphor !== null && (
              <View style={styles.metaphor}>
                <Mark name="quote" color={COLOR.creamInk} />
                <Text style={styles.metaphorText}>{metaphor}</Text>
              </View>
            )}
            {/* 궁합에서는 점수가 그 글의 일부다. 빼면 받은 사람이 다른 글을 본다 */}
            {score !== null && (
              <Tile tone={ELEMENT_TONE.火.soft} style={styles.score}>
                <View style={styles.scoreLabel}>
                  <Icon name="taiji" size={16} color={ELEMENT_TONE.火.ink} />
                  <Text style={styles.scoreName}>궁합풀이 점수</Text>
                </View>
                <View style={styles.scoreLine}>
                  <Text style={styles.scoreValue}>{score}</Text>
                  <Text style={styles.scoreMax}>/ 100</Text>
                </View>
              </Tile>
            )}
          </Paper>
        )}

        <Card style={styles.article}>
          <Markdown source={body} />
        </Card>

        {/* 다 읽은 자리에서 묻는다 — 이 화면의 유일한 시작 단추다. 가입에 코드가 든다는 말이 곁에 함께 선다 */}
        <Paper style={styles.invitation}>
          <BrandCircle size={56} mark={36} />
          <Text accessibilityRole="header" style={styles.section}>
            {invitation.heading}
          </Text>
          <Text style={styles.note}>{invitation.note}</Text>
          {failure !== null && <Text style={styles.failure}>{failure}</Text>}
          <PrimaryButton label="로그인하고 시작하기" onPress={start} disabled={going} />
          <Text style={styles.fine}>{BETA_SIGNUP_CODE_NOTE}</Text>
        </Paper>
      </ScrollView>
    </SafeAreaView>
  );
}

/**
 * 열리지 않는 공유 링크 — 웹의 `app/share/not-found.tsx`. 이유를 가르지 않고, 막다른 자리에 세워 두지 않는다.
 * 웹의 아래 줄 「…로그인 없이 사주를 볼 수 있어요」는 안 세운다 — 앱은 결과 앞에 로그인을 지난다(운영자 결정, 비로그인 전용 결과 없음).
 */
function GoneScreen() {
  return (
    <Notice
      title="열 수 없는 링크예요"
      lines={['주소가 잘못됐거나 더 이상 남아 있지 않은 풀이예요.', '보낸 분에게 링크를 다시 받아 주세요.']}
    >
      <PrimaryButton label="무료로 내 사주 보기" onPress={() => router.replace('/')} />
    </Notice>
  );
}

/** 문이 터졌을 때 — 멀쩡한 링크를 「없어진 풀이」라고 하지 않는다. 글자는 웹의 `app/error-screen.tsx` 다 */
function FailedScreen({ onRetry }: { onRetry: () => void }) {
  return (
    <Notice title="화면을 불러오지 못했어요" lines={['잠시 후 다시 시도해 주세요.']}>
      <PrimaryButton label="다시 시도하기" onPress={onRetry} />
      <SecondaryButton label="홈으로" onPress={() => router.replace('/')} />
    </Notice>
  );
}

/** 막힌 화면의 틀 — 웹의 `NoticeScreen`: 가운데 크림 판, 왼쪽 글 */
function Notice({ title, lines, children }: { title: string; lines: readonly string[]; children: ReactNode }) {
  return (
    <SafeAreaView style={styles.screen} edges={['left', 'right', 'bottom']}>
      <TopBar fallback="/" />
      <View style={styles.noticeRoom}>
        <Paper style={styles.notice}>
          <BrandCircle size={64} mark={40} />
          <Text accessibilityRole="header" style={styles.title}>
            {title}
          </Text>
          <View>
            {lines.map((line) => (
              <Text key={line} style={styles.noticeLine}>
                {line}
              </Text>
            ))}
          </View>
          <View style={styles.noticeActions}>{children}</View>
        </Paper>
      </View>
    </SafeAreaView>
  );
}

function BrandCircle({ size, mark }: { size: number; mark: number }) {
  return (
    <View style={[styles.circle, { width: size, height: size }]}>
      <Logo size={mark} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLOR.background },
  content: { flexGrow: 1, padding: 16, gap: 24 },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44, marginHorizontal: 4 },
  brand: { fontSize: TYPE.heading, fontFamily: FONT.bold, color: COLOR.foreground },
  head: { gap: 6 },
  eyebrow: { fontSize: TYPE.small, fontFamily: FONT.bold, color: COLOR.creamInk },
  title: { fontSize: TYPE.title, lineHeight: 35, fontFamily: FONT.bold, color: COLOR.foreground },
  cover: { padding: 0, overflow: 'hidden' },
  metaphor: { flexDirection: 'row', gap: 12, paddingHorizontal: 20, paddingVertical: 28 },
  metaphorText: { flex: 1, fontSize: TYPE.heading, lineHeight: 29, fontFamily: FONT.medium, color: COLOR.foreground },
  score: { alignItems: 'center', margin: 12, paddingHorizontal: 20, paddingVertical: 16 },
  scoreLabel: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  scoreName: { fontSize: TYPE.small, fontFamily: FONT.bold, color: ELEMENT_TONE.火.ink },
  scoreLine: { flexDirection: 'row', alignItems: 'baseline', gap: 4, marginTop: 4 },
  scoreValue: { fontSize: TYPE.figure, fontFamily: FONT.bold, color: COLOR.foreground },
  scoreMax: { fontSize: TYPE.small, fontFamily: FONT.bold, color: COLOR.secondary },
  article: { overflow: 'hidden' },
  invitation: { gap: 12, paddingHorizontal: 20, paddingVertical: 28 },
  circle: { alignItems: 'center', justifyContent: 'center', borderRadius: RADIUS.pill, backgroundColor: COLOR.surface },
  section: { fontSize: TYPE.heading, lineHeight: 29, fontFamily: FONT.bold, color: COLOR.foreground },
  note: { fontSize: TYPE.body, lineHeight: 26, fontFamily: FONT.medium, color: COLOR.secondary },
  /* 두 문장이 제 줄에서 시작한다(운영자 2026-10-03) — 390px 에서 한 문장이 한 줄에 들어가는 크기다 */
  noticeLine: { fontSize: TYPE.sm, lineHeight: 24, fontFamily: FONT.medium, color: COLOR.secondary },
  fine: { fontSize: TYPE.small, lineHeight: 20, fontFamily: FONT.medium, color: COLOR.secondary },
  failure: { fontSize: TYPE.small, lineHeight: 19, fontFamily: FONT.medium, color: COLOR.danger },
  noticeRoom: { flex: 1, justifyContent: 'center', padding: 16 },
  notice: { gap: 16 },
  noticeActions: { gap: 8, marginTop: 8 },
});
