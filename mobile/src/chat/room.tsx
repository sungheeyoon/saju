import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useCallback, useEffect, useMemo, useRef, useState, type ComponentRef } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CHAT_POLICY, TOO_LONG_TEXT, checkBody } from '@chat';
import {
  CHAT_INPUT_PLACEHOLDER,
  CHAT_SEND_LABEL,
  MY_PROFILE_EDIT_LABEL,
  NEW_MESSAGES_LABEL,
  OLDER_LOADING_LABEL,
  OLDER_MESSAGES_LABEL,
  ROOM_FIRST_HELLO,
  ROOM_SAFETY_NOTE,
  SEND_DROP_LABEL,
  SEND_FAILED_LABEL,
  SEND_RETRY_LABEL,
} from '@chat/copy';
import { bubbleDaysOf, reportableOf, type Bubble, type ShownMessage } from '@chat/room/bubbles';
import { dropDraft, readDraft, writeDraft, type TabStorage } from '@chat/room/draft';
import { bodyPartsOf } from '@chat/room/links';
import { droppable, withPending, type Pending } from '@chat/room/pending';
import { readAlready, readsNow } from '@chat/room/thread';
import { activityText, type ActivityBand } from '@presence';
import { STEM_INFO, type Element, type Stem } from '@saju';

import { COLOR, CONTROL, ELEMENT_TONE, FONT, RADIUS, TYPE } from '@/ui/tokens';
import { ElementSymbol } from '@/ui/element-symbol';

import { Avatar } from './avatar';
import { CompatChip, CompatRow } from './compat';
import { BlockDialog, ReportDialog } from './dialogs';
import { ChatIcon } from './icons';
import { AnchoredMenu, type MenuItem } from './menu';
import { partnerSheetName, ProfileSheet } from './profile-sheet';
import type { RoomView } from './reads';
import { useOutbox, useReadMarker, useThread, type MergeKind } from './use-room';

/** 맨 아래에서 이만큼 안이면 「맨 아래에 있다」 — 웹의 `NEAR_BOTTOM_PX` 와 같다 */
const NEAR_BOTTOM_PX = 48;
/** 글자 수는 한도에 가까워질 때만 선다 */
const COUNT_FROM = Math.floor(CHAT_POLICY.maxLength * 0.9);
/** 말풍선이 이만큼 화면에 들어와야 「본 것」이다 — 웹의 `SEEN_RATIO` 와 같다 */
const SEEN_CONFIG = { itemVisiblePercentThreshold: 60 };

/** 쓰던 글은 방마다 앱이 살아 있는 동안만 남는다 — 웹의 탭 수명과 같은 범위다(기기에 안 적는다, ADR 0155 덧) */
const held = new Map<string, string>();
const memory: TabStorage = {
  getItem: (key) => held.get(key) ?? null,
  setItem: (key, value) => void held.set(key, value),
  removeItem: (key) => void held.delete(key),
};
const draftStore = () => memory;

/** 천간의 그림 이름 — 웹의 `STEM_PICTURE` 와 같은 글자다 */
const STEM_PICTURE: Record<Stem, string> = {
  甲: '나무',
  乙: '덩굴',
  丙: '햇빛',
  丁: '등불',
  戊: '산',
  己: '밭',
  庚: '강철',
  辛: '보석',
  壬: '바다',
  癸: '빗물',
};

type Row =
  | { readonly kind: 'bubble'; readonly key: string; readonly bubble: Bubble }
  | { readonly kind: 'day'; readonly key: string; readonly label: string }
  | { readonly kind: 'start'; readonly key: string }
  | { readonly kind: 'older'; readonly key: string };

/**
 * **방 하나 — 머리와 입력이 붙어 있고 대화만 스크롤한다**(웹의 `room.tsx`). 대화 칸은 거꾸로 쌓는다(`inverted`) — 스크롤의 시작이 맨 아래라 들어오면 가장 최근 말이
 * 먼저 보인다. 말풍선은 두 사람의 일간 색이고, 값이 없는 방은 먹색 · 회색 한 벌이다 — 지어낸 색은 그 사람에 대해 거짓을 말한다.
 */
