import { AuthProvider } from "@/contexts/AuthContext";
import { StudentProvider } from "@/contexts/student-context";
import { ThemeProvider } from "@/contexts/theme-context";
import { ZnAuthProvider } from "@/contexts/zn-auth-context";
import { ENV } from "@/lib/env";
import { Stack } from "expo-router";

export default function RootLayout() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <StudentProvider>
          {/* Phase 2 foundation: ZN provider mounts only when the flag is on, so
              current builds remain behavior-identical to legacy. Route guard inside
              activates only for authenticated ZN sessions. Deleted in Phase 6 flip. */}
          {ENV.znAuthEnabled ? (
            <ZnAuthProvider>
              <Stack screenOptions={{ headerShown: false }}>
                <Stack.Screen name="(tabs)" />
              </Stack>
            </ZnAuthProvider>
          ) : (
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="(tabs)" />
            </Stack>
          )}
        </StudentProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
