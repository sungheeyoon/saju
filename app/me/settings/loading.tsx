import { Bone, SkeletonMain } from '../../ui/skeleton';
import { COLUMN } from '../../ui/surfaces';

/**
 * 계정 관리의 뼈대 — 제목 · 한 줄 설명, 무리 여섯(작은 이름 · 위아래 구분선 사이의 줄)(`page.tsx` · `card.tsx`). 무리는 실제 화면의
 * 차례다 — 프로필 한 줄 · 어떤 상대 · 인연 찾기 · 선택 동의(설명과 세 줄) · 로그인 정보(이메일 · 로그아웃), 그 아래 탈퇴 글자 줄.
 * 이 기기의 알림 줄은 공개 열쇠가 있는 배포에만 서므로 뼈대에 두지 않는다.
 *
 * 2026-10-25 설정 목록 재배치로 판(카드)이 걷히고 켜고 끄기가 스위치가 됐다 — 스위치 줄은 폰에서도 손잡이가 글 옆에 서므로 뼈대도
 * 줄 오른쪽에 작은 알약(스위치 자리)을 세운다. 성별 칸만 폰에서 글 아래로 내려온다.
 *
 * 머리글의 톱니에서 여는 화면이다. 탭 넷과 같은 까닭으로 뼈대를 둔다(ADR 0116) — 로그인을 읽는 동적 화면이라 뼈대가
 * 없으면 누른 뒤 서버 응답이 다 올 때까지 지금 화면에 머문다. 이 폴더는 이 화면 하나만 품고 `notFound()` 가 없다.
 */
type Row = { kind: 'link' } | { kind: 'switch'; text: string } | { kind: 'choice' } | { kind: 'text'; text: string };

const GROUPS: { description: boolean; rows: Row[] }[] = [
  { description: false, rows: [{ kind: 'link' }] },
  { description: false, rows: [{ kind: 'choice' }, { kind: 'text', text: 'h-5' }] },
  { description: false, rows: [{ kind: 'switch', text: 'h-16 sm:h-12' }] },
  {
    description: true,
    rows: [{ kind: 'switch', text: 'h-19' }, { kind: 'switch', text: 'h-24 sm:h-19' }, { kind: 'link' }],
  },
  { description: false, rows: [{ kind: 'text', text: 'h-5' }, { kind: 'text', text: 'h-6' }] },
];

export default function SettingsLoading() {
  return (
    <SkeletonMain name="settings" className={`app-shell flex w-full ${COLUMN} flex-1 flex-col gap-8 py-8 sm:py-12`}>
      <div className="flex flex-col gap-1">
        <Bone className="h-[2.275rem] w-36 rounded-full sm:h-[2.6rem]" />
        <Bone className="h-5 w-64 max-w-full rounded-full" />
      </div>
      {GROUPS.map((group, at) => (
        <div key={at} className="flex flex-col gap-1">
          <div className="flex flex-col gap-1 pb-1">
            <Bone className="h-5 w-24 rounded-full" />
            {group.description && <Bone className="h-5 w-full rounded-full" />}
          </div>
          <div className="flex flex-col border-y border-border">
            {group.rows.map((row, line) => (
              <div key={line} className="border-t border-border py-4 first:border-0">
                {row.kind === 'link' && (
                  <div className="flex min-h-12 items-center gap-3">
                    <Bone className="size-11 shrink-0 rounded-full" />
                    <div className="flex min-w-0 flex-1 flex-col gap-1">
                      <Bone className="h-5 w-24 rounded-full" />
                      <Bone className="h-4 w-36 rounded-full" />
                    </div>
                  </div>
                )}
                {row.kind === 'switch' && (
                  <div className="flex items-center gap-4">
                    <div className={`flex min-w-0 flex-1 flex-col gap-2 overflow-hidden ${row.text}`}>
                      <Bone className="h-5 w-32 max-w-full shrink-0 rounded-full" />
                      <Bone className="h-4 w-full max-w-sm shrink-0 rounded-full" />
                      <Bone className="h-4 w-3/4 max-w-sm shrink-0 rounded-full" />
                    </div>
                    <Bone className="h-8 w-[3.25rem] shrink-0 rounded-full" />
                  </div>
                )}
                {row.kind === 'choice' && (
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <Bone className="h-5 w-12 rounded-full" />
                    <Bone className="h-11 w-full rounded-cell sm:w-64" />
                  </div>
                )}
                {row.kind === 'text' && <Bone className={`${row.text} w-48 max-w-full rounded-full`} />}
              </div>
            ))}
          </div>
        </div>
      ))}
      <Bone className="h-5 w-10 rounded-full" />
    </SkeletonMain>
  );
}
