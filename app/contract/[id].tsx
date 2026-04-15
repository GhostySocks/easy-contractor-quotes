import { useLocalSearchParams } from 'expo-router';

import { ScreenStub } from '@/components/ui/ScreenStub';

export default function ContractDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <ScreenStub name="/contract/[id]" subtitle={`Contract ${id ?? '(none)'}`} />;
}
