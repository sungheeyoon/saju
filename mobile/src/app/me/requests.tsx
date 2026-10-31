import { router, useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import type { NotificationKind } from '@consent/index';
import type { Inbox } from '@matching/inbox';
import { when } from '@matching/requests';

import { markNotificationsRead, readInbox, type Read } from '@/matching/doors';
import { Icon, type IconName } from '@/ui/icons';
import { EmptyState } from '@/ui/empty-state';
import { COLOR, FONT, RADIUS, TYPE } from '@/ui/tokens';
import { TopBar } from '@/ui/top-bar';
import { CardFrame } from '@/ui/surfaces';

/** 사건마다 줄 머리의 그림 — 색이 아니라 모양이 갈래를 말한다. 웹의 표와 같고, 웹의 태극(`taiji`)은 앱에서 사람 둘이다 */
const NOTIFICATION_ICON: Record<NotificationKind, IconName> = {
  request_received: 'people',
  request_accepted: 'people',
  request_rejected: 'close',
  request_invalidated: 'alert',
  request_expired: 'ticket',
  reading_ready: 'reading',
  reading_failed: 'alert',
  credits_granted: 'ticket',
  credits_revoked: 'ticket',
};

const NOTIFICATION_WARNS: readonly NotificationKind[] = ['request_invalidated', 'reading_failed'];

/**
 * 소식 — 머리글의 종이 여는 화면이고 지나간 일만 든다(ADR 0130). 들어오면 전부 읽음이 된다.
 * 갈 자리가 있는 줄은 줄 전체가 누를 자리다. 소식은 앱 밖으로 나가지 않는다(PRD §6.4).
 */
export default function RequestsScreen() {
  const [inbox, setInbox] = useState<Read<Inbox> | null>(null);
  const [readFailed, setReadFailed] = useState(false);
  const marked = useRef(false);

  const load = useCallback(async () => {
    const next = await readInbox();
    setInbox(next);
    if (!next.ok) return;
    if (next.value.unread === 0) {
      marked.current = false;
      return;
    }
    if (marked.current) return;
    marked.current = true;
    const result = await markNotificationsRead();
    setReadFailed(!result.ok);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  return (
    <View style={styles.screen}>
      <TopBar title="소식" fallback="/me" />
      <ScrollView contentContainerStyle={styles.content}>
        {inbox === null ? null : !inbox.ok ? (
          <View>
            <Text style={styles.failure} accessibilityRole="alert">
              소식을 불러오지 못했어요. {inbox.reason}
            </Text>
            <Pressable accessibilityRole="button" onPress={load} style={styles.retry}>
              <Text style={styles.retryText}>다시 시도하기</Text>
            </Pressable>
          </View>
        ) : (
          <>
            {readFailed && (
              <Text style={styles.failure} accessibilityRole="alert">
                소식을 읽은 것으로 표시하지 못했어요.
              </Text>
            )}
            {inbox.value.notifications.length === 0 ? (
              <EmptyState icon="bell" title="새로운 소식이 없어요">
                새 요청이나 풀이 결과가 생기면 여기에 알려드릴게요.
              </EmptyState>
            ) : (
              <CardFrame >
                {inbox.value.notifications.map((item, index) => {
                  const warns = NOTIFICATION_WARNS.includes(item.kind);
                  const body = (
                    <>
                      <View style={[styles.icon, warns ? styles.iconWarn : item.unread ? styles.iconNew : styles.iconOld]}>
                        <Icon name={NOTIFICATION_ICON[item.kind]} size={18} color={warns ? COLOR.danger : item.unread ? COLOR.creamInk : COLOR.secondary} />
                      </View>
                      <View style={styles.flex}>
                        <Text style={[styles.text, item.unread && styles.textNew]}>{item.text}</Text>
                        <Text style={styles.meta}>{when(item.createdAt)}</Text>
                      </View>
                      {item.unread && <View style={styles.dot} accessibilityLabel="읽지 않음" accessible />}
                      {item.href !== null && <Icon name="chevron" size={16} color={COLOR.muted} />}
                    </>
                  );
                  const rowStyle = [styles.row, index > 0 && styles.rowLine, item.unread && styles.rowNew];
                  return item.href === null ? (
                    <View key={item.notificationId} style={rowStyle}>
                      {body}
                    </View>
                  ) : (
                    <Pressable key={item.notificationId} accessibilityRole="link" onPress={() => router.push(item.href as never)} style={rowStyle}>
                      {body}
                    </Pressable>
                  );
                })}
              </CardFrame>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLOR.background },
  content: { flexGrow: 1, gap: 24, padding: 16 },
  flex: { flex: 1, minWidth: 0, gap: 2 },
  failure: { fontFamily: FONT.medium, fontSize: TYPE.small, lineHeight: 19, color: COLOR.danger },
  retry: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' },
  retryText: { fontFamily: FONT.bold, fontSize: TYPE.note, color: COLOR.foreground },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingHorizontal: 16, paddingVertical: 14 },
  rowLine: { borderTopWidth: 1, borderTopColor: COLOR.border },
  rowNew: { backgroundColor: COLOR.cream },
  icon: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: RADIUS.pill },
  iconWarn: { backgroundColor: COLOR.warningWash },
  iconNew: { backgroundColor: COLOR.cream },
  iconOld: { backgroundColor: COLOR.surfaceSunken },
  text: { fontFamily: FONT.medium, fontSize: TYPE.body, lineHeight: 24, color: COLOR.secondary },
  textNew: { fontFamily: FONT.bold, color: COLOR.foreground },
  meta: { fontFamily: FONT.medium, fontSize: TYPE.small, color: COLOR.muted },
  dot: { width: 8, height: 8, marginTop: 8, borderRadius: RADIUS.pill, backgroundColor: COLOR.danger },
});
