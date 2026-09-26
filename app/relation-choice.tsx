import { RELATIONS, RELATION_LABEL, type Relation } from '@/src/lib/people';

import { TYPE_NAME } from './ui/surfaces';

/**
 * **두 분은 무슨 사이인가요** — 궁합을 읽기 **전에** 묻는 자리.
 *
 * 묻는 까닭은 「무슨 사이인지에 따라 해석의 방향을 달리 잡아 드리겠다」는 것이다.
 * 그러니 읽고 난 뒤에 묻는 것은 아무 뜻이 없다 — 이미 나온 글은 그 답을 못 쓴다.
 *
 * **묻는 자리는 하나다** — 두 사람을 고르는 칸 아래(`compat-picker.tsx`). 결과 화면(`/me/compat`)은 다시 묻지
 * 않고 무엇으로 읽는지만 한 줄로 적는다(ADR 0054).
 *
 * 답은 글의 방향만이 아니라 **점수의 눈금도 고른다**(ADR 0113) — 연인 · 배우자는 연인용, 그 밖과 모름은 일반.
 * 그래서 안내가 「점수에는 쓰지 않습니다」를 더는 말하지 않는다(2026-09-26).
 *
 * 고른 것은 먹색으로 채우고 체크 표시를 단다 — 색만으로 「골랐다」를 말하지 않는다.
 *
 * **안 고르는 것도 답이다.** 필수로 두면 사람들은 아무거나 고르고, 그러면 틀린 값이
 * 「모른다」보다 나쁜 자리에 앉는다.
 */
export function RelationChoice({
  value,
  onChange,
  idPrefix,
}: {
  value: Relation | null;
  onChange: (next: Relation | null) => void;
  idPrefix: string;
}) {
  return (
    <fieldset>
      {/* `float-left w-full` — 안 두면 legend 가 테두리 선을 끊고 그 위에 걸터앉는다 */}
      <legend className={`float-left w-full ${TYPE_NAME}`}>두 분은 무슨 사이인가요?</legend>
      <p className="mt-1.5 text-[13px] leading-5 text-secondary">
        사이에 따라 읽어 드릴 방향이 달라집니다. 가족에게 할 말과 연인에게 할 말이 다르기
        때문입니다. <strong className="font-semibold text-foreground">점수의 기준도 이 답을 따릅니다.</strong>
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        {[...RELATIONS, null].map((choice) => {
          const id = `${idPrefix}-relation-${choice ?? 'unknown'}`;
          const label = choice === null ? '아직 모르겠음' : RELATION_LABEL[choice];
          const picked = value === choice;

          return (
            <label
              key={id}
              htmlFor={id}
              className={`relative inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-full border px-4 text-[15px] font-semibold active:scale-[0.97] has-[:focus-visible]:outline has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent-soft ${
                picked
                  ? 'border-transparent bg-accent text-on-accent'
                  : 'border-border bg-surface text-foreground hover:border-border-strong'
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
              {picked && (
                <svg viewBox="0 0 12 12" aria-hidden="true" className="size-3.5 shrink-0">
                  <path d="M2.5 6.2 5 8.5l4.5-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
              {label}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
