/**
 * 외부에서 격을 명시한 명조 — **격국 판정의 첫 대조 자료.**
 *
 * `STRUCTURE_POLICY.externalCheck` 가 여태 `{ dataset: null, cases: 0 }` 이었다. 종격은
 * 서른다섯 건을 놓고 게이트를 못 열었고 격국은 **재 본 적이 없는데** 상한 사다리에서 같은
 * `candidate` 칸에 앉아 있었다 — 「재어 봤는데 모자란다」와 「아직 안 재 봤다」가 같은
 * 칸에 앉으면 그 칸이 무엇을 뜻하는지 알 수 없다.
 *
 * ## 출처와 claim 을 고른 방법
 *
 * 《子平真詮》은 **격국을 논하는 책**이고 장(章)이 격마다 하나씩이다. 論正官 장의 예시는
 * 정관격이고 論財 장의 예시는 재격이다 — 그래서 **claim 은 장이 든다.** 산문에서 격
 * 이름을 골라내지 않는다: 財 장의 문장은 「財格佩印」처럼 다른 십성을 늘 함께 부르는데,
 * 그것은 다른 격이 아니라 **그 격을 어떻게 쓰는가**이기 때문이다. 산문에서 낱말을 주우면
 * 그 차이가 지워진다.
 *
 * `label` 은 명조 바로 뒤의 원문을 그대로 옮긴 것이다. 우리가 요약하지 않는다.
 *
 * ## 우리 격과 저쪽 격의 눈금이 다르다
 *
 * 이 책은 財格·印綬格으로 부르고 우리는 正財格·偏財格·正印格·偏印格으로 가른다. 그래서
 * `kinds` 가 **배열**이다 — 저쪽 한 이름이 우리 쪽 둘에 걸리는 자리이고, 그 둘 중 하나가
 * 나오면 맞은 것으로 센다. 없는 눈금을 있는 척하지 않는다.
 *
 * 建祿·月劫은 우리 쪽에서도 격이 아니라 **월령을 격으로 쓸 수 없는 자리**다
 * (`SELF_SEAT_KINDS`). 그 장의 예시는 그 자리로 잡혔는지를 본다.
 *
 * ## 계통이 하나다
 *
 * 억부·종격 자료가 계통을 둘 이상 섞은 것과 다르다. 격국은 **자평 계열의 개념 자체**라
 * 다른 계통에 같은 눈금이 없다 — 억부 계열은 격을 안 잡고, 현대 정리 사이트는 이 책을
 * 다시 옮긴 것이 대부분이라 섞어도 계통이 늘지 않는다. 그러니 이 대조가 말할 수 있는 것은
 * **「자평 계열과 얼마나 맞는가」**뿐이고, 게이트를 여는 근거로는 그만큼 약하다.
 */

import type { StructureKind } from '../structure';

export type StructureExternalCase = {
  id: string;
  pillars: { year: string; month: string; day: string; hour: string };
  /** 이 책 하나뿐이다 — 위 머리말의 「계통이 하나다」를 값으로 든다 */
  lineage: 'classical-chinese';
  source: { title: string; url: string; locator: string; retrievedAt: '2026-09-05' };
  claim: {
    /** 이 명조가 실린 장 — claim 의 출처다 */
    chapter: string;
    /** 저쪽 한 이름에 걸리는 우리 쪽 격들. 하나라도 나오면 맞은 것으로 센다 */
    kinds: readonly StructureKind[];
    /** 명조 뒤의 원문 표기 그대로 */
    label: string;
  };
  /** 네 기둥이 오호둔·오자둔과 맞는가 — 시험이 손으로 적은 값을 믿지 않고 다시 센다 */
  chartConstruction: 'consistent' | 'unrealizable';
  caveats?: readonly string[];
};

const SOURCE = {
  title: '子平真詮評注 (清 沈孝瞻)',
  url: 'https://ctext.org/wiki.pl?if=gb&chapter=974137',
  retrievedAt: '2026-09-05',
} as const;

