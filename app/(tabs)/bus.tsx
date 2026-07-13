// app/(tabs)/bus.tsx
import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  Platform,
  Dimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { WebView } from "react-native-webview";
import { COLORS } from "@/constants/theme";
import { useAuth } from "../../contexts/AuthContext";

interface LiveTelemetry {
  latitude: number;
  longitude: number;
  speed: number;
}

export default function BusTrackerScreen() {
  const { studentData, loading } = useAuth();

  // Extract both route layout details and the specific bus block from our context
  const routeInfo = studentData?.bus_routes?.[0] || studentData?.bus_routes;
  const assignedBus = studentData?.assigned_bus;
  const busId = assignedBus?.busNumber || "SCH-BUS";

  const wsRef = useRef<WebSocket | null>(null);
  const webViewRef = useRef<WebView | null>(null);
  const reconnectTimerRef = useRef<any>(null);
  const isMountedRef = useRef(true);

  const [connStatus, setConnStatus] = useState<
    "Connecting..." | "Connected" | "Error" | "Reconnecting..."
  >("Connecting...");

  // Fallback map coordinate center points to use before websocket feeds trigger
  const [telemetry, setTelemetry] = useState<LiveTelemetry>({
    latitude: assignedBus?.route_geometry?.[0]?.latitude || 29.7604,
    longitude: assignedBus?.route_geometry?.[0]?.longitude || -95.3698,
    speed: 0,
  });

  // Keep track of route geometry safely as a standard JSON string payload for the WebView
  const routeGeometryPoints = assignedBus?.route_geometry || [];

  const connectWebSocket = useCallback(() => {
    if (!isMountedRef.current || !busId) return;

    const streamUrl = `wss://zn-school-bus-tracker.onrender.com/track/${busId}`;

    try {
      const ws = new WebSocket(streamUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        if (!isMountedRef.current) return;
        setConnStatus("Connected");
      };

      ws.onmessage = (event) => {
        if (!isMountedRef.current) return;
        try {
          const payload = JSON.parse(event.data);
          if (
            payload &&
            typeof payload.latitude === "number" &&
            typeof payload.longitude === "number"
          ) {
            const nextCoords = {
              latitude: payload.latitude,
              longitude: payload.longitude,
              speed: payload.speed || 0,
            };
            setTelemetry(nextCoords);

            // Dynamically post the updated telemetry marker position straight into the Leaflet canvas context
            webViewRef.current?.injectJavaScript(`
              if (window.updateBusMarker) {
                window.updateBusMarker(${payload.latitude}, ${payload.longitude}, ${payload.speed || 0});
              }
              true;
            `);
          }
        } catch (e) {
          console.log("Failed to parse incoming tracking data frame");
        }
      };

      ws.onerror = () => {
        if (!isMountedRef.current) return;
        setConnStatus("Error");
      };

      ws.onclose = () => {
        if (!isMountedRef.current) return;
        setConnStatus("Reconnecting...");
        reconnectTimerRef.current = setTimeout(() => {
          connectWebSocket();
        }, 5000);
      };
    } catch (err) {
      setConnStatus("Reconnecting...");
      reconnectTimerRef.current = setTimeout(() => {
        connectWebSocket();
      }, 5000);
    }
  }, [busId]);

  useEffect(() => {
    isMountedRef.current = true;
    if (busId && studentData?.school_settings?.is_bus_tracking_enabled) {
      connectWebSocket();
    }

    return () => {
      isMountedRef.current = false;
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      if (wsRef.current) wsRef.current.close();
    };
  }, [busId, studentData, connectWebSocket]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={COLORS.primary || "#4F46E5"} />
      </View>
    );
  }

  if (!studentData?.school_settings?.is_bus_tracking_enabled || !assignedBus) {
    return (
      <View style={styles.centered}>
        <Ionicons
          name="bus-outline"
          size={48}
          color="#9CA3AF"
          style={{ marginBottom: 12 }}
        />
        <Text style={styles.emptyTitleText}>No Active Bus Route Assigned</Text>
        <Text style={styles.emptySubtitleText}>
          Contact school administration to sync your profile transit pool
          details.
        </Text>
      </View>
    );
  }

  const statusColors = {
    Connected: COLORS.success || "#10B981",
    "Connecting...": COLORS.warning || "#F59E0B",
    "Reconnecting...": COLORS.warning || "#F59E0B",
    Error: COLORS.error || "#EF4444",
  };

  // Generate self-contained OpenStreetMap HTML layout fueled by Leaflet.js engine bindings
  const mapHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
      <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
      <style>
        html, body, #map { height: 100%; margin: 0; padding: 0; background: #F9FAFB; }
        .bus-icon-div { background: #4F46E5; color: white; border: 2px solid white; border-radius: 50%; text-align: center; font-weight: bold; line-height: 24px; box-shadow: 0 2px 5px rgba(0,0,0,0.3); }
      </style>
    </head>
    <body>
      <div id="map"></div>
      <script>
        const initialLat = ${telemetry.latitude};
        const initialLng = ${telemetry.longitude};
        const polylinePoints = ${JSON.stringify(routeGeometryPoints.map((p: any) => [p.latitude, p.longitude]))};

        const map = L.map('map', { zoomControl: false }).setView([initialLat, initialLng], 14);
        
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; OpenStreetMap'
        }).addTo(map);

        // Draw the static route geometries polylines path structure
        if (polylinePoints.length > 0) {
          const polyline = L.polyline(polylinePoints, { color: '#4F46E5', weight: 4, opacity: 0.7 }).addTo(map);
          map.fitBounds(polyline.getBounds(), { padding: [30, 30] });
        }

        // Add Live School Transit Asset Marker Pin Icon
        let busMarker = L.marker([initialLat, initialLng]).addTo(map)
          .bindPopup('School Bus Tracking Active')
          .openPopup();

        window.updateBusMarker = function(lat, lng, speed) {
          const newPos = new L.LatLng(lat, lng);
          busMarker.setLatLng(newPos);
          busMarker.setPopupContent('Moving: ' + speed + ' MPH');
          map.panTo(newPos);
        };
      </script>
    </body>
    </html>
  `;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Dynamic Status Header */}
      <View style={styles.headerRow}>
        <View style={{ flex: 1, paddingRight: 8 }}>
          <Text style={styles.titleText}>Bus Telemetry</Text>
          <Text style={styles.subtitleText} numberOfLines={1}>
            Route: {routeInfo || "School Loop"} • ID: {busId}
          </Text>
        </View>
        <View
          style={[
            styles.badge,
            { backgroundColor: `${statusColors[connStatus]}20` },
          ]}
        >
          <View
            style={[styles.dot, { backgroundColor: statusColors[connStatus] }]}
          />
          <Text style={[styles.badgeText, { color: statusColors[connStatus] }]}>
            {connStatus}
          </Text>
        </View>
      </View>

      {/* OPENSTREETMAP CANVAS WINDOW COMPONENT CONTAINER */}
      <View style={styles.mapContainerCard}>
        <Text style={styles.cardLabel}>INTERACTIVE TRANSIT GEOMETRY MAP</Text>
        <View style={styles.mapFrameCanvas}>
          <WebView
            ref={webViewRef}
            originWhitelist={["*"]}
            source={{ html: mapHtml }}
            style={{ flex: 1 }}
            javaScriptEnabled={true}
            domStorageEnabled={true}
            startInLoadingState={true}
            renderLoading={() => (
              <ActivityIndicator
                style={StyleSheet.absoluteFill}
                color={COLORS.primary}
              />
            )}
          />
        </View>
      </View>

      {/* Primary Telemetry Instruments */}
      <View style={styles.card}>
        <Text style={styles.cardLabel}>LIVE STREAM INSTRUMENTS</Text>
        <View style={styles.telemetryContainer}>
          <View style={styles.instrumentBlock}>
            <Text style={styles.instrumentVal}>{telemetry.speed}</Text>
            <Text style={styles.instrumentUnit}>MPH SPEED</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.instrumentBlock}>
            <Text style={styles.coordinateText}>
              {telemetry.latitude.toFixed(5)}
            </Text>
            <Text style={styles.instrumentUnit}>LATITUDE</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.instrumentBlock}>
            <Text style={styles.coordinateText}>
              {telemetry.longitude.toFixed(5)}
            </Text>
            <Text style={styles.instrumentUnit}>LONGITUDE</Text>
          </View>
        </View>
      </View>

      {/* Driver Information Metrics */}
      <View style={styles.card}>
        <Text style={styles.cardLabel}>ASSIGNED OPERATOR DETAILS</Text>
        <View style={styles.driverProfile}>
          <View style={styles.avatarCircle}>
            <Ionicons
              name="person-outline"
              size={24}
              color={COLORS.primary || "#4F46E5"}
            />
          </View>
          <View>
            <Text style={styles.driverName}>
              {assignedBus.driverName || "Assigned Operator"}
            </Text>
            {/* <Text style={styles.driverMeta}>Vehicle Model: {assignedBus.busModel || "Standard Fleet"}</Text> */}
            <Text style={styles.driverPhone}>
              {assignedBus.driverPhone || "No Linked Phone Number"}
            </Text>
          </View>
        </View>

        <View style={styles.horizontalLine} />

        <View style={styles.metaFlexRow}>
          <View>
            <Text style={styles.metaLabel}>LICENSE PLATE</Text>
            <View style={styles.plateContainer}>
              <Text style={styles.plateText}>
                {assignedBus?.busNumber || busId}
              </Text>
            </View>
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={styles.metaLabel}>TRANSIT ARRIVAL STATUS</Text>
            <Text style={styles.etaText}>
              {connStatus === "Connected"
                ? "Active Live Feed"
                : "Telemetry Inactive"}
            </Text>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background || "#F9FAFB" },
  content: {
    padding: 20,
    gap: 16,
    paddingTop: Platform.OS === "ios" ? 60 : 30,
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: COLORS.background || "#F9FAFB",
    padding: 30,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  titleText: {
    fontSize: 24,
    fontWeight: "800",
    color: COLORS.textPrimary || "#111827",
  },
  subtitleText: {
    fontSize: 13,
    color: COLORS.textSecondary || "#6B7280",
    marginTop: 2,
  },
  emptyTitleText: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
    marginTop: 8,
  },
  emptySubtitleText: {
    fontSize: 14,
    color: "#6B7280",
    textAlign: "center",
    marginTop: 4,
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  dot: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
  badgeText: { fontSize: 12, fontWeight: "700" },
  card: {
    backgroundColor: COLORS.card || "#FFFFFF",
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: COLORS.border || "#E5E7EB",
  },
  mapContainerCard: {
    backgroundColor: COLORS.card || "#FFFFFF",
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border || "#E5E7EB",
  },
  mapFrameCanvas: {
    height: 220,
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    marginTop: 8,
  },
  cardLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: COLORS.textSecondary || "#6B7280",
    letterSpacing: 1,
    marginBottom: 8,
  },
  telemetryContainer: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
  },
  instrumentBlock: { flex: 1, alignItems: "center" },
  instrumentVal: {
    fontSize: 32,
    fontWeight: "800",
    color: COLORS.primary || "#4F46E5",
  },
  coordinateText: {
    fontSize: 13,
    fontWeight: "700",
    color: COLORS.textPrimary || "#111827",
  },
  instrumentUnit: {
    fontSize: 9,
    fontWeight: "600",
    color: COLORS.textSecondary || "#6B7280",
    marginTop: 4,
  },
  divider: {
    width: 1,
    height: 32,
    backgroundColor: COLORS.border || "#E5E7EB",
  },
  driverProfile: { flexDirection: "row", alignItems: "center", gap: 14 },
  avatarCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: `${COLORS.primary || "#4F46E5"}15`,
    alignItems: "center",
    justifyContent: "center",
  },
  driverName: {
    fontSize: 15,
    fontWeight: "700",
    color: COLORS.textPrimary || "#111827",
  },
  driverMeta: {
    fontSize: 12,
    color: COLORS.textSecondary || "#6B7280",
    marginTop: 2,
  },
  driverPhone: {
    fontSize: 12,
    fontWeight: "600",
    color: COLORS.primary || "#4F46E5",
    marginTop: 2,
  },
  horizontalLine: {
    height: 1,
    backgroundColor: COLORS.border || "#E5E7EB",
    marginVertical: 16,
  },
  metaFlexRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  metaLabel: {
    fontSize: 10,
    fontWeight: "600",
    color: COLORS.textSecondary || "#6B7280",
    marginBottom: 6,
  },
  plateContainer: {
    backgroundColor: `${COLORS.primary || "#4F46E5"}15`,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  plateText: {
    fontSize: 13,
    fontWeight: "800",
    color: COLORS.primary || "#4F46E5",
    letterSpacing: 0.5,
  },
  etaText: {
    fontSize: 13,
    fontWeight: "800",
    color: COLORS.success || "#10B981",
  },
});
