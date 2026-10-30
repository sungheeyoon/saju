import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { listenLive } from '@/chat/live';
import { AccountNotice, FailureLine, NoRoom } from '@/chat/notices';
import { noteActivity, readRoomScreen, type RoomScreen } from '@/chat/reads';
import { ChatRoomView } from '@/chat/room';
import { COLOR } from '@/ui/tokens';

/** 한 물결의 변경을 묶어 다시 읽는 간격 — 웹의 `REDRAW_AFTER_MS` 와 같다 */
const REREAD_AFTER_MS = 400;

/**
 * 방 안 — 없는 방 · 내가 볼 수 없는 방은 읽는 문이 내주지 않는다(ADR 0091). 방의 상태(닫힘 · 궁합 단추)는 `chat` · `requests` 갈래가 바뀌면 다시 읽고,
 * 메시지는 방이 합친다. 다시 읽는 것은 활동이 아니다(ADR 0155) — 활동은 사람이 이 화면을 연 한 번이다.
 */
export default function ChatRoomScreen() {
  const { matchId } = useLocalSearchParams<{ matchId: string }>();
  const [screen, setScreen] = useState<RoomScreen | null>(null);
  const live = useRef(true);

  const load = useCallback(async () => {
    const next = await readRoomScreen(matchId);
    if (!live.current) return;
    if (next.kind === 'signed-out') router.replace('/');
    /* 선 화면을 다시 읽다 실패하면 가진 것을 그대로 둔다 — 다음 다시 대조가 메운다 */
    else setScreen((now) => (now?.kind === 'ready' && next.kind === 'failed' ? now : next));
  }, [matchId]);

  useEffect(() => {
    live.current = true;
    noteActivity();
    void load();
    return () => {
      live.current = false;
    };
  }, [load]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const unlisten = listenLive((signal) => {
      if (signal.kind === 'change') {
        const { area, matchId: movedIn } = signal.change;
        if (area !== 'chat' && area !== 'requests') return;
        if (area === 'chat' && movedIn !== null && movedIn !== matchId) return;
      }
      if (timer !== null) clearTimeout(timer);
      timer = setTimeout(() => void load(), REREAD_AFTER_MS);
    });
    return () => {
      unlisten();
      if (timer !== null) clearTimeout(timer);
    };
  }, [load, matchId]);

  /* 첫 읽기 동안은 판만 — 방이 선 뒤 다시 읽다 실패하면 가진 방을 그대로 둔다(쓰던 글과 스크롤이 그대로다) */
  if (screen === null) return <SafeAreaView style={styles.screen} />;
  if (screen.kind === 'ready') return <ChatRoomView key={matchId} room={screen.view} onChanged={load} />;
  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.pad}>
        {screen.kind === 'failed' && <FailureLine onRetry={load}>{screen.message}</FailureLine>}
        {screen.kind === 'blocked' && <AccountNotice state={screen.state} onRetry={load} />}
        {screen.kind === 'not-found' && <NoRoom />}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLOR.background },
  pad: { padding: 16 },
});
