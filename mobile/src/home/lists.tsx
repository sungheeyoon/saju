import { router } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { READING_STALE_LABEL } from '@reading/notes';
import { STEM_INFO, type Stem } from '@saju';
import { withFromMe } from '@web-home/from-me';
import { READING_CONTINUE_NOTE, READING_MAKING, SELF_READING_MAKING } from '@web-home/making';

import { ElementSymbol } from '@/ui/element-symbol';
import { Icon } from '@/ui/icons';
import { COLOR, ELEMENT_TONE, FONT, RADIUS, TYPE } from '@/ui/tokens';

import { readingDate, type HomePerson, type ReadingRow } from './read';

const go = (href: string) => router.push(href as never);

/** 줄 왼쪽의 표시 — 오행 색은 여기만 입는다. 웹은 일간의 천간 그림을 쓰는데 앱에는 아직 그 그림이 없어 오행 기호로 선다 */
function HomeMark({ stem = null }: { stem?: Stem | null }) {
  const tone = stem !== null ? STEM_INFO[stem].element : null;
  return (
    <View style={[styles.mark, { backgroundColor: tone === null ? COLOR.noneSoft : ELEMENT_TONE[tone].soft }]}>
      <ElementSymbol element={tone} size={24} />
    </View>
  );
}

const IconMark = ({ children }: { children: ReactNode }) => <View style={[styles.mark, { backgroundColor: COLOR.surfaceSunken }]}>{children}</View>;

function Row({ onPress, children }: { onPress?: () => void; children: ReactNode }) {
  return (
    <Pressable accessibilityRole={onPress ? 'link' : undefined} onPress={onPress} style={({ pressed }) => [styles.row, pressed && onPress && styles.pressed]}>
      {children}
    </Pressable>
  );
}

function SectionHead({ title, count, link }: { title: string; count: string | null; link?: { label: string; name: string; href: string } }) {
  return (
    <View style={styles.head}>
      <View style={styles.headTitle}>
        <Text style={styles.title}>{title}</Text>
        {count !== null && <Text style={styles.count}>{count}</Text>}
      </View>
      {link !== undefined && (
        <Pressable accessibilityRole="link" accessibilityLabel={link.name} onPress={() => go(link.href)} style={styles.headLink}>
          <Text style={styles.headLinkText}>{link.label}</Text>
          <Icon name="chevron" size={16} color={COLOR.secondary} />
        </Pressable>
      )}
    </View>
  );
}

/** 많으면 앞의 몇 줄만 서고 판 아래 「더보기」가 그 자리에서 편다 */
function MoreList({ shown, rows, tail }: { shown: number; rows: readonly ReactNode[]; tail?: ReactNode }) {
  const [open, setOpen] = useState(false);
  const more = rows.length > shown;
  return (
    <View style={styles.list}>
      {open || !more ? rows : rows.slice(0, shown)}
      {tail}
      {more && (
        <Pressable accessibilityRole="button" accessibilityState={{ expanded: open }} onPress={() => setOpen(!open)} style={styles.more}>
          <Text style={styles.moreText}>{open ? '접기' : '더보기'}</Text>
        </Pressable>
      )}
    </View>
  );
}

/** 만드는 중인 풀이 — 있을 때만. 웹의 「어느 절을 쓰는 중」은 프롬프트 모듈이 지어 앱에 안 와서 「만드는 중…」으로 말한다 */
export function RunningReadings({ running }: { running: readonly { key: string; name: string }[] }) {
  if (running.length === 0) return null;
  return (
    <View style={styles.list}>
      {running.map((line) => (
        <Row key={line.key}>
          <View style={styles.body}>
            <Text style={styles.name} numberOfLines={1}>{line.name}</Text>
            <Text style={styles.second}>{READING_MAKING}</Text>
          </View>
        </Row>
      ))}
    </View>
  );
}

/** 다른 사람 사주 보기 — 저장하지 않고 한 사람을 계산하는 자리. 앱에서는 입력 화면이 그 자리다 */
export function OtherSaju() {
  return (
    <View style={styles.list}>
      <Row onPress={() => go('/?another=1')}>
        <IconMark><Icon name="search" size={20} /></IconMark>
        <Text style={[styles.name, styles.body]}>다른 사람 사주 보기</Text>
        <Icon name="chevron" size={16} color={COLOR.muted} />
      </Row>
    </View>
  );
}

const RECEIVED_SHOWN = 3;
const RECEIVED_OPEN = 10;

export function ReceivedReadings({ readings }: { readings: readonly ReadingRow[] }) {
  if (readings.length === 0) return null;
  return (
    <View style={styles.section}>
      <SectionHead
        title="받은 사주풀이"
        count={`${readings.length}개`}
        link={{ label: '모두 보기', name: '풀이 보관함 모두 보기', href: '/me/readings?kind=saju' }}
      />
      <MoreList
        shown={RECEIVED_SHOWN}
        rows={readings.slice(0, RECEIVED_OPEN).map((reading) => (
          <Row key={`${reading.kind}:${reading.personA}`} onPress={() => go(withFromMe(`/me/readings/${reading.personA}`))}>
            <HomeMark stem={reading.stem} />
            <View style={styles.body}>
              <View style={styles.line}>
                <Text style={[styles.name, styles.grow]} numberOfLines={1}>{reading.label ?? '이름 없음'}</Text>
                {reading.stale && <Text style={styles.stale}>{READING_STALE_LABEL}</Text>}
                <Text style={styles.date}>{readingDate(reading.createdAt)}</Text>
              </View>
              <Text style={styles.second} numberOfLines={1}>{reading.metaphor ?? READING_CONTINUE_NOTE}</Text>
            </View>
          </Row>
        ))}
      />
    </View>
  );
}

