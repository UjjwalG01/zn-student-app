// app/(tabs)/index.tsx
import React from "react";
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { COLORS } from "@/constants/theme";
import { useAuth } from "../../contexts/AuthContext";

export default function DashboardScreen() {
  // 1. Pull live, pre-fetched reactive parameters directly from the AuthContext pipeline
  const {
    studentData,
    className,
    sectionName,
    attendance,
    fees,
    examRoutines,
    assignedBus,
    loading,
  } = useAuth();

  // 2. Fallback loader while the Auth Context initializes or restores secure tokens
  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={COLORS.primary || "#4F46E5"} />
        <Text style={styles.loadingText}>Syncing portal data...</Text>
      </View>
    );
  }

  // 3. Compute Live Statistics derived from the synchronized state arrays
  const totalDays = attendance?.length || 0;
  const presentDays =
    attendance?.filter(
      (record: any) =>
        record.status?.toLowerCase() === "present" ||
        record.is_present === true,
    ).length || totalDays; // Fallback to total length if explicit status fields aren't flag-mapped

  const absentDays = totalDays - presentDays;
  const attendancePercent =
    totalDays > 0 ? `${Math.round((presentDays / totalDays) * 100)}%` : "100%";

  const pendingInvoicesCount =
    fees?.filter(
      (invoice: any) =>
        invoice.status?.toLowerCase() === "unpaid" || !invoice.is_paid,
    ).length || 0;

  const busRouteNo =
    assignedBus?.busNumber || assignedBus?.bus_number || "Not Assigned";

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Welcome Banner Header */}
      <View style={styles.header}>
        <View style={styles.headerTextWrapper}>
          <Text style={styles.welcomeText}>Welcome back,</Text>
          <Text style={styles.studentName}>
            {studentData?.user?.name || "Student"}
          </Text>
          <Text style={styles.metaText}>
            Class: {className || "N/A"} | Section: {sectionName || "N/A"}
          </Text>
        </View>
        <View style={styles.avatarPlaceholder}>
          <Ionicons name="person" size={24} color="#6B7280" />
        </View>
      </View>

      {/* Grid Stats Overview Row 1: Attendance & Exams */}
      <View style={styles.statsGrid}>
        <View style={styles.statCard}>
          <Ionicons
            name="pie-chart"
            size={22}
            color={COLORS.primary || "#4F46E5"}
            style={styles.iconMargin}
          />
          <Text style={styles.statLabel}>ATTENDANCE RATE</Text>
          <Text style={styles.statValue}>{attendancePercent}</Text>
          <Text style={styles.statSubText}>
            {totalDays > 0
              ? `${presentDays}P / ${absentDays}A`
              : "No current entries"}
          </Text>
        </View>

        <View style={styles.statCard}>
          <Ionicons
            name="alert-circle"
            size={22}
            color="#F59E0B"
            style={styles.iconMargin}
          />
          <Text style={styles.statLabel}>UPCOMING EXAMS</Text>
          <Text style={styles.statValue}>{examRoutines?.length || 0}</Text>
          <Text style={styles.statSubText}>Schedules Active</Text>
        </View>
      </View>

      {/* Grid Stats Overview Row 2: Fees Accounts & Transit Configurations */}
      <View style={styles.statsGrid}>
        <View style={styles.statCard}>
          <Ionicons
            name="card-outline"
            size={22}
            color="#EF4444"
            style={styles.iconMargin}
          />
          <Text style={styles.statLabel}>PENDING INVOICES</Text>
          <Text style={styles.statValue}>{pendingInvoicesCount}</Text>
          <Text style={styles.statSubText}>Requires Attention</Text>
        </View>

        <View style={styles.statCard}>
          <Ionicons
            name="bus-outline"
            size={22}
            color="#10B981"
            style={styles.iconMargin}
          />
          <Text style={styles.statLabel}>ASSIGNED ROUTE</Text>
          <Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit>
            {busRouteNo}
          </Text>
          <Text style={styles.statSubText}>GPS Tracking Enabled</Text>
        </View>
      </View>

      {/* Examination Schedule Segments */}
      <Text style={styles.sectionTitle}>Upcoming Academic Exams</Text>

      {!examRoutines || examRoutines.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>No upcoming test rosters found.</Text>
        </View>
      ) : (
        examRoutines.map((exam: any, index: number) => (
          <View key={exam.id || exam._id || index} style={styles.examCard}>
            <View style={styles.examBadge}>
              <Ionicons name="document-text" size={20} color="#4F46E5" />
            </View>
            <View style={styles.examDetails}>
              <Text style={styles.examName}>
                {exam.exam_name || exam.name || "Academic Exam"}
              </Text>
              <Text style={styles.examSubject}>
                {exam.subject_name || exam.subject || "General"}
              </Text>
              <Text style={styles.examDate}>
                🗓️ {exam.exam_date || exam.date || exam.examDate || "TBD"}
              </Text>
            </View>
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background || "#F9FAFB" },
  content: { padding: 20, gap: 20 },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F9FAFB",
  },
  loadingText: {
    marginTop: 12,
    color: "#6B7280",
    fontSize: 14,
    fontWeight: "600",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 10,
    backgroundColor: "#FFFFFF",
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  headerTextWrapper: { flex: 1, paddingRight: 8 },
  welcomeText: { fontSize: 13, color: "#6B7280", fontWeight: "500" },
  studentName: {
    fontSize: 22,
    fontWeight: "800",
    color: "#111827",
    marginTop: 2,
  },
  metaText: {
    fontSize: 12,
    color: COLORS.primary || "#4F46E5",
    fontWeight: "700",
    marginTop: 4,
  },
  avatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#F3F4F6",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  statsGrid: { flexDirection: "row", gap: 14 },
  statCard: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.02,
    shadowRadius: 3,
    elevation: 1,
  },
  iconMargin: { marginBottom: 6 },
  statLabel: {
    fontSize: 9,
    fontWeight: "800",
    color: "#9CA3AF",
    letterSpacing: 0.6,
  },
  statValue: {
    fontSize: 22,
    fontWeight: "800",
    color: "#111827",
    marginVertical: 2,
  },
  statSubText: { fontSize: 11, color: "#6B7280", fontWeight: "600" },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#111827",
    marginTop: 4,
    letterSpacing: -0.3,
  },
  emptyCard: {
    backgroundColor: "#FFFFFF",
    padding: 24,
    borderRadius: 16,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  emptyText: { color: "#9CA3AF", fontSize: 14, fontWeight: "500" },
  examCard: {
    flexDirection: "row",
    backgroundColor: "#FFFFFF",
    padding: 16,
    borderRadius: 16,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  examBadge: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: "#EEF2FF",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 14,
  },
  examDetails: { flex: 1 },
  examName: { fontSize: 15, fontWeight: "700", color: "#111827" },
  examSubject: {
    fontSize: 13,
    color: COLORS.primary || "#4F46E5",
    fontWeight: "700",
    marginVertical: 1,
  },
  examDate: { fontSize: 12, color: "#6B7280", fontWeight: "500", marginTop: 2 },
});
