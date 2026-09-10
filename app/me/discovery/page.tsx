import { redirect } from 'next/navigation';

export const metadata = {
  title: '인연 찾기 설정 — 만세력',
  description: '인연 목록에 어떻게 서고, 무엇이 공개되는지 정합니다.',
};

/** 예전 주소로 들어와도 계정 관리의 새 자리로 이어 준다. */
export default async function DiscoveryPage() {
  redirect('/me/settings');
}
