import { Stack } from 'expo-router';

/** O marketplace permanece público; autenticação só é exigida nas ações pessoais. */
export default function CustomerLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