export function ChatRoomView({ room, onChanged }: { room: RoomView; onChanged: () => void }) {
  const closed = room.notice !== null;
  const [opened, setOpened] = useState<'report' | 'block' | null>(null);
  const [sheet, setSheet] = useState<'partner' | 'me' | null>(null);
  const partnerOpens = room.partnerUserId !== null && !closed;
  const theirTone = room.tones?.theirs.element ?? null;
  const myTone = room.tones?.mine.element ?? null;

  useEffect(() => {
    if (closed) dropDraft(draftStore, room.matchId);
  }, [closed, room.matchId]);

  const list = useRef<ComponentRef<typeof FlatList<Row>>>(null);
  const atBottom = useRef(true);
  const [fresh, setFresh] = useState(false);
  const beforeMerge = useCallback((kind: MergeKind, incoming: readonly ShownMessage[]) => {
    if (kind === 'newer' && !atBottom.current && incoming.some((message) => !message.mine)) setFresh(true);
  }, []);
  const toBottom = useCallback(() => {
    list.current?.scrollToOffset({ offset: 0, animated: false });
    setFresh(false);
  }, []);
  const onScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    atBottom.current = Math.abs(event.nativeEvent.contentOffset.y) < NEAR_BOTTOM_PX;
    if (atBottom.current) setFresh(false);
  }, []);

  const thread = useThread(room.matchId, room.messages, room.fromBeginning, beforeMerge);
  const outbox = useOutbox(room.matchId, thread.messages, thread.catchUp, onChanged);
  const pending = outbox.pending;
  const days = useMemo(() => bubbleDaysOf(withPending(thread.messages, pending)), [thread.messages, pending]);
  const pendingById = useMemo(() => new Map(pending.map((one) => [one.id, one])), [pending]);
  const reportable = useMemo(() => reportableOf(thread.messages), [thread.messages]);

  /* 창 · 시트가 대화를 덮은 동안은 읽음을 남기지 않는다 — 그 뒤에 든 말은 본 것이 아니다 */
  const [already] = useState(() => readAlready(room.messages, room.unread));
  const seenNow = useReadMarker(room.matchId, already, readsNow({ closed, dialogOpen: opened !== null, sheetOpen: sheet !== null }));
  const onViewable = useRef(({ viewableItems }: { viewableItems: { item: Row; isViewable: boolean }[] }) => {
    const seqs = new Set<number>();
    for (const { item, isViewable } of viewableItems) {
      if (isViewable && item.kind === 'bubble' && !item.bubble.mine) seqs.add(item.bubble.seq);
    }
    seenNow(seqs);
  });

  /* 거꾸로 쌓는 칸이라 맨 아래 말이 첫 줄이다 */
  const rows = useMemo<readonly Row[]>(() => {
    const down: Row[] = [];
    if (thread.reachedStart) down.push({ kind: 'start', key: 'start' });
    else if (thread.messages.length > 0) down.push({ kind: 'older', key: 'older' });
    for (const day of days) {
      down.push({ kind: 'day', key: `day-${day.key}`, label: day.label });
      for (const bubble of day.bubbles) down.push({ kind: 'bubble', key: bubble.id, bubble });
    }
    return down.reverse();
  }, [days, thread.reachedStart, thread.messages.length]);

  const openPartner = partnerOpens ? () => setSheet('partner') : null;
  const openMe = room.me === null ? null : () => setSheet('me');
  const menuOf = (fromSheet: boolean): MenuItem[] => [
    ...(fromSheet || openMe === null ? [] : [{ label: '내 프로필', icon: 'people' as const, onPress: openMe }]),
    {
      label: '신고',
      icon: 'flag' as const,
      onPress: () => {
        setSheet(null);
        setOpened('report');
      },
    },
    ...(closed
      ? []
      : [
          {
            label: '차단',
            icon: 'block' as const,
            danger: true,
            onPress: () => {
              setSheet(null);
              setOpened('block');
            },
          },
        ]),
  ];

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={styles.screen} behavior="padding">
        <View style={styles.header}>
          <Pressable
            accessibilityRole="link"
            accessibilityLabel="대화방 목록"
            style={styles.iconButton}
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/me/chat' as never))}
          >
            <ChatIcon name="back" color={COLOR.foreground} />
          </Pressable>
          <Pressable
            accessibilityRole={partnerOpens ? 'button' : undefined}
            accessibilityLabel={partnerOpens ? partnerSheetName(room.name) : undefined}
            disabled={!partnerOpens}
            onPress={openPartner ?? undefined}
            style={styles.who}
          >
            <Avatar nickname={room.name} size={44} tone={theirTone} dim={closed} userId={room.partnerUserId} hasPhoto={room.partnerHasPhoto} focus={room.partnerPhotoFocus} />
            <View style={styles.whoWords}>
              <View style={styles.nameLine}>
                <Text accessibilityRole="header" numberOfLines={1} style={styles.heading}>
                  {room.heading}
                </Text>
                {partnerOpens && <ChatIcon name="chevron" color={COLOR.secondary} size={16} />}
              </View>
              {room.activity !== null && <Activity band={room.activity} />}
            </View>
          </Pressable>
          {partnerOpens && <CompatChip compat={room.compat ?? { kind: 'quiet' }} matchId={room.matchId} tone={room.tones === null ? null : theirTone} />}
          {room.partnerUserId !== null && (
            <AnchoredMenu label={openMe === null ? '신고 · 차단' : '메뉴'} items={menuOf(false)}>
              <ChatIcon name="more" color={COLOR.foreground} />
            </AnchoredMenu>
          )}
        </View>

        <View style={styles.logBox}>
          <FlatList
            ref={list}
            inverted
            data={rows}
            keyExtractor={(row) => row.key}
            accessibilityLabel="메시지"
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            contentContainerStyle={styles.log}
            onScroll={onScroll}
            scrollEventThrottle={100}
            maintainVisibleContentPosition={{ minIndexForVisible: 1, autoscrollToTopThreshold: NEAR_BOTTOM_PX }}
            viewabilityConfig={SEEN_CONFIG}
            onViewableItemsChanged={onViewable.current}
            renderItem={({ item }) => {
              switch (item.kind) {
                case 'day':
                  return (
                    <View style={styles.dayRow}>
                      <Text style={styles.day}>{item.label}</Text>
                    </View>
                  );
                case 'older':
                  return (
                    <Pressable accessibilityRole="button" disabled={thread.loadingOlder} onPress={thread.loadOlder} style={styles.older}>
                      <Text style={styles.olderText}>{thread.loadingOlder ? OLDER_LOADING_LABEL : OLDER_MESSAGES_LABEL}</Text>
                    </Pressable>
                  );
                case 'start':
                  return (
                    <RoomStart
                      room={room}
                      quiet={thread.messages.length === 0 && pending.length === 0}
                      onMe={openMe}
                      onPartner={openPartner}
                    />
                  );
                case 'bubble': {
                  const one = pendingById.get(item.bubble.id);
                  return (
                    <BubbleRow
                      bubble={item.bubble}
                      room={room}
                      sending={one?.state ?? null}
                      /* 닫힌 방에서 서버에 간 적 없는 말은 다시 보낼 곳이 없다 — 남았을 수 있는 말에는 「삭제」가 없다(웹과 같다) */
                      onRetry={closed && one?.mightBeKept !== true ? null : () => outbox.retry(item.bubble.id)}
                      onDrop={one !== undefined && droppable(one) ? () => outbox.drop(item.bubble.id) : null}
                      onFace={openPartner}
                    />
                  );
                }
              }
            }}
          />
          {fresh && (
            <Pressable accessibilityRole="button" onPress={toBottom} style={styles.fresh}>
              <View style={styles.down}>
                <ChatIcon name="arrow" color={COLOR.foreground} size={16} />
              </View>
              <Text style={styles.freshText}>{NEW_MESSAGES_LABEL}</Text>
            </Pressable>
          )}
        </View>

        <View style={styles.foot}>
          {closed ? (
            <View accessibilityRole="text" style={styles.closed}>
              <ChatIcon name="lock" color={COLOR.secondary} size={16} />
              <Text style={styles.closedText}>{room.notice}</Text>
            </View>
          ) : (
            <Composer
              matchId={room.matchId}
              said={outbox.said}
              onSend={(body) => {
                outbox.send(body);
                toBottom();
              }}
            />
          )}
        </View>
      </KeyboardAvoidingView>

      {sheet === 'partner' && (
        <ProfileSheet
          nickname={room.name}
          intro={room.partnerIntro}
          tone={theirTone}
          photos={room.partnerUserId === null ? null : { userId: room.partnerUserId, focuses: room.partnerPhotoFocuses }}
          onClose={() => setSheet(null)}
          toMatch={<CompatRow compat={room.compat ?? { kind: 'quiet' }} matchId={room.matchId} />}
          menu={
            <AnchoredMenu label="신고 · 차단" items={menuOf(true)}>
              <ChatIcon name="more" color={COLOR.foreground} />
            </AnchoredMenu>
          }
        />
      )}
      {sheet === 'me' && room.me !== null && (
        <ProfileSheet
          nickname={room.me.nickname}
          intro={room.me.intro}
          tone={myTone}
          photos={{ userId: room.me.userId, focuses: room.me.photoFocuses }}
          onClose={() => setSheet(null)}
          footer={
            <Pressable
              accessibilityRole="link"
              style={styles.edit}
              onPress={() => {
                setSheet(null);
                router.push('/me/profile' as never);
              }}
            >
              <Text style={styles.editText}>{MY_PROFILE_EDIT_LABEL}</Text>
            </Pressable>
          }
        />
      )}
      {opened === 'report' && room.partnerUserId !== null && (
        <ReportDialog
          userId={room.partnerUserId}
          nickname={room.name}
          messages={reportable}
          onClose={() => setOpened(null)}
          onBlock={closed ? null : () => setOpened('block')}
        />
      )}
      {opened === 'block' && room.partnerUserId !== null && (
        <BlockDialog userId={room.partnerUserId} nickname={room.name} onClose={() => setOpened(null)} onBlocked={onChanged} />
      )}
    </SafeAreaView>
  );
}

