import { TYPE_SECTION } from '../ui/surfaces';
import { bookOf } from '../me/(shelf)/readings/book';
import { PairCover } from '../me/(shelf)/readings/shelf';
import type { ReadingEntry } from '../me/reading/current';

/**
 * **궁합풀이 보관함** — 내가 만든 궁합풀이 전부, 책장의 궁합 표지 그대로(ADR 0129).
 *
 * 직접 본 궁합(저장한 사람 · 적어 넣은 사람끼리)과 인연 궁합이 **한 줄에** 선다. 차례는 DB 가 준 그대로(최근 것이
 * 앞)이고 어디서 왔는지만 작은 딱지로 가른다. 인연 궁합은 눌러도 제 결과 화면(`/me/match/…`)으로 간다 — 동의 ·
 * 차단 · 채팅이 함께 서는 자리라 켜지는 탭도 인연이다(ADR 0126). 주소는 표지가 든다(`readingHref`).
 *
 * 한 권도 없으면 이 구역은 안 선다 — 바로 위의 고르는 칸이 궁합을 만드는 자리다.
 */
export function CompatArchive({ readings }: { readings: readonly ReadingEntry[] }) {
  const pairs = readings.flatMap((entry) => {
    const book = bookOf(entry);
    return book.single ? [] : [{ book, source: entry.kind === 'match' ? '인연' : '직접' }];
  });
  if (pairs.length === 0) return null;

  return (
    <section aria-labelledby="compat-archive" className="flex flex-col gap-4">
      <h2 id="compat-archive" className={`${TYPE_SECTION} flex items-baseline gap-2`}>
        궁합풀이 보관함
        <span className="font-sans text-[13px] font-semibold tabular-nums text-secondary">{pairs.length}개</span>
      </h2>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {pairs.map(({ book, source }) => (
          <li key={book.key}>
            <PairCover book={book} source={source} />
          </li>
        ))}
      </ul>
    </section>
  );
}
