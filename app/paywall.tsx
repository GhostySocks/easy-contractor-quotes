import { ScreenStub } from '@/components/ui/ScreenStub';
import { strings } from '@/lib/strings';

export default function Paywall() {
  return <ScreenStub name="/paywall" subtitle={strings.paywall.priceLine} />;
}
