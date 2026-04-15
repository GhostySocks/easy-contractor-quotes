import { ScreenStub } from '@/components/ui/ScreenStub';
import { strings } from '@/lib/strings';

export default function HomeScreen() {
  return <ScreenStub name="/(tabs)/home" subtitle={strings.empty.jobs} />;
}
