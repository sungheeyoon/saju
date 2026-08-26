'use client';

import { useState } from 'react';

import { CopyText } from './copy-text';

/**
 * **가린 채로 매기는 채점표.**
 *
 * 평가하는 사람이 「이건 control 이니까」를 알고 점수를 매기면 재는 것이 글이 아니라
 * 기대가 된다. 그래서 화면에는 `Q01-A` 만 서고, **짝은 여기서 나가는 어떤 파일에도
 * 들어가지 않는다** — 사례별 백업에 짝을 실으면 첫 사례를 끝내는 순간 남은 넷의
 * 블라인드가 깨진다. 짝은 전부 채점한 뒤 따로 연다.
 *
 * ## 덮어쓰기를 막는 것이 저장보다 먼저다
 *
 * 저장해 둔 사례로 돌아오면 화면은 비어 있다. 그 상태에서 한 칸이라도 적으면 빈 것을
 * 바탕으로 통째로 다시 저장되어 **한 시간 채점한 것이 한 줄로 덮인다.** 그래서 무엇을
 * 할지 고르기 전에는 칸을 잠근다 — 이어서 할지, 버리고 새로 할지.
 *
 * ## 셀 수 있는 것은 세지 않는다
 *
 * 본문 길이·`score` 가 null 인지·소제목 개수는 출력 원문에서 나온다. 사람이 손으로
 * 세면 스무 건 중 몇 개는 틀리고, 틀린 줄을 나중에 가려낼 방법이 없다.
 *
 * ## DB 를 만들지 않는다
 *
 * 첫 라운드 스무 건이 정하는 것은 **다음에 무엇을 잴지**다. 표를 먼저 만들면 아직 모르는
 * 축을 스키마로 굳히게 된다. 합성 고정 사례라 사용자 Reading 이력을 남기지 않는 규율과도
 * 부딪히지 않는다.
 */

/** 아직 안 본 것과 보고 나서 아니었던 것은 다르다 */
type Answered = 'unknown' | 'yes' | 'no';

export type Score = {
  /** 모델이 낸 것 그대로 — 여기서 길이·`score`·소제목 수가 나온다 */
  output: string;
  /** 자동으로 못 세는 것 — 소제목 이름이 프롬프트와 다를 수 있다 */
  missingSections: string;
  /** hard fail 이나 근거 밖 주장 */
  hardFail: string;
  concreteness: string;
  grounding: string;
  usefulness: string;
  note: string;
};

const EMPTY: Score = {
  output: '',
  missingSections: '',
  hardFail: '',
  concreteness: '',
  grounding: '',
  usefulness: '',
  note: '',
};

const RATINGS = [
  ['concreteness', '구체성'],
  ['grounding', '근거 밀착성'],
  ['usefulness', '실용성'],
] as const;

/**
 * 출력 원문에서 **셀 수 있는 것**을 센다.
 *
 * 모델이 구조화 출력을 그대로 뱉으면 `{"score":…, "markdown":"…"}` 이고, 대화창에서
 * 손으로 돌리면 본문만 오기도 한다. 둘 다 받는다 — 다만 JSON 이 아니면 `score` 는
 * **모른다**고 말한다. 「안 봤다」를 「null 이 아니었다」로 적으면 그 줄은 조용히 거짓이 된다.
 */
