import { useEffect, useRef, useState, type ComponentRef } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { NOTICE_NOT_READY, noticeFor, OPTIONAL_CONSENTS, OPTIONAL_CONSENT_NOTE } from '@consent/notice';
import { PRIVACY_INTRO, PRIVACY_OPTIONAL_TITLE, PRIVACY_RIGHTS_LINES, PRIVACY_RIGHTS_TITLE, privacyPurgeNote } from '@consent/privacy-page';

import { readSchedule, type ScheduleRead } from '@/auth/schedule';
import { Clause, Dot, FinePrint, InfoLine, InfoScreen, LegalHead } from '@/info/frame';
import { HomeButton } from '@/info/home-button';
import { Panel } from '@/ui/parts';
import { COLOR, FONT, RADIUS, TYPE } from '@/ui/tokens';

/** 처리방침 — 웹의 `/privacy` 와 같은 자료(`noticeFor`)이고 로그인 없이 열린다. 날짜를 지어내지 않는다: 일정이 없으면 그 말만 선다 */
export default function PrivacyScreen() {
  const [schedule, setSchedule] = useState<ScheduleRead | null>(null);
  const scroller = useRef<ComponentRef<typeof ScrollView>>(null);
  const tops = useRef<Record<number, number>>({});

  useEffect(() => {
    let live = true;
    void readSchedule().then((next) => {
      if (live) setSchedule(next);
    });
    return () => {
      live = false;
    };
  }, []);

  const ready = schedule?.ok ? schedule.value : null;
  const sections = ready === null ? [] : noticeFor(ready.dates, ready.operator);
  /* 목차와 조항 제목이 같은 글자를 쓴다 */
  const titles = [...sections.map((section) => section.title), PRIVACY_OPTIONAL_TITLE, PRIVACY_RIGHTS_TITLE];
  const anchor = (index: number) => ({
    onLayout: (event: { nativeEvent: { layout: { y: number } } }) => {
      tops.current[index] = event.nativeEvent.layout.y;
    },
  });

  return (
    <InfoScreen ref={scroller} title="처리방침" fallback="/">
      <LegalHead title="개인정보 처리방침" note={PRIVACY_INTRO} />

      {schedule === null ? null : !schedule.ok ? (
        <Panel>
          <InfoLine>{schedule.reason}</InfoLine>
        </Panel>
      ) : ready === null ? (
        <Panel>
          <InfoLine>{NOTICE_NOT_READY}</InfoLine>
        </Panel>
      ) : (
        <>
          <Panel style={styles.toc}>
            <Text style={styles.tocHead}>목차</Text>
            <View>
              {titles.map((title, index) => (
                <Pressable
                  key={title}
                  accessibilityRole="link"
                  onPress={() => scroller.current?.scrollTo({ y: (tops.current[index] ?? 0) - 12 })}
                  style={styles.tocRow}
                >
                  <Text style={styles.tocNumber}>{index + 1}</Text>
                  <Text style={styles.tocTitle}>{title}</Text>
                </Pressable>
              ))}
            </View>
          </Panel>

          {sections.map((section, index) => (
            <Clause key={section.title} title={section.title} {...anchor(index)}>
              <View style={styles.lines}>
                {section.lines.map((line) => (
                  <Dot key={line}>{line}</Dot>
                ))}
              </View>
            </Clause>
          ))}

          <Clause title={PRIVACY_OPTIONAL_TITLE} {...anchor(sections.length)}>
            <InfoLine>{OPTIONAL_CONSENT_NOTE}</InfoLine>
            {OPTIONAL_CONSENTS.map((one) => (
              <View key={one.key} style={styles.optional}>
                <Text style={styles.optionalLabel}>{one.label}</Text>
                <InfoLine>{one.detail}</InfoLine>
                <InfoLine>{one.erasure}</InfoLine>
              </View>
            ))}
          </Clause>

          <Clause title={PRIVACY_RIGHTS_TITLE} {...anchor(sections.length + 1)}>
            <View style={styles.lines}>
              {PRIVACY_RIGHTS_LINES.map((line) => (
                <Dot key={line}>{line}</Dot>
              ))}
            </View>
          </Clause>

          <FinePrint>{privacyPurgeNote(ready.dates.purgeWithinDays)}</FinePrint>
        </>
      )}

      <HomeButton />
    </InfoScreen>
  );
}

const styles = StyleSheet.create({
  toc: { gap: 8 },
  tocHead: { fontFamily: FONT.bold, fontSize: TYPE.small, color: COLOR.secondary },
  tocRow: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 8 },
  tocNumber: { width: 20, textAlign: 'right', fontFamily: FONT.bold, fontSize: TYPE.small, color: COLOR.muted },
  tocTitle: { flex: 1, fontFamily: FONT.medium, fontSize: TYPE.body, color: COLOR.foreground },
  lines: { gap: 8 },
  optional: { paddingHorizontal: 16, paddingVertical: 12, borderRadius: RADIUS.panel, backgroundColor: COLOR.surfaceSoft },
  optionalLabel: { fontFamily: FONT.bold, fontSize: TYPE.body, lineHeight: 24, color: COLOR.foreground },
});
