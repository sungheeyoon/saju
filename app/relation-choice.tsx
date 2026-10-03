import type { ReactNode } from 'react';

import { RELATIONS, RELATION_LABEL, type Relation } from '@/src/lib/people';

import { Icon } from './ui/icons';
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
 * **칩은 조용하다**(운영자 2026-09-29 — 「스타일 좀 죽이고」). 먹색 채움 · 굵은 15px · 44px 알약 다섯이 주 단추와 같은
 * 무게로 서서, 누를 것(「궁합 보기」)보다 고를 것이 먼저 보였다. 이제 칩은 보관함의 필터 칩과 같은 몸 — 14px 보통 굵기 ·
 * 흰 면 · 가는 테 · 보이는 높이 36px 이고, 고른 것은 옅은 크림 면 · 한 단계 짙은 테 · 먹색 글자에 **체크 표시**를 단다 — 색만으로
 * 「골랐다」를 말하지 않는다. 눌리는 자리는 그대로 44px 다(보이는 알약 밖의 투명한 위아래 4px).
 *
 * **누를 것은 칩 줄의 오른쪽 끝에 선다**(`action`). 넓은 화면은 칩 · 단추가 한 줄이고, 폰에서 줄이 넘치면 단추만 다음 줄의
 * 오른쪽 끝으로 내려간다.
 *
 * **안 고르는 것도 답이다.** 필수로 두면 사람들은 아무거나 고르고, 그러면 틀린 값이
 * 「모른다」보다 나쁜 자리에 앉는다.
 */
export function RelationChoice({
  value,
  onChange,
  idPrefix,
  action,
}: {
  value: Relation | null;
  onChange: (next: Relation | null) => void;
  idPrefix: string;
  /** 칩 줄 오른쪽 끝의 단추 — 궁합 고르는 자리의 「궁합 보기」 */
  action?: ReactNode;
}) {
  return (
    <fieldset>
      {/* `float-left w-full` — 안 두면 legend 가 테두리 선을 끊고 그 위에 걸터앉는다 */}
      <legend className={`float-left w-full ${TYPE_NAME}`}>두 분은 무슨 사이인가요?</legend>
      <p className="mt-1.5 text-[13px] leading-5 text-secondary">
        사이에 따라 읽어 드릴 방향이 달라져요. 가족에게 할 말과 연인에게 할 말이 다르기
        때문이에요. <strong className="font-semibold text-foreground">점수의 기준도 이 답을 따라요.</strong>
      </p>

      <div className="mt-2 flex flex-wrap items-center gap-x-1.5">
        {[...RELATIONS, null].map((choice) => {
          const id = `${idPrefix}-relation-${choice ?? 'unknown'}`;
          const label = choice === null ? '아직 모르겠음' : RELATION_LABEL[choice];
          const picked = value === choice;

          return (
            <label
              key={id}
              htmlFor={id}
              className="group relative inline-flex min-h-11 cursor-pointer items-center active:scale-[0.97]"
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
                className="peer absolute inset-0 cursor-pointer appearance-none opacity-0"
              />
              <span
                className={`inline-flex min-h-9 items-center gap-1 rounded-full px-3.5 text-[14px] ring-1 peer-focus-visible:outline peer-focus-visible:outline-3 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-focus ${
                  picked
                    ? 'bg-accent-wash font-semibold text-foreground ring-border-strong'
                    : 'bg-surface font-medium text-secondary ring-border group-hover:text-foreground'
                }`}
              >
                {picked && <Icon name="check" className="size-3 stroke-[3.6]" />}
                {label}
              </span>
            </label>
          );
        })}
        {action !== undefined && <div className="ml-auto flex min-w-0 justify-end pl-1.5">{action}</div>}
      </div>
    </fieldset>
  );
}
