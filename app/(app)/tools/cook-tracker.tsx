import EmployeeTracker from '@/components/EmployeeTracker';
import { KEYS } from '@/lib/storage';

export default function CookTrackerScreen() {
  return (
    <EmployeeTracker
      storageKey={KEYS.cookTracker}
      defaultName="Cook"
      accent="#D97706"
      placeholderSalary="e.g. 8000"
    />
  );
}
