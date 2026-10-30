import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { UNREADABLE_INPUT_NOTE } from '@input/stored';
import { HOUR_UNKNOWN_LABEL } from '@input/query';
import { READING_STALE_LABEL } from '@reading/notes';
import { READING_CONTINUE_NOTE, SELF_READING_MAKING } from '@web-home/making';
import { CALENDAR_KO, GENDER_KO, STEM_INFO } from '@saju';

import { ElementSymbol } from '@/ui/element-symbol';
import { COLOR, CONTROL, ELEMENT_TONE, FONT, RADIUS, TYPE } from '@/ui/tokens';

import type { MyReading, PersonRow } from './data';
import { NameEditor, NoteEditor, RemoveConfirm } from './manage';
import { DayMasterChip, PillarStrip, Sheet, SheetItem, go, styles as shared } from './parts';
import { StemSymbol } from './stem-symbol';

type Panel = 'menu' | 'name' | 'note' | 'remove';

/**
 * 한 사람 = 그 사람의 일간 오행 색을 입은 한 장의 타일. **타일이 곧 상세로 가는 길이다**(`app/me/people/page.tsx`).
 * 손대는 것(이름 · 메모 · 삭제)은 구석의 관리 단추 하나로 물러난다.
 */
export function PersonCard({
  person,
  reading,
  pair,
  making,
  selfPersonId,
  onChanged,
}: {
  person: PersonRow;
  reading: MyReading | null;
  /** 나 × 이 사람의 궁합풀이 — 있으면 궁합 단추가 점수를 달고 그 글로 간다 */
  pair: MyReading | null;
  making: boolean;
  selfPersonId: string | null;
  onChanged: () => void;
}) {
  const [panel, setPanel] = useState<Panel | null>(null);
  const note = person.note?.trim() ?? '';
  const stem = person.chart.ok ? person.chart.saju.pillars.dayMaster : null;
  const tone = stem === null ? null : ELEMENT_TONE[STEM_INFO[stem].element];
  const done = () => {
    setPanel(null);
    onChanged();
  };

  return (
    <View style={styles.item}>
      <Pressable
        accessibilityRole="link"
        accessibilityLabel={person.label}
        onPress={() => go(`/me/people/${person.personId}`)}
        style={[styles.tile, { backgroundColor: tone?.soft ?? COLOR.noneSoft }]}
      >
        {stem !== null && (
          <View style={styles.watermark}>
            <StemSymbol stem={stem} size={128} opacity={0.14} />
          </View>
        )}

        <View style={styles.head}>
          {stem !== null ? (
            <DayMasterChip stem={stem} />
          ) : (
            <View style={styles.unknown}>
              <ElementSymbol element={null} size={20} />
            </View>
          )}
        </View>

        <View>
          <Text style={shared.name} numberOfLines={1}>{person.label}</Text>
          {person.chart.ok && (
            <>
              <Text style={shared.meta}>
                {person.chart.query.calendar === 'solar' ? person.chart.query.date : `${CALENDAR_KO[person.chart.query.calendar]} ${person.chart.query.date}`}
                {person.chart.query.hourKnown === false ? ` · ${HOUR_UNKNOWN_LABEL}` : ` · ${person.chart.query.time}`}
              </Text>
              <Text style={shared.meta}>
                {GENDER_KO[person.chart.query.gender]} · {person.chart.query.city}
              </Text>
            </>
          )}
        </View>

        {note !== '' && (
          <Text style={styles.note}>
            <Text style={[styles.noteName, tone !== null && { color: tone.ink }]}>메모 </Text>
            {note}
          </Text>
        )}

        {person.chart.ok ? (
          <>
            <PillarStrip pillars={person.chart.saju.pillars} name={person.label} />
            {reading !== null && (
              <Text style={styles.oneLine} numberOfLines={2}>
                {!reading.fromCurrentChart && <Text style={styles.stale}>{READING_STALE_LABEL} </Text>}
                {reading.metaphor ?? READING_CONTINUE_NOTE}
              </Text>
            )}
            <View style={styles.buttons}>
              <Pressable
                accessibilityRole="link"
                onPress={() => go(`/me/readings/${person.personId}`)}
                style={[styles.button, styles.grow, reading === null ? styles.buttonPrimary : styles.buttonPlain]}
              >
                <Text style={[styles.buttonText, reading === null && styles.buttonPrimaryText]} numberOfLines={1}>
                  {reading !== null ? '사주풀이 보기' : making ? SELF_READING_MAKING : '사주풀이 받기'}
                </Text>
              </Pressable>
              <Pressable
                accessibilityRole="link"
                accessibilityLabel={pair?.score != null ? `나와 궁합 ${pair.score}점` : '나와 궁합'}
                onPress={() => go(pair !== null ? `/me/compat?a=${pair.personA}&b=${pair.personB}` : compatPickHref(selfPersonId, person.personId))}
                style={[styles.button, styles.buttonPlain]}
              >
                <Text style={styles.buttonText}>{pair?.score != null ? `${pair.score}점` : '궁합'}</Text>
              </Pressable>
            </View>
          </>
        ) : (
          <View style={styles.unreadable}>
            <Text style={shared.noticeBody}>{person.chart.message}</Text>
            <Text style={shared.meta}>{UNREADABLE_INPUT_NOTE}</Text>
          </View>
        )}

        <Pressable accessibilityRole="button" accessibilityLabel={`${person.label} 관리`} onPress={() => setPanel('menu')} style={styles.manage}>
          <Text style={styles.manageDots}>⋯</Text>
        </Pressable>
      </Pressable>

      {panel === 'name' && <NameEditor personId={person.personId} name={person.label} onDone={done} onCancel={() => setPanel(null)} />}
      {panel === 'note' && <NoteEditor personId={person.personId} note={person.note ?? ''} onDone={done} onCancel={() => setPanel(null)} />}
      {panel === 'remove' && <RemoveConfirm personId={person.personId} label={person.label} onDone={done} onCancel={() => setPanel(null)} />}
      {panel === 'menu' && (
        <Sheet label="닫기" onClose={() => setPanel(null)}>
          <Text style={shared.section}>{person.label}</Text>
          <SheetItem label="이름 변경" onPress={() => setPanel('name')} />
          <SheetItem label={note === '' ? '메모 넣기' : '메모 고치기'} onPress={() => setPanel('note')} />
          <SheetItem label="삭제" danger onPress={() => setPanel('remove')} />
        </Sheet>
      )}
    </View>
  );
}