function Activity({ band }: { band: ActivityBand }) {
  /* 점은 꾸밈이다 — 뜻은 곁의 글자가 든다 */
  const dot = band === 'now' ? styles.dotNow : band === 'day' ? styles.dotDay : styles.dotEarlier;
  return (
    <View style={styles.activity}>
      <View style={[styles.dot, dot]} />
      <Text style={styles.activityText}>{activityText(band)}</Text>
    </View>
  );
}

function RoomStart({ room, quiet, onMe, onPartner }: { room: RoomView; quiet: boolean; onMe: (() => void) | null; onPartner: (() => void) | null }) {
  /* 막 열린 방은 무엇을 하면 되는지와 어디서 끊는지를 말한다(대장 28). 열린 방 · 상대가 있는 방에만 선다 */
  const hello = quiet && room.partnerUserId !== null && room.notice === null && (
    <View style={styles.hello}>
      <Text style={styles.helloTitle}>{ROOM_FIRST_HELLO}</Text>
      <Text style={styles.helloNote}>{ROOM_SAFETY_NOTE}</Text>
    </View>
  );
  if (room.tones === null) {
    return (
      <View style={styles.startPlain}>
        <Avatar nickname={room.name} size={72} tone={null} userId={room.partnerUserId} hasPhoto={room.partnerHasPhoto} focus={room.partnerPhotoFocus} />
        <Text style={styles.startName}>{room.heading}</Text>
        {hello}
      </View>
    );
  }
  return (
    <View style={styles.start}>
      <View style={styles.sides}>
        <StartSide label="나" stem={room.tones.mine.stem} onOpen={onMe} openName="내 프로필" />
        <StartSide label={room.name} stem={room.tones.theirs.stem} onOpen={onPartner} openName={partnerSheetName(room.name)} />
      </View>
      {hello}
    </View>
  );
}

