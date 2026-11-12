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
  withSequence,
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
// Quả bóng 48px, cách viền 1.5px mỗi bên -> NOTCH_WIDTH = 51px
const NOTCH_WIDTH = 51;
// Quả bóng nghỉ tại Y = -18, đáy bóng tại 30px -> cách đáy rãnh 1.5px -> NOTCH_DEPTH = 31.5px
const NOTCH_DEPTH_STANDARD = 31.5;
const ACTIVE_ICON_Y = -26; // 32 + (-26) = 6px -> trùng tâm với quả bóng (-18 + 24 = 6px)
const SIDE_PADDING = 14;
const TOTAL_TABS = 5;

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
  const prevIndexRef = useRef<number>(activeIndex);
  const isFirstMount = useRef<boolean>(true);

  // 1. Shared values cho Vòng tròn Active (Chất lỏng đặc)
  const circleTranslateX = useSharedValue(initialCenter);
  const circleTranslateY = useSharedValue(-18);

  // 2. Shared values cho 2 điểm biến dạng độc lập trên SVG Path
  // - Vị trí cũ (oldNotchX, oldNotchDepth): hiệu ứng kéo dính slime nhô lên (-12) rồi phẳng về (0)
  // - Vị trí mới (newNotchX, newNotchDepth): phẳng (0) -> lún sâu (46) -> đàn hồi chuẩn (34)
  const oldNotchX = useSharedValue(initialCenter);
  const oldNotchDepth = useSharedValue(0);

  const newNotchX = useSharedValue(initialCenter);
  const newNotchDepth = useSharedValue(NOTCH_DEPTH_STANDARD);

  // 3. Shared values cho vị trí nâng lên/hạ xuống của từng Icon
  const icon0Y = useSharedValue(activeIndex === 0 ? ACTIVE_ICON_Y : 0);
  const icon1Y = useSharedValue(activeIndex === 1 ? ACTIVE_ICON_Y : 0);
  const icon2Y = useSharedValue(activeIndex === 2 ? ACTIVE_ICON_Y : 0);
  const icon3Y = useSharedValue(activeIndex === 3 ? ACTIVE_ICON_Y : 0);
  const icon4Y = useSharedValue(activeIndex === 4 ? ACTIVE_ICON_Y : 0);

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

  useEffect(() => {
    const targetX = getCenterForIndex(activeIndex, barWidth);

    if (isFirstMount.current) {
      isFirstMount.current = false;
      circleTranslateX.value = targetX;
      circleTranslateY.value = -18;
      oldNotchX.value = targetX;
      oldNotchDepth.value = 0;
      newNotchX.value = targetX;
      newNotchDepth.value = NOTCH_DEPTH_STANDARD;
      for (let i = 0; i < TOTAL_TABS; i++) {
        getIconSharedValue(i).value = i === activeIndex ? ACTIVE_ICON_Y : 0;
      }
      prevIndexRef.current = activeIndex;
      return;
    }

    // Nếu vị trí không đổi thì bỏ qua
    if (prevIndexRef.current === activeIndex) {
      return;
    }

    const oldCenter = getCenterForIndex(prevIndexRef.current, barWidth);
    const oldIdx = prevIndexRef.current;
    prevIndexRef.current = activeIndex;

    // Thiết lập tọa độ 2 điểm biến dạng độc lập
    oldNotchX.value = oldCenter;
    oldNotchDepth.value = NOTCH_DEPTH_STANDARD;

    newNotchX.value = targetX;
    newNotchDepth.value = 0;

    // ==========================================
    // 1. Quỹ đạo Vòng tròn Active (Nhanh hơn ~0.5s: 280ms thay vì 750ms)
    // ==========================================
    circleTranslateX.value = withTiming(targetX, {
      duration: 280,
      easing: Easing.bezier(0.22, 1, 0.36, 1),
    });

    // Giữ quả bóng ổn định ở Y = -18 (tuyệt đối không nhảy vồng lên cao)
    circleTranslateY.value = -18;

    // ==========================================
    // 2. Viền Navbar đẩy nhô lên tại vị trí cũ & lún xuống vị trí mới
    // ==========================================
    // Vị trí CŨ: Viền đẩy nhô lên nhẹ (-5px) rồi phẳng lì về 0
    oldNotchDepth.value = withSequence(
      withTiming(-5, { duration: 120, easing: Easing.out(Easing.cubic) }),
      withTiming(0, { duration: 140, easing: Easing.inOut(Easing.quad) })
    );

    // Vị trí MỚI: Bề mặt lún xuống đón trọn quả bóng với khoảng cách chuẩn 1.5px
    newNotchDepth.value = withTiming(NOTCH_DEPTH_STANDARD, {
      duration: 280,
      easing: Easing.bezier(0.22, 1, 0.36, 1),
    });

    // ==========================================
    // 3. Icon di chuyển mượt mà (Không bị nảy/vung lên trời)
    // ==========================================
    for (let i = 0; i < TOTAL_TABS; i++) {
      const sv = getIconSharedValue(i);
      if (i === activeIndex) {
        // Icon mới: Lướt mượt lên vị trí ACTIVE_ICON_Y (-26px) trùng tâm quả bóng
        sv.value = withTiming(ACTIVE_ICON_Y, {
          duration: 260,
          easing: Easing.bezier(0.25, 0.1, 0.25, 1),
        });
      } else if (i === oldIdx) {
        // Icon cũ: Hạ mượt về 0
        sv.value = withTiming(0, {
          duration: 240,
          easing: Easing.bezier(0.25, 0.1, 0.25, 1),
        });
      } else {
        sv.value = withTiming(0, { duration: 150 });
      }
    }

    // Rung phản hồi haptics ngay khi bắt đầu chuyển tab
    triggerHaptic();

    // Sau khi kết thúc chu kỳ (300ms), đồng bộ điểm tĩnh
    setTimeout(() => {
      oldNotchX.value = targetX;
      oldNotchDepth.value = 0;
    }, 300);
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

  // Animated Props cho SVG Path của vết lõm kép độc lập
  const animatedPathProps = useAnimatedProps(() => {
    'worklet';
    const W = barWidth;
    const H = BAR_HEIGHT;
    const R = CORNER_RADIUS;
    const nw = NOTCH_WIDTH;

    const ox = oldNotchX.value;
    const od = oldNotchDepth.value;

    const nx = newNotchX.value;
    const nd = newNotchDepth.value;

    // Nếu 2 điểm trùng nhau hoặc điểm cũ đã phẳng về 0
    if (Math.abs(ox - nx) < 1 || Math.abs(od) < 0.2) {
      const x = nx;
      const d = nd;
      const leftNotch = Math.max(R, x - nw / 2);
      const rightNotch = Math.min(W - R, x + nw / 2);
      const cp1x = x - nw * 0.32;
      const cp2x = x - nw * 0.20;
      const cp3x = x + nw * 0.20;
      const cp4x = x + nw * 0.32;

      const pathStr = `M 0 ${R} A ${R} ${R} 0 0 1 ${R} 0 L ${leftNotch} 0 C ${cp1x} 0, ${cp2x} ${d}, ${x} ${d} C ${cp3x} ${d}, ${cp4x} 0, ${rightNotch} 0 L ${W - R} 0 A ${R} ${R} 0 0 1 ${W} ${R} L ${W} ${H - R} A ${R} ${R} 0 0 1 ${W - R} ${H} L ${R} ${H} A ${R} ${R} 0 0 1 0 ${H - R} Z`;
      return { d: pathStr };
    }

    // Sắp xếp 2 điểm theo trục X từ trái qua phải
    const firstX = ox < nx ? ox : nx;
    const firstDepth = ox < nx ? od : nd;

    const secondX = ox < nx ? nx : ox;
    const secondDepth = ox < nx ? nd : od;

    const left1 = Math.max(R, firstX - nw / 2);
    const right1 = firstX + nw / 2;

    const left2 = secondX - nw / 2;
    const right2 = Math.min(W - R, secondX + nw / 2);

    const midX = (firstX + secondX) / 2;
    const actualRight1 = Math.min(right1, midX);
    const actualLeft2 = Math.max(left2, midX);

    const cp1_1 = firstX - nw * 0.32;
    const cp1_2 = firstX - nw * 0.20;
    const cp1_3 = firstX + nw * 0.20;
    const cp1_4 = firstX + nw * 0.32;

    const cp2_1 = secondX - nw * 0.32;
    const cp2_2 = secondX - nw * 0.20;
    const cp2_3 = secondX + nw * 0.20;
    const cp2_4 = secondX + nw * 0.32;

    const pathStr = `M 0 ${R} A ${R} ${R} 0 0 1 ${R} 0 L ${left1} 0 C ${cp1_1} 0, ${cp1_2} ${firstDepth}, ${firstX} ${firstDepth} C ${cp1_3} ${firstDepth}, ${cp1_4} 0, ${actualRight1} 0 L ${actualLeft2} 0 C ${cp2_1} 0, ${cp2_2} ${secondDepth}, ${secondX} ${secondDepth} C ${cp2_3} ${secondDepth}, ${cp2_4} 0, ${right2} 0 L ${W - R} 0 A ${R} ${R} 0 0 1 ${W} ${R} L ${W} ${H - R} A ${R} ${R} 0 0 1 ${W - R} ${H} L ${R} ${H} A ${R} ${R} 0 0 1 0 ${H - R} Z`;

    return { d: pathStr };
  }, [barWidth]);

  // Animated Props cho viền mép trên tinh tế lượn theo bề mặt kép
  const animatedStrokeProps = useAnimatedProps(() => {
    'worklet';
    const W = barWidth;
    const R = CORNER_RADIUS;
    const nw = NOTCH_WIDTH;

    const ox = oldNotchX.value;
    const od = oldNotchDepth.value;

    const nx = newNotchX.value;
    const nd = newNotchDepth.value;

    if (Math.abs(ox - nx) < 1 || Math.abs(od) < 0.2) {
      const x = nx;
      const d = nd;
      const leftNotch = Math.max(R, x - nw / 2);
      const rightNotch = Math.min(W - R, x + nw / 2);
      const cp1x = x - nw * 0.32;
      const cp2x = x - nw * 0.20;
      const cp3x = x + nw * 0.20;
      const cp4x = x + nw * 0.32;

      const strokeStr = `M 0 ${R} A ${R} ${R} 0 0 1 ${R} 0 L ${leftNotch} 0 C ${cp1x} 0, ${cp2x} ${d}, ${x} ${d} C ${cp3x} ${d}, ${cp4x} 0, ${rightNotch} 0 L ${W - R} 0 A ${R} ${R} 0 0 1 ${W} ${R}`;
      return { d: strokeStr };
    }

    const firstX = ox < nx ? ox : nx;
    const firstDepth = ox < nx ? od : nd;

    const secondX = ox < nx ? nx : ox;
    const secondDepth = ox < nx ? nd : od;

    const left1 = Math.max(R, firstX - nw / 2);
    const right1 = firstX + nw / 2;

    const left2 = secondX - nw / 2;
    const right2 = Math.min(W - R, secondX + nw / 2);

    const midX = (firstX + secondX) / 2;
    const actualRight1 = Math.min(right1, midX);
    const actualLeft2 = Math.max(left2, midX);

    const cp1_1 = firstX - nw * 0.32;
    const cp1_2 = firstX - nw * 0.20;
    const cp1_3 = firstX + nw * 0.20;
    const cp1_4 = firstX + nw * 0.32;

    const cp2_1 = secondX - nw * 0.32;
    const cp2_2 = secondX - nw * 0.20;
    const cp2_3 = secondX + nw * 0.20;
    const cp2_4 = secondX + nw * 0.32;

    const strokeStr = `M 0 ${R} A ${R} ${R} 0 0 1 ${R} 0 L ${left1} 0 C ${cp1_1} 0, ${cp1_2} ${firstDepth}, ${firstX} ${firstDepth} C ${cp1_3} ${firstDepth}, ${cp1_4} 0, ${actualRight1} 0 L ${actualLeft2} 0 C ${cp2_1} 0, ${cp2_2} ${secondDepth}, ${secondX} ${secondDepth} C ${cp2_3} ${secondDepth}, ${cp2_4} 0, ${right2} 0 L ${W - R} 0 A ${R} ${R} 0 0 1 ${W} ${R}`;

    return { d: strokeStr };
  }, [barWidth]);

  // Vòng tròn Active tím sáng
  const circleAnimatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: circleTranslateX.value - CIRCLE_RADIUS },
      { translateY: circleTranslateY.value },
    ],
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
      {/* 1. Mặt phẳng SVG có hiệu ứng biến dạng slime kép */}
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
    overflow: 'visible', // Cho phép vòng tròn nhô lên khỏi mép trên của navbar (-36px)
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
    top: 0,
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
