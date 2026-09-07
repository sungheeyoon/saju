import { CardTabs } from './card-tabs';

/**
 * 운 표 셋 — **고르는 일만 브라우저로 간다**(`CardTabs`).
 *
 * `id="fortune"` 은 이 카드를 감싼 묶음이 든다(`SajuView`) — 그 묶음에는 겹침 칸이 함께
 * 서고, 그 칸은 겹칠 것이 없으면 아예 안 선다.
 */
export function FortuneTabs({
  asOf,
  daeun,
  saeun,
  wolun,
}: {
  /**
   * 표가 「현재」를 짚은 기준 시각 — **표 옆에 적어야 참이 된다.**
   *
   * 「지금의 운」 카드가 이 문장을 들고 있었다. 그 카드가 없어지면서 표만 남았는데,
   * 표의 「현재」 표시는 여전히 이 시각으로 정해진다 — 적지 않으면 어제 열어 둔 탭이
   * 오늘의 운인 것처럼 읽히고, 링크를 받은 사람은 남의 어제를 자기 지금으로 읽는다.
   */
  readonly asOf: string;
  /**
   * **이미 그려진 표를 받는다.**
   *
   * 표를 자식으로 부르면 표 셋의 코드(430여 줄)가 「어느 표를 볼까」 하나 때문에
   * 브라우저로 따라간다.
   */
  readonly daeun: React.ReactNode;
  readonly saeun: React.ReactNode;
  readonly wolun: React.ReactNode;
}) {
  return (
    <CardTabs
      id="fortune"
      title="운 흐름"
      note={`다른 시점을 골라 한 표씩 집중해서 봅니다. ${asOf} 기준으로 짚었고, 다시 제출하기 전까지는 이 기준 시각이 바뀌지 않습니다.`}
      tablistLabel="운 종류"
      initial="saeun"
      tabs={[
        { key: 'daeun', label: '대운', panel: daeun },
        { key: 'saeun', label: '세운', panel: saeun },
        { key: 'wolun', label: '월운', panel: wolun },
      ]}
    />
  );
}
