import DeliveryTracker from '@/components/DeliveryTracker';
import { KEYS } from '@/lib/storage';

export default function MilkTrackerScreen() {
  return (
    <DeliveryTracker
      storageKey={KEYS.milkTracker}
      mode="qty-dual"
      defaultName="Milk Tracker"
      accent="#0284C7"
      unit="L"
      unitPlural="L"
      primaryIcon="water"
      quickValues={[0, 0.25, 0.5, 1, 1.5, 2]}
      showPaymentLog={false}
      priceLabel="Price per Liter"
      pricePlaceholder="e.g. 60"
      defaultSlot1={1}
      defaultSlot2={0}
      slot1={{ label: 'Morning', icon: 'sunny-outline', color: '#F59E0B' }}
      slot2={{ label: 'Evening', icon: 'moon-outline', color: '#6366F1' }}
    />
  );
}
