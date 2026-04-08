import EmployeeTracker from '@/components/EmployeeTracker';
import { KEYS } from '@/lib/storage';

export default function OfficeBoyTrackerScreen() {
  return (
    <EmployeeTracker
      storageKey={KEYS.officeBoyTracker}
      defaultName="Office Boy"
      accent="#0D9488"
      placeholderSalary="e.g. 12000"
    />
  );
}
