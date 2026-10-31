import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, Line, Path, RadialGradient, Rect, Stop } from 'react-native-svg';

import { READING_STALE_LABEL } from '@reading/notes';
import { ELEMENTS, type Element, type Stem } from '@saju';
import { curve, curveAway, ELEMENT_ANGLE, phaseOf, pointAt, RADIUS, seatAngles, SIZE, stepsAlong, type Point } from '@saju-view/orbit';
import { linksOf, type MapModel, type MapPerson } from '@reading/relation-map';

import { ChatIcon } from '@/chat/icons';
import { ElementSymbol } from '@/ui/element-symbol';
import { Icon } from '@/ui/icons';
import { PrimaryButton } from '@/ui/parts';
import { StemSymbol } from '@/ui/stem-symbol';
import { COLOR, ELEMENT_TONE, FONT, RADIUS as CORNER, TYPE } from '@/ui/tokens';
import { CardFrame, Paper } from '@/ui/surfaces';

/** 누른 뒤의 박자(ms) — 웹의 `BEAT` 와 같다 */
const BEAT = { depart: 900, travel: 900 } as const;
const BEND = 3;
const MAX_WIDTH = 384;

const go = (href: string) => router.push(href as never);
const toneOf = (element: Element | null | undefined) => (element ? ELEMENT_TONE[element] : { ink: COLOR.none, soft: COLOR.noneSoft, mid: COLOR.noneMid });

/** 움직임을 줄인 기기인가 — 줄였으면 숨도 만남도 안 돈다(웹의 `motion-reduce`) */
function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setReduced);
    const listening = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    return () => listening.remove();
  }, []);
  return reduced;
}

/** 그림의 숨 — 아주 작고 느리고, 박자가 흩어져 한꺼번에 움직이지 않는다. 웹은 그림의 부분마다 움직이고 앱은 그림 하나가 숨 쉰다 */
function Breathing({ stem, size, phase, hushed }: { stem: Stem; size: number; phase: number; hushed: boolean }) {
  const reduced = useReducedMotion();
  const breath = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reduced || hushed) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(Math.abs(phase) * 200),
        Animated.timing(breath, { toValue: 1, duration: 2600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(breath, { toValue: 0, duration: 2600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [breath, phase, reduced, hushed]);
  const scale = breath.interpolate({ inputRange: [0, 1], outputRange: [1, 1.05] });
  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <StemSymbol stem={stem} size={size} />
    </Animated.View>
  );
}

/** 만남 — 두 그림에서 작은 것이 하나씩 떠나 같은 선을 타고 엇갈려 건너간다. 어느 짝이든 같은 박자 · 같은 크기다 */
function Token({ element, steps, width }: { element: Element; steps: readonly Point[]; width: number }) {
  const at = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const run = Animated.sequence([
      Animated.delay(BEAT.depart),
      Animated.timing(at, { toValue: 1, duration: BEAT.travel, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
    ]);
    run.start();
    return () => run.stop();
  }, [at]);
  const inputRange = steps.map((_, index) => index / (steps.length - 1));
  const px = (value: number) => (value / 100) * width - TOKEN / 2;
  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        zIndex: 6,
        opacity: at.interpolate({ inputRange: [0, 0.02, 0.98, 1], outputRange: [0, 1, 1, 0] }),
        transform: [
          { translateX: at.interpolate({ inputRange, outputRange: steps.map((step) => px(step.x)) }) },
          { translateY: at.interpolate({ inputRange, outputRange: steps.map((step) => px(step.y)) }) },
        ],
      }}
    >
      <ElementSymbol element={element} size={TOKEN} />
    </Animated.View>
  );
}
const TOKEN = 16;

/**
 * 관계 지도 — 웹의 `app/me/home/map/relation-map.tsx` 와 같은 값 · 같은 자리 · 같은 글자다. 가운데 나, 한 궤도에 저장한 사람이 제 일간 오행의 방향으로 앉는다.
 * 거리는 아무것도 판정하지 않고, 선은 이미 만든 궁합풀이가 있을 때만 긋는다.
 */