export const STRUCTURE_EXTERNAL_CASES: readonly StructureExternalCase[] = [
  {
    id: 'zpzq-zhengguan-1',
    pillars: { year: '甲申', month: '壬申', day: '乙巳', hour: '戊寅' },
    lineage: 'classical-chinese',
    source: { ...SOURCE, locator: '論正官 §220' },
    claim: { chapter: '論正官', kinds: ['正官格'], label: '，壬印戊財，以乙隔之，水與土不相礙，故為大貴' },
    chartConstruction: 'consistent',
  },
  {
    id: 'zpzq-zhengguan-2',
    pillars: { year: '乙卯', month: '丁亥', day: '丁未', hour: '庚戌' },
    lineage: 'classical-chinese',
    source: { ...SOURCE, locator: '論正官 §221' },
    claim: { chapter: '論正官', kinds: ['正官格'], label: '，此並用財印，無傷官而不雜煞，所謂去其忌而存其喜者也' },
    chartConstruction: 'consistent',
  },
  {
    id: 'zpzq-zhengguan-3',
    pillars: { year: '己卯', month: '辛未', day: '壬寅', hour: '辛亥' },
    lineage: 'classical-chinese',
    source: { ...SOURCE, locator: '論正官 §222' },
    claim: { chapter: '論正官', kinds: ['正官格'], label: '，未中己官透乾用清，支會木局，兩辛解之，是遇傷而佩印也' },
    chartConstruction: 'consistent',
  },
  {
    id: 'zpzq-zhengguan-4',
    pillars: { year: '庚寅', month: '乙酉', day: '甲子', hour: '戊辰' },
    lineage: 'classical-chinese',
    source: { ...SOURCE, locator: '論正官 §222' },
    claim: { chapter: '論正官', kinds: ['正官格'], label: '，甲用酉官，庚金混雜，乙以合之，合煞留官，是雜煞而取清也' },
    chartConstruction: 'consistent',
  },
  {
    id: 'zpzq-zhengguan-5',
    pillars: { year: '丁丑', month: '壬寅', day: '己巳', hour: '丙寅' },
    lineage: 'classical-chinese',
    source: { ...SOURCE, locator: '論正官 §223' },
    claim: { chapter: '論正官', kinds: ['正官格'], label: '，支具巳丑，會金傷官，丙丁解之，透壬豈非破格？卻不知丙丁並透，用一而足，' },
    chartConstruction: 'consistent',
  },
  {
    id: 'zpzq-cai-1',
    pillars: { year: '壬申', month: '壬子', day: '戊午', hour: '乙卯' },
    lineage: 'classical-chinese',
    source: { ...SOURCE, locator: '論財 §232' },
    claim: { chapter: '論財', kinds: ['正財格', '偏財格'], label: '，豈非財露？唯其生官，所以不忌也' },
    chartConstruction: 'consistent',
  },
  {
    id: 'zpzq-cai-2',
    pillars: { year: '壬寅', month: '壬寅', day: '庚辰', hour: '辛巳' },
    lineage: 'classical-chinese',
    source: { ...SOURCE, locator: '論財 §234' },
    claim: { chapter: '論財', kinds: ['正財格', '偏財格'], label: '，楊待郎之命是也' },
    chartConstruction: 'consistent',
  },
  {
    id: 'zpzq-cai-3',
    pillars: { year: '乙未', month: '甲申', day: '丙申', hour: '庚寅' },
    lineage: 'classical-chinese',
    source: { ...SOURCE, locator: '論財 §235' },
    claim: { chapter: '論財', kinds: ['正財格', '偏財格'], label: '，曾參政之命是也，然財印宜相並，如乙未、己卯、庚寅、辛巳，乙與己兩不相能' },
    chartConstruction: 'consistent',
  },
  {
    id: 'zpzq-cai-4',
    pillars: { year: '乙未', month: '己卯', day: '庚寅', hour: '辛巳' },
    lineage: 'classical-chinese',
    source: { ...SOURCE, locator: '論財 §235' },
    claim: { chapter: '論財', kinds: ['正財格', '偏財格'], label: '，乙與己兩不相能，即有好處，小富而已' },
    chartConstruction: 'consistent',
  },
  {
    id: 'zpzq-cai-5',
    pillars: { year: '庚戌', month: '戊子', day: '戊子', hour: '丙辰' },
    lineage: 'classical-chinese',
    source: { ...SOURCE, locator: '論財 §237' },
    claim: { chapter: '論財', kinds: ['正財格', '偏財格'], label: '，庚與丙隔兩戊而不相克，是食與印不相礙也' },
    chartConstruction: 'consistent',
  },
  {
    id: 'zpzq-cai-6',
    pillars: { year: '壬辰', month: '乙巳', day: '癸巳', hour: '辛酉' },
    lineage: 'classical-chinese',
    source: { ...SOURCE, locator: '論財 §237' },
    claim: { chapter: '論財', kinds: ['正財格', '偏財格'], label: '，雖食印相克，而欲存巳戊官，是去食護官也' },
    chartConstruction: 'consistent',
  },
  {
    id: 'zpzq-cai-7',
    pillars: { year: '甲子', month: '辛未', day: '辛酉', hour: '壬辰' },
    lineage: 'classical-chinese',
    source: { ...SOURCE, locator: '論財 §238' },
    claim: { chapter: '論財', kinds: ['正財格', '偏財格'], label: '，甲透未庫，逢辛為劫，壬以化劫生財，汪學士命是也，財旺無劫而透傷，反為不' },
    chartConstruction: 'consistent',
  },
  {
    id: 'zpzq-cai-8',
    pillars: { year: '乙酉', month: '庚辰', day: '甲午', hour: '戊辰' },
    lineage: 'classical-chinese',
    source: { ...SOURCE, locator: '論財 §239' },
    claim: { chapter: '論財', kinds: ['正財格', '偏財格'], label: '，合煞存財也；李御史命，庚辰、戊子、戊寅、甲寅，制煞生財也' },
    chartConstruction: 'consistent',
  },
  {
    id: 'zpzq-cai-9',
    pillars: { year: '庚辰', month: '戊子', day: '戊寅', hour: '甲寅' },
    lineage: 'classical-chinese',
    source: { ...SOURCE, locator: '論財 §239' },
    claim: { chapter: '論財', kinds: ['正財格', '偏財格'], label: '，制煞生財也' },
    chartConstruction: 'consistent',
  },
  {
    id: 'zpzq-cai-10',
    pillars: { year: '丙寅', month: '癸巳', day: '癸未', hour: '壬戌' },
    lineage: 'classical-chinese',
    source: { ...SOURCE, locator: '論財 §241' },
    claim: { chapter: '論財', kinds: ['正財格', '偏財格'], label: '，林尚書命是也' },
    chartConstruction: 'consistent',
  },
  {
    id: 'zpzq-cai-11',
    pillars: { year: '丙辰', month: '癸巳', day: '壬戌', hour: '壬寅' },
    lineage: 'classical-chinese',
    source: { ...SOURCE, locator: '論財 §241' },
    claim: { chapter: '論財', kinds: ['正財格', '偏財格'], label: '，王太僕命是也' },
    chartConstruction: 'consistent',
  },
  {
    id: 'zpzq-cai-12',
    pillars: { year: '丙辰', month: '丙申', day: '丙午', hour: '壬辰' },
    lineage: 'classical-chinese',
    source: { ...SOURCE, locator: '論財 §242' },
    claim: { chapter: '論財', kinds: ['正財格', '偏財格'], label: '，此變之又變者也' },
    chartConstruction: 'consistent',
  },
  {
    id: 'zpzq-yinshou-1',
    pillars: { year: '丙寅', month: '戊戌', day: '辛酉', hour: '戊子' },
    lineage: 'classical-chinese',
    source: { ...SOURCE, locator: '論印綬 §250' },
    claim: { chapter: '論印綬', kinds: ['正印格', '偏印格'], label: '，張參政之命是也' },
    chartConstruction: 'consistent',
  },
  {
    id: 'zpzq-yinshou-2',
    pillars: { year: '丙戌', month: '戊戌', day: '辛未', hour: '壬辰' },
    lineage: 'classical-chinese',
    source: { ...SOURCE, locator: '論印綬 §251' },
    claim: { chapter: '論印綬', kinds: ['正印格', '偏印格'], label: '，壬為戊制，不傷官也' },
    chartConstruction: 'consistent',
  },
  {
    id: 'zpzq-yinshou-3',
    pillars: { year: '乙亥', month: '己卯', day: '丁酉', hour: '壬寅' },
    lineage: 'classical-chinese',
    source: { ...SOURCE, locator: '論印綬 §251' },
    claim: { chapter: '論印綬', kinds: ['正印格', '偏印格'], label: '，己為乙制，己不礙官也' },
    chartConstruction: 'consistent',
  },
  {
    id: 'zpzq-yinshou-4',
    pillars: { year: '戊戌', month: '乙卯', day: '丙午', hour: '乙亥' },
    lineage: 'classical-chinese',
    source: { ...SOURCE, locator: '論印綬 §252' },
    claim: { chapter: '論印綬', kinds: ['正印格', '偏印格'], label: '，李狀元命也，若印淺身輕，而用層層傷食，則寒貧之局矣' },
    /** 판본이 옮겨지며 어긋난 자리 — **고전이라고 이 검사에서 면제되지 않는다** */
    chartConstruction: 'unrealizable',
    caveats: ['戊년의 亥시는 오자둔으로 己亥다 — 乙亥가 될 수 없다'],
  },
  {
    id: 'zpzq-yinshou-5',
    pillars: { year: '己巳', month: '癸酉', day: '癸未', hour: '庚申' },
    lineage: 'classical-chinese',
    source: { ...SOURCE, locator: '論印綬 §253' },
    claim: { chapter: '論印綬', kinds: ['正印格', '偏印格'], label: '，此身輕印重也' },
    chartConstruction: 'consistent',
  },
  {
    id: 'zpzq-yinshou-6',
    pillars: { year: '壬寅', month: '戊申', day: '壬辰', hour: '壬寅' },
    lineage: 'classical-chinese',
    source: { ...SOURCE, locator: '論印綬 §253' },
    claim: { chapter: '論印綬', kinds: ['正印格', '偏印格'], label: '，此身重印輕也' },
    chartConstruction: 'consistent',
  },
  {
    id: 'zpzq-yinshou-7',
    pillars: { year: '辛酉', month: '丙申', day: '壬申', hour: '辛亥' },
    lineage: 'classical-chinese',
    source: { ...SOURCE, locator: '論印綬 §255' },
    claim: { chapter: '論印綬', kinds: ['正印格', '偏印格'], label: '，汪侍郎命是也' },
    chartConstruction: 'consistent',
  },
  {
    id: 'zpzq-yinshou-8',
    pillars: { year: '庚寅', month: '乙酉', day: '癸亥', hour: '丙辰' },
    lineage: 'classical-chinese',
    source: { ...SOURCE, locator: '論印綬 §256' },
    claim: { chapter: '論印綬', kinds: ['正印格', '偏印格'], label: '，此牛監薄命，乙合庚而不生癸，所以為貴，若合財存食，又可類推矣' },
    chartConstruction: 'consistent',
  },
  {
    id: 'zpzq-yinshou-9',
    pillars: { year: '己未', month: '甲戌', day: '辛未', hour: '癸巳' },
    lineage: 'classical-chinese',
    source: { ...SOURCE, locator: '論印綬 §256' },
    claim: { chapter: '論印綬', kinds: ['正印格', '偏印格'], label: '，此合財存食之貴也' },
    chartConstruction: 'consistent',
  },
  {
    id: 'zpzq-yinshou-10',
    pillars: { year: '辛亥', month: '庚子', day: '甲辰', hour: '乙亥' },
    lineage: 'classical-chinese',
    source: { ...SOURCE, locator: '論印綬 §257' },
    claim: { chapter: '論印綬', kinds: ['正印格', '偏印格'], label: '，此合煞留官也；壬子、癸卯、丙子、己亥、此官煞有制也' },
    chartConstruction: 'consistent',
  },
  {
    id: 'zpzq-yinshou-11',
    pillars: { year: '壬子', month: '癸卯', day: '丙子', hour: '己亥' },
    lineage: 'classical-chinese',
    source: { ...SOURCE, locator: '論印綬 §257' },
    claim: { chapter: '論印綬', kinds: ['正印格', '偏印格'], label: '、此官煞有制也' },
    chartConstruction: 'consistent',
  },
  {
    id: 'zpzq-yinshou-12',
    pillars: { year: '庚戌', month: '戊子', day: '甲戌', hour: '乙亥' },
    lineage: 'classical-chinese',
    source: { ...SOURCE, locator: '論印綬 §259' },
    claim: { chapter: '論印綬', kinds: ['正印格', '偏印格'], label: '是也' },
    chartConstruction: 'consistent',
  },
  {
    id: 'zpzq-shishen-1',
    pillars: { year: '丁未', month: '癸卯', day: '癸亥', hour: '癸丑' },
    lineage: 'classical-chinese',
    source: { ...SOURCE, locator: '論食神 §268' },
    claim: { chapter: '論食神', kinds: ['食神格'], label: '，梁丞相之命是也；己未、壬申、戊子、庚申，謝閣老之命是也' },
    chartConstruction: 'consistent',
  },
  {
    id: 'zpzq-shishen-2',
    pillars: { year: '己未', month: '壬申', day: '戊子', hour: '庚申' },
    lineage: 'classical-chinese',
    source: { ...SOURCE, locator: '論食神 §268' },
    claim: { chapter: '論食神', kinds: ['食神格'], label: '，謝閣老之命是也' },
    chartConstruction: 'consistent',
  },
  {
    id: 'zpzq-shishen-3',
    pillars: { year: '丁亥', month: '癸卯', day: '癸卯', hour: '甲寅' },
    lineage: 'classical-chinese',
    source: { ...SOURCE, locator: '論食神 §269' },
    claim: { chapter: '論食神', kinds: ['食神格'], label: '，沈路分命是也' },
    chartConstruction: 'consistent',
  },
  {
    id: 'zpzq-shishen-4',
    pillars: { year: '甲午', month: '丁卯', day: '癸丑', hour: '丙辰' },
    lineage: 'classical-chinese',
    source: { ...SOURCE, locator: '論食神 §269' },
    claim: { chapter: '論食神', kinds: ['食神格'], label: '，龔知縣命是也' },
    chartConstruction: 'consistent',
  },
  {
    id: 'zpzq-shishen-5',
    pillars: { year: '辛卯', month: '辛卯', day: '癸酉', hour: '己未' },
    lineage: 'classical-chinese',
    source: { ...SOURCE, locator: '論食神 §271' },
    claim: { chapter: '論食神', kinds: ['食神格'], label: '，常國公命是也' },
    chartConstruction: 'consistent',
  },
  {
    id: 'zpzq-shishen-6',
    pillars: { year: '戊戌', month: '壬戌', day: '丙子', hour: '戊戌' },
    lineage: 'classical-chinese',
    source: { ...SOURCE, locator: '論食神 §271' },
    claim: { chapter: '論食神', kinds: ['食神格'], label: '，胡會元命是也' },
    chartConstruction: 'consistent',
  },
  {
    id: 'zpzq-shishen-7',
    pillars: { year: '丁亥', month: '壬子', day: '辛巳', hour: '丁酉' },
    lineage: 'classical-chinese',
    source: { ...SOURCE, locator: '論食神 §272' },
    claim: { chapter: '論食神', kinds: ['食神格'], label: '，舒尚書命是也' },
    chartConstruction: 'consistent',
  },
  {
    id: 'zpzq-shishen-8',
    pillars: { year: '丙午', month: '癸巳', day: '甲子', hour: '丙寅' },
    lineage: 'classical-chinese',
    source: { ...SOURCE, locator: '論食神 §272' },
    claim: { chapter: '論食神', kinds: ['食神格'], label: '，錢參政命是也' },
    chartConstruction: 'consistent',
  },
  {
    id: 'zpzq-shishen-9',
    pillars: { year: '癸酉', month: '辛酉', day: '己卯', hour: '乙亥' },
    lineage: 'classical-chinese',
    source: { ...SOURCE, locator: '論食神 §276' },
    claim: { chapter: '論食神', kinds: ['食神格'], label: '是也' },
    chartConstruction: 'consistent',
  },
  {
    id: 'zpzq-pianguan-1',
    pillars: { year: '乙亥', month: '乙酉', day: '乙卯', hour: '丁丑' },
    lineage: 'classical-chinese',
    source: { ...SOURCE, locator: '論偏官 §283' },
    claim: { chapter: '論偏官', kinds: ['偏官格'], label: '，極等之貴也' },
    chartConstruction: 'consistent',
  },
  {
    id: 'zpzq-pianguan-2',
    pillars: { year: '壬辰', month: '甲辰', day: '丙戌', hour: '戊戌' },
    lineage: 'classical-chinese',
    source: { ...SOURCE, locator: '論偏官 §284' },
    claim: { chapter: '論偏官', kinds: ['偏官格'], label: '，辰中暗煞，壬以透之，戊坐四支，食太重而透甲印，以損太過，豈非貴格？若煞' },
    chartConstruction: 'consistent',
  },
  {
    id: 'zpzq-pianguan-3',
    pillars: { year: '丙寅', month: '戊戌', day: '壬戌', hour: '辛丑' },
    lineage: 'classical-chinese',
    source: { ...SOURCE, locator: '論偏官 §285' },
    claim: { chapter: '論偏官', kinds: ['偏官格'], label: '，戊與辛同通月令，是煞印有情也' },
    chartConstruction: 'consistent',
  },
  {
    id: 'zpzq-pianguan-4',
    pillars: { year: '戊戌', month: '甲子', day: '丁未', hour: '庚戌' },
    lineage: 'classical-chinese',
    source: { ...SOURCE, locator: '論偏官 §287' },
    claim: { chapter: '論偏官', kinds: ['偏官格'], label: '，戊被制不能伏煞，時透庚財，即以清食者，生不足之煞' },
    chartConstruction: 'consistent',
  },
  {
    id: 'zpzq-pianguan-5',
    pillars: { year: '甲申', month: '乙亥', day: '丙戌', hour: '庚寅' },
    lineage: 'classical-chinese',
    source: { ...SOURCE, locator: '論偏官 §288' },
    claim: { chapter: '論偏官', kinds: ['偏官格'], label: '，劉運使命是也' },
    chartConstruction: 'consistent',
  },
  {
    id: 'zpzq-pianguan-6',
    pillars: { year: '癸卯', month: '丁巳', day: '庚寅', hour: '庚辰' },
    lineage: 'classical-chinese',
    source: { ...SOURCE, locator: '論偏官 §290' },
    claim: { chapter: '論偏官', kinds: ['偏官格'], label: '，去官留煞也' },
    chartConstruction: 'consistent',
  },
  {
    id: 'zpzq-pianguan-7',
    pillars: { year: '丙子', month: '甲午', day: '辛亥', hour: '辛卯' },
    lineage: 'classical-chinese',
    source: { ...SOURCE, locator: '論偏官 §290' },
    claim: { chapter: '論偏官', kinds: ['偏官格'], label: '，子衝午而克煞，是去煞留官也' },
    chartConstruction: 'consistent',
  },
  {
    id: 'zpzq-pianguan-8',
    pillars: { year: '戊辰', month: '甲寅', day: '戊寅', hour: '戊午' },
    lineage: 'classical-chinese',
    source: { ...SOURCE, locator: '論偏官 §291' },
    claim: { chapter: '論偏官', kinds: ['偏官格'], label: '、趙員外命是也' },
    chartConstruction: 'consistent',
  },
  {
    id: 'zpzq-shangguan-1',
    pillars: { year: '壬午', month: '己酉', day: '戊午', hour: '庚申' },
    lineage: 'classical-chinese',
    source: { ...SOURCE, locator: '論傷官 §300' },
    claim: { chapter: '論傷官', kinds: ['傷官格'], label: '，史春芳命也' },
    chartConstruction: 'consistent',
  },
  {
    id: 'zpzq-shangguan-2',
    pillars: { year: '甲子', month: '乙亥', day: '辛未', hour: '戊子' },
    lineage: 'classical-chinese',
    source: { ...SOURCE, locator: '論傷官 §301' },
    claim: { chapter: '論傷官', kinds: ['傷官格'], label: '，幹頭之甲，通根於亥，然又會未成局，化水為木，化之生財，尤為有情，所以傷' },
    chartConstruction: 'consistent',
  },
  {
    id: 'zpzq-shangguan-3',
    pillars: { year: '己卯', month: '丁丑', day: '丙寅', hour: '庚寅' },
    lineage: 'classical-chinese',
    source: { ...SOURCE, locator: '論傷官 §302' },
    claim: { chapter: '論傷官', kinds: ['傷官格'], label: '，己與庚同根月令是也' },
    chartConstruction: 'consistent',
  },
  {
    id: 'zpzq-shangguan-4',
    pillars: { year: '壬申', month: '丙午', day: '甲午', hour: '壬申' },
    lineage: 'classical-chinese',
    source: { ...SOURCE, locator: '論傷官 §303' },
    claim: { chapter: '論傷官', kinds: ['傷官格'], label: '、傷官旺，印根深，身又弱，又是夏木逢潤，其秀百倍，所以一品之貴' },
    chartConstruction: 'consistent',
  },
  {
    id: 'zpzq-shangguan-5',
    pillars: { year: '丁酉', month: '己酉', day: '戊子', hour: '壬子' },
    lineage: 'classical-chinese',
    source: { ...SOURCE, locator: '論傷官 §304' },
    claim: { chapter: '論傷官', kinds: ['傷官格'], label: '，財太重而帶印，而丁與壬隔以戊已，兩不礙，且金水多而覺寒，得火融和，都統' },
    chartConstruction: 'consistent',
  },
  {
    id: 'zpzq-shangguan-6',
    pillars: { year: '壬戌', month: '己酉', day: '戊午', hour: '丁巳' },
    lineage: 'classical-chinese',
    source: { ...SOURCE, locator: '論傷官 §304' },
    claim: { chapter: '論傷官', kinds: ['傷官格'], label: '，印太重而隔戊已，而丁與壬不相礙，一丞相命也' },
    chartConstruction: 'consistent',
  },
  {
    id: 'zpzq-shangguan-7',
    pillars: { year: '己未', month: '丙子', day: '庚子', hour: '丙子' },
    lineage: 'classical-chinese',
    source: { ...SOURCE, locator: '論傷官 §305' },
    claim: { chapter: '論傷官', kinds: ['傷官格'], label: '，蔡貴妃也' },
    chartConstruction: 'consistent',
  },
  {
    id: 'zpzq-shangguan-8',
    pillars: { year: '戊申', month: '甲子', day: '庚午', hour: '丁丑' },
    lineage: 'classical-chinese',
    source: { ...SOURCE, locator: '論傷官 §306' },
    claim: { chapter: '論傷官', kinds: ['傷官格'], label: '，藏癸露丁，戊甲為輔，官又得祿，所以為丞相之格' },
    chartConstruction: 'consistent',
  },
  {
    id: 'zpzq-shangguan-9',
    pillars: { year: '丙申', month: '己亥', day: '辛未', hour: '己亥' },
    lineage: 'classical-chinese',
    source: { ...SOURCE, locator: '論傷官 §307' },
    claim: { chapter: '論傷官', kinds: ['傷官格'], label: '，鄭丞相命是也' },
    chartConstruction: 'consistent',
  },
  {
    id: 'zpzq-shangguan-10',
    pillars: { year: '甲子', month: '壬申', day: '己亥', hour: '辛未' },
    lineage: 'classical-chinese',
    source: { ...SOURCE, locator: '論傷官 §308' },
    claim: { chapter: '論傷官', kinds: ['傷官格'], label: '，章丞相命也' },
    chartConstruction: 'consistent',
  },
  {
    id: 'zpzq-yangren-1',
    pillars: { year: '己酉', month: '丙子', day: '壬寅', hour: '丙午' },
    lineage: 'classical-chinese',
    source: { ...SOURCE, locator: '論陽刃 §318' },
    claim: { chapter: '論陽刃', kinds: ['陽刃格'], label: '，官透有力，旺財生之，丞相命也' },
    chartConstruction: 'consistent',
  },
  {
    id: 'zpzq-yangren-2',
    pillars: { year: '辛酉', month: '甲午', day: '丙申', hour: '壬辰' },
    lineage: 'classical-chinese',
    source: { ...SOURCE, locator: '論陽刃 §318' },
    claim: { chapter: '論陽刃', kinds: ['陽刃格'], label: '，透煞根淺，財印助之，亦丞相命也' },
    chartConstruction: 'consistent',
  },
  {
    id: 'zpzq-yangren-3',
    pillars: { year: '甲午', month: '癸酉', day: '庚寅', hour: '戊寅' },
    lineage: 'classical-chinese',
    source: { ...SOURCE, locator: '論陽刃 §319' },
    claim: { chapter: '論陽刃', kinds: ['陽刃格'], label: '，癸水傷寅午之官，而戊以合之，所謂印護也，如賈平章命，甲寅、庚午、戊申、' },
    chartConstruction: 'consistent',
  },
  {
    id: 'zpzq-yangren-4',
    pillars: { year: '甲寅', month: '庚午', day: '戊申', hour: '甲寅' },
    lineage: 'classical-chinese',
    source: { ...SOURCE, locator: '論陽刃 §319' },
    claim: { chapter: '論陽刃', kinds: ['陽刃格'], label: '，煞兩透而根太重，食以制之，所謂裁損也' },
    chartConstruction: 'consistent',
  },
  {
    id: 'zpzq-yangren-5',
    pillars: { year: '丙戌', month: '丁酉', day: '庚申', hour: '壬午' },
    lineage: 'classical-chinese',
    source: { ...SOURCE, locator: '論陽刃 §319' },
    claim: { chapter: '論陽刃', kinds: ['陽刃格'], label: '，官煞競出，而壬合丁官，煞純而不雜' },
    chartConstruction: 'consistent',
  },
  {
    id: 'zpzq-jianlu-1',
    pillars: { year: '庚戌', month: '戊子', day: '癸酉', hour: '癸亥' },
    lineage: 'classical-chinese',
    source: { ...SOURCE, locator: '論建祿月劫 §326' },
    claim: { chapter: '論建祿月劫', kinds: ['建祿格', '月劫格'], label: '，金丞相命是也' },
    chartConstruction: 'consistent',
  },
  {
    id: 'zpzq-jianlu-2',
    pillars: { year: '丁酉', month: '丙午', day: '丁巳', hour: '壬寅' },
    lineage: 'classical-chinese',
    source: { ...SOURCE, locator: '論建祿月劫 §326' },
    claim: { chapter: '論建祿月劫', kinds: ['建祿格', '月劫格'], label: '，李知府命是也' },
    chartConstruction: 'consistent',
  },
  {
    id: 'zpzq-jianlu-3',
    pillars: { year: '庚午', month: '戊子', day: '癸卯', hour: '丁巳' },
    lineage: 'classical-chinese',
    source: { ...SOURCE, locator: '論建祿月劫 §327' },
    claim: { chapter: '論建祿月劫', kinds: ['建祿格', '月劫格'], label: '，王少師命是也' },
    chartConstruction: 'consistent',
  },
  {
    id: 'zpzq-jianlu-4',
    pillars: { year: '甲子', month: '丙子', day: '癸丑', hour: '壬辰' },
    lineage: 'classical-chinese',
    source: { ...SOURCE, locator: '論建祿月劫 §328' },
    claim: { chapter: '論建祿月劫', kinds: ['建祿格', '月劫格'], label: '，張都統命是也' },
    /** 판본이 옮겨지며 어긋난 자리 — **고전이라고 이 검사에서 면제되지 않는다** */
    chartConstruction: 'unrealizable',
    caveats: ['甲년의 子월은 오호둔으로 丙子가 맞으나 癸丑일의 辰시는 丙辰이다 — 壬辰이 될 수 없다'],
  },
  {
    id: 'zpzq-jianlu-5',
    pillars: { year: '己未', month: '己巳', day: '丁未', hour: '辛丑' },
    lineage: 'classical-chinese',
    source: { ...SOURCE, locator: '論建祿月劫 §329' },
    claim: { chapter: '論建祿月劫', kinds: ['建祿格', '月劫格'], label: '，醜與巳會，即以劫財之火為金局之財，安得不為大貴？所謂化劫為財也' },
    chartConstruction: 'consistent',
  },
  {
    id: 'zpzq-jianlu-6',
    pillars: { year: '庚子', month: '甲申', day: '庚子', hour: '甲申' },
    lineage: 'classical-chinese',
    source: { ...SOURCE, locator: '論建祿月劫 §329' },
    claim: { chapter: '論建祿月劫', kinds: ['建祿格', '月劫格'], label: '，即以劫財之金，化為生財之水，所謂化劫為生也' },
    chartConstruction: 'consistent',
  },
  {
    id: 'zpzq-jianlu-7',
    pillars: { year: '丁巳', month: '壬子', day: '癸卯', hour: '己未' },
    lineage: 'classical-chinese',
    source: { ...SOURCE, locator: '論建祿月劫 §330' },
    claim: { chapter: '論建祿月劫', kinds: ['建祿格', '月劫格'], label: '，壬合丁財以去其黨煞，卯未會局以制伏是也' },
    chartConstruction: 'consistent',
  },
  {
    id: 'zpzq-jianlu-8',
    pillars: { year: '戊辰', month: '癸亥', day: '壬午', hour: '丙午' },
    lineage: 'classical-chinese',
    source: { ...SOURCE, locator: '論建祿月劫 §331' },
    claim: { chapter: '論建祿月劫', kinds: ['建祿格', '月劫格'], label: '，合煞存財，袁內閣命是也' },
    chartConstruction: 'consistent',
  },
  {
    id: 'zpzq-jianlu-9',
    pillars: { year: '甲子', month: '丙寅', day: '甲子', hour: '丙寅' },
    lineage: 'classical-chinese',
    source: { ...SOURCE, locator: '論建祿月劫 §332' },
    claim: { chapter: '論建祿月劫', kinds: ['建祿格', '月劫格'], label: '，木火通明也；又癸卯、庚申、庚子、庚辰，金水相涵也' },
    chartConstruction: 'consistent',
  },
  {
    id: 'zpzq-jianlu-10',
    pillars: { year: '癸卯', month: '庚申', day: '庚子', hour: '庚辰' },
    lineage: 'classical-chinese',
    source: { ...SOURCE, locator: '論建祿月劫 §332' },
    claim: { chapter: '論建祿月劫', kinds: ['建祿格', '月劫格'], label: '，金水相涵也' },
    chartConstruction: 'consistent',
  },
  {
    id: 'zpzq-jianlu-11',
    pillars: { year: '辛丑', month: '庚寅', day: '甲辰', hour: '乙亥' },
    lineage: 'classical-chinese',
    source: { ...SOURCE, locator: '論建祿月劫 §333' },
    claim: { chapter: '論建祿月劫', kinds: ['建祿格', '月劫格'], label: '、合煞留這也；如辛亥、庚寅、甲申、丙寅，制煞留官也' },
    chartConstruction: 'consistent',
  },
  {
    id: 'zpzq-jianlu-12',
    pillars: { year: '辛亥', month: '庚寅', day: '甲申', hour: '丙寅' },
    lineage: 'classical-chinese',
    source: { ...SOURCE, locator: '論建祿月劫 §333' },
    claim: { chapter: '論建祿月劫', kinds: ['建祿格', '月劫格'], label: '，制煞留官也' },
    chartConstruction: 'consistent',
  },
  {
    id: 'zpzq-jianlu-13',
    pillars: { year: '己酉', month: '乙亥', day: '壬戌', hour: '庚子' },
    lineage: 'classical-chinese',
    source: { ...SOURCE, locator: '論建祿月劫 §335' },
    claim: { chapter: '論建祿月劫', kinds: ['建祿格', '月劫格'], label: '，庚合乙而去傷存官，王總兵命也' },
    chartConstruction: 'consistent',
  },
];
