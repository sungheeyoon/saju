'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';

import { RESUME_READING_PATH } from '@/src/lib/consent';
import { toSearchParams, type Query } from '@/src/lib/input/query';
import { TASTE_CLOSED_NOTE, TASTE_FAILED_NOTE, TASTE_RETRY_LABEL, TASTE_WRITING_SUBJECT } from '@/src/lib/reading/copy';
import { READING_OUTLINE_STATE } from '@/src/lib/reading/notes';
import { TASTE_WAIT, tasteFirstSectionOf, type TasteAnswer, type TasteFirstSection } from '@/src/lib/reading/taste-visit';
import type { Saju } from '@/src/lib/saju';

import { noteTasteStep, readTaste, requestTaste } from './actions';
import { SelfCard } from './me/home/self-card';
import { READING_DRAFT_KEY, TASTE_SESSION_KEY } from './reading-draft';
import { SignInCarrying } from './sign-in-carrying';
import motion from './taste.module.css';
import { BUTTON_PRIMARY, BUTTON_TERTIARY } from './ui/buttons';
import { Icon } from './ui/icons';
import { reducedMotion } from './ui/motion';
import { CARD, TYPE_META, TYPE_NAME } from './ui/surfaces';

/**
 * 로그인 전 결과의 첫머리 — **내 사주 카드와 잠긴 목차**(흐름 시안 g 의 2~3단계, ADR 0131 의 6 · 7 · ADR 0143).
 *
 * 차례는 **내 사주 카드(천간 그림) → 전체 사주풀이 목차(첫 절에 로그인 전 사주 문단) → 로그인** 이고, 표는 지우지 않고
 * 「사주 자세히 보기」에 접힌다.
 *
 * ## 로그인 전 사주 문단은 목차의 첫 절 자리에 선다
 *
 * 문단은 따로 칸을 세우지 않는다(운영자 결정 2026-10-09, ADR 0143 「2026-10-09 덧」). 가입한 뒤의 전체 사주풀이는 첫 절의 1번이
 * 이 글이 멈춘 물음의 답이다(ADR 0143 의 2) — 그래서 글은 첫 절 자리에서 읽히고, 나머지 절은 자물쇠로 잠겨 「더 보려면
 * 로그인」이 한 칸 안에서 말해진다. 가입 단추는 카드 끝의 하나다.
 *
 * ## 로그인 전 사주 문단의 글은 어디서 오나
 *
 * **이 사람의 사주로 서버가 쓴다**(ADR 0143). 화면은 입력(주소 `#` 뒤의 모양)을 서버 액션에 보내고(`requestTaste`), 서버가
 * 명식을 다시 계산해 근거와 지문을 짓고 · 예약하고 · 모델을 부르고 · 검사한 글을 돌려준다. 같은 입력을 다시 넣으면 같은 글이다
 * (모델을 다시 안 부른다). **실패하면 첫 절도 다른 절처럼 잠긴 채 서고, 다음 시도가 열려 있으면 「다시 시도하기」가 선다** — 다른
 * 글로 바꿔치기하지 않는다.
 *
 * ## 목차는 본 풀이의 절 이름이다
 *
 * 서버(`app/page.tsx`)가 프롬프트의 절 이름을 지어 넘긴다 — 모델이 실제로 단 소제목은 검사 전이라 없고, 우리가 시킨
 * 이름만 참이다. 단추를 누르면 입력을 탭에 두고 로그인 · 가입을 거쳐 「이 사주가 내 사주 맞나요?」로 돌아온다(ADR 0128).
 */
