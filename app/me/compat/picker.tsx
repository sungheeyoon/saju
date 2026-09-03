'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import type { Relation } from '@/src/lib/people';
import {
  READING_ALREADY_RUNNING_NOTE,
  READING_FAILED_NOTE,
  READING_LEAVE_SAFE_NOTE,
  readingWaitNote,
} from '@/src/lib/reading';

import { GENERATION } from '../reading/generation';

import { RelationChoice } from '../../relation-choice';
import { readingRunState } from '../reading/actions';
import { pairRelationFor, startPairReading } from './actions';

export type Choosable = { personId: string; label: string; isSelf: boolean };

/**
 * 두 사람을 고르고 **무슨 사이인지 함께 답한 뒤** 풀이를 시작하는 자리.
 *
 * ## 관계를 왜 여기서 묻나
 *
 * 관계를 묻는 까닭은 「무슨 사이인지에 따라 해석의 방향을 달리 잡아 드리겠다」는 것이다.
 * 그러니 **읽고 난 뒤에 묻는 것은 아무 뜻이 없다** — 이미 나온 글은 그 답을 못 쓴다.
 * 고르는 칸 옆에 나란히 서야 그 약속이 참이 된다.
 *
 * ## 두 칸이 서로를 안다
 *
 * 첫 번째에서 고른 사람은 두 번째 목록에서 빠진다. 같은 사람 둘을 고를 수 있게 두면
 * **누르고 나서야 거절을 만난다** — 화면이 이미 아는 것을 사용자가 실수해서 알아내게
 * 하지 않는다.
 */
