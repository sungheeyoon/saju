'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { DELETION_IRREVERSIBLE_NOTE, DELETION_NOTE } from '@/src/lib/account';

import { BUTTON_DANGER } from '../ui/buttons';
import { requestAccountDeletion } from './requests/actions';
import { SETTINGS_DANGER, SETTINGS_QUIET, SettingsRow } from './settings/card';

/**
 * 떠나는 자리 — **한 번 더 묻고, 무엇이 지워지지 않는지 먼저 말한다.**
 *
 * 「삭제」라고만 적으면 누른 사람은 모든 것이 그 자리에서 사라진다고 읽는다. 실제로는
 * 요청이 접수되는 것이고, 이미 공유된 결과처럼 두 사람의 것인 자료는 한쪽이 지울 수
 * 없다(ADR 0014·0023: 무조건 연쇄 삭제하지 않는다). 그 차이를 누르기 전에 읽힌다.
 *
 * 계정 관리 화면 안에서도 접힌 채로 시작한다. 되돌리기 어려운 작업이므로 설명과
 * 실행 버튼을 처음부터 같은 무게로 세우지 않는다.
 *
 * **모양은 이 파일이 안 정한다**(`settings/card.tsx`). 펴진 판이 카드 안의 또 다른
 * 카드로 서던 동안, 이 자리는 계정 관리의 다른 칸들과 다른 언어를 쓰고 있었다.
 */
export function RequestDeletion() {
  const router = useRouter();
  const [asking, setAsking] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [working, startWorking] = useTransition();

  const leave = () => {
    setFailure(null);
    startWorking(async () => {
      const result = await requestAccountDeletion();
      // 성공하면 이 화면이 통째로 「탈퇴를 신청한 계정입니다」로 바뀐다(`AccountNotice`).
      if (result.ok) router.refresh();
      else setFailure(result.message);
    });
  };

  if (!asking) {
    return (
      /*
        **이 누름은 아무것도 안 지운다.** 자세한 내용을 펴는 것이고, 되돌릴 수 없는
        누름은 그 안의 「탈퇴를 신청합니다」다. 카드의 둘째 줄이 그렇게 말한다.
        이름은 PRD §5.3 의 표(2026-09-23) — 계정 상태에 「삭제」를 안 쓴다.
      */
      <SettingsRow
        help={
          <>
            탈퇴하면 저장한 정보와 이용 기록이 삭제됩니다.
            <br />
            탈퇴 전에 자세한 내용을 확인할 수 있습니다.
          </>
        }
      >
        <button type="button" onClick={() => setAsking(true)} className={SETTINGS_DANGER}>
          탈퇴
        </button>
      </SettingsRow>
    );
  }

  return (
    <SettingsRow
      help={DELETION_NOTE}
      note={DELETION_IRREVERSIBLE_NOTE}
    >
      {/*
        **펴진 판도 이 화면의 줄 하나다.** 전에는 카드 안에 또 하나의 카드(테두리·모서리·
        제목)가 서서, 되돌리기 어려운 자리가 **다른 화면에서 온 것처럼** 보였다. 같은 줄
        모양을 쓰고 무게는 글과 버튼의 색이 든다.
      */}
      {/*
        되돌릴 수 없는 마지막 누름만 **채운 위험 색**이다(`BUTTON_DANGER`). 여는 단추는 흰 알약에
        붉은 글자였으니, 한 번 더 물은 뒤에야 무게가 오른다. 폰에서는 그만두기가 아래로 내려가
        엄지가 먼저 닿는 자리를 위험한 누름에 내주지 않는다 — 두 단추가 같은 폭으로 쌓인다.
      */}
      <div className="flex w-full flex-col-reverse gap-2 sm:w-auto sm:flex-row sm:items-center">
        <button
          type="button"
          onClick={() => setAsking(false)}
          disabled={working}
          className={SETTINGS_QUIET}
        >
          그만두기
        </button>
        <button type="button" onClick={leave} disabled={working} className={BUTTON_DANGER}>
          {working ? '보내는 중…' : '탈퇴를 신청합니다'}
        </button>
      </div>
      {failure !== null && (
        <p role="alert" className="w-full text-sm text-danger">
          {failure}
        </p>
      )}
    </SettingsRow>
  );
}
