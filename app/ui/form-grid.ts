/**
 * **입력 서식 한 벌 — 서식지 격자**(폼 디자인 C, 2026-10-03).
 *
 * 역술원 접수지 · 만세력 기입 서식처럼 가는 선으로 짠 표 한 장이다. 이름표 칸과 값 칸이 표의 셀로 맞물리고,
 * 년 · 월 · 일 · 시 · 분은 한 줄에 셀이 이어지며, 고르는 칸은 셀 안의 ○ · ● 이다.
 *
 * 앞 모양(「설정 목록」, ADR 0132)은 줄마다 같은 48px · 같은 좌우 여백 · 같은 회색 칸 + 꺾쇠였다 — 이름도 값도
 * 고르는 것도 적는 것도 한 모양이라 무엇을 적는 자리인지가 글자로만 갈렸다. 여기서는 **칸의 생김이 할 일을 말한다**:
 * 적는 칸은 빈 셀, 고르는 칸은 동그라미가 박힌 셀, 숫자 칸은 단위가 찍힌 좁은 셀.
 *
 * ## 선은 세 굵기다
 *
 * 바깥 테 1.5px(먹 70%) · 묶음 사이 1px(먹 24%) · 칸 사이 1px(먹 11%) — 색 토큰은 `globals.css` 의 `--form-*`.
 * 그림자는 안 쓴다 — 종이 위의 인쇄된 표라 떠 있지 않다.
 *
 * ## 칸의 여백은 위아래와 좌우가 다르다
 *
 * 칸 높이는 폰 52px · 넓은 서식 56px. 위아래 여백은 0 이고 높이가 글줄을 가운데 세운다 — 좌우는 폰 14px · 넓은 서식
 * 18px. 이름표 칸은 폰 80px · 넓은 서식 104px 로 **고정**이라 값 칸들의 왼쪽 끝이 한 세로줄에 선다.
 *
 * ## 좁으면 쌓는다
 *
 * 서식(`@container`)이 18rem(288px) 아래로 좁아지면 이름표가 값 위의 띠로 올라선다 — 이름표 80px 을 떼고 나면 값 칸이
 * 년 · 월 · 일 세 셀을 못 든다. 폰 360~430px 의 첫 화면 · 카드는 이 문턱 위라 나란히 선다.
 */

/** 서식 한 장 — 바깥 테. 안의 줄이 칸을 나눈다 */
export const SHEET =
  '@container overflow-hidden rounded-[0.625rem] border-[1.5px] border-[var(--form-rule)] bg-surface text-foreground';

/** 덧붙은 서식(고급 설정) — 테가 한 단 옅다. 본 서식보다 먼저 읽히지 않게 */
export const SHEET_MINOR =
  '@container overflow-hidden rounded-[0.625rem] border border-[var(--form-rule-group)] bg-surface text-foreground';

/** 묶음 — 성질이 같은 줄끼리(누구 · 언제 · 어디서). 묶음 사이는 한 단 짙은 선이다 */
export const SHEET_GROUP = 'border-t border-[var(--form-rule-group)] first:border-t-0';

/**
 * 줄 — 이름표 칸 | 값 칸. 줄 사이는 가장 옅은 선이다(`SHEET_GROUP` 안의 둘째 줄부터).
 * 이름표 칸의 면은 줄 높이를 다 채우고(`items-stretch`), 초점이 든 줄의 이름표는 크림으로 선다.
 */
export const SHEET_ROW_GRID =
  'group/row grid min-h-[3.25rem] grid-cols-1 items-stretch @[18rem]:grid-cols-[5rem_minmax(0,1fr)] @md:min-h-14 @md:grid-cols-[6.5rem_minmax(0,1fr)]';

/** 줄 사이 옅은 선 — 묶음의 첫 줄에는 안 긋는다(묶음 선이 그 자리다) */
export const SHEET_ROW_RULE = 'border-t border-[var(--form-rule-cell)] first:border-t-0';

export const SHEET_ROW = `${SHEET_ROW_GRID} ${SHEET_ROW_RULE}`;

/** 이름표 칸 — 좁은 고정 폭 · 옅은 면 · 13px 굵게. 좁은 서식에서는 값 위의 띠가 된다 */
export const SHEET_LABEL =
  'flex min-h-7 flex-col justify-center gap-0.5 border-b border-[var(--form-rule-cell)] bg-[var(--form-label-bg)] px-3 py-1 text-[13px] font-semibold leading-4 tracking-[0.01em] text-secondary transition-colors @[18rem]:border-r @[18rem]:border-b-0 @md:px-[1.125rem] group-focus-within/row:bg-[var(--form-label-on)] group-focus-within/row:text-foreground';