export function Taste({
  query,
  saju,
  outline,
  detail,
  arriving,
  submits,
}: {
  /** 화면에 서 있는 사주의 입력 — 로그인을 다녀와 되찾는 것이 이것이다 */
  query: Query;
  saju: Saju;
  /** 본 사주풀이의 절 이름 */
  outline: readonly string[];
  /** 접어 둘 만세력 — 지우지 않는다 */
  detail: ReactNode;
  /** 방금 제출해서 선 결과인가 — 한 번 물으면 지워진다(`saju-calculator.tsx`) */
  arriving: () => boolean;
  /** 제출 횟수 — 같은 입력을 다시 보내도 머리로 데려가려고 센다 */
  submits: number;
}) {
  const name = query.name.trim();
  const draft = toSearchParams(query).toString();

  /*
    **제출해서 선 결과면 그 머리로 데려간다.** 폼은 결과 위에 있어 단추를 누른 자리에서는 결과가 안 보였다(2026-10-09 화면
    점검 A1). 링크 · 뒤로가기로 들어온 결과는 제출이 없으니 움직이지 않는다 — 궁합 입구(`compat-picker.tsx`)와 같은 몸짓이다.
  */
  const head = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (head.current === null || !arriving()) return;
    head.current.scrollIntoView({ block: 'start', behavior: reducedMotion() ? 'instant' : 'smooth' });
    head.current.focus({ preventScroll: true });
  }, [draft, arriving, submits]);

  return (
    <div className="flex flex-col gap-4">
      {/* 카드는 홈의 내 사주 카드 그대로 — 가입하면 홈에서 만날 얼굴이 이것이다(운영자 2026-09-29) */}
      <div ref={head} tabIndex={-1} className="scroll-mt-24 outline-none">
        <SelfCard personId={null} label={name || '나'} query={query} saju={saju} reading={null} />
      </div>

      <LockedOutline outline={outline} draft={draft} />

      <details id="saju-detail" data-fold="" className="group/detail scroll-mt-24">
        <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 rounded-[1.5rem] border border-border bg-surface px-5 py-4 hover:border-border-strong sm:px-6 [&::-webkit-details-marker]:hidden">
          <span className="min-w-0">
            <span className={TYPE_NAME}>사주 자세히 보기</span>
            <span className="mt-0.5 block text-[13px] leading-5 text-secondary">여덟 글자 · 신살 · 오행 · 용신 · 관계 · 운</span>
          </span>
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-surface-sunken text-secondary transition-transform group-open/detail:rotate-180">
            <Icon name="chevron" className="size-4 rotate-90" />
          </span>
        </summary>
        <div className="pt-4">{detail}</div>
      </details>
    </div>
  );
}


/** 받은 입력 · 몇 번째 물음과 그 답 — 입력이 바뀌거나(다시 제출) 「다시 시도하기」를 누르면 받은 답이 지금 물음의 것이 아니므로 기다림으로 돌아간다 */
type Passage = { draft: string; attempt: number; answer: TasteAnswer };

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * 서버에 묻고, 「기다린다」면 잠깐씩 다시 묻는다 — **상한이 있다**(`TASTE_WAIT`). 상한을 넘기면 시간 초과로 선다.
 * 액션이 던지면(배포가 바뀌어 액션을 못 찾음 · 네트워크) 실패로 서고 「다시 시도하기」를 연다.
 */
async function askTaste(draft: string, alive: () => boolean): Promise<TasteAnswer> {
  let answer: TasteAnswer;
  try {
    answer = await requestTaste(draft);
  } catch {
    return { state: 'failed', retry: true };
  }
  const deadline = Date.now() + TASTE_WAIT.forMs;
  while (answer.state === 'waiting' && alive()) {
    if (Date.now() > deadline) return { state: 'timeout', retry: true };
    await pause(TASTE_WAIT.everyMs);
    try {
      answer = await readTaste(answer.sessionId);
    } catch {
      return { state: 'failed', retry: true };
    }
  }
  return answer;
}

/**
 * 지금 입력의 로그인 전 사주 문단 — 답이 아직 없으면 `null`(기다리는 중) — 과, 같은 입력으로 다시 묻는 손잡이.
 *
 * **「다시 시도하기」는 같은 입력을 다시 보낸다**(운영자 결정 2026-10-10, ADR 0143 「2026-10-10 덧」) — 서버가 같은 글의 다음
 * 시도를 연다(세 번까지, `reserve_taste`). 2026-10-09 에 걷었던 「다시 읽기」를 이 이름으로 되살렸다.
 */
