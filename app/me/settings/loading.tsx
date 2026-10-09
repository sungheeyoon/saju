import { Bone, SkeletonMain } from '../../ui/skeleton';

/**
 * 계정 관리의 뼈대 — 제목 · 한 줄 설명, 무리 여섯(작은 제목 · 흰 판의 줄)(`page.tsx` · `card.tsx`). 무리는 실제 화면의
 * 차례다 — 프로필 한 줄 · 어떤 상대 · 인연 찾기 · 선택 동의(설명과 세 줄) · 로그인 정보 · 탈퇴. 줄은 `SETTINGS_ROW` 처럼
 * 폰에서 글 아래 오른쪽 끝에 손잡이가 서고 넓은 화면에서 한 줄이다 — 넷이 같은 높이의 판이면 다 불러온 순간 화면이 출렁였다
 * (2026-10-09 화면 갤러리 감사). 이 기기의 알림 줄은 공개 열쇠가 있는 배포에만 서므로 뼈대에 두지 않는다.
 *
 * 머리글의 톱니에서 여는 화면이다. 탭 넷과 같은 까닭으로 뼈대를 둔다(ADR 0116) — 로그인을 읽는 동적 화면이라 뼈대가
 * 없으면 누른 뒤 서버 응답이 다 올 때까지 지금 화면에 머문다. 이 폴더는 이 화면 하나만 품고 `notFound()` 가 없다.
 */
const GROUPS = [
  { rows: 0, link: true, description: false },
  { rows: 1, link: false, description: false },
  { rows: 1, link: false, description: false },
  { rows: 3, link: false, description: true },
  { rows: 1, link: false, description: false },
  { rows: 1, link: false, description: false },
] as const;

export default function SettingsLoading() {
  return (
    <SkeletonMain name="settings" className="app-shell flex w-full max-w-2xl flex-1 flex-col gap-8 py-8 sm:py-12">
      <div className="flex flex-col gap-1">
        <Bone className="h-[2.275rem] w-36 rounded-full sm:h-[2.6rem]" />
        <Bone className="h-5 w-64 max-w-full rounded-full" />
      </div>
      {GROUPS.map((group, at) => (
        <div key={at} className="flex flex-col gap-2">
          <div className="flex flex-col gap-1 px-1">
            <Bone className="h-6 w-28 rounded-full" />
            {group.description && <Bone className="h-5 w-full rounded-full" />}
          </div>
          <div className="flex flex-col rounded-[1.5rem] border border-border bg-surface px-4 py-1 sm:px-5">
            {group.link && (
              <div className="flex min-h-14 items-center gap-3 py-3">
                <Bone className="size-11 shrink-0 rounded-full" />
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <Bone className="h-5 w-24 rounded-full" />
                  <Bone className="h-4 w-36 rounded-full" />
                </div>
              </div>
            )}
            {Array.from({ length: group.rows }, (_, row) => (
              <div
                key={row}
                className="flex flex-col gap-3 border-t border-border py-4 first:border-0 sm:flex-row sm:items-center sm:justify-between sm:gap-6"
              >
                <div className="flex min-w-0 flex-col gap-1 sm:flex-1">
                  <Bone className="h-5 w-32 rounded-full" />
                  <Bone className="h-5 w-56 max-w-full rounded-full" />
                </div>
                <Bone className="h-11 w-28 shrink-0 self-end rounded-full sm:self-auto" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </SkeletonMain>
  );
}
