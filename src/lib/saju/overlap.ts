import type { RelationKind } from './constants';
import { PILLAR_POSITIONS, type PillarPosition } from './position';
import type { Relation } from './relations';
import type { Emptiness, EmptinessBasis } from './sinsal';

/**
 * 자리마다 그 글자에 **무엇이 함께 걸렸는가** — 관계표와 공망을 자리로 색인한 것.
 *
 * ## 왜 색인을 따로 두는가
 *
 * 이 표에 새 사실은 없다. `relations` 와 `sinsal.emptiness` 에서 전부 유도된다.
 * 그래서 「유도할 수 있는 것을 표로 적으면 두 벌이 되고 어긋난 쪽을 알 수 없다」
 * 는 이 저장소의 규율에 정면으로 걸린다 — 지지암합 표를 두지 않기로 한 자리다.
 *
 * 그런데도 두는 이유는 **거기서 걸러 낸 것이 지식 표가 아니라 조인**이기 때문이다.
 * 암합 표는 지장간 표와 천간합 표를 옮겨 적은 것이라 두 벌이 되면 어느 쪽이
 * 원문인지 알 수 없다. 이것은 옮겨 적을 원문이 없다 — 같은 명식의 두 값을
 * 자리로 맞춰 본 것뿐이고, 원본은 언제나 `relations` 다.
 *
 * 그리고 **읽는 쪽이 실제로 필요로 하는 것이 이 모양이다.** 신살은 자기가 어느
 * 자리에 걸렸는지 알고(`hits[].position`) 관계표는 자기 참여자가 어느 자리인지
 * 아는데, 둘을 맞춰 보는 곳이 아무 데도 없었다. 「일지에 도화가 있다」와 「그
 * 일지가 충을 맞았다」가 자료 안에 나란히 있는데도 읽는 쪽이 스스로 조인해야
 * 했고, 그 조인을 산문으로 시키면 틀린다.
 *
 * 두 벌이 되지 않게 **시험이 관계표에서 다시 세어 같은지 확인한다**
 * (`overlap.test.ts`). 색인이 원본과 어긋나면 거기서 걸린다.
 *
 * ## 무엇을 **말하지 않는가**
 *
 * 자리에 붙은 관습적 의미 — 년주가 조상, 일지가 배우자, 시주가 자식 — 는 여기
 * 없다. 여덟 글자에서 나오는 값이 아니라서다. 궁합이 `spouseSeat: 'display-only'`
 * 로 같은 결정을 이미 내려 두었고(`COMPAT_POLICY`), 엔진이 그것을 값으로 만들면
 * 관습적 의미를 계산 결과인 척 담게 된다. 자리 이름만 사실로 내고, 그 자리가
 * 무엇을 뜻하는지는 읽는 쪽이 든다.
 *
 * 겹쳤다는 것이 **무엇을 뜻하는지도 말하지 않는다.** 「양인이 충을 맞으면 …」은
 * 계통이 갈리는 판정이다. 여기서는 양인이 걸린 지지에 충이 있다는 사실까지다.
 */

/** 천간끼리의 관계 이름 — 이름이 곧 tier 다 */
export type StemRelationKind = Extract<RelationKind, `stem${string}`>;

/** 지지끼리의 관계 이름 */
export type BranchRelationKind = Extract<RelationKind, `branch${string}`>;

/**
 * 자리에 걸린 관계 하나 — 이름만. 자세한 것은 `relations` 가 든다.
 *
 * `tier` 는 두지 않는다. 어느 칸에 담겼는지(`stem`·`branch`)가 이미 그것을
 * 말하고 `kind` 이름에도 들어 있어(`stemClash`·`branchClash`) 같은 사실의 세
 * 번째 사본이 된다.
 *
 * **그 말이 참인지는 타입이 지킨다.** 칸마다 들어갈 수 있는 `kind` 를 좁혀
 * 두었으므로, 지지 관계가 천간 칸에 담기면 컴파일이 막힌다 — 「칸이 곧 tier 다」가
 * 관례가 아니라 구조가 된다.
 */
export type OverlapRelation<K extends RelationKind = RelationKind> = {
  kind: K;
  ko: string;
};

