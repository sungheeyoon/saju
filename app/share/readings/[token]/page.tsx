import { previewFor } from '../../preview';
import { SharedReadingView } from '../../view';

export const metadata = previewFor('self');

export default async function Page({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  return <SharedReadingView token={token} expect="self" />;
}
