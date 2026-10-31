import { Image } from 'expo-image';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { PanResponder, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { PHOTO_ADD, PHOTO_UPLOADS_PAUSED } from '@account/copy';
import { FOCUS_CENTER, PHOTO_MAX_COUNT, PHOTO_NOTE, PHOTO_REMOVED, PHOTO_REMOVE_CONFIRM, PHOTO_REMOVE_NOTE, PHOTO_REMOVE_TITLE, movedPhotos, type PhotoFocus, type PhotoUploadMode } from '@profile';

import { Paper } from '@/ui/surfaces';
import { ConfirmDialog } from '@/ui/confirm-dialog';
import { COLOR, FONT, RADIUS, TYPE } from '@/ui/tokens';
import { settled } from '@/ui/settled';

import { FailureLine, useDoneNote } from './parts';
import { PHOTO_FRAME_TITLE, PhotoFramer, contentPositionOf } from './photo-framer';
import { PhotoViewer, type PhotoChoice } from './photo-viewer';
import { UNREADABLE_PHOTO, addPhoto, movePhoto, photoSource, pickPhotos, removePhoto, replacePhoto, setPhotoFocus, type MyPhoto } from './photos';

const PHOTO_SECTION_TITLE = '프로필 사진';
const PHOTO_SAVES_ITSELF = '사진은 바로 저장돼요';
const PHOTO_REORDER_HINT = '사진을 길게 눌러 순서를 바꿀 수 있어요';
const FOCUS_SAVED = '위치를 저장했어요';

const GAP = 8;
const LIFT_MS = 300;
const MOVE_SLOP = 8;

/** 칸의 자리 — 첫 칸은 두 칸 두 줄이다. 끌기의 놓는 자리도 이 셈이다 */
function slotRect(position: number, width: number) {
  const cell = (width - GAP * 2) / 3;
  const tall = (cell * 5) / 4;
  if (position === 1) return { left: 0, top: 0, width: cell * 2 + GAP, height: tall * 2 + GAP };
  if (position <= 3) return { left: (cell + GAP) * 2, top: (tall + GAP) * (position - 2), width: cell, height: tall };
  return { left: (cell + GAP) * (position - 4), top: (tall + GAP) * 2, width: cell, height: tall };
}

function slotAt(x: number, y: number, width: number, total: number): number | null {
  for (let position = 1; position <= total; position += 1) {
    const box = slotRect(position, width);
    if (x >= box.left && x <= box.left + box.width && y >= box.top && y <= box.top + box.height) return position;
  }
  return null;
}

type Asset = { uri: string; width: number; height: number };
type Framing = { source: string; focus: PhotoFocus; settle: (focus: PhotoFocus | null) => void };
type Lift = { from: number; dx: number; dy: number; over: number | null };

/**
 * 사진 여섯 칸 — 웹 `app/me/profile/photo-grid.tsx` 와 같은 꼴과 약속이다. 첫 칸이 대표고, 고르면 바로 올라가며(한 장이면 위치 조정을 지나서),
 * 지우기는 묻고 나서 한다(ADR 0205). 칸을 누르면 크게 보고, 길게 눌러 끌면 옮겨 앉는다 — 사이의 장이 한 칸씩 밀린다.
 *
 * 쓰기마다 서버 목록을 다시 받는다(`reload`) — 자리와 판본은 늘 서버가 준 값으로 보낸다. 다른 기기가 목록을 바꿨으면 DB 가 거절하고 다시 받은 목록이 선다.
 */
export function PhotoGrid({
  userId,
  photos,
  uploads,
  reload,
  onLifting,
}: {
  userId: string | null;
  photos: readonly MyPhoto[];
  uploads: PhotoUploadMode;
  reload: () => Promise<void>;
  /** 끄는 동안 바깥 스크롤을 멈춘다 */
  onLifting: (lifting: boolean) => void;
}) {
  const paused = uploads === 'paused';
  const [order, setOrder] = useState(photos);
  useEffect(() => setOrder(photos), [photos]);
  const total = order.length;

  const [failure, setFailure] = useState<string | null>(null);
  const done = useDoneNote();
  const [sending, setSending] = useState(false);
  /** 올라가는 중인 기기의 사진 — 서버 목록에 서면 걷힌다 */
  const [waiting, setWaiting] = useState<{ key: number; uri: string; focus: PhotoFocus }[]>([]);
  const nextKey = useRef(0);
  const [covering, setCovering] = useState<{ version: number; uri: string; focus: PhotoFocus } | null>(null);
  const [placed, setPlaced] = useState<ReadonlyMap<number, PhotoFocus>>(() => new Map());
  const [framing, setFraming] = useState<Framing | null>(null);
  const [viewing, setViewing] = useState<number | null>(null);
  const [asking, setAsking] = useState<MyPhoto | null>(null);
  const [askFailure, setAskFailure] = useState<string | null>(null);
  const [removing, setRemoving] = useState(false);
  const [width, setWidth] = useState(0);
  const [lift, setLift] = useState<Lift | null>(null);

  const busy = sending || removing;
  const focusOfPhoto = (photo: MyPhoto) => placed.get(photo.version) ?? photo.focus;

  const failed = (message: string) => {
    setFailure(message);
    void reload();
  };
  const begin = () => {
    setFailure(null);
    done.clear();
  };

  const frame = (source: string, focus: PhotoFocus) =>
    new Promise<PhotoFocus | null>((resolve) => {
      setFraming({
        source,
        focus,
        settle: (chosen) => {
          setFraming(null);
          resolve(chosen);
        },
      });
    });

  const pick = async () => {
    if (busy) return;
    begin();
    let assets: Asset[];
    try {
      assets = await pickPhotos(PHOTO_MAX_COUNT - total);
    } catch {
      setFailure(UNREADABLE_PHOTO);
      return;
    }
    if (assets.length === 0) return;
    const batch: { key: number; asset: Asset; focus: PhotoFocus }[] = [];
    for (const asset of assets) {
      const focus = assets.length === 1 ? await frame(asset.uri, FOCUS_CENTER) : FOCUS_CENTER;
      if (focus !== null) batch.push({ key: nextKey.current++, asset, focus });
    }
    if (batch.length === 0) return;
    setWaiting(batch.map(({ key, asset, focus }) => ({ key, uri: asset.uri, focus })));
    setSending(true);
    let sent = 0;
    for (const { key, asset, focus } of batch) {
      let message: string | null = null;
      try {
        const result = await addPhoto(asset, focus, uploads);
        if (!result.ok) message = result.message;
      } catch {
        message = UNREADABLE_PHOTO;
      }
      if (message !== null) {
        failed(message);
        break;
      }
      sent += 1;
      await reload();
      setWaiting((was) => was.filter((one) => one.key !== key));
      done.say(sent === 1 ? '사진을 저장했어요' : `사진 ${sent}장을 저장했어요`);
    }
    setWaiting([]);
    setSending(false);
  };

  const replace = async (photo: MyPhoto) => {
    if (busy) return;
    begin();
    let asset: Asset | undefined;
    try {
      [asset] = await pickPhotos(1);
    } catch {
      setFailure(UNREADABLE_PHOTO);
      return;
    }
    if (asset === undefined) return;
    const focus = await frame(asset.uri, FOCUS_CENTER);
    if (focus === null) return;
    setCovering({ version: photo.version, uri: asset.uri, focus });
    setSending(true);
    let message: string | null = null;
    try {
      const result = await replacePhoto(photo, asset, focus, uploads);
      if (!result.ok) message = result.message;
    } catch {
      message = UNREADABLE_PHOTO;
    }
    if (message !== null) failed(message);
    else {
      await reload();
      done.say('사진을 변경했어요');
    }
    setCovering(null);
    setSending(false);
  };

  const adjust = async (photo: MyPhoto) => {
    if (busy) return;
    begin();
    const source = await photoSource(photo, userId ?? undefined);
    if (source === null) return;
    const chosen = await frame(source, focusOfPhoto(photo));
    if (chosen === null) return;
    setPlaced((was) => new Map(was).set(photo.version, chosen));
    setSending(true);
    const result = await setPhotoFocus(photo, chosen);
    if (result.ok) {
      done.say(FOCUS_SAVED);
      await reload();
    } else {
      setPlaced((was) => {
        const next = new Map(was);
        next.delete(photo.version);
        return next;
      });
      failed(result.message);
    }
    setSending(false);
  };

  const move = async (from: number, to: number) => {
    const photo = order[from - 1];
    if (busy || photo === undefined || from === to) return;
    begin();
    setOrder((now) => movedPhotos(now, from, to));
    setSending(true);
    /* 서버의 자리로 보낸다 — 칸 번호가 아니다. 다시 받은 목록이 칸을 잇는다 */
    const serverTo = photos[to - 1]?.position ?? to;
    const result = await movePhoto(photo, serverTo);
    if (result.ok) await reload();
    else failed(result.message);
    setSending(false);
  };

  const remove = async () => {
    if (asking === null) return;
    setAskFailure(null);
    setRemoving(true);
    const result = await removePhoto(asking);
    if (result.ok) {
      setAsking(null);
      done.say(PHOTO_REMOVED);
      await reload();
    } else {
      setAskFailure(result.message);
      void reload();
    }
    setRemoving(false);
  };

  const ask = (photo: MyPhoto) => {
    if (busy) return;
    begin();
    setAskFailure(null);
    setAsking(photo);
  };

  const choicesFor = (photo: MyPhoto, position: number): PhotoChoice[] => [
    ...(position > 1 ? [{ label: '대표로 설정', run: () => void move(position, 1) }] : []),
    ...(paused ? [] : [{ label: '사진 변경', run: () => void replace(photo) }]),
    { label: PHOTO_FRAME_TITLE, run: () => void adjust(photo) },
    { label: '삭제', tone: 'danger' as const, run: () => ask(photo) },
  ];

  const slot = (position: number) => {
    const box = slotRect(position, width);
    const photo = order[position - 1];
    if (photo !== undefined) {
      const lifting = lift?.from === position;
      return (
        <View
          key={photo.version}
          style={[
            styles.slot,
            box,
            lifting && lift !== null && { zIndex: 5, transform: [{ translateX: lift.dx }, { translateY: lift.dy }, { scale: 1.05 }] },
            lift !== null && !lifting && lift.over === position && styles.target,
          ]}
        >
          <Liftable
            label={`사진 ${position} / ${total}, 길게 눌러 옮기기`}
            position={position}
            total={total}
            width={width}
            busy={busy}
            onOpen={() => setViewing(position)}
            onLift={setLift}
            onLifting={onLifting}
            onDrop={(to) => void move(position, to)}
          >
            <PhotoFace photo={photo} focus={focusOfPhoto(photo)} userId={userId} cover={covering?.version === photo.version ? covering : null} />
            {position === 1 && <Text style={styles.lead}>대표</Text>}
          </Liftable>
          <Pressable accessibilityRole="button" accessibilityLabel="사진 지우기" disabled={busy} onPress={() => ask(photo)} style={[styles.remove, busy && styles.off]}>
            <View style={styles.removeFace}>
              <Svg width={12} height={12} viewBox="0 0 12 12">
                <Path d="M2 2 L10 10 M10 2 L2 10" stroke="#fff" strokeWidth={1.6} strokeLinecap="round" />
              </Svg>
            </View>
          </Pressable>
        </View>
      );
    }
    const upload = waiting[position - total - 1];
    if (upload !== undefined) {
      return (
        <View key={`upload-${upload.key}`} style={[styles.slot, box]}>
          <Image source={{ uri: upload.uri }} style={StyleSheet.absoluteFill} contentFit="cover" contentPosition={contentPositionOf(upload.focus)} />
          <Saving />
        </View>
      );
    }
    if (paused) return <View key={`rest-${position}`} style={[styles.slot, box, styles.empty, styles.resting]} />;
    const first = position === total + waiting.length + 1;
    const bare = position === 1 && total === 0 && waiting.length === 0;
    return (
      <Pressable
        key={`empty-${position}`}
        accessibilityRole="button"
        accessibilityLabel={first ? PHOTO_ADD : undefined}
        accessibilityElementsHidden={!first}
        importantForAccessibility={first ? 'yes' : 'no-hide-descendants'}
        disabled={busy}
        onPress={() => void pick()}
        style={[styles.slot, box, styles.empty, busy && styles.off]}
      >
        <View style={[styles.plus, first ? styles.plusNext : styles.plusRest, bare && styles.plusBig]}>
          <Svg width={bare ? 24 : 18} height={bare ? 24 : 18} viewBox="0 0 24 24">
            <Path d="M12 5 V19 M5 12 H19" stroke={first ? COLOR.surface : COLOR.secondary} strokeWidth={2} strokeLinecap="round" />
          </Svg>
        </View>
        {bare && <Text style={styles.addText}>{PHOTO_ADD}</Text>}
      </Pressable>
    );
  };

  const status = done.note !== '' ? done.note : sending ? '사진 저장 중…' : '';
  const gridHeight = width === 0 ? 0 : slotRect(6, width).top + slotRect(6, width).height;

  return (
    <Paper style={styles.panel}>
      <View style={styles.head}>
        <View style={styles.headRow}>
          <Text style={styles.title}>{PHOTO_SECTION_TITLE}</Text>
          <Text style={styles.count}>
            {total}/{PHOTO_MAX_COUNT}
          </Text>
        </View>
        <Text style={styles.line}>{paused ? PHOTO_UPLOADS_PAUSED : PHOTO_SAVES_ITSELF}</Text>
      </View>
      <View style={{ height: gridHeight }} onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
        {width > 0 && Array.from({ length: PHOTO_MAX_COUNT }, (_, index) => slot(index + 1))}
      </View>
      {total >= 2 && <Text style={styles.line}>{PHOTO_REORDER_HINT}</Text>}
      <Text accessibilityLiveRegion="polite" style={styles.status}>
        {status}
      </Text>
      <Text style={styles.line}>{PHOTO_NOTE}</Text>
      {failure !== null && <FailureLine>{failure}</FailureLine>}

      <PhotoViewer userId={userId} photos={order} at={viewing} onAt={setViewing} onClose={() => setViewing(null)} choicesFor={choicesFor} />
      <PhotoFramer
        source={framing?.source ?? null}
        focus={framing?.focus ?? FOCUS_CENTER}
        onFocus={(focus) => setFraming((was) => (was === null ? was : { ...was, focus }))}
        onSave={() => framing?.settle(framing.focus)}
        onCancel={() => framing?.settle(null)}
      />
      <ConfirmDialog
        open={asking !== null}
        onClose={() => {
          setAsking(null);
          setAskFailure(null);
        }}
        title={PHOTO_REMOVE_TITLE}
        confirmLabel={removing ? '삭제 중…' : PHOTO_REMOVE_CONFIRM}
        onConfirm={() => void remove()}
        danger
        busy={removing}
        failure={askFailure}
        irreversible={PHOTO_REMOVE_NOTE}
      />
    </Paper>
  );
}

/**
 * 사진 칸의 손잡이 — 누름 · 길게 누름 · 끌기를 **한 응답자가 다 든다.** 누른 채 멈추면 들리고, 들린 뒤의 움직임은 바깥 스크롤에 안 넘긴다.
 * 들리기 전에 움직이면 들지 않아 스크롤이 가져간다. 움직이지 않고 떼면 크게 본다.
 */
function Liftable({
  label,
  children,
  ...props
}: {
  label: string;
  children: ReactNode;
  position: number;
  total: number;
  width: number;
  busy: boolean;
  onOpen: () => void;
  onLift: (lift: Lift | null) => void;
  onLifting: (lifting: boolean) => void;
  onDrop: (to: number) => void;
}) {
  const live = useRef(props);
  live.current = props;
  const press = useRef({ timer: null as ReturnType<typeof setTimeout> | null, lifted: false, moved: false, over: null as number | null });

  const finish = (released: boolean) => {
    const now = press.current;
    if (now.timer !== null) clearTimeout(now.timer);
    now.timer = null;
    const { lifted, moved, over } = now;
    now.lifted = false;
    if (lifted) {
      live.current.onLift(null);
      live.current.onLifting(false);
      if (released && over !== null && over !== live.current.position) live.current.onDrop(over);
    } else if (released && !moved) {
      live.current.onOpen();
    }
  };

  const responder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !live.current.busy,
      onPanResponderTerminationRequest: () => !press.current.lifted,
      onPanResponderGrant: () => {
        const now = press.current;
        now.moved = false;
        now.lifted = false;
        now.over = null;
        now.timer = setTimeout(() => {
          now.timer = null;
          if (now.moved || live.current.total < 2) return;
          now.lifted = true;
          now.over = live.current.position;
          live.current.onLift({ from: live.current.position, dx: 0, dy: 0, over: now.over });
          live.current.onLifting(true);
        }, LIFT_MS);
      },
      onPanResponderMove: (_, gesture) => {
        const now = press.current;
        if (!now.lifted) {
          if (Math.hypot(gesture.dx, gesture.dy) > MOVE_SLOP) now.moved = true;
          return;
        }
        const { position, width, total } = live.current;
        const box = slotRect(position, width);
        now.over = slotAt(box.left + box.width / 2 + gesture.dx, box.top + box.height / 2 + gesture.dy, width, total);
        live.current.onLift({ from: position, dx: gesture.dx, dy: gesture.dy, over: now.over });
      },
      onPanResponderRelease: () => finish(true),
      onPanResponderTerminate: () => finish(false),
    }),
  ).current;

  return (
    <View
      {...responder.panHandlers}
      accessible
      accessibilityRole="button"
      accessibilityLabel={label}
      onAccessibilityTap={() => live.current.onOpen()}
      style={StyleSheet.absoluteFill}
    >
      {children}
    </View>
  );
}

