'use client';

import { useEffect, useRef } from 'react';

import { actionAnswer } from '../../ui/action-answer';
import { removePhoto } from './actions';
import { serverPosition } from './photo-positions';
import type { MyPhoto } from './photos';

/**
 * **지우기와 서버 목록의 자리** — 사진 판(`PhotoGrid`)의 지우기 한 벌.
 *
 * 묻는 창에서 「삭제」를 누르면 그 장을 곧바로 서버에서 지운다(ADR 0205 — ADR 0165 의 늦은 지우기 · 실행 취소 띠를 걷었다).
 * 서버가 지웠다고 답한 장은 목록이 새로 오기 전에도 빼고 자리를 센다(`serverPhotos` · `serverPositionOf`) — 옮기기 · 바꾸기 ·
 * 위치 조정이 서버에 보내는 자리는 화면의 칸 번호가 아니라 그 장(판본)이 서버 목록에서 몇 번째인가다.
 */
export function usePhotoRemoval({ photos }: { /** 서버가 준 지금 목록 */ photos: readonly MyPhoto[] }) {
  /** 서버가 지웠다고 답한 판본 — 서버 목록이 새로 오기 전에도 그 장을 빼고 자리를 센다 */
  const gone = useRef(new Set<number>());
  /** 지금 서버 목록 — 답을 기다린 뒤의 셈이 그때의 자리를 센다 */
  const latest = useRef(photos);

  useEffect(() => {
    latest.current = photos;
  }, [photos]);

  /** 그 장을 서버에서 지운다 — 이미 없으면(다른 탭이 지웠다) 할 일이 없다 */
  const remove = async (version: number) => {
    const position = serverPosition(latest.current, gone.current, version);
    if (position === null) return { ok: true as const };
    const result = await actionAnswer(removePhoto({ position, version }));
    if (result.ok) gone.current.add(version);
    return result;
  };

  return {
    remove,
    /** 지금 서버 목록 — 서버가 지웠다고 답한 장은 뺀다 */
    serverPhotos: () => latest.current.filter((one) => !gone.current.has(one.version)),
    /** 그 장이 서버에서 지금 몇 번째인가 — 없으면 `null` */
    serverPositionOf: (version: number) => serverPosition(latest.current, gone.current, version),
    /** 지금 서버 목록의 판본들 — 올리기 전에 들어 둔다 */
    serverVersions: (): ReadonlySet<number> => new Set(latest.current.map((photo) => photo.version)),
  };
}
