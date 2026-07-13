// app/(tabs)/profile.tsx
import React from "react";
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { COLORS } from "@/constants/theme";
import { useAuth } from "../../contexts/AuthContext";

export default function ProfileScreen() {
  const { studentData, logout } = useAuth();

  // Clean extraction from synchronized user matrix
  const user = studentData?.profile;
  const profileName = user?.name || "Student Profile";
  const profileEmail = user?.email || "No email linked";
  const admissionNo = user?.admission_no || "---";

  // Format class information safely
  const className = user?.class_name || "Unassigned";
  const sectionName = user?.section ? `Section ${user.section}` : "";
  const classGradeDisplay = sectionName
    ? `${className} - ${sectionName}`
    : className;

  const handleSignOut = () => {
    Alert.alert(
      "Sign Out",
      "Are you sure you want to log out of your student portal portal session?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Log Out",
          style: "destructive",
          onPress: async () => {
            try {
              if (logout) {
                await logout();
              }
            } catch (error) {
              Alert.alert(
                "Error",
                "Failed to clear authentication session safely.",
              );
            }
          },
        },
      ],
    );
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Central Identity Section */}
      <View style={styles.avatarContainer}>
        <View style={styles.largeAvatar}>
          <Ionicons name="person" size={40} color="#9CA3AF" />
        </View>
        <Text style={styles.profileName}>{profileName}</Text>
        <Text style={styles.profileEmail}>{profileEmail}</Text>
      </View>

      {/* Meta Profile Grid Blocks */}
      <View style={styles.infoSection}>
        <View style={styles.infoRow}>
          <Ionicons name="school-outline" size={20} color="#6B7280" />
          <View style={styles.infoTextContainer}>
            <Text style={styles.infoLabel}>SCHOOL ACADEMY SYSTEM</Text>
            <Text style={styles.infoValue}>
              {studentData?.school_settings?.school_name ||
                "Active Verified Institution"}
            </Text>
          </View>
        </View>

        <View style={styles.infoRow}>
          <Ionicons name="id-card-outline" size={20} color="#6B7280" />
          <View style={styles.infoTextContainer}>
            <Text style={styles.infoLabel}>ADMISSION NUMBER</Text>
            <Text style={styles.infoValue}>{admissionNo}</Text>
          </View>
        </View>

        <View style={styles.infoRow}>
          <Ionicons name="bookmark-outline" size={20} color="#6B7280" />
          <View style={styles.infoTextContainer}>
            <Text style={styles.infoLabel}>CURRENT CLASS GRADE</Text>
            <Text style={styles.infoValue}>{classGradeDisplay}</Text>
          </View>
        </View>
      </View>

      {/* Security Sessions / Action Rows */}
      <TouchableOpacity style={styles.logoutButton} onPress={handleSignOut}>
        <Ionicons name="log-out-outline" size={20} color="#EF4444" />
        <Text style={styles.logoutText}>Sign Out from Portal</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background || "#F9FAFB" },
  content: { padding: 20, gap: 24 },
  avatarContainer: { alignItems: "center", marginTop: 10 },
  largeAvatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#E5E7EB",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  profileName: { fontSize: 20, fontWeight: "800", color: "#111827" },
  profileEmail: {
    fontSize: 13,
    color: "#6B7280",
    marginTop: 2,
    fontWeight: "500",
  },
  infoSection: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    paddingVertical: 4,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    gap: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  infoTextContainer: { flex: 1 },
  infoLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: "#9CA3AF",
    letterSpacing: 0.5,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: "600",
    color: "#111827",
    marginTop: 2,
  },
  logoutButton: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#FDF2F2",
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#FDE8E8",
    marginTop: 8,
  },
  logoutText: { color: "#EF4444", fontWeight: "700", fontSize: 14 },
});
