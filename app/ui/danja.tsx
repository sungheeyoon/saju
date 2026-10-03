/**
 * **단자(單子) — 입력폼 한 벌의 생김새**(폼 디자인 F · 한국 전통).
 *
 * 생년월일시를 적는 일을 사주단자를 쓰는 일처럼 보이게 한다 — 한지 한 장, 먹선의 광곽, 세로로 쓴 이름표, 연 · 월 · 일 ·
 * 시의 기둥 칸, 마지막에 찍는 낙관. 이 라운드 전의 폼은 「설정 목록」이었다 — 모든 줄이 48px · 좌우 16px 같은 안쪽 여백의
 * 회색 칸과 꺾쇠였고, 숫자 칸 여섯도 같은 44px 회색 상자였다. 칸마다 하는 일이 다른데 생김새가 하나였다.
 *
 * 판 · 칸 · 초점의 바탕은 `app/globals.css` 의 `.danja` · `.dj-row` · `.dj-label` 이 든다(배경 겹이 여럿이라 클래스 문자열로
 * 못 적는다). 여기는 그 위에 얹는 글자 · 칸 · 단추의 문자열과 낙관 한 점이다. 색은 폼 토큰(`--hanji` · `--ink-*` · `--seal`)과
 * 앱 토큰만 쓴다 — 새 hex 를 짓지 않는다.
 */

/** 판 — 사주쌍변의 한지 한 장. 칸은 계선(`divide-ink-hair`)으로 나뉜다 */
export const DANJA = 'danja flex flex-col divide-y divide-ink-hair';

/** 딸린 쪽지 — 한 겹 선. 고급 설정처럼 본문 밖의 것 */
export const DANJA_SLIP = 'danja-slip flex flex-col divide-y divide-ink-hair';

/**
 * 칸 — 이름표 기둥(`--dj-col`) + 적는 자리. **칸마다 높이가 다르다**: 이름 64px · 고르는 칸 60px · 기둥 칸은 세 줄(한자 ·
 * 숫자 · 단위)이라 104px. 세로 이름표가 길면(「출생 시각」) 칸이 그만큼 자란다.
 */
export const DJ_ROW = 'dj-row grid grid-cols-[var(--dj-col)_minmax(0,1fr)]';

/** 세로 이름표 — 명조 13.5px 굵게, 글자 사이 0.14em. 위에서부터 쓴다 */
export const DJ_LABEL =
  'dj-label mx-auto pt-3.5 pb-3 text-[13.5px] font-bold leading-none tracking-[0.14em] text-foreground';

/** 적은 값 · 고른 값의 글자 — 명조. 숫자는 고정폭 숫자로 */
export const DJ_VALUE = 'font-myeongjo text-[17px] leading-6 text-foreground';

/** 주서(朱書) — 기둥 위의 작은 한자. 옛 글에서 붉은 먹으로 단 풀이처럼 인주색이다 */
export const DJ_HANJA = 'font-myeongjo text-[11px] leading-none tracking-[0.1em] text-seal';

/**
 * 낱칸 — 곁 폼(가입 · 프로필 · 설문 · 메모)의 한 줄 입력. 판 없이 홀로 서므로 한지 면에 먹선 한 줄을 두르고,
 * 위(13px)가 아래(11px)보다 한 단 넓다 — 글자의 기준선이 칸의 아래쪽 2/3 에 앉는다(붓글씨를 칸에 앉히는 자리).
 */
export const DJ_FIELD =
  'min-h-[3.25rem] rounded-[3px] border border-ink-hair bg-hanji bg-[image:var(--hanji-grain)] pl-4 pr-3.5 pt-[13px] pb-[11px] text-[16px] text-foreground outline-none placeholder:text-muted hover:border-ink-line focus:border-ink-line focus:shadow-[inset_0_-2px_0_var(--seal),0_0_0_4px_var(--ink-wash)] aria-invalid:border-danger aria-invalid:shadow-[inset_0_-2px_0_var(--danger)]';

/** 낱칸의 이름표 — 명조 굵게, 위 칸과 붙지 않게 아래 6px */
export const DJ_FIELD_LABEL = 'font-myeongjo text-[14.5px] font-bold tracking-[0.04em] text-foreground';

/**
 * 고르는 낱칸(확인 상자 · 라디오 한 줄) — 한지 면, 고르면 먹이 스민 짙은 한지와 먹선. 상자 자체는 그대로 남아
 * 색만으로 「골랐다」를 말하지 않는다.
 */
export const DJ_CHOICE =
  'flex cursor-pointer gap-3 rounded-[3px] border border-ink-hair bg-hanji px-4 pt-3.5 pb-3 hover:border-ink-line has-checked:border-ink-line has-checked:bg-hanji-deep has-checked:shadow-[inset_3px_0_0_var(--seal)] has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-seal';

/**
 * 낙관 단추 — 폼을 끝맺는 주 단추. 먹 면 · 모서리 3px(알약이 아니다) · 명조, 글 뒤에 인주 낙관이 한 점 찍힌다.
 * 누르면 낙관이 찍히듯 줄어든다. 높이 52px — 앱의 주 단추(48px)보다 한 단 크다, 한 폼에 하나라서.
 */
export const BUTTON_SEAL =
  'group inline-flex min-h-[3.25rem] items-center justify-center gap-3 rounded-[3px] bg-accent pl-6 pr-2 font-myeongjo text-[16px] font-bold tracking-[0.01em] text-on-accent shadow-[0_1px_0_var(--ink-line),0_10px_22px_-14px_var(--ink-line)] hover:bg-accent-strong disabled:pointer-events-none disabled:opacity-55';

/**
 * 낙관 한 점 — 인주 면에 한 글자를 양각으로. 그림이라 낭독기에는 안 읽힌다(단추의 이름은 글이 든다).
 * 글자는 둘이다 — 사주(命) · 궁합(合). PR 본문에 보조 표기로 적었다.
 */
export function Seal({ glyph }: { glyph: '命' | '合' }) {
  return (
    <span
      aria-hidden="true"
      className="grid size-9 shrink-0 -rotate-3 place-items-center rounded-[4px] bg-seal font-myeongjo text-[17px] font-bold leading-none text-on-seal shadow-[inset_0_0_0_2px_var(--seal),inset_0_0_0_3px_color-mix(in_srgb,var(--on-seal)_55%,transparent)] transition-transform duration-150 group-active:scale-90 group-active:rotate-0"
    >
      {glyph}
    </span>
  );
}
