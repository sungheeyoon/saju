import { candidateCardText } from '@/src/lib/discovery';

import harinPhoto from '../../../public/matching/harin.webp';
import jiwooPhoto from '../../../public/matching/jiwoo.webp';
import seoyeonPhoto from '../../../public/matching/seoyeon.webp';
import type { DeckCard } from './deck-card';
import { meMarkOf } from './me-mark';

/**
 * 디자인을 확인하려고 남겨 둔 **AI 예시 얼굴 셋** — 붐비는 날은 아래 `CROWD` 가 이 셋을 돌려 쓴다.
 *
 * 후보가 실제로 서는 자리(`/me/matching`)에는 절대 안 쓴다 — 실제 후보가 없다고 이
 * 셋을 대신 세우면 사용자는 없는 사람을 본다. 오직 미리보기 경로만 이것을 읽는다.
 *
 * **문구는 여기서 짓지 않는다.** 판정·이유·보완 문장은 실데이터와 똑같이 정책
 * 함수를 지나서 나온다(`candidateCardText` — 후보 카드와 같은 한 벌). 손으로 적어 두면 정책이
 * 바뀐 날 예시만 옛말을 하고, 디자인 확인이 거짓 화면 위에서 이뤄진다.
 */
const SEEDS = [
  {
    candidateUserId: 'example-seoyeon',
    nickname: '서연',
    intro:
      '좋아하는 것을 오래 좋아하는 사람이에요. 동네의 작은 카페, 밑줄이 많은 책, 그리고 편안한 대화를 좋아해요.',
    photo: seoyeonPhoto,
    previewScore: 79,
    suppliedElements: ['木'],
    balanceBand: 'even',
    exploration: false,
  },
  {
    candidateUserId: 'example-jiwoo',
    nickname: '지우',
    intro:
      '낯선 골목과 새로운 전시 앞에서 자주 멈춰요. 맛있는 한 끼를 함께 나눌 때 가장 행복한 사람이에요.',
    photo: jiwooPhoto,
    previewScore: 74,
    suppliedElements: ['火'],
    balanceBand: 'even',
    exploration: true,
  },
  {
    candidateUserId: 'example-harin',
    /** 소개를 비운 자리 — **「자기소개 없음」이 어떻게 서는지도 확인할 값이 있다** */
    nickname: '하린',
    intro: null,
    photo: harinPhoto,
    previewScore: 68,
    suppliedElements: ['水'],
    balanceBand: 'mixed',
    exploration: false,
  },
] as const;

/**
 * **붐비는 날을 보는 사람들** — 지도는 지금 한 사람과 다음 다섯까지 세우고 넘친 사람은 「+n」 으로 센다(`orbit-seats.ts`).
 * 셋으로는 그 모양 · 한 기운에 몰린 날 · 넘기면 바깥에서 들어와 앉는 움직임을 볼 수 없었다(운영자 2026-09-27).
 *
 * 얼굴은 위의 셋을 돌려 쓰고, 채우는 기운은 예시 명식의 빈 곳(木 0 · 火 1 · 水 1)만 고른다 — 찬 원에 선을 긋는 거짓 그림이
 * 안 되게. **앞의 여섯 중 셋이 木 을 채운다**(한 사람은 木 · 水 둘) — 한 방향에 몰린 날이 기본 화면이다. 하나도 안
 * 채우는 사람도 하나 둔다(틈에 서는 자리). 소개는 위의 두 문장을 돌려 쓰거나 비운다 — 새 문장을 짓지 않는다.
 */