export function RelationMap({ model, canAdd }: { model: MapModel; canAdd: boolean }) {
  const [width, setWidth] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const reduced = useReducedMotion();

  const angles = seatAngles(model.people.map((person) => ({ id: person.id, element: person.day?.element ?? null })));
  const chosen = model.people.find((person) => person.id === selectedId) ?? null;
  const kept = chosen === null ? null : new Set([chosen.id, ...model.links.flatMap((link) => (link.a === chosen.id ? [link.b] : link.b === chosen.id ? [link.a] : []))]);
  const meeting = chosen !== null && chosen.day !== null && chosen.compat.seen;
  const empty = model.people.length === 0;
  const px = (value: number) => (value / 100) * width;
  const center: Point = { x: 50, y: 50 };

  return (
    <Paper accessibilityLabel="관계 지도" style={styles.panel}>
      <View style={styles.head}>
        <Text accessibilityRole="header" style={styles.title}>관계 지도</Text>
        {!empty && (
          <Text style={styles.count}>
            저장한 사람 <Text style={styles.countStrong}>{model.people.length}</Text>명
          </Text>
        )}
      </View>

      <View style={styles.mapRoom}>
        <View onLayout={(event) => setWidth(event.nativeEvent.layout.width)} style={styles.map}>
          {width > 0 && (
            <>
              <Svg pointerEvents="none" width={width} height={width} viewBox="0 0 100 100" style={styles.layer}>
                <Defs>
                  {ELEMENTS.map((element) => (
                    <RadialGradient key={element} id={`zone-${ELEMENT_ANGLE[element]}`}>
                      <Stop offset="0" stopColor={ELEMENT_TONE[element].soft} stopOpacity={0.95} />
                      <Stop offset="1" stopColor={ELEMENT_TONE[element].soft} stopOpacity={0} />
                    </RadialGradient>
                  ))}
                </Defs>
                {ELEMENTS.map((element) => {
                  const at = pointAt(ELEMENT_ANGLE[element], RADIUS);
                  const seated = model.people.some((person) => person.day?.element === element);
                  const strength = chosen !== null ? (element === chosen.day?.element ? 1 : 0.25) : seated ? 1 : 0.45;
                  return <Circle key={element} cx={at.x} cy={at.y} r={23} fill={`url(#zone-${ELEMENT_ANGLE[element]})`} opacity={strength} />;
                })}

                {/* 나와 본 궁합은 늘 이어져 있다 — 가만있을 때는 가늘고 옅게, 누르면 그 사람의 것만 진하게 */}
                {chosen === null &&
                  model.people.map((person) =>
                    !person.compat.seen || person.day === null ? null : (
                      <Path
                        key={person.id}
                        d={curve(pointAt(angles[person.id], RADIUS), center, SIZE.person / 2 + 1, SIZE.me / 2 + 1.5, BEND)}
                        fill="none"
                        stroke={toneOf(person.day.element).mid}
                        strokeWidth={0.9}
                        strokeLinecap="round"
                        opacity={0.9}
                      />
                    ),
                  )}
                {chosen !== null &&
                  model.links.flatMap((link) => {
                    const otherId = link.a === chosen.id ? link.b : link.b === chosen.id ? link.a : null;
                    if (otherId === null || angles[otherId] === undefined) return [];
                    return [
                      <Path
                        key={otherId}
                        d={curveAway(pointAt(angles[chosen.id], RADIUS), pointAt(angles[otherId], RADIUS), SIZE.current / 2 + 1.5, SIZE.person / 2 + 1.5)}
                        fill="none"
                        stroke={COLOR.secondary}
                        strokeWidth={1.1}
                        strokeDasharray="0.01 2.6"
                        strokeLinecap="round"
                      />,
                    ];
                  })}
                {meeting && chosen !== null && (
                  <Path
                    d={curve(pointAt(angles[chosen.id], RADIUS), center, SIZE.current / 2 + 1, SIZE.me / 2 + 1.5, BEND)}
                    fill="none"
                    stroke={toneOf(chosen.day?.element).ink}
                    strokeWidth={0.7}
                    strokeLinecap="round"
                  />
                )}
              </Svg>

              {ELEMENTS.map((element) => {
                const mark = pointAt(ELEMENT_ANGLE[element], RADIUS + 13);
                const seated = model.people.some((person) => person.day?.element === element);
                const strength = chosen !== null ? (element === chosen.day?.element ? 1 : 0.25) : seated ? 1 : 0.45;
                const size = px(7);
                return (
                  <View key={element} pointerEvents="none" style={{ position: 'absolute', left: px(mark.x) - size / 2, top: px(mark.y) - size / 2, opacity: strength * 0.7 }}>
                    <ElementSymbol element={element} size={size} />
                  </View>
                );
              })}

              <View
                accessible
                accessibilityLabel={`나 ${model.self.label}, 일간 ${model.self.stem} ${model.self.picture}`}
                style={[styles.me, { left: px(50 - SIZE.me / 2), top: px(50 - SIZE.me / 2), width: px(SIZE.me), height: px(SIZE.me), borderRadius: px(SIZE.me) / 2, backgroundColor: toneOf(model.self.element).soft }]}
              >
                <Breathing key={selectedId ?? 'alone'} stem={model.self.stem as Stem} size={px(11)} phase={-3.7} hushed={false} />
                <View style={[styles.meTag, { backgroundColor: toneOf(model.self.element).ink }]}>
                  <Text style={[styles.meTagText, { color: toneOf(model.self.element).soft }]}>나</Text>
                </View>
              </View>

              {model.people.map((person, index) => (
                <Seat
                  key={person.id}
                  person={person}
                  at={pointAt(angles[person.id], RADIUS)}
                  angle={angles[person.id]}
                  phase={phaseOf(index)}
                  width={width}
                  state={chosen?.id === person.id ? 'near' : kept === null ? 'still' : kept.has(person.id) ? 'linked' : 'receded'}
                  onPress={() => setSelectedId((now) => (now === person.id ? null : person.id))}
                />
              ))}

              {empty && canAdd && <AddSeat width={width} />}

              {meeting && chosen !== null && chosen.day !== null && !reduced && (
                <View key={chosen.id} pointerEvents="none" style={styles.layer}>
                  <Token element={chosen.day.element} width={width} steps={stepsAlong(pointAt(angles[chosen.id], RADIUS), center, SIZE.current / 2 + 1, SIZE.me / 2 + 1.5, BEND)} />
                  <Token element={model.self.element} width={width} steps={stepsAlong(pointAt(angles[chosen.id], RADIUS), center, SIZE.current / 2 + 1, SIZE.me / 2 + 1.5, BEND).reverse()} />
                </View>
              )}
            </>
          )}
        </View>
      </View>

      {chosen !== null ? <PersonCard key={chosen.id} person={chosen} links={linksOf(model, chosen.id)} onClose={() => setSelectedId(null)} /> : <Legend empty={empty} />}
    </Paper>
  );
}