function Saving() {
  return (
    <View style={styles.saving}>
      <Text style={styles.savingText}>저장 중…</Text>
    </View>
  );
}

/** 사진 한 칸의 그림 — 바이트는 칸마다 따로 받는다. 저장소에 사는 장은 앱이 못 읽어 빈 면으로 선다 */
function PhotoFace({ photo, focus, userId, cover }: { photo: MyPhoto; focus: PhotoFocus; userId: string | null; cover: { uri: string; focus: PhotoFocus } | null }) {
  const [source, setSource] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    void settled(photoSource(photo, userId ?? undefined), 'photoSource', () => null).then((next) => {
      if (live) setSource(next);
    });
    return () => {
      live = false;
    };
  }, [photo, userId]);
  if (cover !== null) {
    return (
      <>
        <Image source={{ uri: cover.uri }} style={StyleSheet.absoluteFill} contentFit="cover" contentPosition={contentPositionOf(cover.focus)} />
        <Saving />
      </>
    );
  }
  return source === null ? null : <Image source={{ uri: source }} style={StyleSheet.absoluteFill} contentFit="cover" contentPosition={contentPositionOf(focus)} />;
}

const styles = StyleSheet.create({
  panel: { gap: 12 },
  head: { gap: 4 },
  headRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 },
  title: { fontSize: TYPE.body, fontFamily: FONT.bold, color: COLOR.foreground },
  count: { fontSize: TYPE.small, fontFamily: FONT.medium, color: COLOR.creamInk },
  line: { fontSize: TYPE.small, lineHeight: 20, fontFamily: FONT.medium, color: COLOR.creamInk },
  status: { minHeight: 20, fontSize: TYPE.small, lineHeight: 20, fontFamily: FONT.medium, color: COLOR.foreground },
  slot: { position: 'absolute', overflow: 'hidden', borderRadius: RADIUS.cell, backgroundColor: COLOR.surface },
  target: { borderWidth: 4, borderColor: COLOR.accent },
  empty: { alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 2, borderStyle: 'dashed', borderColor: COLOR.borderStrong },
  resting: { borderColor: COLOR.border },
  off: { opacity: 0.6 },
  plus: { width: 32, height: 32, borderRadius: RADIUS.pill, alignItems: 'center', justifyContent: 'center' },
  plusBig: { width: 48, height: 48, borderRadius: RADIUS.pill },
  plusNext: { backgroundColor: COLOR.accent },
  plusRest: { backgroundColor: COLOR.surfaceSunken },
  addText: { fontSize: TYPE.body, fontFamily: FONT.bold, color: COLOR.secondary },
  lead: { position: 'absolute', left: 8, top: 8, overflow: 'hidden', paddingHorizontal: 8, paddingVertical: 2, borderRadius: RADIUS.pill, backgroundColor: COLOR.surface, fontSize: TYPE.fine, fontFamily: FONT.bold, color: COLOR.foreground },
  remove: { position: 'absolute', right: 0, top: 0, width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  removeFace: { width: 26, height: 26, borderRadius: RADIUS.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0, 0, 0, 0.5)', borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.4)' },
  saving: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(38, 36, 31, 0.45)' },
  savingText: { fontSize: TYPE.small, fontFamily: FONT.bold, color: COLOR.surface },
});
