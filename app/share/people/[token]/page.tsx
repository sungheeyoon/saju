import { previewFor } from '../../preview';
import { SharedReadingView } from '../../view';

export const metadata = previewFor('person');

export default async function Page({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  return (
    <SharedReadingView
      token={token}
      expect="person"
      eyebrow="공유받은 사주풀이"
      invitation={{
        heading: '나를 이루는 흐름도 읽어 보세요',
        note: '생년월일시를 넣으면 명식을 세우고, 그 근거로 사주풀이를 받습니다.',
      }}
    />
  );
}
