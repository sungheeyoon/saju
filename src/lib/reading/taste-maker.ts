import {
  BRANCH_INFO,
  ELEMENT_KO,
  STEM_INFO,
  type Branch,
  type Stem,
} from '../saju';

import { plainTermsIn } from './check';
import type { TasteKey } from './taste';

/**
 * 로그인 전 사주 문단 표(`taste_passage`)를 **미리 채우는 일** — 프롬프트 · 짧은 규칙 검사 · 도는 차례(ADR 0131).
 *
 * 부르는 자리는 운영자가 손으로 돌리는 실호출 하나다(`app/me/reading/taste.live.test.ts` — 모델 래퍼가 app 에 살고
 * `scripts/` 는 app 을 못 부르므로 `call.live.test.ts` 와 같은 자리에 선다). 여기는 모델도 DB 도 모른다 — 둘 다 받아서
 * 부른다. 그래서 단위 시험이 모의 모델로 도는 차례와 거르는 규칙을 잰다.
 *
 * ## 모델에게 가는 것
 *
 * **열쇠 하나의 엔진 값뿐이다** — 일간의 글자 · 오행 · 음양, 일지, 월지와 계절. 사람은 없다. 같은 칸의 글은 그 일주로
 * 그 달에 난 모든 사람이 읽으므로, 한 사람에게만 맞는 이야기(직업 · 사건 · 나이)를 쓰면 안 된다.
 */

const SEASON_KO = { 春: '봄', 夏: '여름', 秋: '가을', 冬: '겨울' } as const;
const YIN_YANG_KO = { 陽: '양', 陰: '음' } as const;

/** 열쇠를 엔진 글자로 — 꼴이 틀리면 `null`(표의 검사식과 같은 꼴) */
export function tasteKeyParts(key: string): { stem: Stem; dayBranch: Branch; monthBranch: Branch } | null {
  const [day, monthBranch] = key.split('-');
  if (day === undefined || monthBranch === undefined || [...day].length !== 2 || [...monthBranch].length !== 1) return null;
  const [stem, dayBranch] = [...day];
  if (!Object.hasOwn(STEM_INFO, stem) || !Object.hasOwn(BRANCH_INFO, dayBranch) || !Object.hasOwn(BRANCH_INFO, monthBranch)) {
    return null;
  }
  return { stem: stem as Stem, dayBranch: dayBranch as Branch, monthBranch: monthBranch as Branch };
}

/**
 * 한 칸의 프롬프트. 출력 모양은 모델 래퍼의 계약(`score · metaphor · markdown`) 그대로다 — `markdown` 에 로그인 전 사주
 * 문단을, `metaphor` 에 한 줄을 받는다. 점수는 `null`.
 */
export function tastePromptOf(key: TasteKey): string {
  const parts = tasteKeyParts(key);
  if (parts === null) throw new Error(`로그인 전 사주 문단 열쇠의 꼴이 아니다: ${key}`);
  const stem = STEM_INFO[parts.stem];
  const dayBranch = BRANCH_INFO[parts.dayBranch];
  const month = BRANCH_INFO[parts.monthBranch];

  return `# 역할

너는 사주를 처음 보는 사람에게 첫 인상을 건네는 사람이다. 긴 풀이가 아니라 **맛보기 문단 하나**를 쓴다.

# 자료

- 일간: ${stem.char}(${stem.ko}) — ${ELEMENT_KO[stem.element]}, ${YIN_YANG_KO[stem.yinYang]}
- 일지: ${dayBranch.char}(${dayBranch.ko}) — ${ELEMENT_KO[dayBranch.element]}
- 태어난 달의 지지: ${month.char}(${month.ko}) — ${ELEMENT_KO[month.element]}, ${SEASON_KO[month.season]}

이 자료는 **같은 일주로 같은 달에 난 사람 모두**의 것이다. 한 사람에게만 맞는 이야기(직업 · 사건 · 나이 · 가족)는 쓰지 않는다.

# 낼 것

- \`markdown\` — 두세 문장, 해요체, 200자 안팎. 이 일간이 그 계절에 어떤 모습인지를 그림처럼 보여 주고, 마지막 문장은
  「전체 풀이에서 더 볼 수 있는 것」을 궁금하게 남긴다. 제목 · 목록 · 굵은 글씨 없이 문단 하나.
- \`metaphor\` — 이 일간과 계절을 한 줄로.
- \`score\` — null.

사주 분류명(신강 · 신약 · 용신 · 격국 · 십성 이름 · 신살 이름 · 대운 같은 말)과 한자는 본문에 쓰지 않는다. 좋고 나쁨을
단정하지 않는다.`;
}