/** 이름표 칸 아래의 작은 덧말(「24시간」) */
export const SHEET_LABEL_HINT = 'text-xs font-medium text-muted';

/** 초점 — 칸 안쪽에 두르는 먹 테 2px. 칸이 맞물려 있어 바깥으로 두르면 이웃 칸에 걸린다 */
const FOCUS_INSET = 'outline-none focus-visible:shadow-[inset_0_0_0_2px_var(--form-focus)]';

/** 적는 칸 — 값 칸을 다 채우는 글 입력. 위아래 여백 없이 줄 높이가 가운데 세운다 */
export const SHEET_TEXT = `h-full min-h-[3.25rem] w-full min-w-0 bg-transparent px-3.5 text-[17px] font-medium text-foreground placeholder:font-normal placeholder:text-[15px] placeholder:text-muted @md:min-h-14 @md:px-[1.125rem] focus:shadow-[inset_0_0_0_2px_var(--form-focus)] ${FOCUS_INSET}`;

/**
 * 숫자 셀들이 이어지는 값 칸 — 셀 사이는 옅은 세로선. 셀의 폭은 부르는 쪽이 `flex` 비로 준다(해는 넷, 달 · 날은 둘).
 */
export const SHEET_CELLS = 'flex min-w-0 items-stretch divide-x divide-[var(--form-rule-cell)]';

/** 숫자 셀 하나 — 안의 입력이 셀을 다 채우고, 단위는 셀 오른쪽 끝에 작게 찍힌다 */
export const SHEET_DIGIT_CELL = 'relative flex min-w-0 items-stretch';

/**
 * 숫자 입력 — 오른쪽 정렬이라 숫자가 단위 바로 앞에 선다(종이 서식의 「____년」). 단위 자리만큼 오른쪽을 비운다.
 * 범위를 벗어나면(`aria-invalid`) 셀이 붉은 면 · 붉은 안쪽 테가 된다.
 */
export const SHEET_DIGIT = `h-full min-h-[3.25rem] w-full min-w-0 bg-transparent pl-2 pr-7 text-right text-[17px] font-semibold tabular-nums tracking-[0.02em] text-foreground placeholder:text-[13px] placeholder:font-normal placeholder:tracking-normal placeholder:text-muted @md:min-h-14 @md:pr-8 focus:shadow-[inset_0_0_0_2px_var(--form-focus)] ${FOCUS_INSET} disabled:cursor-not-allowed aria-invalid:bg-danger-wash aria-invalid:text-danger aria-invalid:shadow-[inset_0_0_0_2px_var(--danger)]`;

/** 숫자 셀의 단위 글자(년 · 월 · 일 · 시 · 분) — 누름을 가로채지 않는다 */
export const SHEET_UNIT =
  'pointer-events-none absolute right-2.5 top-[calc(50%+2px)] -translate-y-1/2 text-xs leading-none font-medium text-muted @md:right-3';

/**
 * 고르는 셀 — 셀 전체가 라디오다(보이지 않는 라디오가 셀을 덮는다). 고른 셀은 크림 면 + ● 이고, 키보드 초점은
 * 셀 안쪽의 먹 테다. 고를 수 없을 때는 빗금 면이다(종이 서식의 「해당 없음」).
 */
export const SHEET_CHOICE =
  'group/choice relative flex min-h-11 min-w-0 cursor-pointer items-center gap-2 px-2.5 text-[15px] text-secondary transition-colors hover:text-foreground has-checked:bg-[var(--form-picked)] has-checked:font-semibold has-checked:text-foreground has-[:focus-visible]:shadow-[inset_0_0_0_2px_var(--form-focus)] has-disabled:cursor-not-allowed has-disabled:text-muted has-disabled:bg-[repeating-linear-gradient(135deg,transparent_0_6px,var(--form-rule-cell)_6px_7px)] @md:px-[1.125rem]';

/** 셀을 덮는 라디오 — 눌리는 것도 초점을 받는 것도 이것이다 */
export const SHEET_CHOICE_INPUT = 'peer absolute inset-0 cursor-pointer appearance-none opacity-0 disabled:cursor-not-allowed';