/** 첫머리 카드의 한 사람 — 색만으로 말하지 않게 그림 이름이 함께 선다. 그림은 그 천간의 오행 상징이다 */
function StartSide({ label, stem, onOpen, openName }: { label: string; stem: Stem; onOpen: (() => void) | null; openName: string }) {
  const element: Element = STEM_INFO[stem].element;
  const scale = ELEMENT_TONE[element];
  return (
    <Pressable
      accessibilityRole={onOpen === null ? undefined : 'button'}
      accessibilityLabel={onOpen === null ? undefined : openName}
      disabled={onOpen === null}
      onPress={onOpen ?? undefined}
      style={[styles.side, { backgroundColor: scale.soft }]}
    >
      <View style={styles.stemChip}>
        <ElementSymbol element={element} size={20} />
        <Text style={[styles.stemName, { color: scale.ink }]}>{STEM_PICTURE[stem]}</Text>
      </View>
      <View style={styles.nameLine}>
        <Text numberOfLines={1} style={styles.sideName}>
          {label}
        </Text>
        {onOpen !== null && <ChatIcon name="chevron" color={COLOR.secondary} size={16} />}
      </View>
    </Pressable>
  );
}

function BubbleRow({
  bubble,
  room,
  sending,
  onRetry,
  onDrop,
  onFace,
}: {
  bubble: Bubble;
  room: RoomView;
  sending: Pending['state'] | null;
  onRetry: (() => void) | null;
  onDrop: (() => void) | null;
  onFace: (() => void) | null;
}) {
  const mine = bubble.mine;
  const tones = room.tones;
  const face = mine
    ? tones === null
      ? { backgroundColor: COLOR.accent }
      : { backgroundColor: ELEMENT_TONE[tones.mine.element].ink }
    : tones === null
      ? { backgroundColor: COLOR.noneSoft, borderWidth: 1, borderColor: COLOR.border }
      : { backgroundColor: ELEMENT_TONE[tones.theirs.element].soft };
  const ink = mine ? (tones === null ? COLOR.onAccent : ELEMENT_TONE[tones.mine.element].soft) : COLOR.foreground;
  /* 묶음의 첫 말은 머리 쪽 모서리만 뾰족하다 */
  const corner = bubble.first ? (mine ? styles.cornerMine : styles.cornerTheirs) : null;

  const line = (
    <View style={[styles.line, mine && styles.lineMine]}>
      <View style={[styles.bubble, face, corner]}>
        <Text style={[styles.body, { color: ink }]}>
          {bodyPartsOf(bubble.body).map((part, index) =>
            part.kind === 'text' ? (
              part.text
            ) : (
              <Text key={index} accessibilityRole="link" onPress={() => void WebBrowser.openBrowserAsync(part.href)} style={styles.link}>
                {part.text}
              </Text>
            ),
          )}
        </Text>
      </View>
      {sending === 'failed' ? (
        <SendFailedMenu onRetry={onRetry} onDrop={onDrop} />
      ) : (
        bubble.last && sending !== 'sending' && <Text style={styles.time}>{bubble.time}</Text>
      )}
    </View>
  );

  return (
    <View style={[styles.bubbleRow, mine ? styles.rowMine : styles.rowTheirs, bubble.first && styles.rowFirst]}>
      {!mine &&
        (bubble.first ? (
          <Pressable
            accessibilityRole={onFace === null ? undefined : 'button'}
            accessibilityLabel={onFace === null ? undefined : partnerSheetName(room.name)}
            disabled={onFace === null}
            onPress={onFace ?? undefined}
            style={styles.face}
          >
            <Avatar nickname={room.name} size={36} tone={tones?.theirs.element ?? null} userId={room.partnerUserId} hasPhoto={room.partnerHasPhoto} focus={room.partnerPhotoFocus} />
          </Pressable>
        ) : (
          <View style={styles.faceGap} />
        ))}
      {mine ? (
        line
      ) : (
        <View style={styles.theirs}>
          {bubble.first && (
            <Text numberOfLines={1} style={styles.speaker}>
              {room.name}
            </Text>
          )}
          {line}
        </View>
      )}
    </View>
  );
}

