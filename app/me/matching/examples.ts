import { candidateCardText } from '@/src/lib/discovery';

import harinPhoto from '../../../public/matching/harin.webp';
import jiwooPhoto from '../../../public/matching/jiwoo.webp';
import seoyeonPhoto from '../../../public/matching/seoyeon.webp';
import type { DeckCard } from './deck-card';
import { meMarkOf } from './me-mark';

/**
 * 디자인을 확인하려고 남겨 둔 **AI 예시 얼굴 셋**.
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

export const EXAMPLE_CARDS: readonly DeckCard[] = SEEDS.map((seed) => ({
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
}));

/**
 * 미리보기 지도의 가운데 — **예시 명식 하나**(戊 일간, 목 0 · 화 1 · 토 2 · 금 4 · 수 1).
 *
 * 보는 사람의 명식을 쓰지 않는 까닭: 예시 셋은 木 · 火 · 水 를 채운다고 적혀 있는데, 보는 사람에게 그 기운이 넉넉하면
 * 지도는 「빈 자리를 채운다」는 선을 찬 원에 긋는 거짓 그림이 된다. 이 명식에서는 셋이 모두 실제로 빈 원을 채운다.
 */
export const EXAMPLE_ME = meMarkOf('戊', { glyphCount: 8, counts: { 木: 0, 火: 1, 土: 2, 金: 4, 水: 1 } });