type SeatState = 'still' | 'near' | 'linked' | 'receded';

function Seat({ person, at, angle, phase, width, state, onPress }: { person: MapPerson; at: Point; angle: number; phase: number; width: number; state: SeatState; onPress: () => void }) {
  const near = state === 'near';
  const size = ((near ? SIZE.current : SIZE.person) / 100) * width;
  const sin = Math.sin((angle * Math.PI) / 180);
  /* 가만있는 이름은 안쪽(나 쪽)에 단다 — 바깥의 오행 기호와 안 겹치게. 누른 이름표는 바깥이다 — 안쪽이면 나에게 긋는 빛을 가린다 */
  const above = near ? sin < -0.3 : sin > 0.3;
  const score = person.compat.seen ? person.compat.score : null;
  const tone = toneOf(person.day?.element);
  const cx = (at.x / 100) * width;
  const cy = (at.y / 100) * width;
  const label = (
    <View pointerEvents="none" style={[styles.seatLabel, near && styles.seatLabelNear, above ? { bottom: size + 2 } : { top: size + 2 }]}>
      <Text numberOfLines={1} style={[styles.seatName, near && styles.seatNameNear]}>{person.label}</Text>
      {score !== null && <Text style={[styles.seatScore, { color: tone.ink }]}>{score}</Text>}
    </View>
  );
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ expanded: near }}
      accessibilityLabel={`${person.label}${person.day === null ? '' : `, 일간 ${person.day.stem} ${person.day.picture}`}${score !== null ? `, 나와 본 궁합 ${score}점` : ''}`}
      hitSlop={8}
      onPress={onPress}
      style={[styles.seat, { left: cx - size / 2, top: cy - size / 2, width: size, height: size, zIndex: near ? 10 : 1, opacity: state === 'receded' ? 0.35 : 1 }]}
    >
      <View
        style={[
          styles.seatFace,
          { borderRadius: size / 2 },
          person.day === null ? styles.seatUnread : { backgroundColor: tone.soft },
          (near || state === 'linked') && { borderWidth: 2, borderColor: tone.mid },
        ]}
      >
        {person.day !== null ? <Breathing key={near ? 'near' : 'rest'} stem={person.day.stem as Stem} size={size * 0.65} phase={phase} hushed={state === 'receded'} /> : <Text style={styles.seatUnknown}>?</Text>}
      </View>
      {label}
    </Pressable>
  );
}

