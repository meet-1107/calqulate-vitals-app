import { Redirect } from 'expo-router';

// This step was removed from onboarding. The route stays as a redirect so any
// stale link lands on the next real step instead of a dead screen.
export default function WeightRemoved() {
  return <Redirect href="/onboarding/areas" />;
}
