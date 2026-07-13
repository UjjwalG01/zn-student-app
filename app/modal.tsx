// app/modal.tsx (or wherever your ModalScreen is placed)
import { Link, useLocalSearchParams, useRouter } from "expo-router";
import { StyleSheet, View, ScrollView, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { useAuth } from "../contexts/AuthContext";
import { COLORS } from "@/constants/theme";

export default function ModalScreen() {
  const router = useRouter();

  // 1. Extract route parameters
  const { type, id } = useLocalSearchParams<{
    type: "fee" | "exam" | "attendance";
    id: string;
  }>();

  // 2. Fetch the central student payload context
  const { studentData } = useAuth();

  // 3. Look up the specific item record based on its type context
  let detailedData: any = null;
  if (studentData) {
    if (type === "fee") {
      detailedData = studentData.fees?.find(
        (item: any) => item.id === id || item._id === id,
      );
    } else if (type === "exam") {
      detailedData = studentData.exam_routines?.find(
        (item: any) => item.id === id || item._id === id,
      );
    } else if (type === "attendance") {
      detailedData = studentData.attendance?.find(
        (item: any) => item.id === id || item._id === id,
      );
    }
  }

  // Fallback state if record lookup misses
  if (!detailedData) {
    return (
      <ThemedView style={styles.container}>
        <Ionicons
          name="alert-circle-outline"
          size={48}
          color={COLORS.error || "#EF4444"}
        />
        <ThemedText type="title" style={styles.errorText}>
          Record Not Found
        </ThemedText>
        <TouchableOpacity
          style={styles.closeButton}
          onPress={() => router.back()}
        >
          <ThemedText type="defaultSemiBold" style={{ color: "#FFF" }}>
            Dismiss
          </ThemedText>
        </TouchableOpacity>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      {/* Header Container */}
      <View style={styles.header}>
        <ThemedText type="title" style={styles.headerTitle}>
          {type === "fee" && "Fee Transaction Detail"}
          {type === "exam" && "Exam Routine Details"}
          {type === "attendance" && "Attendance Log"}
        </ThemedText>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.iconClose}
        >
          <Ionicons name="close" size={24} color="#6B7280" />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Dynamic Detail Configurations */}
        {type === "fee" && (
          <View style={styles.card}>
            <View style={styles.amountBadge}>
              <ThemedText type="title" style={styles.amountText}>
                ${detailedData.amount || "0.00"}
              </ThemedText>
              <ThemedText type="defaultSemiBold" style={styles.statusLabel}>
                {(detailedData.status || "PENDING").toUpperCase()}
              </ThemedText>
            </View>

            <View style={styles.metaRow}>
              <ThemedText type="defaultSemiBold" style={styles.metaLabel}>
                INVOICE TITLE
              </ThemedText>
              <ThemedText type="default">
                {detailedData.title || "Tuition Fee"}
              </ThemedText>
            </View>
            <View style={styles.metaRow}>
              <ThemedText type="defaultSemiBold" style={styles.metaLabel}>
                BILLING DATE
              </ThemedText>
              <ThemedText type="default">
                {detailedData.due_date || detailedData.date || "N/A"}
              </ThemedText>
            </View>
            <View style={styles.metaRow}>
              <ThemedText type="defaultSemiBold" style={styles.metaLabel}>
                TRANSACTION ID
              </ThemedText>
              <ThemedText type="default" style={styles.codeText}>
                {id}
              </ThemedText>
            </View>
          </View>
        )}

        {type === "exam" && (
          <View style={styles.card}>
            <View style={styles.metaRow}>
              <ThemedText type="defaultSemiBold" style={styles.metaLabel}>
                SUBJECT
              </ThemedText>
              <ThemedText type="subtitle" style={{ color: COLORS.primary }}>
                {detailedData.subject || "Examination"}
              </ThemedText>
            </View>
            <View style={styles.metaRow}>
              <ThemedText type="defaultSemiBold" style={styles.metaLabel}>
                DATE & TIME
              </ThemedText>
              <ThemedText type="default">
                {detailedData.exam_date} at {detailedData.time || "09:00 AM"}
              </ThemedText>
            </View>
            <View style={styles.metaRow}>
              <ThemedText type="defaultSemiBold" style={styles.metaLabel}>
                HALL / ROOM NO.
              </ThemedText>
              <ThemedText type="default">
                {detailedData.room || "Main Examination Block"}
              </ThemedText>
            </View>
          </View>
        )}

        {type === "attendance" && (
          <View style={styles.card}>
            <View style={styles.metaRow}>
              <ThemedText type="defaultSemiBold" style={styles.metaLabel}>
                STATUS
              </ThemedText>
              <ThemedText
                type="subtitle"
                style={{
                  color:
                    detailedData.status === "Present" ? "#10B981" : "#EF4444",
                }}
              >
                {detailedData.status || "Marked"}
              </ThemedText>
            </View>
            <View style={styles.metaRow}>
              <ThemedText type="defaultSemiBold" style={styles.metaLabel}>
                LOG DATE
              </ThemedText>
              <ThemedText type="default">
                {detailedData.date || "N/A"}
              </ThemedText>
            </View>
            <View style={styles.metaRow}>
              <ThemedText type="defaultSemiBold" style={styles.metaLabel}>
                REMARKS
              </ThemedText>
              <ThemedText type="default">
                {detailedData.remarks || "Regular check-in"}
              </ThemedText>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Footer Link Alternative */}
      <Link href="/" dismissTo style={styles.link}>
        <ThemedText type="link">Return to Dashboard</ThemedText>
      </Link>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
    paddingBottom: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "800",
  },
  iconClose: {
    padding: 4,
  },
  scrollContent: {
    paddingVertical: 8,
  },
  card: {
    backgroundColor: "#FFF",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  amountBadge: {
    alignItems: "center",
    paddingVertical: 14,
    backgroundColor: "#F3F4F6",
    borderRadius: 12,
    marginBottom: 16,
  },
  amountText: {
    fontSize: 28,
    fontWeight: "800",
    color: "#111827",
  },
  statusLabel: {
    fontSize: 11,
    marginTop: 4,
    color: "#4F46E5",
    letterSpacing: 0.5,
  },
  metaRow: {
    marginBottom: 14,
  },
  metaLabel: {
    fontSize: 10,
    color: "#6B7280",
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  codeText: {
    fontFamily: "Courier",
    fontSize: 13,
    color: "#4B5563",
  },
  errorText: {
    marginTop: 12,
    marginBottom: 16,
  },
  closeButton: {
    backgroundColor: "#4F46E5",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  link: {
    marginTop: 20,
    alignSelf: "center",
    paddingVertical: 10,
  },
});