export function PairPicker({
  people,
  a,
  b,
}: {
  people: Choosable[];
  a: string | null;
  b: string | null;
}) {
  const router = useRouter();
  const [first, setFirst] = useState(a ?? '');
  const [second, setSecond] = useState(b ?? '');
  const [relation, setRelation] = useState<Relation | null>(null);
  /**
   * **이 누름이 사이를 건드리는가.**
   *
   * 안 건드렸으면 안 적는다. 칸이 늘 「아직 모르겠음」에서 시작하던 동안, 지난번에
   * 답해 둔 두 사람을 다시 고르기만 해도 그 답이 지워졌다 — `null` 은 행을 지우는
   * 답이기 때문이다. 「모른다를 골랐다」와 「이 누름에서 안 정했다」는 다른 일이다.
   */
  const answered = useRef<string | null>(null);
  const [running, setRunning] = useState(false);
  const [waited, setWaited] = useState(0);
  const [failure, setFailure] = useState<string | null>(null);

  const chosen = first !== '' && second !== '' && first !== second;
  /** 차례를 안 타는 쌍 이름 — 첫째·둘째를 바꿔 골라도 같은 쌍이다(DB 와 같은 규율) */
  const pairKey = chosen ? [first, second].sort().join('|') : '';

  /**
   * **고른 두 사람에 대해 저장해 둔 답을 칸에 세운다.**
   *
   * 이 값이 없던 동안 화면은 늘 「아직 모르겠음」을 보여 주었고, 그것은 저장된 값과
   * 달랐다. 화면이 저장 상태를 그대로 보여 주면 그 화면을 눌러도 아무것도 안 지워진다.
   */
  useEffect(() => {
    if (pairKey === '') return;

    let alive = true;
    void pairRelationFor(first, second).then((read) => {
      // 못 읽었으면 칸을 건드리지 않는다 — 「못 읽었다」를 「모른다」로 세우지 않는다.
      // 방금 사용자가 이 쌍에서 고른 것이 있으면 그것이 저장된 값보다 뒤의 답이다.
      if (!alive || !read.ok || answered.current === pairKey) return;
      setRelation(read.relation);
    });

    return () => {
      alive = false;
    };
  }, [pairKey, first, second]);

  const chooseRelation = (next: Relation | null) => {
    answered.current = pairKey;
    setRelation(next);
  };

  /** 도는 시도를 지켜본다 — 끝나면 목록을 다시 읽는다(`ReadingPanel` 과 같은 고리) */
  useEffect(() => {
    if (!running) return;

    let alive = true;
    const since = Date.now();
    const seconds = setInterval(() => setWaited(Math.floor((Date.now() - since) / 1000)), 1000);

    const ask = async () => {
      let run: Awaited<ReturnType<typeof readingRunState>>;
      try {
        run = await readingRunState({ kind: 'private', personA: first, personB: second });
      } catch {
        // 한 번 못 물은 것으로 끝났다고 하지 않는다. 다음 물음에서 다시 본다.
        return;
      }
      if (!alive || run === null || run.status === 'running') return;

      setRunning(false);
      if (run.status === 'failed') setFailure(READING_FAILED_NOTE);
      // 결과는 서버에만 있다. 다시 안 읽으면 방금 만든 것이 목록에 안 선다.
      router.refresh();
    };

    // 물어보는 간격은 짧게 잡지 않는다 — 4분짜리 일에 1초짜리 왕복은 값만 쓴다.
    const tick = setInterval(ask, 3000);

    return () => {
      alive = false;
      clearInterval(tick);
      clearInterval(seconds);
    };
  }, [running, first, second, router]);

  if (people.length < 2) {
    return (
      <section className="rounded-2xl border border-border bg-surface-sunken px-5 py-4">
        <h2 className="text-base font-semibold">고를 사람이 아직 둘이 아닙니다</h2>
        <p className="mt-1.5 text-sm text-secondary">
          가족이나 친구를 등록하면 여기서 고를 수 있습니다.{' '}
          <Link href="/me/people" className="text-accent underline underline-offset-2">
            사람 등록하기
          </Link>
        </p>
      </section>
    );
  }

  const start = async () => {
    if (!chosen) return;
    setFailure(null);
    setWaited(0);
    setRunning(true);

    const result = await startPairReading(
      first,
      second,
      // 안 건드렸으면 안 적는다 — 저장된 답은 그대로 두고 파이프라인이 그것을 읽는다.
      answered.current === pairKey ? relation : undefined,
      crypto.randomUUID(),
    );
    if (result.ok) {
      // 열지 못했으면(이미 도는 시도가 있다) 그것도 기다릴 일이다. 다만 내가 방금 연
      // 것이 아니라는 사실은 말해 준다 — 안 그러면 「눌렀는데 그대로」로 보인다.
      if (!result.started) setFailure(READING_ALREADY_RUNNING_NOTE);
      return;
    }

    setRunning(false);
    setFailure(result.message);
  };

  return (
    <section className="flex flex-col gap-5 rounded-2xl border border-border bg-surface px-5 py-5">
      <div className="flex flex-wrap items-end gap-3">
        <Choose
          label="첫 번째"
          value={first}
          onChange={setFirst}
          // 두 번째에서 고른 사람은 여기서 뺀다 — 같은 사람 둘은 애초에 고를 수 없다.
          people={people.filter((one) => one.personId !== second)}
        />
        <Choose
          label="두 번째"
          value={second}
          onChange={setSecond}
          people={people.filter((one) => one.personId !== first)}
        />
      </div>

      <RelationChoice
        value={relation}
        onChange={chooseRelation}
        idPrefix="pair"
        className="rounded-xl bg-surface-sunken px-4 py-3"
      />

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={start}
          disabled={!chosen || running}
          className="h-11 rounded-xl bg-accent px-5 text-sm font-semibold text-on-accent shadow-sm hover:bg-accent-strong disabled:cursor-not-allowed disabled:opacity-60 sm:h-10"
        >
          {running ? '풀이 만드는 중…' : '궁합 보기'}
        </button>
        {/* 버튼을 잠근 이유를 그대로 말한다 — 잠긴 버튼만 있으면 왜인지 알 수 없다 */}
        {!chosen && !running && (
          <span className="text-xs text-muted">두 사람을 고르면 시작할 수 있습니다.</span>
        )}
      </div>

      {running && (
        <div role="status" className="flex flex-col gap-1 rounded-xl bg-surface-sunken px-4 py-3">
          {/*
            **올라가는 숫자가 「살아 있다」를 말한다.** 스피너는 서버가 죽어도 계속 도므로
            오래 걸리는 일에서는 그것을 말하지 못한다(`ReadingPanel` 과 같은 규율).
          */}
          <p className="text-sm font-medium tabular-nums">
            풀이 만드는 중 · {waited}초
          </p>
          <p className="text-xs leading-5 text-muted">
            {readingWaitNote(GENERATION.settings.timeout)} {READING_LEAVE_SAFE_NOTE}
          </p>
        </div>
      )}

      {failure !== null && (
        <p role="status" className="rounded-xl bg-warning-wash px-4 py-3 text-sm leading-6 text-warning">
          {failure}
        </p>
      )}
    </section>
  );
}

function Choose({
  label,
  value,
  onChange,
  people,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  people: Choosable[];
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs text-secondary">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 rounded-md border border-border bg-surface px-2.5 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent-wash sm:h-10"
      >
        <option value="" disabled>
          고르기
        </option>
        {people.map((person) => (
          <option key={person.personId} value={person.personId}>
            {person.label}
            {person.isSelf ? ' (나)' : ''}
          </option>
        ))}
      </select>
    </label>
  );
}
