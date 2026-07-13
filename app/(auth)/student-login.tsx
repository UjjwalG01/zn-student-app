// app/(auth)/student-login.tsx
import React, { useEffect, useState } from "react";
import {
  View,
  TextInput,
  Text,
  Alert,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { useAuth } from "../../contexts/AuthContext";
import { Link } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { COLORS } from "@/constants/theme";

import { getSafeErrorMessage } from "@/utils/error-message";

export default function StudentLogin() {
  const [email, setEmail] = useState("");
  const [admissionNo, setAdmissionNo] = useState("");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState<"credentials" | "otp">("credentials");
  const [submitting, setSubmitting] = useState(false);

  const { loginOrRequestOtp, verifyOtpAndLogin } = useAuth();

  // Handle Initial Step: Credentials Login attempt
  const handleIdentityLogin = async () => {
    const cleanEmail = email.trim();
    const cleanAdmission = admissionNo.trim();

    if (!cleanEmail || !cleanAdmission) {
      return Alert.alert(
        "Required Fields",
        "Please enter both your institutional email address and admission number.",
      );
    }

    setSubmitting(true);
    try {
      const result = await loginOrRequestOtp(cleanEmail, cleanAdmission);

      if (result.isVerified) {
        Alert.alert("Welcome Back", "Authentication successful!");
      } else {
        // Unverified account flow path: advance view to capture incoming OTP check
        setStep("otp");
        Alert.alert(
          "Verification Required",
          "A one-time verification code has been sent to your student inbox to register this device.",
        );
      }
    } catch (err: any) {
      const message = getSafeErrorMessage(
        err,
        "Invalid credentials. Please verify your details.",
      );
      Alert.alert("Authentication Failed", message);
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Secondary Step: Verify incoming code fallback
  const handleVerifyOtp = async () => {
    if (!otp.trim()) {
      return Alert.alert(
        "Required Field",
        "Please input the 6-digit verification code.",
      );
    }

    setSubmitting(true);
    try {
      await verifyOtpAndLogin(email, otp);
      Alert.alert("Success", "Account activated and verified successfully!");
    } catch (err: any) {
      const message = getSafeErrorMessage(err, "Invalid verification code.");
      Alert.alert("Access Denied", message);
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    const testEnv = process.env.EXPO_PUBLIC_API_URL;
    if (testEnv) {
      console.log("✅ Dotenv is working! Value:", testEnv);
    } else {
      console.log("❌ Dotenv is NOT working. Value is undefined.");
    }
  }, []);

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.container}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.card}>
          <View style={styles.iconContainer}>
            <Ionicons
              name={step === "otp" ? "mail-open-outline" : "school-outline"}
              size={44}
              color={COLORS.primary || "#4F46E5"}
            />
          </View>

          <Text style={styles.title}>Student Portal</Text>
          <Text style={styles.subtitle}>
            {step === "credentials"
              ? "Provide your student credentials below to enter the main application dashboard."
              : "Enter the secure activation security token sent to your email inbox."}
          </Text>

          {/* Core Credentials View Context Panel */}
          {step === "credentials" ? (
            <>
              <Text style={styles.inputLabel}>EMAIL ADDRESS</Text>
              <TextInput
                placeholder="e.g. student@school.com"
                placeholderTextColor="#9CA3AF"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                autoCorrect={false}
                editable={!submitting}
                style={styles.input}
              />

              <Text style={styles.inputLabel}>OFFICIAL ADMISSION NUMBER</Text>
              <TextInput
                placeholder="e.g. ADM-2026-0492"
                placeholderTextColor="#9CA3AF"
                value={admissionNo}
                onChangeText={setAdmissionNo}
                autoCapitalize="characters"
                autoCorrect={false}
                editable={!submitting}
                style={styles.input}
              />

              <TouchableOpacity
                style={[
                  styles.signInButton,
                  submitting && styles.disabledButton,
                ]}
                onPress={handleIdentityLogin}
                disabled={submitting}
                activeOpacity={0.8}
              >
                {submitting ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.signInButtonText}>
                    Sign In to Dashboard
                  </Text>
                )}
              </TouchableOpacity>
            </>
          ) : (
            /* OTP Secondary Intercept Verification Step */
            <>
              <Text style={styles.inputLabel}>ONE-TIME PASSWORD (OTP)</Text>
              <TextInput
                placeholder="Enter 6-digit code"
                placeholderTextColor="#9CA3AF"
                value={otp}
                onChangeText={setOtp}
                autoCapitalize="none"
                keyboardType="number-pad"
                autoCorrect={false}
                editable={!submitting}
                style={styles.input}
              />

              <View style={{ gap: 12 }}>
                <TouchableOpacity
                  style={[
                    styles.verifyButton,
                    submitting && styles.disabledButton,
                  ]}
                  onPress={handleVerifyOtp}
                  disabled={submitting}
                  activeOpacity={0.8}
                >
                  {submitting ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <Text style={styles.signInButtonText}>
                      Confirm Code & Activate
                    </Text>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => setStep("credentials")}
                  disabled={submitting}
                  style={styles.backButton}
                >
                  <Text style={styles.backButtonText}>
                    Modify Sign-In Details
                  </Text>
                </TouchableOpacity>
              </View>
            </>
          )}

          <Link href={"/(auth)/login" as any} asChild>
            <TouchableOpacity style={styles.switchLinkWrapper}>
              <Text style={styles.switchLinkLabel}>
                Are you staff?{" "}
                <Text style={styles.switchLinkHighlight}>
                  Staff & Teacher Login
                </Text>
              </Text>
            </TouchableOpacity>
          </Link>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background || "#F9FAFB" },
  scrollContent: { flexGrow: 1, justifyContent: "center", padding: 24 },
  card: {
    backgroundColor: COLORS.card || "#FFFFFF",
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: COLORS.border || "#E5E7EB",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  iconContainer: {
    alignSelf: "center",
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: `${COLORS.primary || "#4F46E5"}10`,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: "800",
    color: COLORS.textPrimary || "#111827",
    textAlign: "center",
  },
  subtitle: {
    fontSize: 13,
    color: COLORS.textSecondary || "#6B7280",
    textAlign: "center",
    marginTop: 6,
    marginBottom: 24,
    lineHeight: 18,
    paddingHorizontal: 10,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: COLORS.textSecondary || "#6B7280",
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  input: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: COLORS.border || "#E5E7EB",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    fontSize: 15,
    color: "#111827",
    marginBottom: 20,
  },
  signInButton: {
    backgroundColor: COLORS.primary || "#4F46E5",
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
  },
  verifyButton: {
    backgroundColor: "#10B981",
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
  },
  disabledButton: { opacity: 0.7 },
  signInButtonText: { color: "#FFFFFF", fontSize: 15, fontWeight: "700" },
  backButton: { alignItems: "center", paddingVertical: 8 },
  backButtonText: {
    color: COLORS.textSecondary || "#6B7280",
    fontSize: 13,
    fontWeight: "600",
  },
  switchLinkWrapper: {
    marginTop: 20,
    alignItems: "center",
    paddingVertical: 4,
  },
  switchLinkLabel: {
    fontSize: 13,
    color: COLORS.textSecondary || "#6B7280",
    fontWeight: "500",
  },
  switchLinkHighlight: {
    color: COLORS.primary || "#4F46E5",
    fontWeight: "700",
  },
});