/** 나 × 그 사람으로 두 칸을 채워 고르는 자리를 연다 — id 만 싣는다(`compatHrefFor`) */
const compatPickHref = (selfPersonId: string | null, personId: string): string =>
  selfPersonId === null || selfPersonId === personId ? `/me/compat?pickA=${personId}` : `/me/compat?pickA=${selfPersonId}&pickB=${personId}`;

const styles = StyleSheet.create({
  item: { gap: 8 },
  tile: { gap: 10, padding: 16, borderRadius: RADIUS.panel, overflow: 'hidden' },
  watermark: { position: 'absolute', right: -24, bottom: -24 },
  head: { minHeight: CONTROL, justifyContent: 'center', paddingRight: 52 },
  unknown: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center', borderRadius: RADIUS.pill, backgroundColor: 'rgba(255, 253, 249, 0.72)' },
  note: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, backgroundColor: 'rgba(255, 253, 249, 0.6)', fontSize: TYPE.small, lineHeight: 19, fontFamily: FONT.medium, color: COLOR.foreground },
  noteName: { fontSize: TYPE.fine, fontFamily: FONT.bold },
  oneLine: { fontSize: TYPE.small, lineHeight: 19, fontFamily: FONT.medium, color: COLOR.foreground },
  stale: { fontSize: TYPE.fine, fontFamily: FONT.bold, color: COLOR.secondary },
  buttons: { flexDirection: 'row', gap: 8, paddingTop: 4 },
  grow: { flex: 1 },
  button: { minHeight: CONTROL, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14, borderRadius: RADIUS.pill },
  buttonPlain: { backgroundColor: COLOR.surface },
  buttonPrimary: { backgroundColor: COLOR.accent },
  buttonText: { fontSize: TYPE.sm, fontFamily: FONT.bold, color: COLOR.foreground },
  buttonPrimaryText: { color: COLOR.onAccent },
  unreadable: { gap: 4 },
  manage: { position: 'absolute', top: 12, right: 12, width: CONTROL, height: CONTROL, alignItems: 'center', justifyContent: 'center', borderRadius: RADIUS.pill },
  manageDots: { fontSize: 22, lineHeight: 26, color: COLOR.secondary },
});