const PEOPLE_SHOWN = 5;

function PersonRow({ person }: { person: HomePerson }) {
  const href = `/me/people/${person.personId}?from=me`;
  if (!person.chart.ok) {
    return (
      <Row onPress={() => go(href)}>
        <HomeMark />
        <View style={styles.body}>
          <Text style={styles.name} numberOfLines={1}>{person.label}</Text>
          <Text style={styles.second} numberOfLines={1}>{person.chart.message}</Text>
        </View>
      </Row>
    );
  }
  const note = person.note?.trim() ?? '';
  const second = note !== '' ? note : person.reading !== null ? (person.reading.metaphor ?? READING_CONTINUE_NOTE) : person.making ? SELF_READING_MAKING : null;
  return (
    <Row onPress={() => go(href)}>
      <HomeMark stem={person.chart.saju.pillars.dayMaster} />
      <View style={styles.body}>
        <Text style={styles.name} numberOfLines={1}>{person.label}</Text>
        {second !== null && <Text style={styles.second} numberOfLines={1}>{second}</Text>}
      </View>
      {person.score !== null && (
        <View style={styles.value} accessibilityLabel={`나와 궁합 ${person.score}점`}>
          <Text style={styles.valueText}>{person.score}점</Text>
          <Icon name="taiji" size={16} color={COLOR.secondary} />
        </View>
      )}
    </Row>
  );
}

export function SavedPeople({ people, slots }: { people: readonly HomePerson[]; slots: { limit: number; used: number; remaining: number } | null }) {
  const full = slots !== null && slots.remaining <= 0;
  const add = (
    <Row onPress={() => go('/me/people')}>
      <IconMark><Icon name="plus" size={20} /></IconMark>
      <Text style={[styles.name, styles.body]}>사람 추가</Text>
    </Row>
  );
  return (
    <View style={styles.section}>
      <SectionHead
        title="저장한 사람"
        count={slots === null ? null : `${slots.used}/${slots.limit}명`}
        link={people.length > 0 ? { label: '관리', name: '저장한 사람 관리', href: '/me/people' } : undefined}
      />
      {people.length === 0 ? (
        <View style={styles.list}>
          <View style={styles.row}>
            <Text style={styles.empty}>가족이나 친구의 출생 정보를 저장하고 관리하세요.</Text>
          </View>
          {add}
        </View>
      ) : (
        <MoreList shown={PEOPLE_SHOWN} rows={people.map((person) => <PersonRow key={person.personId} person={person} />)} tail={full ? undefined : add} />
      )}
      {slots !== null && full && <Text style={styles.full}>저장할 수 있는 {slots.limit}명을 다 채웠어요.</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: 8 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 16 },
  headTitle: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  title: { fontFamily: FONT.bold, fontSize: TYPE.heading, color: COLOR.foreground },
  count: { fontFamily: FONT.medium, fontSize: TYPE.small, color: COLOR.secondary },
  headLink: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 2 },
  headLinkText: { fontFamily: FONT.medium, fontSize: TYPE.small, color: COLOR.secondary },
  list: { borderRadius: RADIUS.panel, backgroundColor: COLOR.surface, borderWidth: 1, borderColor: COLOR.border, overflow: 'hidden' },
  row: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: COLOR.border, marginTop: -StyleSheet.hairlineWidth },
  pressed: { backgroundColor: COLOR.surfaceSunken },
  mark: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1, minWidth: 0 },
  line: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  grow: { flex: 1 },
  name: { fontFamily: FONT.bold, fontSize: TYPE.body, color: COLOR.foreground },
  second: { fontFamily: FONT.medium, fontSize: TYPE.small, lineHeight: 20, color: COLOR.secondary },
  stale: { fontFamily: FONT.medium, fontSize: TYPE.fine, color: COLOR.creamInk },
  date: { fontFamily: FONT.medium, fontSize: TYPE.fine, color: COLOR.muted },
  value: { width: 64, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 4 },
  valueText: { fontFamily: FONT.bold, fontSize: TYPE.body, color: COLOR.foreground },
  more: { minHeight: 48, alignItems: 'center', justifyContent: 'center', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: COLOR.border },
  moreText: { fontFamily: FONT.medium, fontSize: TYPE.small, color: COLOR.secondary },
  empty: { flex: 1, fontFamily: FONT.medium, fontSize: TYPE.body, lineHeight: 24, color: COLOR.secondary },
  full: { fontFamily: FONT.medium, fontSize: TYPE.small, color: COLOR.secondary },
});
