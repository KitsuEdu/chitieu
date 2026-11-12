import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  Pressable,
  Dimensions,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import Animated, {
  useSharedValue,
  useAnimatedProps,
  useAnimatedStyle,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import {
  LayoutDashboard,
  Wallet,
  ReceiptText,
  Settings,
  Plus,
} from 'lucide-react-native';

export type MainTabType = 'OVERVIEW' | 'WALLETS' | 'HISTORY' | 'SETTINGS';

interface LiquidNavBarProps {
  currentTab: MainTabType;
  onSelectTab: (tab: MainTabType) => void;
  onPressPlus: () => void;
  isQuickEntryOpen: boolean;
}

const AnimatedPath = Animated.createAnimatedComponent(Path);

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const BAR_HEIGHT = 64;
const CORNER_RADIUS = 20;
const CIRCLE_RADIUS = 24;
const CIRCLE_SIZE = CIRCLE_RADIUS * 2; // 48px
const NOTCH_WIDTH = 64;
const NOTCH_DEPTH = 32;
const SIDE_PADDING = 14;
const TOTAL_TABS = 5;

const EASING_CURVE = Easing.bezier(0.25, 0.1, 0.25, 1);
const ANIMATION_DURATION = 300;

const triggerHaptic = () => {
  try {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  } catch {
    // Ignore haptic error on unsupported platforms
  }
};

export const LiquidNavBar: React.FC<LiquidNavBarProps> = ({
  currentTab,
  onSelectTab,
  onPressPlus,
  isQuickEntryOpen,
}) => {
  const insets = useSafeAreaInsets();
  const [barWidth, setBarWidth] = useState<number>(SCREEN_WIDTH - 32);

  const usableWidth = barWidth - SIDE_PADDING * 2;
  const tabWidth = usableWidth / TOTAL_TABS;

  const getIndexFromTab = (tab: MainTabType): number => {
    switch (tab) {
      case 'OVERVIEW':
        return 0;
      case 'WALLETS':
        return 1;
      case 'HISTORY':
        return 3;
      case 'SETTINGS':
        return 4;
      default:
        return 0;
    }
  };

  const getCenterForIndex = (idx: number, width: number): number => {
    const usable = width - SIDE_PADDING * 2;
    const tW = usable / TOTAL_TABS;
    return SIDE_PADDING + idx * tW + tW / 2;
  };

  const activeIndex = isQuickEntryOpen ? 2 : getIndexFromTab(currentTab);
  const initialCenter = getCenterForIndex(activeIndex, barWidth);

  // 1. Shared value cho tọa độ tâm của vết lõm và vòng tròn active
  const notchCenterX = useSharedValue(initialCenter);

  // 2. Shared values cho vị trí nâng lên/hạ xuống của từng Icon (Index 0 -> 4)
  const icon0Y = useSharedValue(activeIndex === 0 ? -22 : 0);
  const icon1Y = useSharedValue(activeIndex === 1 ? -22 : 0);
  const icon2Y = useSharedValue(activeIndex === 2 ? -22 : 0);
  const icon3Y = useSharedValue(activeIndex === 3 ? -22 : 0);
  const icon4Y = useSharedValue(activeIndex === 4 ? -22 : 0);

  const getIconSharedValue = (idx: number) => {
    switch (idx) {
      case 0:
        return icon0Y;
      case 1:
        return icon1Y;
      case 2:
        return icon2Y;
      case 3:
        return icon3Y;
      case 4:
      default:
        return icon4Y;
    }
  };

  // Cập nhật vị trí khi activeIndex hoặc barWidth thay đổi
  useEffect(() => {
    const targetX = getCenterForIndex(activeIndex, barWidth);

    // Trượt ngang mượt mà bằng withTiming cubic-bezier
    notchCenterX.value = withTiming(targetX, {
      duration: ANIMATION_DURATION,
      easing: EASING_CURVE,
    });

    // Nâng icon được chọn lên đúng tâm vòng tròn và hạ các icon khác xuống
    for (let i = 0; i < TOTAL_TABS; i++) {
      const sv = getIconSharedValue(i);
      sv.value = withTiming(i === activeIndex ? -22 : 0, {
        duration: ANIMATION_DURATION,
        easing: EASING_CURVE,
      });
    }
  }, [activeIndex, barWidth]);

  // Xử lý chạm tab
  const handlePressTab = (idx: number) => {
    triggerHaptic();

    if (idx === 2) {
      onPressPlus();
      return;
    }

    let targetTab: MainTabType = 'OVERVIEW';
    if (idx === 0) targetTab = 'OVERVIEW';
    else if (idx === 1) targetTab = 'WALLETS';
    else if (idx === 3) targetTab = 'HISTORY';
    else if (idx === 4) targetTab = 'SETTINGS';

    onSelectTab(targetTab);
  };

  // Animated Props cho SVG Path của vết lõm chữ U (Cubic Bezier mượt mà)
  const animatedPathProps = useAnimatedProps(() => {
    'worklet';
    const x = notchCenterX.value;
    const W = barWidth;
    const H = BAR_HEIGHT;
    const R = CORNER_RADIUS;
    const nw = NOTCH_WIDTH;
    const nd = NOTCH_DEPTH;

    const leftNotch = Math.max(R, x - nw / 2);
    const rightNotch = Math.min(W - R, x + nw / 2);
    const cp1x = x - nw / 4;
    const cp2x = x - nw / 3;
    const cp3x = x + nw / 3;
    const cp4x = x + nw / 4;

    const d = `M 0 ${R} A ${R} ${R} 0 0 1 ${R} 0 L ${leftNotch} 0 C ${cp1x} 0, ${cp2x} ${nd}, ${x} ${nd} C ${cp3x} ${nd}, ${cp4x} 0, ${rightNotch} 0 L ${W - R} 0 A ${R} ${R} 0 0 1 ${W} ${R} L ${W} ${H - R} A ${R} ${R} 0 0 1 ${W - R} ${H} L ${R} ${H} A ${R} ${R} 0 0 1 0 ${H - R} Z`;

    return { d };
  }, [barWidth]);

  // Animated Props cho đường viền mép trên tinh tế (Stroke Line)
  const animatedStrokeProps = useAnimatedProps(() => {
    'worklet';
    const x = notchCenterX.value;
    const W = barWidth;
    const R = CORNER_RADIUS;
    const nw = NOTCH_WIDTH;
    const nd = NOTCH_DEPTH;

    const leftNotch = Math.max(R, x - nw / 2);
    const rightNotch = Math.min(W - R, x + nw / 2);
    const cp1x = x - nw / 4;
    const cp2x = x - nw / 3;
    const cp3x = x + nw / 3;
    const cp4x = x + nw / 4;

    const d = `M 0 ${R} A ${R} ${R} 0 0 1 ${R} 0 L ${leftNotch} 0 C ${cp1x} 0, ${cp2x} ${nd}, ${x} ${nd} C ${cp3x} ${nd}, ${cp4x} 0, ${rightNotch} 0 L ${W - R} 0 A ${R} ${R} 0 0 1 ${W} ${R}`;

    return { d };
  }, [barWidth]);

  // Vòng tròn Active tím sáng di chuyển đồng bộ 100% cùng tâm notch
  const circleAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: notchCenterX.value - CIRCLE_RADIUS }],
  }));

  // Animated styles cho từng icon
  const icon0Style = useAnimatedStyle(() => ({
    transform: [{ translateY: icon0Y.value }],
  }));
  const icon1Style = useAnimatedStyle(() => ({
    transform: [{ translateY: icon1Y.value }],
  }));
  const icon2Style = useAnimatedStyle(() => ({
    transform: [{ translateY: icon2Y.value }],
  }));
  const icon3Style = useAnimatedStyle(() => ({
    transform: [{ translateY: icon3Y.value }],
  }));
  const icon4Style = useAnimatedStyle(() => ({
    transform: [{ translateY: icon4Y.value }],
  }));

  const getAnimatedIconStyle = (idx: number) => {
    switch (idx) {
      case 0:
        return icon0Style;
      case 1:
        return icon1Style;
      case 2:
        return icon2Style;
      case 3:
        return icon3Style;
      case 4:
      default:
        return icon4Style;
    }
  };

  const bottomOffset = Math.max(16, insets.bottom > 0 ? insets.bottom + 4 : 16);

  return (
    <View
      style={[styles.floatingWrapper, { bottom: bottomOffset }]}
      onLayout={(e) => setBarWidth(e.nativeEvent.layout.width)}
    >
      {/* 1. Mặt phẳng SVG có vết lõm chữ U trượt mượt mà */}
      <Svg
        width={barWidth}
        height={BAR_HEIGHT}
        style={StyleSheet.absoluteFill}
      >
        <AnimatedPath
          animatedProps={animatedPathProps}
          fill="#12141F"
        />
        <AnimatedPath
          animatedProps={animatedStrokeProps}
          stroke="rgba(255, 255, 255, 0.07)"
          strokeWidth={1}
          fill="none"
        />
      </Svg>

      {/* 2. Vòng tròn Active nổi lên trong lòng vết lõm */}
      <Animated.View
        style={[styles.activeCircle, circleAnimatedStyle]}
        pointerEvents="none"
      />

      {/* 3. Lưới 5 Icons điều hướng */}
      <View style={[styles.tabsRow, { paddingHorizontal: SIDE_PADDING }]}>
        {/* Tab 0: Tổng quan */}
        <Pressable
          style={styles.tabItem}
          onPress={() => handlePressTab(0)}
          hitSlop={{ top: 12, bottom: 12 }}
        >
          <Animated.View style={getAnimatedIconStyle(0)}>
            <LayoutDashboard
              size={22}
              color={activeIndex === 0 ? '#FFFFFF' : '#64748B'}
            />
          </Animated.View>
        </Pressable>

        {/* Tab 1: Ví */}
        <Pressable
          style={styles.tabItem}
          onPress={() => handlePressTab(1)}
          hitSlop={{ top: 12, bottom: 12 }}
        >
          <Animated.View style={getAnimatedIconStyle(1)}>
            <Wallet
              size={22}
              color={activeIndex === 1 ? '#FFFFFF' : '#64748B'}
            />
          </Animated.View>
        </Pressable>

        {/* Tab 2: Nút Nhập Nhanh (+) */}
        <Pressable
          style={styles.tabItem}
          onPress={() => handlePressTab(2)}
          hitSlop={{ top: 12, bottom: 12 }}
        >
          <Animated.View style={getAnimatedIconStyle(2)}>
            <Plus
              size={26}
              color={activeIndex === 2 ? '#FFFFFF' : '#64748B'}
              strokeWidth={2.6}
            />
          </Animated.View>
        </Pressable>

        {/* Tab 3: Lịch sử */}
        <Pressable
          style={styles.tabItem}
          onPress={() => handlePressTab(3)}
          hitSlop={{ top: 12, bottom: 12 }}
        >
          <Animated.View style={getAnimatedIconStyle(3)}>
            <ReceiptText
              size={22}
              color={activeIndex === 3 ? '#FFFFFF' : '#64748B'}
            />
          </Animated.View>
        </Pressable>

        {/* Tab 4: Cài đặt */}
        <Pressable
          style={styles.tabItem}
          onPress={() => handlePressTab(4)}
          hitSlop={{ top: 12, bottom: 12 }}
        >
          <Animated.View style={getAnimatedIconStyle(4)}>
            <Settings
              size={22}
              color={activeIndex === 4 ? '#FFFFFF' : '#64748B'}
            />
          </Animated.View>
        </Pressable>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  floatingWrapper: {
    position: 'absolute',
    left: 16,
    right: 16,
    height: BAR_HEIGHT,
    zIndex: 100,
    overflow: 'visible', // Cho phép vòng tròn nhô lên khỏi mép trên của navbar (-18px)
    ...Platform.select({
      ios: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.35,
        shadowRadius: 16,
      },
      android: {
        elevation: 10,
      },
    }),
  },
  activeCircle: {
    position: 'absolute',
    top: -18,
    left: 0,
    width: CIRCLE_SIZE,
    height: CIRCLE_SIZE,
    borderRadius: CIRCLE_RADIUS,
    backgroundColor: '#8B5CF6',
    zIndex: 5,
    ...Platform.select({
      ios: {
        shadowColor: '#8B5CF6',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.45,
        shadowRadius: 10,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  tabsRow: {
    flexDirection: 'row',
    height: BAR_HEIGHT,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 10,
  },
  tabItem: {
    flex: 1,
    height: BAR_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
