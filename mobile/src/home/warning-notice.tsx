import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { WARNING_ACKNOWLEDGE_LABEL, WARNING_NOTICE_TITLE, warningNoticeLines, type WarningNotice as Notice } from '@account/warning';
import { SUPPORT_EMAIL } from '@brand';
import { userFacingDbMessage } from '@db-error';

import { supabase } from '@/auth/client';
import { PrimaryButton } from '@/ui/parts';
import { COLOR, FONT, RADIUS, TYPE } from '@/ui/tokens';

/** 웹의 `--danger-wash` */
const DANGER_WASH = '#faeae7';

/**
 * 경고를 받은 사람에게 서는 안내 — 웹의 `app/me/warning/warning-notice.tsx` 와 같은 문 · 같은 글자다(ADR 0108).
 * 무엇을 내주는가는 문이 정한다. 못 읽었으면 안 그린다 — 부속 정보다. 못 적었으면 안내는 그대로 둔다 — 안 읽은 채 사라지면 「알렸는가」가 거짓이 된다.
 */
export function WarningNotice() {
  const [notice, setNotice] = useState<Notice | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const read = useCallback(async () => {
    if (supabase === null) return;
    const { data, error } = await supabase.rpc('my_warning_notice');
    const row = data?.[0];
    if (error !== null || row === undefined) setNotice(null);
    else setNotice({ ref: row.warning_ref, category: row.category, warnedOn: row.warned_on });
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 여는 때 읽는다 - setState 는 await 뒤라 렌더와 겹치지 않는다
    void read();
  }, [read]);

  if (notice === null) return null;

  const acknowledge = async () => {
    if (supabase === null) return;
    setFailure(null);
    setSaving(true);
    /* 문이 `false` 를 내는 것(이미 확인했거나 내 번호가 아니다)도 성공이다 — 어느 쪽이든 다시 안 선다 */
    const { error } = await supabase.rpc('acknowledge_warning', { p_ref: notice.ref });
    if (error !== null) setFailure(userFacingDbMessage(error, 'acknowledge_warning'));
    else await read();
    setSaving(false);
  };

  return (
    <View style={styles.wrap}>
      <View accessibilityLabel={WARNING_NOTICE_TITLE} style={styles.card}>
        <Text accessibilityRole="header" style={styles.title}>{WARNING_NOTICE_TITLE}</Text>
        <View style={styles.lines}>
          {warningNoticeLines(notice, SUPPORT_EMAIL).map((line) => (
            <Text key={line} style={styles.line}>{line}</Text>
          ))}
        </View>
        <PrimaryButton label={WARNING_ACKNOWLEDGE_LABEL} onPress={() => void acknowledge()} disabled={saving} />
        {failure !== null && <Text accessibilityRole="alert" style={styles.failure}>{failure}</Text>}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 8 },
  card: { gap: 12, padding: 20, borderRadius: RADIUS.panel, borderWidth: 1, borderColor: 'rgba(163, 71, 63, 0.4)', backgroundColor: DANGER_WASH },
  title: { fontFamily: FONT.bold, fontSize: TYPE.lead, color: COLOR.danger },
  lines: { gap: 4 },
  line: { fontFamily: FONT.medium, fontSize: TYPE.body, lineHeight: 24, color: COLOR.foreground },
  failure: { fontFamily: FONT.medium, fontSize: TYPE.small, color: COLOR.danger },
});
