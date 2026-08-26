'use client';

import { useState } from 'react';

import { CopyText } from './copy-text';

/**
 * **가린 채로 매기는 채점표.**
 *
 * 평가하는 사람이 「이건 control 이니까」를 알고 점수를 매기면 재는 것이 글이 아니라
 * 기대가 된다. 그래서 화면에는 `Q01-A` 만 서고, **어느 변형이었는지는 내보낸 뒤에
 * 열린다** — 짝은 서버가 이미 쥐고 있고 이 칸은 그것을 보여 주지 않는다.
 *
 * ## DB 를 만들지 않는다
 *
 * 첫 라운드는 스무 건이고, 그 스무 건이 정하는 것은 다음에 무엇을 잴지다. 표를 먼저
 * 만들면 아직 모르는 축을 스키마로 굳히게 된다. 브라우저에 두고 파일로 내보내는
 * 것으로 족하다 — 합성 고정 사례라 사용자 Reading 이력을 남기지 않는 규율과도
 * 부딪히지 않는다.
 *
 * `localStorage` 는 실패할 수 있다(사생활 보호 창, 저장 차단). 실패를 삼키지 않고
 * 화면이 그렇게 말한다 — 한 시간 채점한 것이 조용히 사라지는 것이 가장 나쁘다.
 *
 * ## 되살리는 것은 **누르는 일**이다
 *
 * 그릴 때 저절로 되살리면 서버가 그린 빈 칸과 브라우저가 채운 칸이 어긋나고, 그것을
 * 맞추려면 결국 그리는 도중에 상태를 바꾸게 된다. 적는 것은 저절로 하되 되살리는 것은
 * 버튼 하나로 둔다 — 새로고침 뒤 한 번 더 누르는 값으로, 화면이 무엇을 들고 있는지가
 * 늘 분명해진다.
 */

/** 채점 한 줄 — 가린 이름 하나에 대한 것 */
export type Score = {
  /** 붙여 넣은 글의 이름 — 우리가 짓지 않고 채점자가 적는다(모델 응답 id 등) */
  outputId: string;
  /** 본문 글자 수 — `checkReading` 이 안 재는 값이라 손으로 센다 */
  length: string;
  /** 빠진 절 수 */
  missingSections: string;
  scoreIsNull: boolean;
  /** hard fail 이나 근거 밖 주장 */
  hardFail: string;
  concreteness: string;
  grounding: string;
  usefulness: string;
  note: string;
};

const EMPTY: Score = {
  outputId: '',
  length: '',
  missingSections: '',
  scoreIsNull: false,
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

type Storage = 'unknown' | 'ok' | 'empty' | 'blocked';

export function RubricSheet({
  caseId,
  setVersion,
  viewedAt,
  evidenceDigest,
  rows,
}: {
  caseId: string;
  setVersion: string;
  viewedAt: string;
  evidenceDigest: string;
  /** 가린 차례 그대로 — `variant` 는 내보낼 때만 쓴다 */
  rows: readonly { blind: string; variant: string; promptDigest: string }[];
}) {
  const key = `saju:rubric:${setVersion}:${caseId}`;
  const [scores, setScores] = useState<Record<string, Score>>({});
  const [storage, setStorage] = useState<Storage>('unknown');

  const restore = () => {
    try {
      const saved = window.localStorage.getItem(key);
      setScores(saved === null ? {} : (JSON.parse(saved) as Record<string, Score>));
      setStorage(saved === null ? 'empty' : 'ok');
    } catch {
      setStorage('blocked');
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

  /** 내보낼 때 **비로소** 짝이 열린다 — 채점하는 동안에는 화면 어디에도 없다 */
  const record = JSON.stringify(
    {
      setVersion,
      caseId,
      viewedAt,
      evidenceDigest,
      recordedAt: new Date().toISOString(),
      rows: rows.map((row) => ({ ...row, score: scores[row.blind] ?? EMPTY })),
    },
    null,
    2,
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm font-semibold">채점 — 어느 변형인지는 내보낸 뒤에 열립니다</p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={restore}
            className="h-8 shrink-0 rounded-md border border-border px-2.5 text-xs text-secondary transition-colors hover:border-border-strong hover:text-foreground"
          >
            저장된 채점 불러오기
          </button>
          <CopyText text={record} label="채점 기록 복사 (JSON)" />
        </div>
      </div>

      {storage === 'empty' && (
        <p role="status" className="rounded-lg bg-surface-sunken px-3 py-2 text-xs text-muted">
          이 사례에 저장해 둔 채점이 없습니다.
        </p>
      )}

      {storage === 'blocked' && (
        <p role="alert" className="rounded-lg bg-warning-wash px-3 py-2 text-xs text-warning">
          이 브라우저가 저장을 막고 있어 새로고침하면 사라집니다. 끝내기 전에 위 버튼으로
          복사해 두세요.
        </p>
      )}

      <div className="flex flex-col gap-3">
        {rows.map((row) => {
          const score = scores[row.blind] ?? EMPTY;

          return (
            <fieldset key={row.blind} className="flex flex-col gap-2 rounded-xl border border-border p-3">
              <legend className="px-1 text-sm font-bold">{row.blind}</legend>

              <div className="grid gap-2 sm:grid-cols-2">
                <Text label="출력 id" value={score.outputId} onChange={(v) => put(row.blind, { outputId: v })} />
                <Text label="본문 글자 수" value={score.length} onChange={(v) => put(row.blind, { length: v })} />
                <Text label="빠진 절 수" value={score.missingSections} onChange={(v) => put(row.blind, { missingSections: v })} />
                <Text label="hard fail · 근거 밖 주장" value={score.hardFail} onChange={(v) => put(row.blind, { hardFail: v })} />
              </div>

              <div className="flex flex-wrap gap-4">
                {RATINGS.map(([field, label]) => (
                  <Text
                    key={field}
                    label={`${label} (1~5)`}
                    value={score[field]}
                    onChange={(v) => put(row.blind, { [field]: v })}
                    width="w-16"
                  />
                ))}
                <label className="flex items-center gap-2 self-end pb-2 text-sm">
                  <input
                    type="checkbox"
                    checked={score.scoreIsNull}
                    onChange={(event) => put(row.blind, { scoreIsNull: event.target.checked })}
                    className="accent-accent"
                  />
                  <code className="text-xs">score</code> 가 null
                </label>
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
    </div>
  );
}

function Text({
  label,
  value,
  onChange,
  width = 'w-full',
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  width?: string;
}) {
  return (
    <label className="flex min-w-0 flex-col gap-1">
      <span className="text-xs font-semibold text-secondary">{label}</span>
      <input
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={`h-10 ${width} rounded-xl border border-border bg-surface px-3 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent-wash`}
      />
    </label>
  );
}