function readOutput(text: string): {
  markdown: string;
  length: number;
  scoreIsNull: Answered;
  headings: number;
} {
  const trimmed = text.trim();

  let markdown = trimmed;
  let scoreIsNull: Answered = 'unknown';

  if (trimmed.startsWith('{')) {
    try {
      const parsed = JSON.parse(trimmed) as { score?: unknown; markdown?: unknown };
      if (typeof parsed.markdown === 'string') markdown = parsed.markdown;
      if ('score' in parsed) scoreIsNull = parsed.score === null ? 'yes' : 'no';
    } catch {
      // JSON 처럼 시작했지만 아니었다 — 통째로 본문으로 본다.
    }
  }

  return {
    markdown,
    length: markdown.length,
    scoreIsNull,
    headings: (markdown.match(/^##\s/gm) ?? []).length,
  };
}

type Gate = 'asking' | 'ready';
type Storage = 'ok' | 'blocked';

export function RubricSheet({
  caseId,
  setVersion,
  viewedAt,
  evidenceDigest,
  promptVersion,
  rows,
}: {
  caseId: string;
  setVersion: string;
  viewedAt: string;
  evidenceDigest: string;
  promptVersion: string;
  /** 가린 차례 그대로 — **`variant` 는 여기 오지 않는다** */
  rows: readonly { blind: string; promptDigest: string }[];
}) {
  const key = `saju:rubric:${setVersion}:${caseId}`;

  const [gate, setGate] = useState<Gate>('asking');
  const [storage, setStorage] = useState<Storage>('ok');
  const [scores, setScores] = useState<Record<string, Score>>({});
  const [run, setRun] = useState({ id: '', model: '', provider: '', settings: '' });

  const open = (keepSaved: boolean) => {
    if (!keepSaved) {
      setScores({});
      setGate('ready');
      return;
    }
    try {
      const saved = window.localStorage.getItem(key);
      setScores(saved === null ? {} : (JSON.parse(saved) as Record<string, Score>));
      setGate('ready');
    } catch {
      setStorage('blocked');
      setGate('ready');
    }
  };

  const put = (blind: string, patch: Partial<Score>) => {
    const next = { ...scores, [blind]: { ...EMPTY, ...scores[blind], ...patch } };
    setScores(next);
    try {
      window.localStorage.setItem(key, JSON.stringify(next));
    } catch {
      setStorage('blocked');
    }
  };

  /** 사례별 백업 — **짝이 없다.** 남은 사례를 가린 채로 두려면 여기서 새면 안 된다 */
  const backup = JSON.stringify(
    {
      setVersion,
      caseId,
      viewedAt,
      evidenceDigest,
      promptVersion,
      run,
      recordedAt: new Date().toISOString(),
      rows: rows.map((row) => {
        const score = scores[row.blind] ?? EMPTY;
        const read = readOutput(score.output);

        return {
          blind: row.blind,
          promptDigest: row.promptDigest,
          output: score.output,
          length: read.length,
          headings: read.headings,
          scoreIsNull: read.scoreIsNull,
          missingSections: score.missingSections,
          hardFail: score.hardFail,
          concreteness: score.concreteness,
          grounding: score.grounding,
          usefulness: score.usefulness,
          note: score.note,
        };
      }),
    },
    null,
    2,
  );

  if (gate === 'asking') {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-sm font-semibold">채점 — 시작하기 전에 고릅니다</p>
        <p className="text-sm leading-6 text-secondary">
          이 사례에 저장해 둔 채점이 있을 수 있습니다. 확인하기 전에 칸을 열면 적는 순간
          예전 기록이 <strong className="font-medium">한 줄로 덮입니다.</strong>
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => open(true)}
            className="h-10 rounded-xl bg-accent px-4 text-sm font-semibold text-on-accent hover:bg-accent-strong"
          >
            저장된 채점 이어서
          </button>
          <button
            type="button"
            onClick={() => open(false)}
            className="h-10 rounded-xl border border-border-strong bg-surface px-4 text-sm font-semibold hover:border-danger hover:text-danger"
          >
            버리고 새로 시작
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm font-semibold">채점 — 어느 변형인지는 여기 없습니다</p>
        <CopyText text={backup} label="이 사례 기록 복사 (JSON)" />
      </div>

      {storage === 'blocked' && (
        <p role="alert" className="rounded-lg bg-warning-wash px-3 py-2 text-xs text-warning">
          이 브라우저가 저장을 막고 있어 새로고침하면 사라집니다. 끝내기 전에 위 버튼으로
          복사해 두세요.
        </p>
      )}

      {/*
        **어떤 설정으로 돌렸는지가 없으면 그 스무 건은 되짚을 수 없다.** 「같은 모델
        설정으로 비교했다」는 적혀 있을 때만 참이다.
      */}
      <fieldset className="grid gap-2 rounded-xl border border-border p-3 sm:grid-cols-4">
        <legend className="px-1 text-sm font-bold">이 라운드를 돌린 설정</legend>
        <Text label="run id" value={run.id} onChange={(v) => setRun({ ...run, id: v })} />
        <Text label="모델" value={run.model} onChange={(v) => setRun({ ...run, model: v })} />
        <Text label="provider" value={run.provider} onChange={(v) => setRun({ ...run, provider: v })} />
        <Text label="생성 설정" value={run.settings} onChange={(v) => setRun({ ...run, settings: v })} />
      </fieldset>

      {rows.map((row) => {
        const score = scores[row.blind] ?? EMPTY;
        const read = readOutput(score.output);

        return (
          <fieldset key={row.blind} className="flex flex-col gap-2 rounded-xl border border-border p-3">
            <legend className="px-1 text-sm font-bold">{row.blind}</legend>

            <label className="flex flex-col gap-1">
              <span className="text-xs font-semibold text-secondary">
                모델이 낸 것 그대로 (JSON 이면 그대로 붙여 넣으세요)
              </span>
              <textarea
                value={score.output}
                onChange={(event) => put(row.blind, { output: event.target.value })}
                rows={4}
                className="rounded-xl border border-border bg-surface px-3 py-2 font-mono text-xs outline-none focus:border-accent focus:ring-2 focus:ring-accent-wash"
              />
            </label>

            {/* 셀 수 있는 것은 세어서 보인다 — 사람이 세면 스무 건 중 몇은 틀린다 */}
            <dl className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
              <span>
                <dt className="inline">본문</dt>{' '}
                <dd className="inline text-foreground">{read.length}자</dd>
              </span>
              <span>
                <dt className="inline">소제목</dt>{' '}
                <dd className="inline text-foreground">{read.headings}개</dd>
              </span>
              <span>
                <dt className="inline">score</dt>{' '}
                <dd className="inline text-foreground">
                  {read.scoreIsNull === 'unknown' ? '모름 (JSON 이 아님)' : read.scoreIsNull === 'yes' ? 'null' : 'null 아님'}
                </dd>
              </span>
            </dl>

            <div className="grid gap-2 sm:grid-cols-2">
              <Number label="빠진 절 수" value={score.missingSections} min={0} max={8} onChange={(v) => put(row.blind, { missingSections: v })} />
              <Text label="hard fail · 근거 밖 주장" value={score.hardFail} onChange={(v) => put(row.blind, { hardFail: v })} />
            </div>

            <div className="flex flex-wrap gap-4">
              {RATINGS.map(([field, label]) => (
                <Number
                  key={field}
                  label={`${label} (1~5)`}
                  value={score[field]}
                  min={1}
                  max={5}
                  width="w-20"
                  onChange={(v) => put(row.blind, { [field]: v })}
                />
              ))}
            </div>

            <label className="flex flex-col gap-1">
              <span className="text-xs font-semibold text-secondary">판단 근거</span>
              <textarea
                value={score.note}
                onChange={(event) => put(row.blind, { note: event.target.value })}
                rows={2}
                className="rounded-xl border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent-wash"
              />
            </label>
          </fieldset>
        );
      })}
    </div>
  );
}

const FIELD =
  'h-10 rounded-xl border border-border bg-surface px-3 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent-wash';

function Text({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
}) {
  return (
    <label className="flex min-w-0 flex-col gap-1">
      <span className="text-xs font-semibold text-secondary">{label}</span>
      <input type="text" value={value} onChange={(event) => onChange(event.target.value)} className={`${FIELD} w-full`} />
    </label>
  );
}

/** 1~5 를 적는 칸에 7 이 들어가면 그 줄은 나중에 못 쓴다 — 범위를 칸이 든다 */
function Number({
  label,
  value,
  min,
  max,
  onChange,
  width = 'w-full',
}: {
  label: string;
  value: string;
  min: number;
  max: number;
  onChange: (next: string) => void;
  width?: string;
}) {
  const over = value !== '' && (globalThis.Number(value) < min || globalThis.Number(value) > max);

  return (
    <label className="flex min-w-0 flex-col gap-1">
      <span className="text-xs font-semibold text-secondary">{label}</span>
      <input
        type="text"
        inputMode="numeric"
        aria-invalid={over || undefined}
        placeholder={`${min}~${max}`}
        value={value}
        onChange={(event) => onChange(event.target.value.replace(/\D/g, '').slice(0, 2))}
        className={`${FIELD} ${width} text-center tabular-nums aria-invalid:border-danger aria-invalid:focus:border-danger`}
      />
    </label>
  );
}
