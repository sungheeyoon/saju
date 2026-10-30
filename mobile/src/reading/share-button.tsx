import * as Clipboard from 'expo-clipboard';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { MenuPanel } from '@/ui/surfaces';
import { SecondaryButton } from '@/ui/parts';
import { COLOR, CONTROL, FONT, RADIUS, TYPE } from '@/ui/tokens';

import type { ReadingTarget } from './api';
import { shareMyReading } from './share';

const IDLE = '공유 링크 복사';
const COPIED = '복사했어요';

type Phase = 'idle' | 'working' | 'copied' | 'failed';

function LinkMark({ copied }: { copied: boolean }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={COLOR.foreground} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d={copied ? 'M5 12.4 10 17l9-10' : 'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1.2 1.2M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1.2-1.2'} />
    </Svg>
  );
}

/**
 * 풀이를 **링크로 보낸다** — 누르면 주소가 클립보드에 든다. 웹처럼 시스템 공유창을 안 쓴다: 받는 앱이 주소와 글을 이어 붙여 링크가 깨졌고
 * 단추에 적힌 대로 일어나야 한다(`app/me/reading/share-button.tsx`). 복사가 거절되면 주소를 세워 손으로 긁게 한다.
 *
 * `icon` 은 표지 끝의 둥근 아이콘, `label` 은 글 끝의 보조 단추다.
 */
export function ShareReadingButton({ target, look = 'label' }: { target: ReadingTarget; look?: 'label' | 'icon' }) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [link, setLink] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (phase !== 'copied') return;
    const timer = setTimeout(() => setPhase('idle'), 4000);
    return () => clearTimeout(timer);
  }, [phase]);

  const start = async () => {
    setPhase('working');
    setNotice(null);
    const issued = await shareMyReading(target);
    if (!issued.ok) {
      setPhase('failed');
      setNotice(issued.message);
      return;
    }
    setLink(issued.url);
    try {
      await Clipboard.setStringAsync(issued.url);
      setPhase('copied');
    } catch {
      setPhase('failed');
      setNotice('링크를 복사하지 못했어요. 아래 주소를 직접 선택해 복사해 주세요.');
    }
  };

  const label = phase === 'working' ? '만드는 중…' : phase === 'copied' ? COPIED : IDLE;
  const trouble =
    phase === 'failed' && notice !== null ? (
      <View style={styles.trouble}>
        <Text accessibilityRole="alert" style={styles.failure}>{notice}</Text>
        {link !== null && <TextInput editable={false} selectTextOnFocus value={link} accessibilityLabel="공유 주소" style={styles.address} />}
      </View>
    ) : null;

  if (look === 'icon') {
    return (
      <View style={styles.iconWrap}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={label}
          accessibilityLiveRegion="polite"
          disabled={phase === 'working'}
          onPress={() => void start()}
          style={styles.icon}
        >
          <LinkMark copied={phase === 'copied'} />
        </Pressable>
        {phase === 'copied' && <Text style={styles.bubble}>{COPIED}</Text>}
        {trouble !== null && <MenuPanel style={styles.floating}>{trouble}</MenuPanel>}
      </View>
    );
  }

  return (
    <View style={styles.label}>
      <SecondaryButton label={label} onPress={() => void start()} disabled={phase === 'working'} />
      {trouble}
    </View>
  );
}

const styles = StyleSheet.create({
  label: { gap: 8 },
  iconWrap: { alignItems: 'flex-end' },
  icon: { width: CONTROL, height: CONTROL, alignItems: 'center', justifyContent: 'center', borderRadius: RADIUS.pill, backgroundColor: COLOR.surface },
  bubble: { position: 'absolute', top: CONTROL + 6, right: 0, paddingHorizontal: 12, paddingVertical: 6, borderRadius: RADIUS.pill, overflow: 'hidden', backgroundColor: COLOR.accent, fontFamily: FONT.bold, fontSize: TYPE.small, color: COLOR.onAccent },
  floating: { position: 'absolute', top: CONTROL + 6, right: 0, width: 260 },
  trouble: { gap: 8 },
  failure: { fontFamily: FONT.medium, fontSize: TYPE.small, lineHeight: 20, color: COLOR.danger },
  address: { minHeight: CONTROL, paddingHorizontal: 12, borderRadius: RADIUS.cell, borderWidth: 1, borderColor: COLOR.border, backgroundColor: COLOR.surfaceSunken, fontFamily: FONT.medium, fontSize: TYPE.field, color: COLOR.secondary },
});
