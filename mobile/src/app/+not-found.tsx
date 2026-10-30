import { router } from 'expo-router';

import { NoticeLine, NoticeScreen } from '@/ui/notice-screen';
import { PrimaryButton } from '@/ui/parts';

/** 어느 라우트에도 안 맞는 주소 — 웹 `app/not-found.tsx` 와 같은 글자다 */
export default function NotFound() {
  return (
    <NoticeScreen
      title="페이지를 찾을 수 없어요"
      description={<NoticeLine>주소가 잘못되었거나 페이지가 이동되었을 수 있어요.</NoticeLine>}
      actions={<PrimaryButton label="홈으로" onPress={() => router.replace('/')} />}
    />
  );
}
