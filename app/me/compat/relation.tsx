'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { RELATIONS, RELATION_LABEL, type Relation } from '@/src/lib/people';

import { setPairRelation } from '../actions';

/**
 * **이 두 사람은 무슨 사이인가** — 궁합을 볼 때 묻는다.
 *
 * 사람 탭에서 묻지 않는다. 그 화면은 그 사람의 사주를 보는 자리이고, 내 사주 화면에
 * 「나와 나는 무슨 사이인가」가 없는 것처럼 거기서 관계를 물을 이유가 없다. 관계가
 * 글을 바꾸는 것은 **궁합을 읽을 때**뿐이라, 물을 자리도 여기다.
 *
 * 그리고 사람이 아니라 **쌍**에 붙는다. 「나와 그 사람」만 알면 어머니와 친구의
 * 궁합에서는 답이 없다 — 어머니가 나의 가족인 것과 어머니가 그 친구와 무슨 사이인지는
 * 다른 물음이다.
 *
 * **안 고르는 것도 답이다.** 필수로 두면 사람들은 아무거나 고르고, 그러면 틀린 값이
 * 「모른다」보다 나쁜 자리에 앉는다. 안 고르면 풀이가 어느 쪽으로도 단정하지 않는
 * 장면으로 쓴다.
 *
 * **누르면 바로 저장한다.** 라디오 하나에 저장 버튼을 더 두면 고른 것과 저장된 것이
 * 갈리는 상태가 생기고, 사용자는 고르기만 하고 떠난다.
 */
export function PairRelation({
  personA,
  personB,
  relation,
}: {
  personA: string;
  personB: string;
  relation: Relation | null;
}) {
  const router = useRouter();
  const [value, setValue] = useState(relation);
  const [failure, setFailure] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();

  const choose = (next: Relation | null) => {
    setValue(next);
    setFailure(null);
    startSaving(async () => {
      const result = await setPairRelation(personA, personB, next);
      if (result.ok) router.refresh();
      else {
        // 저장 못 했으면 화면도 되돌린다 — 안 되돌리면 고른 척만 하고 서 있게 된다.
        setValue(relation);
        setFailure(result.message);
      }
    });
  };

  return (
    <fieldset className="rounded-2xl border border-border bg-surface px-5 py-4">
      {/* `float-left w-full` — 안 두면 legend 가 테두리 선을 끊고 그 위에 걸터앉는다 */}
      <legend className="float-left w-full text-sm font-semibold">두 분은 무슨 사이인가요?</legend>
      <p className="mt-1.5 text-xs leading-5 text-muted">
        사이에 따라 읽어 줄 장면이 달라집니다. 가족에게 할 말과 연인에게 할 말이 다르기
        때문입니다. <strong className="font-medium">점수에는 쓰지 않습니다.</strong>
      </p>

      <div className="flex flex-wrap gap-2 pt-1">
        {[...RELATIONS, null].map((choice) => {
          const id = `pair-relation-${choice ?? 'unknown'}`;
          const label = choice === null ? '아직 모르겠음' : RELATION_LABEL[choice];
          const chosen = value === choice;

          return (
            <label
              key={id}
              htmlFor={id}
              className={`relative cursor-pointer rounded-full border px-3.5 py-1.5 text-sm has-[:focus-visible]:outline has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent-soft ${
                chosen
                  ? 'border-accent bg-accent-wash font-medium text-accent'
                  : 'border-border text-secondary hover:border-accent'
              }`}
            >
              {/*
                칸 전체를 덮는 라디오 — 보이지는 않지만 **이것이 눌린다.** `sr-only` 로
                숨기면 글자만 누를 수 있는 칸이 되고, 라벨을 못 짚는 손에는 누를 것이
                없는 칸이 된다(`birth-form.tsx` 와 같은 규율).
              */}
              <input
                type="radio"
                id={id}
                name="pair-relation"
                checked={chosen}
                onChange={() => choose(choice)}
                className="absolute inset-0 cursor-pointer appearance-none opacity-0"
              />
              {label}
            </label>
          );
        })}
      </div>

      {saving && <p className="mt-2 text-xs text-muted">저장하는 중…</p>}
      {failure !== null && <p className="mt-2 text-xs text-muted">{failure}</p>}
    </fieldset>
  );
}