/** 못 보낸 말 곁의 빨간 경고 — 누르면 「다시 보내기」 · 「삭제」(카카오톡의 방식, 대장 37). 말풍선은 칸의 아래쪽에 서므로 판은 위로 연다 */
function SendFailedMenu({ onRetry, onDrop }: { onRetry: (() => void) | null; onDrop: (() => void) | null }) {
  const items: MenuItem[] = [
    ...(onRetry === null ? [] : [{ label: SEND_RETRY_LABEL, icon: 'send' as const, onPress: onRetry }]),
    ...(onDrop === null ? [] : [{ label: SEND_DROP_LABEL, icon: 'close' as const, danger: true, onPress: onDrop }]),
  ];
  return (
    <AnchoredMenu label={SEND_FAILED_LABEL} items={items} above>
      <ChatIcon name="alert" color={COLOR.danger} />
    </AnchoredMenu>
  );
}

/**
 * 입력 칸 — **누르는 순간 칸을 비우고 방에 맡긴다.** 보내는 동안에도 잠그지 않는다. Enter 는 줄바꿈이고 보내기는 단추로만 한다(손가락으로 쓰는 기기, 카카오톡과 같다).
 * 거절은 누른 뒤에 말한다 — 너무 긴 글은 여기서 막고, 서버가 문장으로 거절한 것은 방이 `said` 로 넘긴다.
 */
