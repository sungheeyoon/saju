import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from './buttons';
import { Icon, type IconName } from './icons';
import { COLOR, FONT, RADIUS, TYPE } from './tokens';

/** 빈 상태 한 벌 — 웹 `app/ui/empty-state.tsx`. 그림 · 제목 · 한 줄 · 단추 하나가 가운데에 선다 */
export function EmptyState({
  icon = 'spark',
  art,
  title,
  children,
  action,
}: {
  icon?: IconName;
  /** 그린 그림 — 있으면 `icon` 대신 선다 */
  art?: ReactNode;
  title: string;
  children?: ReactNode;
  action?: { label: string; onPress: () => void };
}) {
  return (
    <View style={styles.wrap}>
      <View style={styles.art}>
        {art ?? (
          <View style={styles.mark}>
            <Icon name={icon} size={28} color={COLOR.creamInk} />
          </View>
        )}
      </View>
      <Text accessibilityRole="header" style={styles.title}>{title}</Text>
      {children !== undefined && <Text style={styles.body}>{children}</Text>}
      {action !== undefined && <Button variant="primary-small" label={action.label} onPress={action.onPress} style={styles.action} />}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', paddingHorizontal: 16, paddingVertical: 48 },
  art: { marginBottom: 16 },
  mark: { width: 64, height: 64, alignItems: 'center', justifyContent: 'center', borderRadius: RADIUS.pill, backgroundColor: COLOR.surfaceSunken },
  title: { fontFamily: FONT.bold, fontSize: TYPE.heading, lineHeight: 29, color: COLOR.foreground, textAlign: 'center' },
  body: { maxWidth: 384, marginTop: 6, fontFamily: FONT.medium, fontSize: TYPE.body, lineHeight: 24, color: COLOR.secondary, textAlign: 'center' },
  action: { marginTop: 24 },
});
