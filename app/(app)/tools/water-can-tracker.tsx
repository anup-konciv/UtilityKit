import DeliveryTracker from '@/components/DeliveryTracker';
import { KEYS } from '@/lib/storage';

export default function WaterCanTrackerScreen() {
  return (
    <DeliveryTracker
      storageKey={KEYS.waterCanTracker}
      mode="qty-single"
      defaultName="Water Vendor"
      accent="#0891B2"
      unit="can"
      unitPlural="cans"
      primaryIcon="cube-outline"
      quickValues={[0, 1, 2, 3, 4, 5]}
      priceLabel="Price per Can"
      pricePlaceholder="e.g. 50"
    />
  );
}
