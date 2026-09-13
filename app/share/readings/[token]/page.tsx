import { previewFor } from '../../preview';
import { SharedReadingView } from '../../view';

export const metadata = previewFor('self');

export default async function Page({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  return (
    <SharedReadingView
      token={token}
      expect="self"
      eyebrow="공유받은 사주풀이"
      invitation={{
        heading: '내 사주도 직접 읽어보세요',
        note: '생년월일시를 입력하면 명식을 세우고, 그 근거를 바탕으로 나만의 사주풀이를 받아볼 수 있어요.',
      }}
    />
  );
}
