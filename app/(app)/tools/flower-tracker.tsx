import DeliveryTracker from '@/components/DeliveryTracker';
import { KEYS } from '@/lib/storage';

export default function FlowerTrackerScreen() {
  return (
    <DeliveryTracker
      storageKey={KEYS.flowerTracker}
      mode="binary"
      defaultName="Flower Vendor"
      accent="#E11D48"
      unit="delivery"
      unitPlural="deliveries"
      primaryIcon="flower-outline"
      priceLabel="Price per Day"
      pricePlaceholder="e.g. 30"
    />
  );
}
