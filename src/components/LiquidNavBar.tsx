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
  UserRound,
  Plus,
} from 'lucide-react-native';

export type MainTabType = 'OVERVIEW' | 'WALLETS' | 'QUICK_ENTRY' | 'HISTORY' | 'PROFILE' | 'SETTINGS';

interface LiquidNavBarProps {
  currentTab: MainTabType;
  onSelectTab: (tab: MainTabType) => void;
  onPressPlus?: () => void;
}

const AnimatedPath = Animated.createAnimatedComponent(Path);

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const BAR_HEIGHT = 64;
const CORNER_RADIUS = 22;
const BALL_SIZE = 44;
const BALL_RADIUS = BALL_SIZE / 2; // 22px
const RESTING_Y = 14; // Vị trí nghỉ: tâm quả bóng nằm lún nhẹ vào mặt bar (tạo hốc lõm 30px)
const JUMP_PEAK_Y = -28; // Đỉnh bay vồng lên không trung
const IMPACT_DENT_Y = 26; // Điểm rơi đè lún sâu nhất vào mặt bar
const NOTCH_SPREAD = 68; // Bán kính vết lõm chuông úp ngược (tổng rộng 136px)
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
}) => {
  const insets = useSafeAreaInsets();
  const [barWidth, setBarWidth] = useState<number>(SCREEN_WIDTH - 32);

  const getIndexFromTab = (tab: MainTabType): number => {
    switch (tab) {
      case 'OVERVIEW':
        return 0;
      case 'WALLETS':
        return 1;
      case 'QUICK_ENTRY':
        return 2;
      case 'HISTORY':
        return 3;
      case 'PROFILE':
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

  const activeIndex = getIndexFromTab(currentTab);
  const initialCenter = getCenterForIndex(activeIndex, barWidth);
  const prevIndexRef = useRef<number>(activeIndex);
  const isFirstMount = useRef<boolean>(true);

  // ========================================================
  // 1. Quả bóng & Vết lõm vật lý (Ball-Driven Surface Dent)
  // ========================================================
  const ballX = useSharedValue(initialCenter);
  const ballY = useSharedValue(RESTING_Y);
  const ballScaleX = useSharedValue(1);
  const ballScaleY = useSharedValue(1);

  // Độ mờ của icon tại vị trí nghỉ ở từng tab (khi active thì icon nằm trong quả bóng)
  const tab0Opacity = useSharedValue(activeIndex === 0 ? 0 : 1);
  const tab1Opacity = useSharedValue(activeIndex === 1 ? 0 : 1);
  const tab2Opacity = useSharedValue(activeIndex === 2 ? 0 : 1);
  const tab3Opacity = useSharedValue(activeIndex === 3 ? 0 : 1);
  const tab4Opacity = useSharedValue(activeIndex === 4 ? 0 : 1);

  const getTabOpacity = (idx: number) => {
    switch (idx) {
      case 0:
        return tab0Opacity;
      case 1:
        return tab1Opacity;
      case 2:
        return tab2Opacity;
      case 3:
        return tab3Opacity;
      case 4:
      default:
        return tab4Opacity;
    }
  };

  // Hàm kích hoạt hiệu ứng nảy dọc tại chỗ (Bay vồng lên -> Rơi lún sâu -> Nảy về cân bằng)
  const triggerVerticalBounce = () => {
    ballY.value = withSequence(
      withTiming(JUMP_PEAK_Y, {
        duration: 240,
        easing: Easing.out(Easing.cubic),
      }),
      withTiming(IMPACT_DENT_Y, {
        duration: 220,
        easing: Easing.in(Easing.quad),
      }),
      withTiming(RESTING_Y, {
        duration: 190,
        easing: Easing.out(Easing.back(1.2)),
      })
    );

    ballScaleX.value = withSequence(
      withTiming(0.92, { duration: 240, easing: Easing.out(Easing.cubic) }),
      withTiming(1.16, { duration: 220, easing: Easing.in(Easing.quad) }),
      withTiming(1, { duration: 190, easing: Easing.out(Easing.back(1.2)) })
    );

    ballScaleY.value = withSequence(
      withTiming(1.08, { duration: 240, easing: Easing.out(Easing.cubic) }),
      withTiming(0.84, { duration: 220, easing: Easing.in(Easing.quad) }),
      withTiming(1, { duration: 190, easing: Easing.out(Easing.back(1.2)) })
    );

    // Haptic tiếp đất khi bóng rơi lún đè vào mặt bar (t=460ms)
    setTimeout(() => {
      triggerHaptic();
    }, 460);
  };

  useEffect(() => {
    const targetX = getCenterForIndex(activeIndex, barWidth);

    if (isFirstMount.current) {
      isFirstMount.current = false;
      ballX.value = targetX;
      ballY.value = RESTING_Y;
      ballScaleX.value = 1;
      ballScaleY.value = 1;
      for (let i = 0; i < TOTAL_TABS; i++) {
        getTabOpacity(i).value = i === activeIndex ? 0 : 1;
      }
      prevIndexRef.current = activeIndex;
      return;
    }

    if (prevIndexRef.current === activeIndex) {
      // Khi thay đổi layout/width thì chỉ cập nhật vị trí ngang tĩnh
      ballX.value = targetX;
      return;
    }

    prevIndexRef.current = activeIndex;

    // ----------------------------------------------------
    // Chu kỳ vật lý Bouncing Ball Fluid Tab (Tổng ~650ms)
    // ----------------------------------------------------

    // 1. Tọa độ ngang ballX (550ms)
    ballX.value = withTiming(targetX, {
      duration: 550,
      easing: Easing.bezier(0.25, 0.1, 0.25, 1),
    });

    // 2. Tọa độ dọc & Squash Stretch
    triggerVerticalBounce();

    // 3. Mờ dần icon ở tab mới & hiện lại icon ở tab cũ
    for (let i = 0; i < TOTAL_TABS; i++) {
      getTabOpacity(i).value = withTiming(i === activeIndex ? 0 : 1, {
        duration: 220,
      });
    }
  }, [activeIndex, barWidth]);

  // Xử lý chạm tab
  const handlePressTab = (idx: number) => {
    if (idx === activeIndex) {
      // Khi ấn lại vào tab đang active -> nảy lên và rơi xuống theo đúng cơ chế vật lý
      if (idx === 2) {
        onPressPlus?.();
      }
      triggerVerticalBounce();
      return;
    }

    triggerHaptic();

    let targetTab: MainTabType = 'OVERVIEW';
    if (idx === 0) targetTab = 'OVERVIEW';
    else if (idx === 1) targetTab = 'WALLETS';
    else if (idx === 2) {
      onPressPlus?.();
      targetTab = 'QUICK_ENTRY';
    }
    else if (idx === 3) targetTab = 'HISTORY';
    else if (idx === 4) targetTab = 'PROFILE';

    onSelectTab(targetTab);
  };

  // ========================================================
  // 2. Animated Props vẽ mặt phẳng đàn hồi bị đè lún (SVG)
  // ========================================================
  const animatedPathProps = useAnimatedProps(() => {
    'worklet';
    const W = barWidth;
    const H = BAR_HEIGHT;
    const R = CORNER_RADIUS;
    const spread = NOTCH_SPREAD; // 68

    // Độ sâu phụ thuộc trực tiếp vào tọa độ ballY của quả bóng
    const rawDepth = Math.max(0, ballY.value + 16);
    const x = ballX.value;

    // Khi quả bóng bay trên không (rawDepth <= 0.5), mặt thanh bar phẳng lì hoàn toàn
    if (rawDepth <= 0.5) {
      const flatPath = `M 0 ${R} A ${R} ${R} 0 0 1 ${R} 0 L ${W - R} 0 A ${R} ${R} 0 0 1 ${W} ${R} L ${W} ${H - R} A ${R} ${R} 0 0 1 ${W - R} ${H} L ${R} ${H} A ${R} ${R} 0 0 1 0 ${H - R} Z`;
      return { d: flatPath };
    }

    const leftNotch = Math.max(R, x - spread);
    const rightNotch = Math.min(W - R, x + spread);

    // Wide Bell Curve theo đúng cấu trúc flutter-fluid-tab
    const cp1x = Math.max(leftNotch, x - spread * 0.45);
    const cp2x = x - spread * 0.40;
    const cp3x = x + spread * 0.40;
    const cp4x = Math.min(rightNotch, x + spread * 0.45);

    const pathStr = `M 0 ${R} A ${R} ${R} 0 0 1 ${R} 0 L ${leftNotch} 0 C ${cp1x} 0, ${cp2x} ${rawDepth}, ${x} ${rawDepth} C ${cp3x} ${rawDepth}, ${cp4x} 0, ${rightNotch} 0 L ${W - R} 0 A ${R} ${R} 0 0 1 ${W} ${R} L ${W} ${H - R} A ${R} ${R} 0 0 1 ${W - R} ${H} L ${R} ${H} A ${R} ${R} 0 0 1 0 ${H - R} Z`;

    return { d: pathStr };
  }, [barWidth]);

  // Đường viền mép trên tinh tế lượn sóng theo độ lún
  const animatedStrokeProps = useAnimatedProps(() => {
    'worklet';
    const W = barWidth;
    const R = CORNER_RADIUS;
    const spread = NOTCH_SPREAD;

    const rawDepth = Math.max(0, ballY.value + 16);
    const x = ballX.value;

    if (rawDepth <= 0.5) {
      const flatStroke = `M 0 ${R} A ${R} ${R} 0 0 1 ${R} 0 L ${W - R} 0 A ${R} ${R} 0 0 1 ${W} ${R}`;
      return { d: flatStroke };
    }

    const leftNotch = Math.max(R, x - spread);
    const rightNotch = Math.min(W - R, x + spread);

    const cp1x = Math.max(leftNotch, x - spread * 0.45);
    const cp2x = x - spread * 0.40;
    const cp3x = x + spread * 0.40;
    const cp4x = Math.min(rightNotch, x + spread * 0.45);

    const strokeStr = `M 0 ${R} A ${R} ${R} 0 0 1 ${R} 0 L ${leftNotch} 0 C ${cp1x} 0, ${cp2x} ${rawDepth}, ${x} ${rawDepth} C ${cp3x} ${rawDepth}, ${cp4x} 0, ${rightNotch} 0 L ${W - R} 0 A ${R} ${R} 0 0 1 ${W} ${R}`;

    return { d: strokeStr };
  }, [barWidth]);

  // ========================================================
  // 3. Animated Style cho Quả bóng nảy (Bouncing Ball)
  // ========================================================
  const ballAnimatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: ballX.value - BALL_RADIUS },
      { translateY: ballY.value - BALL_RADIUS },
      { scaleX: ballScaleX.value },
      { scaleY: ballScaleY.value },
    ],
  }));

  // Animated Styles cho độ mờ của icon tại vị trí nghỉ
  const tab0Style = useAnimatedStyle(() => ({ opacity: tab0Opacity.value }));
  const tab1Style = useAnimatedStyle(() => ({ opacity: tab1Opacity.value }));
  const tab2Style = useAnimatedStyle(() => ({ opacity: tab2Opacity.value }));
  const tab3Style = useAnimatedStyle(() => ({ opacity: tab3Opacity.value }));
  const tab4Style = useAnimatedStyle(() => ({ opacity: tab4Opacity.value }));

  // Helper render icon trắng bên trong tâm quả bóng
  const renderActiveIcon = (index: number) => {
    switch (index) {
      case 0:
        return <LayoutDashboard size={21} color="#FFFFFF" strokeWidth={2.2} />;
      case 1:
        return <Wallet size={21} color="#FFFFFF" strokeWidth={2.2} />;
      case 2:
        return <Plus size={24} color="#FFFFFF" strokeWidth={2.8} />;
      case 3:
        return <ReceiptText size={21} color="#FFFFFF" strokeWidth={2.2} />;
      case 4:
        return <UserRound size={21} color="#FFFFFF" strokeWidth={2.2} />;
      default:
        return <LayoutDashboard size={21} color="#FFFFFF" strokeWidth={2.2} />;
    }
  };

  const bottomOffset = Math.max(16, insets.bottom > 0 ? insets.bottom + 4 : 16);

  return (
    <View
      style={[styles.floatingWrapper, { bottom: bottomOffset }]}
      onLayout={(e) => setBarWidth(e.nativeEvent.layout.width)}
    >
      {/* 1. Mặt phẳng SVG biến dạng lõm theo quả bóng */}
      <Svg
        width={barWidth}
        height={BAR_HEIGHT}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      >
        <AnimatedPath
          animatedProps={animatedPathProps}
          fill="#12141F"
        />
        <AnimatedPath
          animatedProps={animatedStrokeProps}
          stroke="rgba(255, 255, 255, 0.08)"
          strokeWidth={1}
          fill="none"
        />
      </Svg>

      {/* 2. Quả bóng nảy vật lý mang theo Icon trắng của tab active */}
      <Animated.View
        style={[styles.ball, ballAnimatedStyle]}
        pointerEvents="none"
      >
        {renderActiveIcon(activeIndex)}
      </Animated.View>

      {/* 3. Lưới 5 Tabs với icon màu xám tại vị trí nghỉ */}
      <View style={[styles.tabsRow, { paddingHorizontal: SIDE_PADDING }]}>
        {/* Tab 0: Tổng quan */}
        <Pressable
          style={styles.tabItem}
          onPressIn={() => handlePressTab(0)}
          hitSlop={{ top: 12, bottom: 12 }}
        >
          <Animated.View style={tab0Style}>
            <LayoutDashboard size={22} color="#64748B" />
          </Animated.View>
        </Pressable>

        {/* Tab 1: Ví */}
        <Pressable
          style={styles.tabItem}
          onPressIn={() => handlePressTab(1)}
          hitSlop={{ top: 12, bottom: 12 }}
        >
          <Animated.View style={tab1Style}>
            <Wallet size={22} color="#64748B" />
          </Animated.View>
        </Pressable>

        {/* Tab 2: Nút Nhập Nhanh (+) */}
        <Pressable
          style={styles.tabItem}
          onPressIn={() => handlePressTab(2)}
          hitSlop={{ top: 12, bottom: 12 }}
        >
          <Animated.View style={tab2Style}>
            <Plus size={26} color="#64748B" strokeWidth={2.4} />
          </Animated.View>
        </Pressable>

        {/* Tab 3: Lịch sử */}
        <Pressable
          style={styles.tabItem}
          onPressIn={() => handlePressTab(3)}
          hitSlop={{ top: 12, bottom: 12 }}
        >
          <Animated.View style={tab3Style}>
            <ReceiptText size={22} color="#64748B" />
          </Animated.View>
        </Pressable>

        {/* Tab 4: Hồ sơ & Tiện ích */}
        <Pressable
          style={styles.tabItem}
          onPressIn={() => handlePressTab(4)}
          hitSlop={{ top: 12, bottom: 12 }}
        >
          <Animated.View style={tab4Style}>
            <UserRound size={22} color="#64748B" />
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
    overflow: 'visible',
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
  ball: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: BALL_SIZE,
    height: BALL_SIZE,
    borderRadius: BALL_RADIUS,
    backgroundColor: '#8B5CF6',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 20,
    ...Platform.select({
      ios: {
        shadowColor: '#8B5CF6',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.5,
        shadowRadius: 10,
      },
      android: {
        elevation: 10,
      },
    }),
  },
  tabsRow: {
    flexDirection: 'row',
    height: BAR_HEIGHT,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 30,
  },
  tabItem: {
    flex: 1,
    height: BAR_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