/** 로그인 전 사주 문단이 지켜야 할 모양 — 짧은 규칙만. 글의 질은 사람이 본다(ADR 0131 「잠그지 않은 것」) */
export const TASTE_RULES = {
  minLength: 60,
  /** DB 의 `taste_passage_body_length` 는 600 이다 — 여기서 먼저 좁게 거른다 */
  maxLength: 320,
  minSentences: 2,
  maxSentences: 4,
} as const;

export type TasteVerdict = { ok: true } | { ok: false; reasons: readonly string[] };

const HANJA = /[一-鿿]/;
/** 화면에 「AI」를 새로 세우지 않는다(운영자 2026-09-29) — 글 안에서도 */
const AI_WORD = /\bAI\b|인공지능/;
const MARKUP = /(^|\n)\s*(#|[-*] |\d+\. )|\*\*|__/;

const sentencesOf = (body: string): string[] =>
  body
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence !== '');

export function checkTaste(body: string): TasteVerdict {
  const text = body.trim();
  const reasons: string[] = [];
  const sentences = sentencesOf(text);

  if (text.length < TASTE_RULES.minLength) reasons.push(`너무 짧다(${text.length}자)`);
  if (text.length > TASTE_RULES.maxLength) reasons.push(`너무 길다(${text.length}자)`);
  if (sentences.length < TASTE_RULES.minSentences || sentences.length > TASTE_RULES.maxSentences) {
    reasons.push(`문장이 ${sentences.length}개다`);
  }
  if (sentences.some((sentence) => !/요[.!?]$/.test(sentence))) reasons.push('해요체로 끝나지 않는 문장이 있다');
  if (HANJA.test(text)) reasons.push('한자가 있다');
  if (AI_WORD.test(text)) reasons.push('「AI」를 말한다');
  if (MARKUP.test(text)) reasons.push('제목 · 목록 · 굵은 글씨가 있다');
  const terms = plainTermsIn(text);
  if (terms.length > 0) reasons.push(`분류명이 있다: ${terms.join(' · ')}`);

  return reasons.length === 0 ? { ok: true } : { ok: false, reasons };
}

/** 모델에게 한 칸을 묻는 손 — 실호출은 app 의 모델 래퍼, 단위 시험은 모의 모델이다 */
export type TasteAsk = (prompt: string) => Promise<{ ok: true; body: string; model: string } | { ok: false; detail: string }>;

export type TasteRow = { key: TasteKey; body: string; model: string; checked: true };

export type TasteReport = {
  written: readonly TasteKey[];
  /** 검사를 못 지난 칸 — 적지 않았다. 까닭과 함께 */
  rejected: readonly { key: TasteKey; reasons: readonly string[] }[];
  failed: readonly { key: TasteKey; detail: string }[];
  skipped: readonly TasteKey[];
};

/**
 * 칸마다 한 번 묻고, **규칙 검사를 지난 글만** 적는다.
 *
 * 이미 검사를 지난 글이 있는 칸은 건너뛴다(`done`) — 다시 돌려도 비용이 두 번 안 나간다. 못 지난 칸은 적지 않고 보고에
 * 까닭을 남긴다: 표가 빈 칸은 화면이 엔진의 문장으로 대신 서므로, 틀린 글을 적는 것보다 비워 두는 편이 낫다.
 * 칸 사이는 차례대로 돈다 — 한꺼번에 720을 띄우지 않는다.
 */
export async function makeTastePassages({
  keys,
  done,
  ask,
  write,
}: {
  keys: readonly TasteKey[];
  done: ReadonlySet<string>;
  ask: TasteAsk;
  write: (row: TasteRow) => Promise<void>;
}): Promise<TasteReport> {
  const written: TasteKey[] = [];
  const rejected: { key: TasteKey; reasons: readonly string[] }[] = [];
  const failed: { key: TasteKey; detail: string }[] = [];
  const skipped: TasteKey[] = [];

  for (const key of keys) {
    if (done.has(key)) {
      skipped.push(key);
      continue;
    }
    const answer = await ask(tastePromptOf(key));
    if (!answer.ok) {
      failed.push({ key, detail: answer.detail });
      continue;
    }
    const body = answer.body.trim();
    const verdict = checkTaste(body);
    if (!verdict.ok) {
      rejected.push({ key, reasons: verdict.reasons });
      continue;
    }
    await write({ key, body, model: answer.model, checked: true });
    written.push(key);
  }

  return { written, rejected, failed, skipped };
}
