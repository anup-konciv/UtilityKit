import { Stack } from 'expo-router';

export default function AppLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="settings" />
      <Stack.Screen name="tools" />
      <Stack.Screen name="all-tools" />
      <Stack.Screen name="folders/[id]" />
      <Stack.Screen name="manage-folders" />
    </Stack>
  );
}
