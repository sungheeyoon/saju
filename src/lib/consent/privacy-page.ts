/**
 * **처리방침 화면이 `noticeFor` 밖에서 세우는 글** — 고지한 판의 글자라 웹과 앱이 이 한 벌을 읽는다. 조항 본문은 `notice.ts` 다.
 */
export const PRIVACY_INTRO = '이 서비스는 초대받은 분만 쓰는 비공개 베타입니다.';
export const PRIVACY_OPTIONAL_TITLE = '선택 항목';
export const PRIVACY_RIGHTS_TITLE = '확인하고 고치고 지우는 방법';

export const PRIVACY_RIGHTS_LINES = [
  '내 출생 정보는 프로필 화면에서, 등록한 가족·친구의 출생 정보는 저장한 사람 화면에서 언제든 고칠 수 있습니다.',
  '선택 동의는 설정 화면에서 켜고 끌 수 있습니다.',
  '계정과 저장된 정보의 삭제는 설정 화면에서 요청하실 수 있습니다. 상세 궁합이 열려 있던 상대가 있다면 그 결과는 양쪽 화면에서 함께 사라집니다.',
  '문의는 이 서비스를 초대해 드린 주소로 회신해 주시면 됩니다. 운영자가 직접 답합니다.',
] as const;

export const privacyPurgeNote = (purgeWithinDays: number): string =>
  `비공개 베타 기간의 정보 파기 시점은 위 종료일을 기준으로 합니다(종료 후 ${purgeWithinDays}일 이내). 공개 전환 시에는 이 방침을 다시 씁니다.`;
