import { router, useFocusEffect } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { SUPPORT_EMAIL } from '@brand';
import { businessInfoFrom } from '@brand/business';
import { refundRequestLine } from '@brand/refund';
import { userFacingDbMessage } from '@db-error';
import { won } from '@reading/bundle';
import { CREDITS_AVAILABLE_LABEL, CREDITS_USAGE_NOTE, CREDITS_USAGE_RATE } from '@reading/notes';
import { paidOrderOf, type PaidOrder } from '@reading/paid-order';

import { supabase } from '@/auth/client';
import { NOT_READY } from '@/auth/signup';
import { BackButton, FailureLine, LinkRow, SettingsGroup, settingsText } from '@/settings/parts';
import { Panel, TextButton } from '@/ui/parts';
import { COLOR, FONT, TYPE } from '@/ui/tokens';

const SITE_URL = process.env.EXPO_PUBLIC_SITE_URL;

type Read<T> = { ok: true; value: T } | { ok: false; message: string };

async function readAvailable(): Promise<Read<number | null>> {
  if (supabase === null) return { ok: false, message: NOT_READY };
  const { data, error } = await supabase.rpc('my_reading_credits');
  if (error !== null) return { ok: false, message: userFacingDbMessage(error, 'my_reading_credits') };
  return { ok: true, value: data?.[0]?.available ?? null };
}

async function readOrders(): Promise<Read<readonly PaidOrder[]>> {
  if (supabase === null) return { ok: false, message: NOT_READY };
  const { data, error } = await supabase.rpc('my_reading_orders');
  if (error !== null) return { ok: false, message: userFacingDbMessage(error, 'my_reading_orders') };
  return { ok: true, value: (data ?? []).map(paidOrderOf) };
}

/**
 * 풀이권 — **보유 수를 보기만 한다.** 구매 자리는 없다 — PG 가 정해지지 않았다. 판매가 열리면 그 차례(G-123 의 결제 줄)에 웹의 상품 화면을 옮긴다.
 */
export function CreditsScreen() {
  const [read, setRead] = useState<Read<number | null> | null>(null);
  const load = useCallback(() => {
    void readAvailable().then(setRead);
  }, []);
  useFocusEffect(load);

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <BackButton label="나" />
        {read !== null && (
          <>
            <View style={styles.head}>
              <Text style={settingsText.title} accessibilityRole="header">
                {CREDITS_AVAILABLE_LABEL}
              </Text>
              <Text style={settingsText.meta}>{CREDITS_USAGE_NOTE}</Text>
            </View>
            {read.ok ? (
              read.value !== null && (
                <Panel tone="cream" style={styles.count}>
                  <Text style={styles.number}>
                    {read.value}
                    <Text style={styles.unit}>장</Text>
                  </Text>
                  <Text style={styles.rate}>{CREDITS_USAGE_RATE}</Text>
                </Panel>
              )
            ) : (
              <FailureLine onRetry={load}>{read.message}</FailureLine>
            )}
            <View style={styles.bleed}>
              <SettingsGroup>
                <LinkRow label="결제 내역" onPress={() => router.push('/me/credits/history' as never)} />
              </SettingsGroup>
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

/** 결제 내역 — 웹 `history-view.tsx` 와 같다: 산 묶음 카드들과 환불 신청 절. 화면 안에서 취소하는 단추는 없다(ADR 0174) */
export function CreditsHistoryScreen() {
  const [read, setRead] = useState<Read<readonly PaidOrder[]> | null>(null);
  const load = useCallback(() => {
    void readOrders().then(setRead);
  }, []);
  useFocusEffect(load);

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <BackButton label={CREDITS_AVAILABLE_LABEL} to="/me/credits" />
        <Text style={settingsText.title} accessibilityRole="header">
          결제 내역
        </Text>
        {read !== null &&
          (!read.ok ? (
            <FailureLine onRetry={load}>{read.message}</FailureLine>
          ) : read.value.length === 0 ? (
            <Text style={settingsText.meta}>결제 내역이 없어요.</Text>
          ) : (
            read.value.map((order) => <OrderCard key={order.orderNumber} order={order} />)
          ))}
        <Panel style={styles.refund}>
          <Text style={styles.name} accessibilityRole="header">
            환불 신청
          </Text>
          {/* 사업자 정보 가운데 이메일만 공개 상수다 — 이 줄이 쓰는 값은 그것뿐이다 */}
          <Text style={settingsText.body}>{refundRequestLine(businessInfoFrom({ email: SUPPORT_EMAIL }))}</Text>
          <Text style={settingsText.body}>주문 번호를 함께 알려 주세요.</Text>
          {SITE_URL ? <TextButton label="환불정책 보기" onPress={() => void WebBrowser.openBrowserAsync(`${SITE_URL}/refund`)} /> : null}
        </Panel>
      </ScrollView>
    </View>
  );
}

function OrderCard({ order }: { order: PaidOrder }) {
  const rows: (readonly [string, string])[] = [
    ['주문 번호', order.orderNumber],
    ['결제 금액', won(order.amount)],
    ...(order.refundedAmount > 0 ? [['환불 금액', won(order.refundedAmount)] as const] : []),
    ['결제 시각', order.paidAt],
    ['유효기간', `${order.validUntil}까지`],
    ['남은 풀이권', `${order.remaining}장`],
  ];
  return (
    <Panel style={styles.order}>
      <View style={styles.orderHead}>
        <Text style={styles.name}>{order.product}</Text>
        <Text style={styles.tag}>{order.status}</Text>
      </View>
      {rows.map(([label, value]) => (
        <View key={label} style={styles.orderRow}>
          <Text style={styles.orderLabel}>{label}</Text>
          <Text selectable style={styles.orderValue}>
            {value}
          </Text>
        </View>
      ))}
    </Panel>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLOR.background },
  content: { flexGrow: 1, gap: 16, padding: 16, paddingBottom: 40 },
  head: { gap: 4 },
  count: { gap: 8 },
  number: { fontSize: TYPE.figure, lineHeight: 48, fontFamily: FONT.bold, color: COLOR.foreground },
  unit: { fontSize: TYPE.lead, fontFamily: FONT.bold },
  rate: { fontSize: TYPE.small, lineHeight: 20, fontFamily: FONT.medium, color: COLOR.creamInk },
  bleed: { marginHorizontal: -16 },
  refund: { gap: 8 },
  order: { gap: 8 },
  orderHead: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  name: { fontSize: TYPE.lead, lineHeight: 26, fontFamily: FONT.bold, color: COLOR.foreground },
  tag: { overflow: 'hidden', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, backgroundColor: COLOR.cream, fontSize: TYPE.fine, fontFamily: FONT.bold, color: COLOR.creamInk },
  orderRow: { flexDirection: 'row', gap: 16 },
  orderLabel: { width: 84, flexShrink: 0, fontSize: TYPE.body, lineHeight: 24, fontFamily: FONT.medium, color: COLOR.secondary },
  orderValue: { flex: 1, minWidth: 0, fontSize: TYPE.body, lineHeight: 24, fontFamily: FONT.medium, color: COLOR.foreground },
});
