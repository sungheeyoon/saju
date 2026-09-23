import type { Pillar } from '../constants';
import { tenGodOf, tenGodOfBranch, type TenGod } from '../analysis/tenGods';
import type { Pillars } from '../pillars';
import type { LabeledPillars } from '../relations';
import { twelveSpiritOf, type SpiritBasis, type TwelveSpirit } from '../sinsal';
import { twelveStageOf, type TwelveStage, type TwelveStageOptions } from '../stages';

/**
 * **운 한 칸이 원국에 대고 읽는 것** — 대운·세운·월운이 나눠 쓰는 자리.
 *
 * 세 표는 경계도 주기도 다르다. 대운은 열 해를 나이로, 세운은 한 해를 입춘으로,
 * 월운은 한 달을 절입으로 끊는다. 그런데 **칸 안에서 하는 일은 셋이 같다** — 그 칸의
 * 기둥을 일간과 원국에 대고 읽는 것이다.
 *
 * 그 아홉 줄이 세 파일에 **글자까지 똑같이** 적혀 있었다(`daeun:300` · `saeun:203` ·
 * `wolun:167`). 복사가 나쁘다는 말이 아니다 — 나쁜 것은 **셋이 같다는 사실을 아무것도
 * 붙들고 있지 않았다**는 쪽이다. 한 자리에서 신살 기준을 년지에서 월지로 옮기면 나머지
 * 둘은 옛 기준으로 남고, 그때 빨개지는 자리가 없다. 세 표는 한 화면에 나란히 서므로
 * 그 어긋남은 사용자가 먼저 본다.
 *
 * 그래서 값이 아니라 **자리**를 하나로 만든다. 이제 셋이 같은 것은 우연이 아니라 구조다.
 */
type FortuneReadings = {
  /** 일간에서 본 이 기둥 천간·지지의 십성 */
  tenGods: { stem: TenGod; branch: TenGod };
  /** 일간이 이 기둥 지지에서 어떤 상태인가 */
  stage: TwelveStage;
  /** 12신살 — 원국의 년지·일지 기준 각각 */
  spirits: Record<SpiritBasis, TwelveSpirit>;
};

/**
 * 읽는 데 **실제로 드는 것** — 일간과 원국의 년지·일지 셋뿐이다.
 *
 * 처음에는 `Pillars` 를 통째로 받게 썼다가 **타입 검사에 걸렸다.** 세운·월운은 원국을
 * `meta` 없이 다섯 칸으로 좁혀 들고 다니므로(`SaeunInput`·`WolunInput`), 통째로 달라는
 * 쪽이 **더 달라고 한 것**이었다. 계산마다 `Pick` 으로 필요한 만큼만 받는 것은 이
 * 저장소가 이미 여러 자리에서 하는 일이다(`StructureInput`·`RootednessInput`·
 * `EffectiveInput` …).
 */

/**
 * 그 기둥을 **일간과 원국에 대고** 읽는다.
 *
 * 기준이 둘이라는 것이 요점이다 — 십성과 12운성은 **일간**에서, 12신살은 **원국의
 * 년지·일지**에서 나온다. 부르는 쪽이 일간만 넘기게 두면 신살 기준을 따로 적게 되고,
 * 그 자리가 세 벌이 된다. 그래서 일간만이 아니라 **그 두 지지까지 함께** 받는다.
 *
 * `stages` 는 **넘겨받는다.** 12운성 계통(음간 역행 여부)은 우리가 고른 것이라
 * (`DEFAULT_YIN_REVERSE`), 세 표가 한 화면에 서는데 계통이 갈리면 어느 것이 어느
 * 계통인지 아무 데도 안 적힌다.
 */
type NatalBasis = Pick<Pillars, 'year' | 'day' | 'dayMaster'>;

export function fortuneReadingsOf(
  natal: NatalBasis,
  pillar: Pillar,
  stages?: TwelveStageOptions,
): FortuneReadings {
  const dayMaster = natal.dayMaster;

  return {
    tenGods: {
      stem: tenGodOf(dayMaster, pillar.stem),
      branch: tenGodOfBranch(dayMaster, pillar.branch),
    },
    stage: twelveStageOf(dayMaster, pillar.branch, stages),
    spirits: {
      year: twelveSpiritOf(natal.year.branch, pillar.branch),
      day: twelveSpiritOf(natal.day.branch, pillar.branch),
    },
  };
}

/**
 * 운 칸이 관계 연산에 설 때의 자리 이름.
 *
 * 세운은 연간지라 `'year'`, 대운과 월운은 월주에서 온 것이라 `'month'` 다. **자리
 * 이름은 판 안에서만 뜻이 있고, 판을 가르는 것은 `chartId` 다** — 원국 년주와 세운
 * 년주가 둘 다 `'year'` 인 것이 그 증거다.
 */
type FortuneSeat = 'year' | 'month';

/**
 * 기둥 하나짜리 명식 — **나머지 세 자리는 비운다.**
 *
 * 운 칸에는 기둥이 하나뿐이다. 빈 자리를 아무 글자로도 채우지 않는 것은 **없는 글자로
 * 관계를 만들지 않는다**는 규칙이고, 시간 미상 시주가 따르는 규칙과 같은 것이다.
 *
 * 이 모양이 다섯 자리에 손으로 적혀 있었다(`daeun` 둘 · `saeun` 하나 · `wolun` 둘).
 * 한 자리에서 `day: pillar` 로 잘못 적으면 그 칸만 다른 관계를 내는데, 관계는 수가 많아
 * 눈으로 세지 못한다.
 */
export function fortuneChart(chartId: string, seat: FortuneSeat, pillar: Pillar): LabeledPillars {
  return {
    chartId,
    pillars: {
      year: seat === 'year' ? pillar : null,
      month: seat === 'month' ? pillar : null,
      day: null,
      hour: null,
    },
  };
}