const CROWD = [
  { nickname: '민서', from: 0, suppliedElements: ['木'], previewScore: 77, balanceBand: 'even' },
  { nickname: '예린', from: 2, suppliedElements: ['木', '水'], previewScore: 72, balanceBand: 'mixed' },
  { nickname: '수아', from: 1, suppliedElements: [], previewScore: 66, balanceBand: 'even' },
  { nickname: '다은', from: 0, suppliedElements: ['火'], previewScore: 75, balanceBand: 'even' },
  { nickname: '채원', from: 1, suppliedElements: ['木'], previewScore: 71, balanceBand: 'mixed' },
  { nickname: '유나', from: 2, suppliedElements: ['水'], previewScore: 69, balanceBand: 'even' },
  { nickname: '소윤', from: 0, suppliedElements: ['木'], previewScore: 64, balanceBand: 'even' },
  { nickname: '가은', from: 1, suppliedElements: ['火'], previewScore: 70, balanceBand: 'mixed' },
  { nickname: '나연', from: 2, suppliedElements: ['木'], previewScore: 67, balanceBand: 'even' },
  { nickname: '윤아', from: 0, suppliedElements: ['水'], previewScore: 73, balanceBand: 'even' },
  { nickname: '시은', from: 1, suppliedElements: ['火'], previewScore: 65, balanceBand: 'mixed' },
  { nickname: '하은', from: 2, suppliedElements: ['木'], previewScore: 68, balanceBand: 'even' },
  { nickname: '지아', from: 0, suppliedElements: ['水'], previewScore: 62, balanceBand: 'even' },
  { nickname: '서아', from: 1, suppliedElements: ['火'], previewScore: 74, balanceBand: 'mixed' },
  { nickname: '은서', from: 2, suppliedElements: ['木'], previewScore: 63, balanceBand: 'even' },
] as const;

type Seed = {
  candidateUserId: string;
  nickname: string;
  intro: string | null;
  photo: { src: string };
  previewScore: number;
  suppliedElements: readonly string[];
  balanceBand: string;
  exploration: boolean;
};

const cardOf = (seed: Seed): DeckCard => ({
  candidateUserId: seed.candidateUserId,
  nickname: seed.nickname,
  intro: seed.intro,
  hasPhoto: true,
  avatarElement: null,
  photoUrls: [seed.photo.src],
  exploration: seed.exploration,
  ...candidateCardText({
    suppliedElements: seed.suppliedElements,
    balanceBand: seed.balanceBand,
    previewScore: seed.previewScore,
  }),
});

const EVERYONE: readonly Seed[] = [
  ...SEEDS,
  ...CROWD.map((one, index) => ({
    ...one,
    candidateUserId: `example-crowd-${index}`,
    intro: index % 3 === 2 ? null : SEEDS[index % 2].intro,
    photo: SEEDS[one.from].photo,
    exploration: false,
  })),
];

/** 예시 덱 — 앞에서 `count` 명(셋에서 열여덟까지). 기본은 지도에 여섯이 서고 뒤에 더 기다리는 열둘이다 */
export const EXAMPLE_DECK_SIZE = 12;
export function exampleCards(count: number = EXAMPLE_DECK_SIZE): readonly DeckCard[] {
  return EVERYONE.slice(0, Math.max(1, Math.min(count, EVERYONE.length))).map(cardOf);
}

/** 지나친 인연 보기의 예시 — 덱과 겹치지 않는 여섯(지나친 인연 지도가 받는 수) */
export const EXAMPLE_PASSED: readonly DeckCard[] = EVERYONE.slice(-6).map((seed) =>
  cardOf({ ...seed, candidateUserId: `${seed.candidateUserId}-passed` }),
);

/**
 * 미리보기 지도의 가운데 — **예시 명식 하나**(戊 일간, 목 0 · 화 1 · 토 2 · 금 4 · 수 1).
 *
 * 보는 사람의 명식을 쓰지 않는 까닭: 예시 셋은 木 · 火 · 水 를 채운다고 적혀 있는데, 보는 사람에게 그 기운이 넉넉하면
 * 지도는 「빈 자리를 채운다」는 선을 찬 원에 긋는 거짓 그림이 된다. 이 명식에서는 셋이 모두 실제로 빈 원을 채운다.
 */
export const EXAMPLE_ME = meMarkOf('戊', { glyphCount: 8, counts: { 木: 0, 火: 1, 土: 2, 金: 4, 水: 1 } });
