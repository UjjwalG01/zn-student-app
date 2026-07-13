import { AuthProvider } from "@/contexts/AuthContext";
import { StudentProvider } from "@/contexts/student-context";
import { ThemeProvider } from "@/contexts/theme-context";
import { Stack } from "expo-router";

export default function RootLayout() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <StudentProvider>
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="(tabs)" />
          </Stack>
        </StudentProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
