import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  LayoutChangeEvent,
  StyleProp,
  ViewStyle,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
  Easing,
  interpolateColor,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

export interface SegmentedTabItem<T extends string = string> {
  key: T;
  label: string;
  activeColor?: string; // Color text when active (default: #C084FC)
  activeBgColor?: string; // Background of liquid pill (default: rgba(139, 92, 246, 0.2))
  activeBorderColor?: string; // Border of liquid pill (default: rgba(168, 85, 247, 0.45))
}

export interface SegmentedTabsProps<T extends string = string> {
  tabs: readonly SegmentedTabItem<T>[] | SegmentedTabItem<T>[];
  activeKey: T;
  onChange: (key: T) => void;
  containerStyle?: StyleProp<ViewStyle>;
  tabHeight?: number;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const INITIAL_CONTAINER_WIDTH = SCREEN_WIDTH - 32; // Default horizontal padding 16 each side

interface TabButtonProps {
  label: string;
  isSelected: boolean;
  height: number;
  activeColor?: string;
  onPress: () => void;
}

const TabButton: React.FC<TabButtonProps> = React.memo(
  ({ label, isSelected, height, activeColor = '#C084FC', onPress }) => {
    const activeProgress = useSharedValue(isSelected ? 1 : 0);

    useEffect(() => {
      activeProgress.value = withTiming(isSelected ? 1 : 0, {
        duration: 340,
        easing: Easing.bezier(0.35, 0, 0.25, 1),
      });
    }, [isSelected, activeProgress]);

    const animatedTextStyle = useAnimatedStyle(() => {
      const color = interpolateColor(
        activeProgress.value,
        [0, 1],
        ['#94A3B8', activeColor]
      );
      return { color };
    });

    return (
      <TouchableOpacity
        style={[styles.tabButton, { height }]}
        onPress={onPress}
        activeOpacity={0.8}
      >
        <Animated.Text
          style={[
            styles.tabText,
            animatedTextStyle,
            isSelected ? styles.tabTextActive : styles.tabTextInactive,
          ]}
          numberOfLines={1}
        >
          {label}
        </Animated.Text>
      </TouchableOpacity>
    );
  }
);

TabButton.displayName = 'TabButton';

export function SegmentedTabs<T extends string = string>({
  tabs,
  activeKey,
  onChange,
  containerStyle,
  tabHeight = 36,
}: SegmentedTabsProps<T>) {
  const count = tabs.length;
  const [containerWidth, setContainerWidth] = useState<number>(INITIAL_CONTAINER_WIDTH);
  const currentTabWidth = count > 0 ? (containerWidth - 8) / count : 0;
  const initialTabWidth = count > 0 ? (INITIAL_CONTAINER_WIDTH - 8) / count : 0;

  const getIndexFromKey = useCallback(
    (key: T): number => {
      const idx = tabs.findIndex((t) => t.key === key);
      return idx >= 0 ? idx : 0;
    },
    [tabs]
  );

  const activeIndex = getIndexFromKey(activeKey);
  const oldIndexRef = useRef<number>(activeIndex);
  const secondHapticTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Shared values for gooey liquid stretch & slide
  const tabWidthValue = useSharedValue<number>(initialTabWidth);
  const pillTranslateX = useSharedValue<number>(activeIndex * initialTabWidth);
  const pillScaleX = useSharedValue<number>(1);
  const pillScaleY = useSharedValue<number>(1);
  const colorIndex = useSharedValue<number>(activeIndex);

  // Sync if activeKey prop changes externally (e.g. presets)
  useEffect(() => {
    if (activeIndex !== oldIndexRef.current) {
      const tabW = tabWidthValue.value > 0 ? tabWidthValue.value : currentTabWidth;
      pillTranslateX.value = activeIndex * tabW;
      pillScaleX.value = 1;
      pillScaleY.value = 1;
      colorIndex.value = activeIndex;
      oldIndexRef.current = activeIndex;
    }
  }, [activeIndex, currentTabWidth, tabWidthValue, pillTranslateX, pillScaleX, pillScaleY, colorIndex]);

  // Clean up haptic timer on unmount
  useEffect(() => {
    return () => {
      if (secondHapticTimerRef.current) {
        clearTimeout(secondHapticTimerRef.current);
        secondHapticTimerRef.current = null;
      }
    };
  }, []);

  // Update layout & tabWidth on container measurement
  const handleLayout = (e: LayoutChangeEvent) => {
    const width = e.nativeEvent.layout.width;
    if (width > 0 && Math.abs(width - containerWidth) > 1) {
      setContainerWidth(width);
      const newTabW = count > 0 ? (width - 8) / count : 0;
      tabWidthValue.value = newTabW;
      pillTranslateX.value = activeIndex * newTabW;
    }
  };

  const handleTabPress = (key: T, newIndex: number) => {
    const oldIndex = oldIndexRef.current;
    if (newIndex === oldIndex) return;

    // Clear previous second-stage timer if active
    if (secondHapticTimerRef.current) {
      clearTimeout(secondHapticTimerRef.current);
      secondHapticTimerRef.current = null;
    }

    // Haptics Nhịp 1 (0ms): Chạm nhẹ bắt đầu ấn dồn lực vào khe hẹp
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {
      // Ignore on unsupported platforms
    }

    // Haptics Nhịp 2 (340ms): Đúng khoảnh khắc chui tọt thoát ra khỏi hầm
    secondHapticTimerRef.current = setTimeout(() => {
      try {
        Haptics.selectionAsync();
      } catch {
        // Ignore on unsupported platforms
      }
      secondHapticTimerRef.current = null;
    }, 340);

    const tabW = tabWidthValue.value > 0 ? tabWidthValue.value : currentTabWidth;
    const startX = oldIndex * tabW;
    const endX = newIndex * tabW;
    const direction = newIndex > oldIndex ? 1 : -1;
    const distance = Math.abs(newIndex - oldIndex);
    const squeezePointX = startX + (endX - startX) * 0.18;
    const peakScaleX = distance >= 2 ? 1.65 : 1.45;

    // =========================================================================
    // "Squeeze-Through Bottleneck" 3-Phase Physics Animation (~520ms total)
    // =========================================================================

    // 1. Tọa độ X (pillTranslateX)
    pillTranslateX.value = withSequence(
      withTiming(squeezePointX, { duration: 180, easing: Easing.out(Easing.quad) }),
      withTiming(endX - direction * 4, { duration: 160, easing: Easing.bezier(0.7, 0, 0.2, 1) }),
      withTiming(endX, { duration: 180, easing: Easing.out(Easing.cubic) })
    );

    // 2. Trục X (pillScaleX)
    pillScaleX.value = withSequence(
      withTiming(0.78, { duration: 180, easing: Easing.out(Easing.quad) }),
      withTiming(peakScaleX, { duration: 160 }),
      withTiming(0.92, { duration: 90 }),
      withTiming(1, { duration: 90, easing: Easing.out(Easing.quad) })
    );

    // 3. Trục Y (pillScaleY)
    pillScaleY.value = withSequence(
      withTiming(1.16, { duration: 180, easing: Easing.out(Easing.quad) }),
      withTiming(0.62, { duration: 160 }),
      withTiming(1.08, { duration: 90 }),
      withTiming(1, { duration: 90, easing: Easing.out(Easing.quad) })
    );

    // 4. Chuyển đổi màu sắc đồng bộ (nếu có custom color)
    colorIndex.value = withTiming(newIndex, {
      duration: 340,
      easing: Easing.bezier(0.35, 0, 0.25, 1),
    });

    oldIndexRef.current = newIndex;
    onChange(key);
  };

  const bgColors = useMemo(() => {
    const list = tabs.map((t) => t.activeBgColor || 'rgba(139, 92, 246, 0.2)');
    if (list.length === 1) return [list[0], list[0]];
    return list;
  }, [tabs]);

  const borderColors = useMemo(() => {
    const list = tabs.map((t) => t.activeBorderColor || 'rgba(168, 85, 247, 0.45)');
    if (list.length === 1) return [list[0], list[0]];
    return list;
  }, [tabs]);

  const inputIndices = useMemo(() => {
    if (tabs.length <= 1) return [0, 1];
    return tabs.map((_, i) => i);
  }, [tabs]);

  const pillAnimatedStyle = useAnimatedStyle(() => {
    const backgroundColor = interpolateColor(
      colorIndex.value,
      inputIndices,
      bgColors
    );
    const borderColor = interpolateColor(
      colorIndex.value,
      inputIndices,
      borderColors
    );

    return {
      width: tabWidthValue.value,
      backgroundColor,
      borderColor,
      transform: [
        { translateX: pillTranslateX.value },
        { scaleX: pillScaleX.value },
        { scaleY: pillScaleY.value },
      ],
    };
  });

  const dividerTop = 4 + (tabHeight - 14) / 2;

  return (
    <View style={[styles.container, containerStyle]} onLayout={handleLayout}>
      {/* Liquid Active Pill - FLAT MATTE (Không shadow ở giữa) */}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.liquidPill,
          { height: tabHeight },
          pillAnimatedStyle,
        ]}
      />