export type PositionOverlap = {
  position: PillarPosition;
  /** 그 기둥의 천간에 걸린 관계 */
  stem: readonly OverlapRelation<StemRelationKind>[];
  /** 그 기둥의 지지에 걸린 관계 */
  branch: readonly OverlapRelation<BranchRelationKind>[];
  /**
   * 그 기둥의 지지가 공망인 기준들. 공망은 지지에만 붙으므로 천간 쪽은 없다.
   *
   * 일주 기준과 년주 기준을 모두 내는 정책이라(`SINSAL_POLICY.emptinessBasis`)
   * 어느 기준으로 비었는지까지 적는다 — 한쪽만 비는 자리가 흔하다.
   */
  emptiness: readonly EmptinessBasis[];
};

/**
 * 시주가 없으면 그 자리는 **아예 서지 않는다.**
 *
 * 빈 배열로 세우면 「시주에는 아무것도 안 걸렸다」가 되는데, 시주가 없는 것과
 * 시주에 걸린 것이 없는 것은 다른 말이다. 없는 자리를 「쟀는데 없다」로 적지 않는다.
 */
type OverlapInput = {
  relations: readonly Relation[];
  emptiness: readonly Emptiness[];
  /** 시주를 아는가. 모르면 `hour` 자리를 내지 않는다 */
  hourKnown: boolean;
};

const isStemKind = (kind: RelationKind): kind is StemRelationKind => kind.startsWith('stem');
const isBranchKind = (kind: RelationKind): kind is BranchRelationKind => kind.startsWith('branch');

/**
 * 같은 자리에 **같은 이름의 관계가 두 번** 들어오는 것을 접는다.
 *
 * 지어낸 걱정이 아니다 — 2000건에서 1537번 실제로 접힌다. 申이 월지에 있고 子가
 * 일지와 시지에 각각 있으면 「신자 반합」이 두 줄로 서고, 월지 칸에서 보면 같은
 * 이름이 둘이다. 색인은 「이 자리에 무엇이 걸렸는가」를 말하는 자리라 같은 이름을
 * 두 번 세면 읽는 쪽이 더 센 근거로 읽는다.
 *
 * **접힌 뒤에도 원본은 그대로다** — 몇 짝인지가 필요하면 `relations` 를 본다.
 */
const dedupe = <K extends RelationKind>(
  found: readonly OverlapRelation<K>[],
): OverlapRelation<K>[] => {
  const seen = new Map<string, OverlapRelation<K>>();
  for (const one of found) seen.set(`${one.kind}|${one.ko}`, one);
  return [...seen.values()];
};

/**
 * 칸을 **`tier` 가 아니라 `kind` 로 고른다.**
 *
 * 둘은 언제나 같은 값을 말하지만(`stemClash` 는 반드시 `tier: 'stem'`), `kind` 로
 * 고르면 타입이 좁혀져서 「지지 관계가 천간 칸에 담기지 않는다」가 컴파일 시각에
 * 증명된다. 시험은 여전히 원본의 `tier` 와 맞대므로 둘이 어긋나는 날에도 걸린다.
 */
const relationsAt = <K extends RelationKind>(
  relations: readonly Relation[],
  position: PillarPosition,
  isKind: (kind: RelationKind) => kind is K,
): OverlapRelation<K>[] =>
  dedupe(
    relations
      .filter(
        (relation) =>
          isKind(relation.kind) &&
          relation.participants.some((participant) => participant.position === position),
      )
      .map((relation) => ({ kind: relation.kind as K, ko: relation.ko })),
  );

/**
 * 관계표와 공망을 자리로 색인한다.
 *
 * **겹친 것이 없는 자리도 낸다.** 「쟀는데 없다」와 「안 쟀다」를 가르려면 자리가
 * 서 있어야 한다 — 자리가 빠지는 것은 시주 미상뿐이고, 그것은 위에 적었다.
 */
export function positionOverlapsOf({
  relations,
  emptiness,
  hourKnown,
}: OverlapInput): PositionOverlap[] {
  const positions = hourKnown
    ? PILLAR_POSITIONS
    : PILLAR_POSITIONS.filter((position) => position !== 'hour');

  return positions.map((position) => ({
    position,
    stem: relationsAt(relations, position, isStemKind),
    branch: relationsAt(relations, position, isBranchKind),
    emptiness: emptiness
      .filter((one) => one.positions.includes(position))
      .map((one) => one.basis),
  }));
}
