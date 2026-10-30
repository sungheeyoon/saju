import { Redirect, router } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { SUPPORT_EMAIL } from '@brand';
import { betaIsOver } from '@consent/gate';
import { betaOverNote } from '@consent/notice';

import { readSchedule, type ScheduleRead } from '@/auth/schedule';
import { NoticeLine, NoticeScreen } from '@/ui/notice-screen';
import { PrimaryButton } from '@/ui/parts';
import { COLOR } from '@/ui/tokens';

/**
 * 테스트 종료 — 웹의 `/closed`. 끝나지 않았거나 못 읽었으면 돌려보낸다: 링크 하나로 「끝났습니다」를 아무 때나 띄우면 거짓말이다.
 * 종료 · 파기의 고지라 합니다체다(ADR 0135).
 */
export default function ClosedScreen() {
  const [schedule, setSchedule] = useState<ScheduleRead | null>(null);

  useEffect(() => {
    let live = true;
    void readSchedule().then((next) => {
      if (live) setSchedule(next);
    });
    return () => {
      live = false;
    };
  }, []);

  if (schedule === null) return <View style={{ flex: 1, backgroundColor: COLOR.background }} />;
  const notice = schedule.ok ? schedule.value : null;
  if (notice === null || !betaIsOver(notice.dates, new Date())) return <Redirect href={'/me' as never} />;

  return (
    <NoticeScreen
      title="비공개 테스트가 끝났습니다"
      description={
        <>
          <NoticeLine>{betaOverNote(notice.dates)}</NoticeLine>
          <NoticeLine>함께해 주셔서 고맙습니다. 남은 문의는 {SUPPORT_EMAIL}으로 보내 주세요.</NoticeLine>
          <NoticeLine>선택 동의 철회와 탈퇴 신청은 설정에서 계속하실 수 있습니다.</NoticeLine>
        </>
      }
      actions={<PrimaryButton label="설정" onPress={() => router.push('/me/settings' as never)} />}
    />
  );
}
