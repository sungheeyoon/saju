import { useRef, useState, type ComponentRef, type ReactNode } from 'react';
import { Dimensions, Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { MenuPanel } from '@/ui/surfaces';
import { COLOR, CONTROL, FONT, TYPE } from '@/ui/tokens';

import { ChatIcon, type ChatIconName } from './icons';

export type MenuItem = { readonly label: string; readonly icon: ChatIconName; readonly danger?: boolean; readonly onPress: () => void };

/** 「⋯」 같은 작은 판 — 누른 자리 곁에 서고, 바깥을 누르면 닫힌다. 고르면 먼저 닫고 그 일을 한다 */
export function AnchoredMenu({ label, items, above = false, children }: { label: string; items: readonly MenuItem[]; above?: boolean; children: ReactNode }) {
  const anchor = useRef<ComponentRef<typeof Pressable>>(null);
  const [place, setPlace] = useState<{ right: number; top?: number; bottom?: number } | null>(null);

  const open = () => {
    anchor.current?.measureInWindow((x, y, width, height) => {
      const window = Dimensions.get('window');
      const right = Math.max(8, window.width - x - width);
      setPlace(above ? { right, bottom: window.height - y + 4 } : { right, top: y + height + 4 });
    });
  };

  return (
    <>
      <Pressable ref={anchor} accessibilityRole="button" accessibilityLabel={label} onPress={open} style={styles.anchor}>
        {children}
      </Pressable>
      <Modal transparent visible={place !== null} animationType="none" onRequestClose={() => setPlace(null)}>
        <Pressable accessibilityLabel="닫기" style={styles.outside} onPress={() => setPlace(null)} />
        {place !== null && (
          <MenuPanel style={[styles.panel, place]}>
            {items.map((item) => (
              <Pressable
                key={item.label}
                accessibilityRole="button"
                style={styles.item}
                onPress={() => {
                  setPlace(null);
                  item.onPress();
                }}
              >
                <ChatIcon name={item.icon} color={item.danger === true ? COLOR.danger : COLOR.foreground} size={18} />
                <Text style={[styles.itemText, item.danger === true && styles.danger]}>{item.label}</Text>
              </Pressable>
            ))}
          </MenuPanel>
        )}
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  anchor: { minHeight: CONTROL, minWidth: CONTROL, alignItems: 'center', justifyContent: 'center', borderRadius: RADIUS.pill },
  outside: { ...StyleSheet.absoluteFill },
  panel: { position: 'absolute', width: 192, padding: 6 },
  item: { minHeight: CONTROL, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12 },
  itemText: { fontSize: TYPE.body, fontFamily: FONT.bold, color: COLOR.foreground },
  danger: { color: COLOR.danger },
});