      {/* Vách ngăn mờ giữa các tab tạo cảm giác khe hẹp */}
      {count > 1 &&
        Array.from({ length: count - 1 }).map((_, i) => (
          <View
            key={`divider-${i}`}
            pointerEvents="none"
            style={[
              styles.divider,
              {
                top: dividerTop,
                left: 4 + (i + 1) * currentTabWidth,
              },
            ]}
          />
        ))}

      {/* Segmented Filter Tab Buttons */}
      {tabs.map((tab, index) => (
        <TabButton
          key={tab.key}
          label={tab.label}
          isSelected={activeKey === tab.key}
          height={tabHeight}
          activeColor={tab.activeColor}
          onPress={() => handleTabPress(tab.key, index)}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: '#12141F',
    borderRadius: 16,
    padding: 4,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    marginBottom: 12,
    position: 'relative',
    overflow: 'hidden',
  },
  liquidPill: {
    position: 'absolute',
    top: 4,
    left: 4,
    borderRadius: 16,
    zIndex: 0,
    borderWidth: 1,
  },
  divider: {
    position: 'absolute',
    width: 1,
    height: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    zIndex: 1,
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
    minWidth: 0,
    paddingHorizontal: 2,
  },
  tabText: {
    fontSize: 13,
    textAlign: 'center',
  },
  tabTextActive: {
    fontWeight: '600',
  },
  tabTextInactive: {
    fontWeight: '500',
  },
});
