'use client';

import { useState, useTransition } from 'react';

import { DELETION_IRREVERSIBLE_NOTE, DELETION_NOTE } from '@/src/lib/account';

import { actionAnswer } from '../ui/action-answer';
import { ConfirmDialog } from '../ui/confirm-dialog';
import { requestAccountDeletion } from './requests/actions';
import { SETTINGS_TEXT_ROW_QUIET } from './settings/card';

/**
 * 떠나는 자리 — **한 번 더 묻고, 무엇이 지워지지 않는지 먼저 말한다.**
 *
 * 「삭제」라고만 적으면 누른 사람은 모든 것이 그 자리에서 사라진다고 읽는다. 실제로는
 * 요청이 접수되는 것이고, 이미 공유된 결과처럼 두 사람의 것인 자료는 한쪽이 지울 수
 * 없다(ADR 0014·0023: 무조건 연쇄 삭제하지 않는다). 그 차이를 누르기 전에 읽힌다.
 *
 * **묻는 것은 확인 창 한 벌이다**(ADR 0166, 운영자 결정 2026-10-18 G-97 ③). 전에는 줄이 그 자리에서 펴져 안내 글과
 * 「탈퇴 신청하기」 · 「취소」가 줄 안에 섰다 — 되돌리기 어려운 다른 누름(차단 · 목록에서 빼기 · 출생 정보 변경)은 모두 창으로
 * 묻는데 여기만 판이었다. 창에는 같은 안내 글이 서고, 첫 초점은 「취소」, 보내는 동안은 Esc · 바깥 누름 · 「취소」가 안 닫는다.
 * 거절되면 창이 열린 채 그 줄이 선다. 성공하면 이 화면이 통째로 「탈퇴를 신청한 계정입니다」로 바뀐다(`AccountNotice`).
 *
 * **여는 자리는 계정 관리 맨 아래의 작은 글자 줄이다**(`settings/card.tsx` 의 `SETTINGS_TEXT_ROW_QUIET`, 2026-10-25) — 토스(설정
 * 「하단의 '탈퇴하기'」) · 카카오톡(설정 › 개인/보안 › … › 탈퇴)처럼 찾을 수는 있되 눈에 덜 띄는 자리다. 알약이던 「탈퇴」를 걷었다.
 */
export function RequestDeletion() {
  const [asking, setAsking] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [working, startWorking] = useTransition();

  const leave = () => {
    setFailure(null);
    startWorking(async () => {
      const result = await actionAnswer(requestAccountDeletion());
      if (!result.ok) setFailure(result.message);
    });
  };

  return (
    /*
      **여는 누름은 아무것도 안 지운다.** 창을 여는 것이고, 되돌릴 수 없는 누름은 그 안의 「탈퇴 신청하기」다. 이름은 PRD 「계정이
      멈추는 자리」 의 표(2026-09-23) — 계정 상태에 「삭제」를 안 쓴다. 무엇이 지워지는지는 창이 먼저 말한다(`DELETION_NOTE`) — 그래서
      여는 줄에 설명을 두 번 적지 않는다(2026-10-25).
    */
    <>
      <button type="button" onClick={() => setAsking(true)} className={SETTINGS_TEXT_ROW_QUIET}>
        탈퇴
      </button>
      {/* 안내 글이 길어 낮은 폰에서는 창이 화면을 넘는다 — 창 안에서 내려 읽는다 */}
      <ConfirmDialog
        open={asking}
        onClose={() => {
          setAsking(false);
          setFailure(null);
        }}
        title="정말 탈퇴할까요?"
        confirmLabel={working ? '보내는 중…' : '탈퇴 신청하기'}
        onConfirm={leave}
        danger
        busy={working}
        failure={failure}
        className="max-h-[85dvh] overflow-y-auto"
      >
        <p>{DELETION_NOTE}</p>
        <p className="text-small leading-5 text-muted">{DELETION_IRREVERSIBLE_NOTE}</p>
      </ConfirmDialog>
    </>
  );
}
