import React from "react";
import { StyleSheet, View, Text, ScrollView, FlatList } from "react-native";
import { COLORS } from "@/constants/theme";

const FEE_HEADS = [
  {
    id: "1",
    name: "Tuition Fee (Q3)",
    allocated: 1200,
    paid: 1200,
    balance: 0,
  },
  {
    id: "2",
    name: "Laboratory & IT Fee",
    allocated: 350,
    paid: 350,
    balance: 0,
  },
  {
    id: "3",
    name: "Transport Maintenance",
    allocated: 450,
    paid: 150,
    balance: 300,
  },
  {
    id: "4",
    name: "Examination Registration",
    allocated: 150,
    paid: 0,
    balance: 150,
  },
];

export default function TransactionsScreen() {
  const totalAllocated = FEE_HEADS.reduce(
    (sum, item) => sum + item.allocated,
    0,
  );
  const totalPaid = FEE_HEADS.reduce((sum, item) => sum + item.paid, 0);
  const totalRemaining = FEE_HEADS.reduce((sum, item) => sum + item.balance, 0);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Overview Balance Summary Cards */}
      <View style={styles.summaryRow}>
        <View style={[styles.summaryCard, { backgroundColor: "#DEF7EC" }]}>
          <Text style={[styles.summaryLabel, { color: "#03543F" }]}>
            TOTAL PAID
          </Text>
          <Text style={[styles.summaryAmount, { color: "#03543F" }]}>
            ${totalPaid}
          </Text>
        </View>
        <View style={[styles.summaryCard, { backgroundColor: "#FDE8E8" }]}>
          <Text style={[styles.summaryLabel, { color: "#9B1C1C" }]}>
            REMAINING
          </Text>
          <Text style={[styles.summaryAmount, { color: "#9B1C1C" }]}>
            ${totalRemaining}
          </Text>
        </View>
      </View>

      {/* Head-Wise Fee Ledger Breakdown */}
      <Text style={styles.sectionTitle}>Head-Wise Fee Ledger</Text>

      {FEE_HEADS.map((item) => (
        <View key={item.id} style={styles.ledgerCard}>
          <View style={styles.ledgerHeader}>
            <Text style={styles.headName}>{item.name}</Text>
            <Text style={styles.totalText}>Total: ${item.allocated}</Text>
          </View>

          <View style={styles.horizontalLine} />

          <View style={styles.ledgerMetrics}>
            <View>
              <Text style={styles.metricLabel}>PAID AMOUNT</Text>
              <Text
                style={[
                  styles.metricVal,
                  { color: COLORS.success || "#10B981" },
                ]}
              >
                ${item.paid}
              </Text>
            </View>
            <View style={{ alignItems: "flex-end" }}>
              <Text style={styles.metricLabel}>OUTSTANDING BALANCE</Text>
              <Text
                style={[
                  styles.metricVal,
                  { color: item.balance > 0 ? "#EF4444" : "#6B7280" },
                ]}
              >
                ${item.balance}
              </Text>
            </View>
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background || "#F9FAFB",
  },
  content: {
    padding: 20,
    gap: 16,
  },
  summaryRow: {
    flexDirection: "row",
    gap: 12,
  },
  summaryCard: {
    flex: 1,
    padding: 16,
    borderRadius: 16,
    alignItems: "center",
  },
  summaryLabel: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  summaryAmount: {
    fontSize: 24,
    fontWeight: "800",
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: COLORS.textPrimary || "#111827",
    marginTop: 8,
  },
  ledgerCard: {
    backgroundColor: COLORS.card || "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border || "#E5E7EB",
  },
  ledgerHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  headName: {
    fontSize: 15,
    fontWeight: "600",
    color: COLORS.textPrimary || "#111827",
  },
  totalText: {
    fontSize: 13,
    fontWeight: "600",
    color: COLORS.textSecondary || "#6B7280",
  },
  horizontalLine: {
    height: 1,
    backgroundColor: COLORS.border || "#E5E7EB",
    marginVertical: 12,
  },
  ledgerMetrics: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  metricLabel: {
    fontSize: 10,
    fontWeight: "600",
    color: COLORS.textSecondary || "#6B7280",
    marginBottom: 2,
  },
  metricVal: {
    fontSize: 15,
    fontWeight: "700",
  },
});
