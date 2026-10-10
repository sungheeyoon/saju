/**
 * 2단계 인증 화면의 문구 — **운영자 승인 2026-09-28**(ADR 0123, 「예, 문구대로」). 글자를 바꾸면 다시 표로 묻는다.
 *
 * `/ops/**` 의 운영자 전용 설명은 사전 승인을 생략하는 예외가 있지만(ADR 0103), 이 화면은 「운영자의 권한」에
 * 닿는 문구라 예외에 안 든다(`docs/agents/delegation/working.md` 「사용자와」). 액션의 거절 문장과 화면이 같은 자리에서
 * 읽도록 한곳에 모았다 — e2e 도 이 이름으로 찾는다.
 */
export const SECOND_FACTOR_COPY = {
  title: '2단계 인증',
  enrollNote: '운영 화면은 2단계 인증을 마친 뒤에 열립니다. 인증 앱에 이 계정을 한 번 등록해 주세요.',
  enrollStart: '인증 앱 등록하기',
  enrollStarting: '준비하는 중…',
  scanNote: '인증 앱으로 QR 코드를 찍거나, 아래 설정 키를 직접 입력해 주세요.',
  qrAlt: '인증 앱에 등록할 QR 코드',
  secretLabel: '설정 키',
  secretCopy: '설정 키 복사',
  challengeNote: '인증 앱에 보이는 6자리 코드를 입력해 주세요.',
  codeLabel: '6자리 코드',
  confirm: '확인하기',
  confirming: '확인하는 중…',
  codeShape: '6자리 숫자를 입력해 주세요.',
  wrongCode: '코드가 맞지 않습니다. 인증 앱의 새 코드로 다시 입력해 주세요.',
  alreadyEnrolled: '이미 등록한 인증 앱이 있습니다. 새로고침한 뒤 코드를 입력해 주세요.',
  noFactor: '등록한 인증 앱이 없습니다. 새로고침한 뒤 다시 등록해 주세요.',
  enrollFailed: '등록을 시작하지 못했습니다. 잠시 뒤에 다시 시도해 주세요.',
  verifyFailed: '코드를 확인하지 못했습니다. 잠시 뒤에 다시 시도해 주세요.',
  unread: '인증 상태를 읽지 못했습니다. 잠시 뒤에 새로고침해 주세요.',
} as const;