function useTasteAnswer(draft: string): { answer: TasteAnswer | null; retry: () => void } {
  const [passage, setPassage] = useState<Passage | null>(null);
  /** 「다시 시도하기」를 누를 때마다 하나씩 — 같은 입력으로 다시 묻게 한다 */
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let alive = true;
    void askTaste(draft, () => alive).then((answer) => {
      if (alive) setPassage({ draft, attempt, answer });
    });
    return () => {
      alive = false;
    };
  }, [draft, attempt]);

  const retry = useCallback(() => setAttempt((at) => at + 1), []);
  const answer = passage !== null && passage.draft === draft && passage.attempt === attempt ? passage.answer : null;
  return { answer, retry };
}

/**
 * 퍼널 한 단계 — 답을 안 기다리고, 못 세도 누름은 그대로다. **글이 선 세션이 있을 때만** 센다 — 세션당 한 번이라 세션이
 * 없는 누름(글이 못 선 자리의 가입 단추)은 셀 자리가 없다.
 */
const note = (step: 'signup_started', sessionId: string | null) => {
  if (sessionId === null) return;
  void noteTasteStep(step, sessionId).catch(() => undefined);
};

/** 문단 — 빈 줄로 가른다 */
const paragraphsOf = (text: string): string[] =>
  text
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph !== '');

/** 잠긴 절 아래의 흐린 막대 — 글이 이어지는 듯한 모양이라 읽히지 않는다(`aria-hidden`) */
const BLURRED_LINES = (
  <div aria-hidden className="mt-2 flex flex-col gap-1.5 blur-[2px]">
    <span className="h-2.5 w-full rounded-full bg-surface-sunken" />
    <span className="h-2.5 w-4/5 rounded-full bg-surface-sunken" />
  </div>
);

/** 기다리는 막대 넷의 폭 — 글이 설 높이를 미리 쥔다 */
const WRITING_WIDTHS = ['w-full', 'w-11/12', 'w-full', 'w-2/3'] as const;
/** 빛이 줄마다 늦는 만큼 · 문단이 하나씩 떠오르는 간격(초) */
const WAVE_STEP_S = 0.22;
const RISE_STEP_S = 0.35;

/**
 * 잠긴 목차 — 본 사주풀이의 절 이름과, 첫 절 자리의 로그인 전 사주 문단, 그것을 이어 받으러 가는 단추 하나.
 *
 * 첫 절은 **써지는 글**이다(운영자 결정 2026-10-10 「b로 적용하자」, ADR 0143 「2026-10-10 덧」 — 모양 넷은
 * `tasteFirstSectionOf`).
 *
 * - **기다리는 동안** — 글이 설 높이를 쥔 막대 넷 위에 「첫 문단 작성 중…」. 빛이 줄마다 늦게 흘러 위에서 아래로 써 내려가는
 *   듯하고, 마지막 줄 끝에 커서가 깜박인다(`taste.module.css`, 줄인 움직임이면 멈춘다)
 * - **글이 서면** — 문단이 하나씩 떠오른다(줄인 움직임이면 바로)
 * - **실패 · 시간 초과(다음 시도가 열림)** — 둘째 절처럼 자물쇠와 흐린 막대, 아래에 실패 줄과 「다시 시도하기」
 * - **한도 · 세 번 실패 · 서버가 닫음** — 같은 자물쇠와 막대, 줄 하나. 단추는 없다 — 눌러도 같다
 *
 * 셋째 절부터는 이름과 자물쇠뿐이다.
 */
