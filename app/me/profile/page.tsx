
import { isBlocked } from '@/src/lib/account';

import { supabaseOnServer } from '../../auth/server-client';
import { signedInUser } from '../../auth/signed-in';
import { redirectToSignIn } from '../../auth/sign-in-redirect';
import { COLUMN, TYPE_META, TYPE_TITLE } from '../../ui/surfaces';
import { AccountNotice } from '../account-notice';
import { readAccount } from '../account';
import { ProfileForm } from './form';
import { photoUploadMode } from './photo-upload-mode';
import { myPhotos } from './photos';
import { myBirth } from './birth';
import { BirthSection } from './birth-section';
import { UNREADABLE_INPUT_NOTE } from '@/src/lib/input/stored';

export const metadata = {
  title: '프로필',
  description: '앱 안에서 불릴 이름과 프로필 사진을 정합니다.',
};

/**
 * 프로필 — **고치는 자리 하나** (PRD 「이름과 얼굴」).
 *
 * 이름을 **짓는** 일은 여기 없다. 가입 폼이 코드·이름·안내 확인을 한 번에 적으므로
 * (`/signup`, ADR 0042), 이 화면에 닿는 사람은 이미 이름이 있다. 그래서 관문의 예외
 * 목록에서도 빠졌다 — 이름 없이 열려야 할 이유가 없어졌다.
 *
 * 여기 남는 것은 **넷을 고치는 일**이다: 닉네임 · 프로필 사진(여섯 장까지, G-60) · 소개 · 출생 정보. 사진과 소개는 가입
 * 폼에 없으므로 실제로 채우는 자리도 여기다. 출생 정보는 2026-10-26 에 홈 카드의 연필에서 옮겨 왔다(운영자 「프로필 고치기 한
 * 곳에」) — 홈의 동그란 내 프로필 → 「내 프로필」 시트 → 「프로필 편집」이 이 화면이다.
 */
export default async function ProfilePage() {
  const supabase = await supabaseOnServer();

  const user = await signedInUser(supabase);
  if (!user) return redirectToSignIn();

  // 정책이 자기 행만 내주므로 `where` 를 적지 않는다. 적으면 판정하는 자리가 둘이 된다.
  /** 온보딩을 안 묻는 화면이다 — 이름 · 소개와 함께 내 사주(`self_person_id`)를 읽어, 등록했으면 출생 정보 판을 세운다 */
  const { state, row: account } = await readAccount(supabase, ['status', 'nickname', 'intro', 'self_person_id']);

  if (isBlocked(state) || account === null) {
    return (
      <main className={`app-shell flex w-full ${COLUMN} flex-1 flex-col gap-7 py-8 sm:py-12`}>
        <AccountNotice state={state} />
      </main>
    );
  }

  /*
    바이트는 이 화면에 안 실린다 — 자리와 판본만 읽고 그림은 주소로 받아 간다(`/me/photo/[userId]/[n]`). 올리기의 길(`db` ·
    `paused` · `s3`)은 DB 의 스위치가 정한다(G-120, ADR 0203)
  */
  const [photos, uploads, birth] = await Promise.all([
    myPhotos(),
    photoUploadMode(),
    myBirth(supabase, state.kind === 'active' ? state.selfPersonId : null),
  ]);

  /* 넓은 화면에서는 사진과 글 칸이 나란히 서므로(`form.tsx`) 판이 그 둘만큼 넓어진다 */

  return (
    <main className={`app-shell flex w-full ${COLUMN} flex-1 flex-col gap-6 py-8 sm:py-12 lg:max-w-4xl`}>
      <header className="flex flex-col gap-1">
        <h1 className={TYPE_TITLE}>프로필</h1>
        <p className={TYPE_META}>앱에서 쓸 닉네임과 프로필을 정해요.</p>
      </header>

      <ProfileForm
        current={{ nickname: account.nickname ?? '', intro: account.intro ?? '' }}
        photos={photos}
        userId={user.id}
        uploads={uploads}
      />

      {/*
        **출생 정보도 여기서 고친다**(2026-10-26 운영자 — 홈 카드의 연필을 걷고 한 화면에 모았다). 아직 내 사주를 등록하지 않았으면
        안 선다(등록은 홈이 이끈다). 못 읽는 값이면 메우지 않고 홈 카드와 같은 문장을 세운다
      */}
      {birth.kind === 'ready' && <BirthSection personId={birth.personId} query={birth.query} />}
      {birth.kind === 'unreadable' && (
        <section className="flex flex-col gap-2 rounded-card border border-border bg-surface p-5 sm:p-6">
          <p className="text-sm">{birth.message}</p>
          <p className="text-small text-muted">{UNREADABLE_INPUT_NOTE}</p>
        </section>
      )}
    </main>
  );
}
