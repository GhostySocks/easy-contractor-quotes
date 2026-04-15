import { useLocalSearchParams } from 'expo-router';

import { ScreenStub } from '@/components/ui/ScreenStub';

export default function QuoteDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <ScreenStub name="/quote/[id]" subtitle={`Quote ${id ?? '(none)'}`} />;
}