function Composer({ matchId, onSend, said }: { matchId: string; onSend: (body: string) => void; said: string | null }) {
  const [body, setBody] = useState(() => readDraft(draftStore, matchId));
  const [tooLong, setTooLong] = useState(false);
  const failure = tooLong ? TOO_LONG_TEXT : said;

  const change = (next: string) => {
    setBody(next);
    writeDraft(draftStore, matchId, next);
  };

  const send = () => {
    const shape = checkBody(body);
    if (shape === 'blank') return;
    if (shape === 'too_long') {
      setTooLong(true);
      return;
    }
    setTooLong(false);
    change('');
    onSend(body);
  };

  return (
    <View style={styles.composer}>
      <View style={styles.pill}>
        <TextInput
          accessibilityLabel="메시지"
          multiline
          value={body}
          onChangeText={change}
          placeholder={CHAT_INPUT_PLACEHOLDER}
          placeholderTextColor={COLOR.secondary}
          maxLength={CHAT_POLICY.maxLength}
          style={styles.input}
        />
        <Pressable accessibilityRole="button" accessibilityLabel={CHAT_SEND_LABEL} onPress={send} style={styles.send}>
          <ChatIcon name="send" color={COLOR.onAccent} size={18} />
        </Pressable>
      </View>
      {(body.length >= COUNT_FROM || failure !== null) && (
        <View style={styles.composerFoot}>
          <Text accessibilityRole={failure === null ? undefined : 'alert'} style={styles.composerFailure}>
            {failure}
          </Text>
          {body.length >= COUNT_FROM && (
            <Text style={styles.count}>
              {body.length.toLocaleString('ko-KR')}/{CHAT_POLICY.maxLength.toLocaleString('ko-KR')}
            </Text>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLOR.surface },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: COLOR.border },
  iconButton: { minHeight: CONTROL, minWidth: CONTROL, alignItems: 'center', justifyContent: 'center' },
  who: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 8 },
  whoWords: { flex: 1, minWidth: 0 },
  nameLine: { flexDirection: 'row', alignItems: 'center', gap: 2, minWidth: 0 },
  heading: { flexShrink: 1, fontSize: TYPE.lead, lineHeight: 24, fontFamily: FONT.bold, color: COLOR.foreground },
  activity: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  activityText: { fontSize: TYPE.fine, fontFamily: FONT.medium, color: COLOR.secondary },
  dot: { width: 8, height: 8, borderRadius: 4 },
  dotNow: { backgroundColor: ELEMENT_TONE.木.ink },
  dotDay: { backgroundColor: ELEMENT_TONE.木.mid },
  dotEarlier: { borderWidth: 1, borderColor: COLOR.borderStrong },
  logBox: { flex: 1, minHeight: 0 },
  log: { paddingHorizontal: 12, paddingVertical: 20, gap: 4 },
  dayRow: { alignItems: 'center', marginTop: 16, marginBottom: 8 },
  day: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: RADIUS.pill, overflow: 'hidden', backgroundColor: COLOR.surfaceSoft, fontSize: TYPE.fine, fontFamily: FONT.medium, color: COLOR.secondary },
  older: { alignSelf: 'center', minHeight: CONTROL, justifyContent: 'center', paddingHorizontal: 16, borderRadius: RADIUS.pill, borderWidth: 1, borderColor: COLOR.borderStrong },
  olderText: { fontSize: TYPE.sm, fontFamily: FONT.bold, color: COLOR.foreground },
  fresh: {
    position: 'absolute',
    bottom: 12,
    alignSelf: 'center',
    minHeight: CONTROL,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    borderColor: COLOR.borderStrong,
    backgroundColor: COLOR.surfaceRaised,
  },
  down: { transform: [{ rotate: '90deg' }] },
  freshText: { fontSize: TYPE.sm, fontFamily: FONT.bold, color: COLOR.foreground },
  foot: { padding: 10, borderTopWidth: 1, borderTopColor: COLOR.border },
  closed: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 12, borderRadius: RADIUS.panel, backgroundColor: COLOR.surfaceSoft },
  closedText: { flex: 1, fontSize: TYPE.sm, lineHeight: 20, fontFamily: FONT.medium, color: COLOR.secondary },
  composer: { gap: 6 },
  pill: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, padding: 6, paddingLeft: 16, borderRadius: RADIUS.panel, borderWidth: 1, borderColor: COLOR.border, backgroundColor: COLOR.surfaceSoft },
  input: { flex: 1, minHeight: CONTROL, maxHeight: 144, paddingTop: 11, paddingBottom: 11, fontSize: TYPE.field, lineHeight: 22, fontFamily: FONT.medium, color: COLOR.foreground },
  send: { width: CONTROL, height: CONTROL, alignItems: 'center', justifyContent: 'center', borderRadius: RADIUS.pill, backgroundColor: COLOR.accent },
  composerFoot: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, paddingHorizontal: 16 },
  composerFailure: { flex: 1, fontSize: TYPE.small, lineHeight: 19, fontFamily: FONT.medium, color: COLOR.danger },
  count: { fontSize: TYPE.small, fontFamily: FONT.medium, color: COLOR.secondary },
  bubbleRow: { flexDirection: 'row', gap: 8, minWidth: 0 },
  rowMine: { justifyContent: 'flex-end' },
  rowTheirs: { justifyContent: 'flex-start' },
  rowFirst: { marginTop: 8 },
  face: { alignSelf: 'flex-start' },
  faceGap: { width: 36 },
  theirs: { flex: 1, minWidth: 0, gap: 4 },
  speaker: { paddingHorizontal: 4, fontSize: TYPE.fine, fontFamily: FONT.medium, color: COLOR.secondary },
  line: { flexDirection: 'row', alignItems: 'flex-end', gap: 6, maxWidth: '80%', minWidth: 0 },
  lineMine: { flexDirection: 'row-reverse' },
  bubble: { flexShrink: 1, paddingHorizontal: 16, paddingVertical: 10, borderRadius: RADIUS.panel },
  cornerMine: { borderTopRightRadius: 6 },
  cornerTheirs: { borderTopLeftRadius: 6 },
  body: { fontSize: TYPE.body, lineHeight: 23, fontFamily: FONT.medium },
  link: { textDecorationLine: 'underline' },
  time: { flexShrink: 0, paddingBottom: 2, fontSize: TYPE.fine, fontFamily: FONT.medium, color: COLOR.secondary },
  start: { width: '100%', maxWidth: 448, alignSelf: 'center', gap: 12, paddingTop: 8, alignItems: 'center' },
  startPlain: { alignItems: 'center', gap: 12, paddingTop: 16, paddingBottom: 8 },
  startName: { fontSize: TYPE.lead, fontFamily: FONT.bold, color: COLOR.foreground },
  sides: { flexDirection: 'row', gap: 8, width: '100%' },
  side: { flex: 1, minWidth: 0, gap: 8, padding: 16, borderRadius: RADIUS.panel },
  stemChip: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 4, paddingLeft: 4, paddingRight: 10, borderRadius: RADIUS.pill, backgroundColor: 'rgba(255, 253, 249, 0.72)' },
  stemName: { fontSize: TYPE.fine, fontFamily: FONT.bold },
  sideName: { flexShrink: 1, fontSize: TYPE.lead, lineHeight: 24, fontFamily: FONT.bold, color: COLOR.foreground },
  hello: { maxWidth: 384, gap: 4, alignItems: 'center' },
  helloTitle: { fontSize: TYPE.body, lineHeight: 24, fontFamily: FONT.bold, color: COLOR.foreground, textAlign: 'center' },
  helloNote: { fontSize: TYPE.small, lineHeight: 20, fontFamily: FONT.medium, color: COLOR.secondary, textAlign: 'center' },
  edit: { minHeight: CONTROL, alignItems: 'center', justifyContent: 'center', borderRadius: RADIUS.pill, borderWidth: 1, borderColor: COLOR.borderStrong },
  editText: { fontSize: TYPE.sm, fontFamily: FONT.bold, color: COLOR.foreground },
});
