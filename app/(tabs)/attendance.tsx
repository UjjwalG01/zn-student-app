// app/(tabs)/attendance.tsx
import React from "react";
import { StyleSheet, View, Text, ScrollView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { COLORS } from "@/constants/theme";
import { useAuth } from "../../contexts/AuthContext";

export default function AttendanceScreen() {
  const { studentData } = useAuth();
  const attendanceRecords = studentData?.attendance || [];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.sectionTitle}>Recent Attendance Logs</Text>

      {attendanceRecords.length === 0 ? (
        <View style={styles.emptyCard}>
          <Ionicons
            name="calendar-outline"
            size={40}
            color="#9CA3AF"
            style={{ marginBottom: 8 }}
          />
          <Text style={styles.emptyText}>
            No historical attendance logs synced yet.
          </Text>
        </View>
      ) : (
        attendanceRecords.map((log: any, index: number) => {
          // Normalize status handling (supports "Present"/"P", "Late"/"L", "Absent"/"A")
          const rawStatus = log.status || "Absent";
          const statusLower = rawStatus.toLowerCase();

          let displayStatus = "Absent";
          let statusColor = "#EF4444";
          let statusBg = "#FCE8E6";

          if (statusLower === "present" || statusLower === "p") {
            displayStatus = "Present";
            statusColor = "#10B981";
            statusBg = "#E6F4EA";
          } else if (statusLower === "late" || statusLower === "l") {
            displayStatus = "Late";
            statusColor = "#F59E0B";
            statusBg = "#FEF3C7";
          }

          // Safety mapping for time stamps
          const punchTime = log.check_in || log.checkIn || log.time || "--";

          return (
            <View key={log.id || log._id || index} style={styles.logCard}>
              <View>
                <Text style={styles.logDate}>{log.date || "Unknown Date"}</Text>
                <Text style={styles.logCheckIn}>Punch In: {punchTime}</Text>
              </View>
              <View style={[styles.statusBadge, { backgroundColor: statusBg }]}>
                <Text style={[styles.statusText, { color: statusColor }]}>
                  {displayStatus}
                </Text>
              </View>
            </View>
          );
        })
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background || "#F9FAFB" },
  content: { padding: 20, gap: 12 },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 6,
  },
  logCard: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  logDate: { fontSize: 15, fontWeight: "700", color: "#111827" },
  logCheckIn: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 4,
    fontWeight: "500",
  },
  statusBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 99 },
  statusText: { fontSize: 12, fontWeight: "700" },
  emptyCard: {
    backgroundColor: "#FFFFFF",
    padding: 30,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    marginTop: 10,
  },
  emptyText: { color: "#6B7280", fontSize: 14, fontWeight: "500" },
});
