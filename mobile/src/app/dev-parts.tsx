import { Redirect } from 'expo-router';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { CONTROL, FIELD, GALLERY, TONE } from '@design';

import { Button, type ButtonVariant } from '@/ui/buttons';
import { Card, CardFrame, Cell, DialogPanel, EmptySlot, MenuPanel, Paper, RowCard, RowLine, Tile } from '@/ui/surfaces';
import { COLOR, FONT, TYPE } from '@/ui/tokens';

/** 나란히 재는 그림의 앱 쪽(`scripts/design-compare.mjs`) — 개발 빌드에서만 선다. 차례 · 글자는 웹 쪽과 같은 `GALLERY` 다 */
const FACES = { Card, CardFrame, Paper, Cell, MenuPanel, RowCard, RowLine, EmptySlot, DialogPanel };

export default function DevPartsScreen() {
  if (!__DEV__) return <Redirect href="/" />;
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} testID="gallery">
      {GALLERY.map(({ app, text }) => {
        const body = <Text style={styles.text}>{text}</Text>;
        if (app === 'Tile') return <Tile key={app} tone={TONE.wood.soft}>{body}</Tile>;
        if (app === 'Field') return <TextInput key={app} style={styles.field} value={text} editable={false} />;
        if (app in FACES) {
          const Face = FACES[app as keyof typeof FACES];
          return <Face key={app} style={app === 'CardFrame' || app === 'MenuPanel' ? styles.inner : undefined}>{body}</Face>;
        }
        return (
          <View key={app} style={styles.button}>
            <Button label={text} onPress={() => undefined} variant={app as ButtonVariant} />
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLOR.background },
  content: { padding: 16, gap: 16 },
  text: { fontFamily: FONT.medium, fontSize: TYPE.body, lineHeight: 24, color: COLOR.foreground },
  inner: { padding: 16 },
  button: { alignItems: 'flex-start', minHeight: CONTROL },
  field: { ...FIELD, fontFamily: FONT.medium, color: COLOR.foreground },
});
