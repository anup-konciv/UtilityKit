import EmployeeTracker from '@/components/EmployeeTracker';
import { KEYS } from '@/lib/storage';

export default function MaidTrackerScreen() {
  return (
    <EmployeeTracker
      storageKey={KEYS.maidTracker}
      defaultName="Maid"
      accent="#7C3AED"
      placeholderSalary="e.g. 5000"
    />
  );
}