/** ○ — 고르면 먹색 ●(안에 흰 테 한 겹). 색만으로 고름을 말하지 않는다 */
export const SHEET_MARK =
  'grid size-4 shrink-0 place-items-center rounded-full border-[1.5px] border-[var(--form-rule-group)] bg-surface transition-colors group-hover/choice:border-[var(--form-rule)] peer-checked:border-foreground peer-checked:bg-foreground peer-checked:shadow-[inset_0_0_0_2.5px_var(--surface)]';

/** 고르는 셀 안의 덧말(「경계 23:00」) — 이름 아래 작은 줄 */
export const SHEET_CHOICE_HINT = 'block text-xs font-normal leading-4 text-muted';

/**
 * 펼치는 줄의 값 칸(출생지 — 열 곳이라 한 줄에 다 안 선다). 고른 값이 왼쪽, 오른쪽 끝에 작은 ▾.
 */
export const SHEET_DISCLOSE =
  'flex min-w-0 items-center justify-between gap-2 px-3.5 text-left text-[17px] font-medium text-foreground @md:px-[1.125rem]';

/** 서식 아래 덧줄(음력을 양력으로 바꾼 줄) — 서식 왼쪽 끝에 맞춘다 */
export const SHEET_NOTE = 'px-1 text-[13px] leading-5';

/**
 * 서식에 붙는 거절 줄 — 눌렀는데 못 간 이유. 왼쪽 굵은 붉은 선 + 옅은 붉은 면이라 서식의 칸과 다른 것으로 읽힌다.
 */
export const SHEET_ALERT =
  'flex items-start gap-2 rounded-[0.375rem] border-l-[3px] border-danger bg-danger-wash px-3 py-2 text-sm font-medium leading-5 text-danger';

/**
 * 서식의 제출 단추 — 서식과 같은 모서리(10px)의 먹색 판. 앱의 주 단추(알약, `BUTTON_PRIMARY`)와 높이 · 색은 같고
 * 모서리만 서식을 따른다 — 표 아래 붙은 「접수」 칸으로 읽히게.
 */
export const SHEET_SUBMIT =
  'inline-flex min-h-[3.25rem] items-center justify-center gap-2 rounded-[0.625rem] bg-accent px-6 text-base font-semibold tracking-[0.01em] text-on-accent hover:bg-accent-strong active:scale-[0.985] disabled:pointer-events-none disabled:opacity-55';

/**
 * 곁 폼의 낱칸(가입 코드 · 닉네임 · 소개 · 메모) — 같은 선과 모서리로 선 칸 하나. 테는 묶음 굵기(먹 24%)이고 초점이면
 * 바깥 테 굵기(먹 70%) + 안쪽 테다.
 */
export const FIELD =
  'min-h-12 rounded-[0.5rem] border border-[var(--form-rule-group)] bg-surface px-3.5 text-base text-foreground outline-none placeholder:text-[15px] placeholder:text-muted hover:border-[var(--form-rule)] focus:border-[var(--form-rule)] focus:shadow-[inset_0_0_0_1px_var(--form-rule)] aria-invalid:border-danger';

/** 곁 폼의 낱칸 곁 단추(닉네임 「중복 확인」) — 칸과 같은 높이 · 모서리 · 테, 이름표 칸의 면 */
export const FIELD_ACTION =
  'inline-flex min-h-12 shrink-0 items-center justify-center rounded-[0.5rem] border border-[var(--form-rule-group)] bg-[var(--form-label-bg)] px-4 text-sm font-semibold text-foreground hover:border-[var(--form-rule)] active:scale-[0.97] disabled:pointer-events-none disabled:opacity-55';

/** 곁 폼의 이름표 — 칸 위에 서는 13px 굵은 글자 */
export const FIELD_LABEL = 'text-[13px] font-semibold tracking-[0.01em] text-secondary';

/**
 * 곁 폼의 고르는 칸(설문의 보기 · 가입의 동의 상자) — 같은 선의 낱칸, 고르면 크림 면 + 먹 테.
 */
export const FIELD_CHOICE =
  'flex cursor-pointer items-center gap-3 rounded-[0.5rem] border border-[var(--form-rule-group)] bg-surface px-3.5 py-2.5 text-[15px] leading-6 hover:border-[var(--form-rule)] has-checked:border-[var(--form-rule)] has-checked:bg-[var(--form-picked)] has-checked:shadow-[inset_0_0_0_1px_var(--form-rule)] has-[:focus-visible]:shadow-[inset_0_0_0_2px_var(--form-focus)]';