function AddSeat({ width }: { width: number }) {
  const at = pointAt(-90, RADIUS);
  const cx = (at.x / 100) * width;
  const cy = (at.y / 100) * width;
  return (
    <Pressable accessibilityRole="link" onPress={() => go('/me/people')} style={[styles.add, { left: cx - 22, top: cy - 22 }]}>
      <Text style={styles.addLabel}>사람 추가</Text>
      <View style={styles.addFace}>
        <Icon name="plus" size={20} />
      </View>
    </Pressable>
  );
}

function Legend({ empty }: { empty: boolean }) {
  if (empty) return <Text style={[styles.note, styles.legendRoom]}>사람을 저장하면 그 사람의 기운 쪽 궤도에 앉아요</Text>;
  return (
    <View style={[styles.legend, styles.legendRoom]}>
      <View style={styles.legendRow}>
        <View style={styles.legendItem}>
          <Svg width={24} height={8}>
            <Rect x={0} y={3} width={24} height={2} rx={1} fill={ELEMENT_TONE.木.mid} />
          </Svg>
          <Text style={styles.legendText}>나와 본 궁합</Text>
        </View>
        <View style={styles.legendItem}>
          <Svg width={24} height={8}>
            <Line x1={1} y1={4} x2={23} y2={4} stroke={COLOR.secondary} strokeWidth={2} strokeDasharray="0.01 5" strokeLinecap="round" />
          </Svg>
          <Text style={styles.legendText}>사람끼리 본 궁합</Text>
        </View>
      </View>
      <Text style={styles.note}>누르면 나와의 궁합을 볼 수 있어요. 궁합을 본 사람이면 두 그림이 서로 만나요</Text>
    </View>
  );
}

