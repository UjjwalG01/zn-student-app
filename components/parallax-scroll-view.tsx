import React from "react";
import { StyleSheet, useColorScheme, ViewStyle } from "react-native";
import Animated, {
  interpolate,
  useAnimatedRef,
  useAnimatedStyle,
  useScrollOffset,
} from "react-native-reanimated";
import { useTheme } from "@/contexts/theme-context";

const HEADER_HEIGHT = 250;

interface Props {
  children: React.ReactNode;
  headerImage: React.ReactElement;
  headerBackgroundColor: { light: string; dark: string } | string;
}

export default function ParallaxScrollView({
  children,
  headerImage,
  headerBackgroundColor,
}: Props) {
  const { theme } = useTheme();
  const colorScheme = useColorScheme() ?? "light";
  const scrollRef = useAnimatedRef<Animated.ScrollView>();
  const scrollOffset = useScrollOffset(scrollRef);

  // 🛡️ Safely resolve background color without crashing on nested lookups
  const resolvedHeaderBg =
    typeof headerBackgroundColor === "string"
      ? headerBackgroundColor
      : headerBackgroundColor?.[colorScheme] || theme.colors.primary;

  const headerAnimatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        {
          translateY: interpolate(
            scrollOffset.value,
            [-HEADER_HEIGHT, 0, HEADER_HEIGHT],
            [-HEADER_HEIGHT / 2, 0, HEADER_HEIGHT * 0.75],
          ),
        },
        {
          scale: interpolate(
            scrollOffset.value,
            [-HEADER_HEIGHT, 0, HEADER_HEIGHT],
            [2, 1, 1],
          ),
        },
      ],
    };
  });

  return (
    <Animated.ScrollView
      ref={scrollRef}
      style={{ backgroundColor: theme.colors.background, flex: 1 }}
      scrollEventThrottle={16}
    >
      <Animated.View
        style={[
          styles.header,
          { backgroundColor: resolvedHeaderBg },
          headerAnimatedStyle,
        ]}
      >
        {headerImage}
      </Animated.View>
      <Animated.View
        style={[styles.content, { backgroundColor: theme.colors.background }]}
      >
        {children}
      </Animated.View>
    </Animated.ScrollView>
  );
}

const styles = StyleSheet.create({
  header: {
    height: HEADER_HEIGHT,
    overflow: "hidden",
  },
  content: {
    flex: 1,
    padding: 32,
    gap: 16,
    overflow: "hidden",
  },
});
