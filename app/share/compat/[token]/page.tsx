import { previewFor } from '../../preview';
import { SharedReadingView } from '../../view';

export const metadata = previewFor('private');

export default async function Page({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  return (
    <SharedReadingView
      token={token}
      expect="private"
      eyebrow="공유받은 궁합 풀이"
      invitation={{
        heading: '다른 사람과의 궁합도 읽어보세요',
        note: '두 사람의 생년월일시를 입력하면 명식을 나란히 세우고, 그 근거를 바탕으로 궁합 풀이를 받아볼 수 있어요.',
      }}
    />
  );
}
