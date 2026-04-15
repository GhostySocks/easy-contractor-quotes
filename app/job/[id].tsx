import { useLocalSearchParams } from 'expo-router';

import { ScreenStub } from '@/components/ui/ScreenStub';

export default function JobDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <ScreenStub name="/job/[id]" subtitle={`Job ${id ?? '(none)'}`} />;
}
