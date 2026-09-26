import { initialOf } from '@/src/lib/profile';
import type { Element } from '@/src/lib/saju';

import { elementScope } from '../ui/element-tone';

/**
 * 사람 하나가 서는 자리 — **없으면 없는 대로 선다.**
 *
 * 사진은 선택이다(PRD 「이름과 얼굴」). 안 올린 사람 자리에 「사진을 올려 주세요」를 세우면 그 자리가
 * 채우라는 재촉이 되고, 목록 전체가 미완성으로 보인다. 그래서 이름의 첫 글자를 세운다 —
 * 빈 자리가 아니라 **그 사람의 자리**로 보이게.
 *
 * 주소는 판정하지 않는다. 볼 수 없는 사진이면 그 주소가 404 를 내고, 브라우저는 대체
 * 글자를 그대로 둔다.
 */
export function Avatar({
  userId,
  nickname,
  hasPhoto,
  size = 40,
  tone,
}: {
  userId: string;
  nickname: string;
  hasPhoto: boolean;
  /** 픽셀. 카드는 40, 프로필 화면은 96 */
  size?: number;
  /**
   * 그 사람의 오행 — 주면 둘레에 그 오행의 파스텔 고리가 서고 첫 글자가 그 오행의 글자색을 입는다(채팅). 사진 위에서도
   * 누구의 색인지 남는다. `null` 은 「모른다」의 회색 한 벌, 안 주면 고리 없는 예전 모양이다. 색은 꾸밈이다.
   */
  tone?: Element | null;
}) {
  const box = `${size}px`;
  const ringed = tone !== undefined;

  return (
    <span
      aria-hidden="true"
      className={`inline-flex shrink-0 rounded-full ${ringed ? `${elementScope(tone ?? null)} bg-[var(--tile)] p-[3px]` : ''}`}
      style={{ width: box, height: box }}
    >
      <span
        className={`flex h-full w-full items-center justify-center overflow-hidden rounded-full ${
          ringed ? 'bg-[color-mix(in_srgb,var(--surface)_60%,transparent)] text-[var(--ink)]' : 'bg-surface-sunken text-secondary'
        }`}
        style={{ fontSize: `${Math.round(size * (ringed ? 0.36 : 0.4))}px` }}
      >
        {hasPhoto ? (
          // eslint-disable-next-line @next/next/no-img-element -- 바이트를 우리 라우트가 내주므로 최적화기가 다시 받아 갈 원본이 없다
          <img
            src={`/me/photo/${userId}`}
            alt=""
            width={size}
            height={size}
            className="h-full w-full object-cover"
          />
        ) : (
          <span className="font-semibold">{initialOf(nickname)}</span>
        )}
      </span>
    </span>
  );
}
