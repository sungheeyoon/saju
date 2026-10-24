import { ROOM_FIRST_HELLO, ROOM_SAFETY_NOTE } from '@/src/lib/chat/copy';
import { STEM_INFO, type Stem } from '@/src/lib/saju';

import { elementScope } from '../../../ui/element-tone';
import { Icon } from '../../../ui/icons';
import { StemSymbol } from '../../../ui/stem-symbol';
import { TYPE_NAME } from '../../../ui/surfaces';
import { Avatar } from '../../avatar';
import { partnerSheetName } from '../../partner-sheet';
import { DayMasterChip } from '../../people/chart-bits';
import { MY_PROFILE_LABEL } from '../../requests/report-block';
import type { RoomView } from './room-view';

/**
 * 대화의 첫머리 — 누구와 이야기하는지.
 *
 * 두 일간을 아는 방은 **두 사람의 카드**다: 나와 상대가 제 일간 오행의 파스텔 한 장씩으로 나란히 서고(결과 화면의
 * 「각자의 사주」와 같은 조각 `DayMasterChip`), 아래로 인연 궁합이 이어진다. 「이 사람과 왜 이야기하게
 * 됐나」를 두 색이 되짚는다. 점수 · 궁합 한 줄은 방의 문이 주지 않으므로 싣지 않는다(지어낸 점수는 함께 보는
 * 궁합의 점수와 갈린다). 두 일간을 모르는 방은 상대의 사진과 이름만 선다.
 *
 * **두 카드는 그 사람의 프로필을 연다**(2026-10-24) — 「나」는 내 프로필 시트, 상대는 상대 프로필 시트. 머리의 사진 · 이름과 같은
 * 길이고, 누를 수 있다는 단서는 머리와 같은 「›」다. 못 여는 방(닫힌 방 · 사진을 못 읽은 나)은 그림만 선다.
 */
export function RoomStart({
  room,
  quiet,
  onMe = null,
  onPartner = null,
}: {
  room: RoomView;
  quiet: boolean;
  onMe?: (() => void) | null;
  onPartner?: (() => void) | null;
}) {
  const tones = room.tones;
  /*
    **막 열린 방은 무엇을 하면 되는지와 어디서 끊는지를 말한다**(운영자 2026-10-10, 화면 점검 C4). 두 사람 카드와 빈 입력칸만
    서 있으면 첫 말을 기다리는 방인지 고장 난 방인지 갈리지 않는다. 첫 말이 오가면 걷힌다. 열린 방 · 상대가 있는 방에만 선다 —
    닫힌 방은 입력이 없고, 떠난 상대의 방에는 「⋯」가 없다.
  */
  const hello = quiet && room.partnerUserId !== null && room.notice === null && (
    <div className="flex max-w-sm flex-col gap-1 text-center">
      <p className="text-body font-semibold leading-6 text-foreground">{ROOM_FIRST_HELLO}</p>
      <p className="text-small leading-5 text-secondary">{ROOM_SAFETY_NOTE}</p>
    </div>
  );
  /*
    인연 궁합으로 가는 길은 여기 없다 — 방 머리의 궁합 단추가 폰에도 서므로(ADR 0155 「2026-10-11 저녁 덧」) 여기도 서면 한 화면에
    같은 길이 둘이다(화면 감사 2026-10-09).
  */

  if (tones === null) {
    return (
      <div className="flex flex-col items-center gap-3 pb-2 pt-4 text-center">
        <Avatar userId={room.partnerUserId ?? ''} nickname={room.name} hasPhoto={room.partnerHasPhoto}
              focus={room.partnerPhotoFocus} size={72} />
        <p className={TYPE_NAME}>{room.heading}</p>
        {hello}
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-md flex-col items-center gap-3 pt-2">
      <div className="grid w-full grid-cols-2 gap-2">
        <StartSide label="나" stem={tones.mine.stem} onOpen={onMe} openName={MY_PROFILE_LABEL} />
        <StartSide label={room.name} stem={tones.theirs.stem} onOpen={onPartner} openName={partnerSheetName(room.name)} />
      </div>
      {hello}
    </div>
  );
}

/**
 * 첫머리 카드의 한 사람 — 제 일간 오행의 파스텔 한 장. 색만으로 말하지 않게 딱지(상징 · 글자 · 이름)와 「갑목 일간」이 함께 선다.
 * `onOpen` 이 오면 카드 전체가 그 사람의 프로필 시트를 여는 단추다(`openName` 이 보조기기 이름)
 */
function StartSide({
  label,
  stem,
  onOpen = null,
  openName,
}: {
  label: string;
  stem: Stem;
  onOpen?: (() => void) | null;
  openName: string;
}) {
  const info = STEM_INFO[stem];
  const face = `${elementScope(info.element)} relative flex min-w-0 flex-col gap-2 overflow-hidden rounded-tile bg-[var(--tile)] p-4 text-left`;
  const body = (
    <>
      <StemSymbol stem={stem} className="pointer-events-none absolute -bottom-4 -right-4 size-20 opacity-20" />
      <DayMasterChip stem={stem} className="relative self-start" />
      <div className="relative flex min-w-0 items-center gap-0.5">
        <p className="truncate font-rounded text-lead leading-6 text-foreground">{label}</p>
        {onOpen !== null && <Icon name="chevron" className="size-4 shrink-0 text-secondary" />}
      </div>
    </>
  );
  if (onOpen === null) return <section className={face}>{body}</section>;
  return (
    <button
      type="button"
      aria-haspopup="dialog"
      aria-label={openName}
      onClick={onOpen}
      className={`${face} hover:ring-1 hover:ring-[var(--ink)] active:scale-[0.98]`}
    >
      {body}
    </button>
  );
}
