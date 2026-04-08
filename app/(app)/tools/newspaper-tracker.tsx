import DeliveryTracker from '@/components/DeliveryTracker';
import { KEYS } from '@/lib/storage';

export default function NewspaperTrackerScreen() {
  return (
    <DeliveryTracker
      storageKey={KEYS.newspaperTracker}
      mode="binary"
      defaultName="Newspaper"
      accent="#64748B"
      unit="day"
      unitPlural="days"
      primaryIcon="newspaper-outline"
      subscription
      showPaymentLog={false}
      priceLabel="Monthly Subscription"
      pricePlaceholder="e.g. 250"
    />
  );
}
