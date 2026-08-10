import { Stack } from 'expo-router';
import { AuthProvider } from './_components/AuthProvider';
import { StatusBar } from 'expo-status-bar';

export default function RootLayout() {
  return (
    <AuthProvider>
      <Stack screenOptions={{ headerShown: false }} />
      <StatusBar style="auto" />
    </AuthProvider>
  );
}
