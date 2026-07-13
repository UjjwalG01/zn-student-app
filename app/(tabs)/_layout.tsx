import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { COLORS } from "@/constants/theme"; // Using your design tokens
import { Platform } from "react-native"; // 👈 Make sure to import Platform

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: COLORS.primary || "#4F46E5",
        tabBarInactiveTintColor: "#6B7280",
        tabBarStyle: {
          backgroundColor: COLORS.card || "#FFFFFF",
          borderTopWidth: 1,
          borderTopColor: COLORS.border || "#E5E7EB",

          // Dynamically scale height and padding based on iOS vs Android
          height: Platform.OS === "ios" ? 88 : 70,
          paddingBottom: Platform.OS === "ios" ? 28 : 14,
          paddingTop: Platform.OS === "ios" ? 20 : 10,
        },
        headerStyle: {
          backgroundColor: COLORS.card || "#FFFFFF",
        },
        headerTitleStyle: {
          fontWeight: "700",
          color: COLORS.textPrimary || "#111827",
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Dashboard",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? "grid" : "grid-outline"}
              size={24}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="transactions"
        options={{
          title: "Fees",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? "card" : "card-outline"}
              size={24}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="bus"
        options={{
          title: "Bus Route",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? "bus" : "bus-outline"}
              size={24}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="attendance"
        options={{
          title: "Attendance",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? "calendar" : "calendar-outline"}
              size={24}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? "person" : "person-outline"}
              size={24}
              color={color}
            />
          ),
        }}
      />
    </Tabs>
  );
}
