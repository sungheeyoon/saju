import { initialOf } from '@/src/lib/profile';

/**
 * 사람 하나가 서는 자리 — **없으면 없는 대로 선다.**
 *
 * 사진은 선택이다(§5.1). 안 올린 사람 자리에 「사진을 올려 주세요」를 세우면 그 자리가
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
}: {
  userId: string;
  nickname: string;
  hasPhoto: boolean;
  /** 픽셀. 카드는 40, 프로필 화면은 96 */
  size?: number;
}) {
  const box = `${size}px`;

  return (
    <span
      aria-hidden="true"
      className="inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-surface-sunken text-secondary"
      style={{ width: box, height: box, fontSize: `${Math.round(size * 0.4)}px` }}
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
  );
}
