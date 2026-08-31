'use client';

import { RELATIONS, RELATION_LABEL, type Relation } from '@/src/lib/people';

/**
 * **두 분은 무슨 사이인가요** — 궁합을 읽기 **전에** 묻는 자리.
 *
 * 묻는 까닭은 「무슨 사이인지에 따라 해석의 방향을 달리 잡아 드리겠다」는 것이다.
 * 그러니 읽고 난 뒤에 묻는 것은 아무 뜻이 없다 — 이미 나온 글은 그 답을 못 쓴다.
 *
 * **두 궁합 화면이 같은 칸을 쓴다.** 익명 화면은 우리가 모델을 안 부르지만 프롬프트는
 * 나간다(복사해 붙여 넣는 글). 그 글에도 같은 구멍이 있었으므로 묻는 것도 같다 —
 * 따로 그리면 한쪽만 고쳐지고, 그때 두 화면이 서로 다른 것을 약속한다.
 *
 * **안 고르는 것도 답이다.** 필수로 두면 사람들은 아무거나 고르고, 그러면 틀린 값이
 * 「모른다」보다 나쁜 자리에 앉는다.
 */
export function RelationChoice({
  value,
  onChange,
  idPrefix,
  className = '',
}: {
  value: Relation | null;
  onChange: (next: Relation | null) => void;
  idPrefix: string;
  className?: string;
}) {
  return (
    <fieldset className={className}>
      {/* `float-left w-full` — 안 두면 legend 가 테두리 선을 끊고 그 위에 걸터앉는다 */}
      <legend className="float-left w-full text-sm font-semibold">두 분은 무슨 사이인가요?</legend>
      <p className="mt-1.5 text-xs leading-5 text-muted">
        사이에 따라 읽어 드릴 방향이 달라집니다. 가족에게 할 말과 연인에게 할 말이 다르기
        때문입니다. <strong className="font-medium">점수에는 쓰지 않습니다.</strong>
      </p>

      <div className="mt-2.5 flex flex-wrap gap-2">
        {[...RELATIONS, null].map((choice) => {
          const id = `${idPrefix}-relation-${choice ?? 'unknown'}`;
          const label = choice === null ? '아직 모르겠음' : RELATION_LABEL[choice];
          const picked = value === choice;

          return (
            <label
              key={id}
              htmlFor={id}
              className={`relative cursor-pointer rounded-full border px-3.5 py-1.5 text-sm has-[:focus-visible]:outline has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent-soft ${
                picked
                  ? 'border-accent bg-accent-wash font-medium text-accent'
                  : 'border-border bg-surface text-secondary hover:border-accent'
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
                name={`${idPrefix}-relation`}
                checked={picked}
                onChange={() => onChange(choice)}
                className="absolute inset-0 cursor-pointer appearance-none opacity-0"
              />
              {label}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
