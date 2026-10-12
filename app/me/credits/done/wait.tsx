'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

/** 다시 묻는 간격과 횟수 — 웹훅은 보통 몇 초 안에 오고, PortOne 은 못 받으면 몇 분에 걸쳐 다시 보낸다 */
const EVERY_MS = 3_000;
const TIMES = 20;

/**
 * **결제를 확인하는 동안 화면을 서버에서 다시 받는다.** 결제창이 닫힌 때와 웹훅이 주문을 승인하는 때는 따로라, 결제 뒤 화면이 먼저
 * 서면 주문은 아직 대기다. 1분 동안 3초마다 다시 받아 그린다 — 그 뒤에는 사람이 다시 연다.
 */
export function WaitForApproval() {
  const router = useRouter();
  useEffect(() => {
    let left = TIMES;
    const timer = window.setInterval(() => {
      left -= 1;
      if (left < 0) window.clearInterval(timer);
      else router.refresh();
    }, EVERY_MS);
    return () => window.clearInterval(timer);
  }, [router]);
  return null;
}