/** 누른 사람의 카드 — 지도가 비운 아래 자리에 선다. 주인공은 나와의 궁합이다 */
function PersonCard({ person, links, onClose }: { person: MapPerson; links: ReturnType<typeof linksOf>; onClose: () => void }) {
  const { compat } = person;
  const tone = toneOf(person.day?.element);
  return (
    <CardFrame accessibilityLiveRegion="polite" style={styles.card}>
      <View style={styles.cardHead}>
        <View style={[styles.cardFace, person.day === null ? styles.seatUnread : { backgroundColor: tone.soft }]}>
          {person.day !== null ? <StemSymbol stem={person.day.stem as Stem} size={24} /> : <Text style={styles.seatUnknown}>?</Text>}
        </View>
        <View style={styles.cardWho}>
          <Text accessibilityRole="header" numberOfLines={1} style={styles.cardName}>{person.label}</Text>
          {person.day !== null && <Text numberOfLines={1} style={styles.cardPicture}>{person.day.picture}</Text>}
        </View>
        {person.unreadable === null && compat.seen && compat.score !== null && (
          <View style={styles.cardScore}>
            <Text style={styles.cardScoreHead}>나와의 궁합</Text>
            <Text style={[styles.cardScoreValue, { color: tone.ink }]}>
              {compat.score}
              <Text style={styles.cardScoreUnit}>점</Text>
            </Text>
          </View>
        )}
        <Pressable accessibilityRole="button" accessibilityLabel="닫기" onPress={onClose} style={styles.cardClose}>
          <ChatIcon name="close" color={COLOR.secondary} size={20} />
        </Pressable>
      </View>

      {person.unreadable !== null ? (
        <Text style={styles.cardLine}>{person.unreadable}</Text>
      ) : (
        <>
          <Text numberOfLines={2} style={styles.cardLine}>
            {compat.seen && !compat.current && <Text style={styles.stale}>{READING_STALE_LABEL} </Text>}
            {compat.seen ? compat.metaphor : <Text style={{ color: tone.ink }}>아직 둘의 궁합을 보지 않았어요</Text>}
          </Text>
          <PrimaryButton label={compat.seen ? '궁합풀이 보기' : '궁합 보러 가기'} onPress={() => go(compat.href)} />
          <Pressable accessibilityRole="link" onPress={() => go(person.detailHref)} style={styles.tertiary}>
            <Text style={styles.tertiaryText}>{person.label} 사주 보기</Text>
            <Icon name="chevron" size={16} color={COLOR.secondary} />
          </Pressable>

          {links.length > 0 && (
            <View style={styles.links}>
              <Text style={styles.note}>다른 사람과 본 궁합</Text>
              {links.map((link) => (
                <Pressable
                  key={link.href}
                  accessibilityRole="link"
                  accessibilityLabel={`${person.label} · ${link.otherLabel} 궁합${link.score === null ? '' : ` ${link.score}점`}`}
                  onPress={() => go(link.href)}
                  style={styles.chip}
                >
                  <Text numberOfLines={1} style={styles.chipText}>{link.otherLabel}</Text>
                  {link.score !== null && <Text style={styles.chipScore}>{link.score}점</Text>}
                </Pressable>
              ))}
            </View>
          )}
        </>
      )}
    </CardFrame>
  );
}

