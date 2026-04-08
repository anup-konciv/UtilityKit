import EmployeeTracker from '@/components/EmployeeTracker';
import { KEYS } from '@/lib/storage';

export default function DriverTrackerScreen() {
  return (
    <EmployeeTracker
      storageKey={KEYS.driverTracker}
      defaultName="Driver"
      accent="#2563EB"
      placeholderSalary="e.g. 15000"
    />
  );
}
