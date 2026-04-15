import { useLocalSearchParams } from 'expo-router';

import { ScreenStub } from '@/components/ui/ScreenStub';

export default function CustomerDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <ScreenStub name="/customer/[id]" subtitle={`Customer ${id ?? '(none)'}`} />;
}