const styles = StyleSheet.create({
  panel: { padding: 0, overflow: 'hidden' },
  head: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, paddingHorizontal: 20, paddingTop: 20 },
  title: { fontFamily: FONT.bold, fontSize: TYPE.heading, color: COLOR.foreground },
  count: { fontFamily: FONT.medium, fontSize: TYPE.small, color: COLOR.secondary },
  countStrong: { fontFamily: FONT.bold, color: COLOR.foreground },
  mapRoom: { alignItems: 'center', paddingHorizontal: '8%', paddingVertical: 28 },
  map: { width: '100%', maxWidth: MAX_WIDTH, aspectRatio: 1 },
  layer: { position: 'absolute', left: 0, top: 0, right: 0, bottom: 0, overflow: 'visible' },
  me: { position: 'absolute', zIndex: 5, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: COLOR.surface },
  meTag: { position: 'absolute', bottom: -6, paddingHorizontal: 6, borderRadius: CORNER.pill },
  meTagText: { fontFamily: FONT.bold, fontSize: 11, lineHeight: 16 },
  seat: { position: 'absolute' },
  seatFace: { flex: 1, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: COLOR.surface },
  seatUnread: { borderWidth: 2, borderStyle: 'dashed', borderColor: COLOR.borderStrong, backgroundColor: COLOR.surface },
  seatUnknown: { fontFamily: FONT.bold, fontSize: TYPE.body, color: COLOR.secondary },
  seatLabel: { position: 'absolute', alignSelf: 'center', maxWidth: 88, minWidth: 40, flexDirection: 'row', alignItems: 'baseline', justifyContent: 'center', gap: 4, paddingHorizontal: 6, borderRadius: CORNER.pill, backgroundColor: 'rgba(255, 244, 230, 0.9)' },
  seatLabelNear: { maxWidth: 140, paddingVertical: 2, backgroundColor: COLOR.surface },
  seatName: { flexShrink: 1, fontFamily: FONT.bold, fontSize: TYPE.fine, lineHeight: 20, color: COLOR.secondary },
  seatNameNear: { fontSize: TYPE.body, color: COLOR.foreground },
  seatScore: { fontFamily: FONT.bold, fontSize: TYPE.fine, lineHeight: 20 },
  add: { position: 'absolute', width: 44, height: 44, alignItems: 'center', overflow: 'visible' },
  addFace: { width: 44, height: 44, borderRadius: CORNER.pill, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderStyle: 'dashed', borderColor: COLOR.borderStrong, backgroundColor: COLOR.surface },
  addLabel: { position: 'absolute', top: -24, width: 80, textAlign: 'center', fontFamily: FONT.bold, fontSize: TYPE.small, color: COLOR.foreground },
  legendRoom: { paddingHorizontal: 20, paddingBottom: 20, paddingTop: 4 },
  legend: { gap: 8 },
  legendRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendText: { fontFamily: FONT.medium, fontSize: TYPE.fine, color: COLOR.secondary },
  note: { fontFamily: FONT.medium, fontSize: TYPE.fine, lineHeight: 18, color: COLOR.muted },
  card: { gap: 10, marginHorizontal: 12, marginBottom: 12, padding: 12 },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  cardFace: { width: 40, height: 40, borderRadius: CORNER.pill, alignItems: 'center', justifyContent: 'center' },
  cardWho: { flex: 1, minWidth: 0 },
  cardName: { fontFamily: FONT.bold, fontSize: TYPE.body, color: COLOR.foreground },
  cardPicture: { fontFamily: FONT.medium, fontSize: TYPE.fine, color: COLOR.secondary },
  cardScore: { alignItems: 'flex-end' },
  cardScoreHead: { fontFamily: FONT.bold, fontSize: 11, color: COLOR.secondary },
  cardScoreValue: { fontFamily: FONT.bold, fontSize: TYPE.heading },
  cardScoreUnit: { fontFamily: FONT.medium, fontSize: TYPE.fine, color: COLOR.secondary },
  cardClose: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  cardLine: { fontFamily: FONT.medium, fontSize: TYPE.field, lineHeight: 24, color: COLOR.foreground },
  stale: { fontFamily: FONT.medium, fontSize: TYPE.fine, color: COLOR.creamInk },
  tertiary: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 },
  tertiaryText: { fontFamily: FONT.bold, fontSize: TYPE.small, color: COLOR.secondary },
  links: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 },
  chip: { minHeight: 44, maxWidth: '100%', flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, borderRadius: CORNER.pill, borderWidth: 1, borderColor: COLOR.border, backgroundColor: COLOR.surface },
  chipText: { flexShrink: 1, fontFamily: FONT.bold, fontSize: TYPE.small, color: COLOR.foreground },
  chipScore: { fontFamily: FONT.medium, fontSize: TYPE.small, color: COLOR.secondary },
});