function LockedOutline({ outline, draft }: { outline: readonly string[]; draft: string }) {
  const { answer, retry } = useTasteAnswer(draft);
  const first = tasteFirstSectionOf(answer);
  const ready = answer !== null && answer.state === 'ready' ? answer : null;
  /** 글이 선 세션 — 가입 왕복이 들고 가 전체 풀이가 그 글을 잇는다. 글이 안 섰으면 `null` 이다 */
  const sessionId = ready?.sessionId ?? null;

  return (
    <section aria-labelledby="outline-heading" aria-busy={first === 'writing'} className={CARD}>
      <h2 id="outline-heading" className={TYPE_META}>
        전체 사주풀이 목차
      </h2>
      <ol className="mt-3 flex flex-col gap-3">
        {outline.map((title, index) => {
          /** 첫 절은 기다리는 동안 · 글이 섰을 때 자물쇠가 없다 */
          const locked = index > 0 || first === 'retry' || first === 'closed';
          return (
            <li key={title}>
              <p className="flex items-center gap-2 text-[15px] font-semibold text-foreground">
                <span className="tabular-nums text-secondary">{index + 1}.</span>
                <span className="min-w-0 flex-1">{title}</span>
                {locked && <Icon name="lock" className="size-4 shrink-0 text-muted" />}
              </p>
              {index === 0 ? (
                <FirstSection first={first} preview={ready?.preview ?? ''} onRetry={retry} />
              ) : (
                index < 2 && BLURRED_LINES
              )}
            </li>
          );
        })}
      </ol>
      <div className="mt-5 flex flex-col gap-2">
        <SignInCarrying
          draftKey={READING_DRAFT_KEY}
          draft={draft}
          next={RESUME_READING_PATH}
          carry={{ key: TASTE_SESSION_KEY, value: sessionId }}
          onFollow={() => note('signup_started', sessionId)}
          className={`${BUTTON_PRIMARY} w-full`}
        >
          로그인하고 전체 풀이 받기
        </SignInCarrying>
        <p className="text-center text-xs leading-5 text-secondary">
          로그인하면 이 입력으로 돌아와요. 가입하면 풀이권으로 전체 사주풀이를 받을 수 있어요.
        </p>
      </div>
    </section>
  );
}

/** 목차 첫 절의 몸 — 모양 넷(`tasteFirstSectionOf`) */
function FirstSection({ first, preview, onRetry }: { first: TasteFirstSection; preview: string; onRetry: () => void }) {
  if (first === 'ready') {
    const paragraphs = paragraphsOf(preview);
    return (
      <div className="mt-2 flex flex-col gap-3">
        {paragraphs.map((paragraph, at) => (
          <p key={at} className={`${motion.rise} text-[15px] leading-7 text-foreground`} style={{ animationDelay: `${at * RISE_STEP_S}s` }}>
            {paragraph}
          </p>
        ))}
        <p className={`${motion.rise} text-[13px] leading-5 text-secondary`} style={{ animationDelay: `${paragraphs.length * RISE_STEP_S}s` }}>
          가입하면 이 물음의 답부터 전체 사주풀이가 이어져요.
        </p>
      </div>
    );
  }

  if (first === 'writing') {
    return (
      <div className="mt-2">
        <p role="status" className="flex items-center gap-1.5 text-[13px] font-medium leading-5 text-cream-ink">
          <Icon name="spark" className="size-3.5 animate-pulse motion-reduce:animate-none" />
          {TASTE_WRITING_SUBJECT} {READING_OUTLINE_STATE.writing}
        </p>
        <div aria-hidden className="mt-2.5 flex flex-col gap-2">
          {WRITING_WIDTHS.map((width, at) => (
            <span key={at} className={`flex items-center ${width}`}>
              <span className={`${motion.wave} block h-3.5 flex-1 rounded-full`} style={{ animationDelay: `${at * WAVE_STEP_S}s` }} />
              {at === WRITING_WIDTHS.length - 1 && <span className={`${motion.caret} ml-1 block h-4 w-[2px] rounded-full bg-fire`} />}
            </span>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      {BLURRED_LINES}
      <p role="status" className="mt-3 flex flex-wrap items-center gap-x-2 text-[13px] leading-5 text-secondary">
        <span>{first === 'retry' ? TASTE_FAILED_NOTE : TASTE_CLOSED_NOTE}</span>
        {first === 'retry' && (
          <button type="button" onClick={onRetry} className={`${BUTTON_TERTIARY} text-[13px]`}>
            {TASTE_RETRY_LABEL}
          </button>
        )}
      </p>
    </div>
  );
}
