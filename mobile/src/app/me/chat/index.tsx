import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { CHAT_TAB_LABEL, messageTimeLabel, partnerNameOf, roomNoticeOf } from '@chat';
import { ROOM_NO_MESSAGES_YET } from '@chat/copy';
import type { Element } from '@saju';

import { Avatar } from '@/chat/avatar';
import { EmptyChat } from '@/chat/empty';
import { ChatIcon } from '@/chat/icons';
import { listenLive } from '@/chat/live';
import { AccountNotice, FailureLine } from '@/chat/notices';
import { noteActivity, readRoomListScreen, type ChatRoom, type RoomListScreen } from '@/chat/reads';
import { COLOR, FONT, RADIUS, TYPE } from '@/ui/tokens';

/** 한 물결의 변경을 묶어 다시 읽는 간격 — 웹의 `REDRAW_AFTER_MS` 와 같다 */
const REREAD_AFTER_MS = 400;

/** 대화방 목록 — 누가 어느 방을 보는가는 읽는 문이 정한다(ADR 0091). 접속 상태는 여기 안 선다(ADR 0092) */
export default function ChatRoomsScreen() {
  const [screen, setScreen] = useState<RoomListScreen | null>(null);
  const live = useRef(true);

  const load = useCallback(async () => {
    const next = await readRoomListScreen();
    if (!live.current) return;
    if (next.kind === 'signed-out') router.replace('/');
    /* 선 화면을 다시 읽다 실패하면 가진 것을 그대로 둔다 — 다음 다시 대조가 메운다 */
    else setScreen((now) => (now?.kind === 'ready' && next.kind === 'failed' ? now : next));
  }, []);

  useEffect(() => {
    live.current = true;
    return () => {
      live.current = false;
    };
  }, []);

  /* 사람이 이 화면을 연 것은 활동이다 — 돌아올 때마다 다시 읽는다(방에서 읽은 수 · 마지막 말) */
  useFocusEffect(
    useCallback(() => {
      noteActivity();
      void load();
    }, [load]),
  );

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const unlisten = listenLive((signal) => {
      if (signal.kind === 'change' && signal.change.area !== 'chat' && signal.change.area !== 'requests') return;
      if (timer !== null) clearTimeout(timer);
      timer = setTimeout(() => void load(), REREAD_AFTER_MS);
    });
    return () => {
      unlisten();
      if (timer !== null) clearTimeout(timer);
    };
  }, [load]);

  return (
    <View style={styles.screen}>
      <Text accessibilityRole="header" style={styles.title}>
        {CHAT_TAB_LABEL}
      </Text>
      {screen !== null && screen.kind === 'failed' && (
        <View style={styles.pad}>
          <FailureLine onRetry={load}>{screen.message}</FailureLine>
        </View>
      )}
      {screen !== null && screen.kind === 'blocked' && (
        <View style={styles.pad}>
          <AccountNotice state={screen.state} onRetry={load} />
        </View>
      )}
      {screen !== null && screen.kind === 'ready' && screen.rooms.length === 0 && (
        <View style={styles.pad}>
          <EmptyChat hasSelf={screen.hasSelf} />
        </View>
      )}
      {screen !== null && screen.kind === 'ready' && screen.rooms.length > 0 && (
        <FlatList
          data={screen.rooms}
          keyExtractor={(room) => room.matchId}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => <RoomRow room={item} tone={screen.tones.get(item.matchId)?.theirs.element ?? null} />}
        />
      )}
    </View>
  );
}

function RoomRow({ room, tone }: { room: ChatRoom; tone: Element | null }) {
  /* 닫힌 방은 마지막 말 대신 닫힌 까닭이 자물쇠와 함께 선다 — 누르기 전에 무엇이 안 되는지 읽힌다 */
  const notice = roomNoticeOf(room);
  const closed = notice !== null;
  const name = partnerNameOf(room);
  const unread = room.unread;
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={unread > 0 ? `${name} ${unread}건 안 읽음` : name}
      onPress={() => router.push(`/me/chat/${room.matchId}` as never)}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <Avatar nickname={name} size={56} tone={tone} dim={closed} userId={room.partnerUserId} hasPhoto={room.partnerHasPhoto} focus={room.partnerPhotoFocus} />
      <View style={styles.rowBody}>
        <View style={styles.rowTop}>
          <Text numberOfLines={1} style={[styles.name, closed && styles.quiet]}>
            {name}
          </Text>
          <Text style={[styles.time, unread > 0 && styles.timeUnread]}>{messageTimeLabel(room.lastMessageAt ?? room.openedAt)}</Text>
        </View>
        <View style={styles.rowBottom}>
          {closed && <ChatIcon name="lock" color={COLOR.secondary} size={14} />}
          <Text numberOfLines={1} style={[styles.preview, unread > 0 && !closed && styles.previewUnread]}>
            {notice ?? room.lastMessageBody ?? ROOM_NO_MESSAGES_YET}
          </Text>
          {unread > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{unread}</Text>
            </View>
          )}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLOR.background },
  title: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 16, fontSize: TYPE.title, fontFamily: FONT.bold, color: COLOR.foreground },
  pad: { paddingHorizontal: 16 },
  list: { paddingHorizontal: 8, paddingBottom: 16, gap: 2 },
  row: { minHeight: 72, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 8, paddingVertical: 10, borderRadius: RADIUS.panel },
  pressed: { backgroundColor: COLOR.surfaceSoft },
  rowBody: { flex: 1, gap: 2 },
  rowTop: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 },
  name: { flexShrink: 1, fontSize: TYPE.lead, lineHeight: 24, fontFamily: FONT.bold, color: COLOR.foreground },
  quiet: { color: COLOR.secondary },
  time: { fontSize: TYPE.fine, fontFamily: FONT.medium, color: COLOR.secondary },
  timeUnread: { fontFamily: FONT.bold, color: COLOR.foreground },
  rowBottom: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  preview: { flex: 1, fontSize: TYPE.sm, lineHeight: 20, fontFamily: FONT.medium, color: COLOR.secondary },
  previewUnread: { fontFamily: FONT.bold, color: COLOR.foreground },
  badge: { minWidth: 20, height: 20, paddingHorizontal: 6, alignItems: 'center', justifyContent: 'center', borderRadius: RADIUS.pill, backgroundColor: COLOR.danger },
  badgeText: { fontSize: TYPE.fine, fontFamily: FONT.bold, color: COLOR.onAccent },
});
