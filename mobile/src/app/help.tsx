import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState, type ComponentRef } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { HELP_GROUPS } from '@brand/guide';

import { InfoScreen } from '@/info/frame';
import { Icon } from '@/ui/icons';
import { SecondaryButton } from '@/ui/parts';
import { COLOR, FONT, RADIUS, TYPE } from '@/ui/tokens';
import { Card } from '@/ui/surfaces';

/** 앱은 로그인 뒤에야 결과를 보여 준다 — 「로그인하지 않고 무엇을 볼 수 있나요?」는 앱에서 사실이 아니라 물음째 뺀다 */
const SIGNED_OUT_QUESTION = 'without-sign-in';

/**
 * 자주 묻는 질문 — 웹의 `/help`. `/help#credits` 처럼 물음 하나를 가리켜 오면 펴서 연다(웹의 `open-hashed.tsx`).
 * 묶음 단추도 웹처럼 그 묶음의 첫 물음을 펴고 간다. 물음의 자리는 묶음 · 판 · 줄의 세 층을 더해 안다.
 */
export default function HelpScreen() {
  const { '#': hash } = useLocalSearchParams<{ '#'?: string }>();
  const [opened, setOpened] = useState<ReadonlySet<string>>(new Set());
  const scroller = useRef<ComponentRef<typeof ScrollView>>(null);
  const tops = useRef<Record<string, number>>({});
  const pending = useRef<string | null>(null);

  const scrollTo = (id: string, group: string) => {
    const { current } = tops;
    scroller.current?.scrollTo({ y: (current[`group:${group}`] ?? 0) + (current[`panel:${group}`] ?? 0) + (current[`item:${id}`] ?? 0) - 12 });
  };
  const open = (id: string) => setOpened((current) => new Set(current).add(id));

  useEffect(() => {
    if (!hash) return;
    pending.current = hash;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 주소의 항목을 펼치는 일은 그 주소가 바뀔 때마다 한 번이고, 값은 사용자가 접을 수 있어 렌더에서 끌어낼 수 없다
    open(hash);
  }, [hash]);

  const place = (key: string, y: number) => {
    tops.current[key] = y;
    const id = pending.current;
    if (id === null) return;
    /* 같은 번의 배치가 다 적힌 뒤에 더한다 — 세 층의 자리가 한꺼번에 온다 */
    requestAnimationFrame(() => {
      if (pending.current !== id) return;
      const group = HELP_GROUPS.find((one) => one.items.some((item) => item.id === id));
      if (group === undefined || tops.current[`item:${id}`] === undefined) return;
      pending.current = null;
      scrollTo(id, group.title);
    });
  };

  return (
    <InfoScreen ref={scroller} gap={32} title="자주 묻는 질문" fallback="/">
      <View style={styles.head}>
        <Text style={styles.answer}>궁금한 물음을 누르면 답이 펼쳐져요.</Text>
      </View>

      <View style={styles.chips}>
        {HELP_GROUPS.map((group) => (
          <Pressable
            key={group.title}
            accessibilityRole="link"
            onPress={() => {
              open(group.items[0].id);
              scrollTo(group.items[0].id, group.title);
            }}
            style={styles.chip}
          >
            <Text style={styles.chipText}>{group.title}</Text>
          </Pressable>
        ))}
      </View>

      {HELP_GROUPS.map((group) => (
        <View key={group.title} style={styles.group} onLayout={(event) => place(`group:${group.title}`, event.nativeEvent.layout.y)}>
          <Text style={styles.groupTitle}>{group.title}</Text>
          <View onLayout={(event) => place(`panel:${group.title}`, event.nativeEvent.layout.y)}>
            <Card style={styles.panel}>
              {group.items.filter((item) => item.id !== SIGNED_OUT_QUESTION).map((item, index) => {
                const isOpen = opened.has(item.id);
                return (
                  <View
                    key={item.id}
                    style={index > 0 && styles.divided}
                    onLayout={(event) => place(`item:${item.id}`, event.nativeEvent.layout.y)}
                  >
                    <Pressable
                      accessibilityRole="button"
                      accessibilityState={{ expanded: isOpen }}
                      onPress={() =>
                        setOpened((current) => {
                          const next = new Set(current);
                          if (isOpen) next.delete(item.id);
                          else next.add(item.id);
                          return next;
                        })
                      }
                      style={styles.question}
                    >
                      <Text style={styles.questionText}>{item.q}</Text>
                      <View style={isOpen && styles.chevronOpen}>
                        <Icon name="chevron" size={16} color={COLOR.secondary} />
                      </View>
                    </Pressable>
                    {isOpen && (
                      <View style={styles.answers}>
                        {item.a.map((line) => (
                          <Text key={line} style={styles.answer}>
                            {line}
                          </Text>
                        ))}
                        {item.link && (
                          <Pressable accessibilityRole="link" onPress={() => router.push(item.link!.href as never)} style={styles.link}>
                            <Text style={styles.linkText}>{item.link.label} →</Text>
                          </Pressable>
                        )}
                      </View>
                    )}
                  </View>
                );
              })}
            </Card>
          </View>
        </View>
      ))}

      <SecondaryButton label="서비스 소개" onPress={() => router.push('/about')} />
    </InfoScreen>
  );
}

const styles = StyleSheet.create({
  head: { gap: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 16, borderRadius: RADIUS.pill, borderWidth: 1, borderColor: COLOR.border, backgroundColor: COLOR.surface },
  chipText: { fontFamily: FONT.bold, fontSize: TYPE.sm, color: COLOR.foreground },
  group: { gap: 12 },
  groupTitle: { fontFamily: FONT.bold, fontSize: TYPE.heading, lineHeight: 28, color: COLOR.foreground },
  panel: { paddingVertical: 4 },
  divided: { borderTopWidth: 1, borderTopColor: COLOR.border },
  question: { minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingVertical: 8 },
  questionText: { flex: 1, fontFamily: FONT.bold, fontSize: TYPE.body, lineHeight: 24, color: COLOR.foreground },
  chevronOpen: { transform: [{ rotate: '90deg' }] },
  answers: { gap: 8, paddingBottom: 12 },
  answer: { fontFamily: FONT.medium, fontSize: TYPE.body, lineHeight: 26, color: COLOR.secondary },
  link: { alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center' },
  linkText: { fontFamily: FONT.bold, fontSize: TYPE.small, color: COLOR.foreground },
});
