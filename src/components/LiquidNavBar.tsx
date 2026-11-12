import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  Pressable,
  Dimensions,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  withSequence,
  Easing,
  runOnJS,
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

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const BAR_HEIGHT = 68;
const DROPLET_SIZE = 44;
const TOTAL_TABS = 5;

const triggerHaptic = () => {
  try {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  } catch {
    // Ignore haptic error on unsupported devices
  }
};

export const LiquidNavBar: React.FC<LiquidNavBarProps> = ({
  currentTab,
  onSelectTab,
  onPressPlus,
  isQuickEntryOpen,
}) => {
  const insets = useSafeAreaInsets();
  const [barWidth, setBarWidth] = useState<number>(SCREEN_WIDTH);
  const tabWidth = barWidth / TOTAL_TABS;

  // Chuyển tab name sang index 0, 1, 3, 4 (2 là nút +)
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

  const activeIndex = isQuickEntryOpen ? 2 : getIndexFromTab(currentTab);
  const prevIndexRef = useRef<number>(activeIndex);

  // 1. Shared values cho Giọt nước (Liquid Droplet)
  const dropletX = useSharedValue(
    getIndexFromTab(currentTab) * (SCREEN_WIDTH / TOTAL_TABS) +
      (SCREEN_WIDTH / TOTAL_TABS - DROPLET_SIZE) / 2
  );
  const dropletY = useSharedValue(0);
  const dropletScaleX = useSharedValue(1);
  const dropletScaleY = useSharedValue(1);

  // 2. Shared values cho Gợn sóng (Ripple)
  const rippleX = useSharedValue(0);
  const rippleScale = useSharedValue(0);
  const rippleOpacity = useSharedValue(0);

  // 3. Shared values cho Phao nổi của từng Icon (Index 0 -> 4)
  const icon0Y = useSharedValue(activeIndex === 0 ? -4 : 0);
  const icon0Scale = useSharedValue(activeIndex === 0 ? 1.15 : 1);

  const icon1Y = useSharedValue(activeIndex === 1 ? -4 : 0);
  const icon1Scale = useSharedValue(activeIndex === 1 ? 1.15 : 1);

  const icon2Y = useSharedValue(activeIndex === 2 ? -4 : 0);
  const icon2Scale = useSharedValue(activeIndex === 2 ? 1.15 : 1);

  const icon3Y = useSharedValue(activeIndex === 3 ? -4 : 0);
  const icon3Scale = useSharedValue(activeIndex === 3 ? 1.15 : 1);

  const icon4Y = useSharedValue(activeIndex === 4 ? -4 : 0);
  const icon4Scale = useSharedValue(activeIndex === 4 ? 1.15 : 1);

  const getIconValues = (idx: number) => {
    switch (idx) {
      case 0:
        return { y: icon0Y, scale: icon0Scale };
      case 1:
        return { y: icon1Y, scale: icon1Scale };
      case 2:
        return { y: icon2Y, scale: icon2Scale };
      case 3:
        return { y: icon3Y, scale: icon3Scale };
      case 4:
      default:
        return { y: icon4Y, scale: icon4Scale };
    }
  };

  // Cập nhật vị trí giọt nước khi layout thay đổi
  useEffect(() => {
    const targetX =
      activeIndex * tabWidth + (tabWidth - DROPLET_SIZE) / 2;
    dropletX.value = targetX;
  }, [barWidth]);

  // Kích hoạt chuỗi chuyển động Parabol khi activeIndex thay đổi
  const animateToTab = (newIndex: number, oldIndex: number) => {
    const targetX = newIndex * tabWidth + (tabWidth - DROPLET_SIZE) / 2;

    // A. Quỹ đạo ngang translateX
    dropletX.value = withSpring(targetX, {
      damping: 15,
      stiffness: 160,
    });

    // B. Quỹ đạo nảy Parabol dọc translateY (vồng lên không trung rồi rơi tõm xuống)
    dropletY.value = withSequence(
      withTiming(-16, { duration: 140, easing: Easing.out(Easing.quad) }),
      withSpring(0, { damping: 11, stiffness: 220 })
    );

    // C. Biến dạng giọt nước đàn hồi (bay dãn dọc -> chạm dẹt ngang -> trở lại tròn)
    dropletScaleX.value = withSequence(
      withTiming(1.15, { duration: 140 }),
      withTiming(1.2, { duration: 80 }),
      withSpring(1, { damping: 12, stiffness: 200 })
    );

    dropletScaleY.value = withSequence(
      withTiming(0.85, { duration: 140 }),
      withTiming(0.8, { duration: 80 }),
      withSpring(1, { damping: 12, stiffness: 200 })
    );

    // D. Gợn sóng mặt nước tại đích đến ngay khi giọt nước rơi trúng (~140ms)
    setTimeout(() => {
      triggerHaptic();
      rippleX.value = targetX;
      rippleScale.value = 0.5;
      rippleOpacity.value = 0.8;

      rippleScale.value = withTiming(1.6, { duration: 350 });
      rippleOpacity.value = withTiming(0, { duration: 350 });
    }, 140);

    // E. Hiệu ứng phao nổi cho icon cũ & mới
    for (let i = 0; i < TOTAL_TABS; i++) {
      const { y, scale } = getIconValues(i);
      if (i === newIndex) {
        // Icon được chọn: chìm nhẹ 4px rồi nổi nảy lên -4px
        y.value = withSequence(
          withTiming(4, { duration: 90 }),
          withSpring(-4, { damping: 10, stiffness: 200 })
        );
        scale.value = withSpring(1.15, { damping: 12, stiffness: 200 });
      } else {
        // Icon không được chọn: chìm về mặt nước bình thường
        y.value = withSpring(0, { damping: 14, stiffness: 200 });
        scale.value = withSpring(1, { damping: 14, stiffness: 200 });
      }
    }
  };

  useEffect(() => {
    if (prevIndexRef.current !== activeIndex) {
      animateToTab(activeIndex, prevIndexRef.current);
      prevIndexRef.current = activeIndex;
    }
  }, [activeIndex, barWidth]);

  // Xử lý chạm tab
  const handlePressTab = (idx: number) => {
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

  // Animated styles
  const dropletAnimatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: dropletX.value },
      { translateY: dropletY.value },
      { scaleX: dropletScaleX.value },
      { scaleY: dropletScaleY.value },
    ],
  }));

  const rippleAnimatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: rippleX.value },
      { scale: rippleScale.value },
    ],
    opacity: rippleOpacity.value,
  }));

  const icon0Style = useAnimatedStyle(() => ({
    transform: [{ translateY: icon0Y.value }, { scale: icon0Scale.value }],
  }));
  const icon1Style = useAnimatedStyle(() => ({
    transform: [{ translateY: icon1Y.value }, { scale: icon1Scale.value }],
  }));
  const icon2Style = useAnimatedStyle(() => ({
    transform: [{ translateY: icon2Y.value }, { scale: icon2Scale.value }],
  }));
  const icon3Style = useAnimatedStyle(() => ({
    transform: [{ translateY: icon3Y.value }, { scale: icon3Scale.value }],
  }));
  const icon4Style = useAnimatedStyle(() => ({
    transform: [{ translateY: icon4Y.value }, { scale: icon4Scale.value }],
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

  const bottomPadding = insets.bottom > 0 ? insets.bottom - 4 : 0;

  return (
    <View
      style={[
        styles.navBarContainer,
        {
          height: BAR_HEIGHT + bottomPadding,
          paddingBottom: bottomPadding,
        },
      ]}
      onLayout={(e) => setBarWidth(e.nativeEvent.layout.width)}
    >
      {/* 1. Gợn sóng nước lan rộng (Ripple Ring) */}
      <Animated.View
        style={[styles.rippleRing, rippleAnimatedStyle]}
        pointerEvents="none"
      />

      {/* 2. Khối Giọt nước ánh sáng (Liquid Droplet) */}
      <Animated.View
        style={[styles.liquidDroplet, dropletAnimatedStyle]}
        pointerEvents="none"
      />

      {/* 3. Lớp 5 Tabs ngang hàng phẳng lì */}
      <View style={styles.tabsRow}>
        {/* Tab 0: Tổng quan */}
        <Pressable
          style={styles.tabItem}
          onPress={() => handlePressTab(0)}
          hitSlop={{ top: 8, bottom: 8 }}
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
          hitSlop={{ top: 8, bottom: 8 }}
        >
          <Animated.View style={getAnimatedIconStyle(1)}>
            <Wallet
              size={22}
              color={activeIndex === 1 ? '#FFFFFF' : '#64748B'}
            />
          </Animated.View>
        </Pressable>

        {/* Tab 2: Nút Nhập Nhanh (+) phẳng ngang bằng mặt nước */}
        <Pressable
          style={styles.tabItem}
          onPress={() => handlePressTab(2)}
          hitSlop={{ top: 8, bottom: 8 }}
        >
          <Animated.View style={getAnimatedIconStyle(2)}>
            <Plus
              size={26}
              color={activeIndex === 2 ? '#FFFFFF' : '#94A3B8'}
              strokeWidth={2.6}
            />
          </Animated.View>
        </Pressable>

        {/* Tab 3: Lịch sử */}
        <Pressable
          style={styles.tabItem}
          onPress={() => handlePressTab(3)}
          hitSlop={{ top: 8, bottom: 8 }}
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
          hitSlop={{ top: 8, bottom: 8 }}
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
  navBarContainer: {
    height: BAR_HEIGHT,
    backgroundColor: '#12141F',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
    position: 'relative',
    overflow: 'visible', // Cho phép giọt nước nảy vòng cung lên trên mặt phẳng nước
    justifyContent: 'center',
  },
  tabsRow: {
    flexDirection: 'row',
    height: BAR_HEIGHT,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 5,
  },
  tabItem: {
    flex: 1,
    height: BAR_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
  },
  liquidDroplet: {
    position: 'absolute',
    top: (BAR_HEIGHT - DROPLET_SIZE) / 2, // 12px
    left: 0,
    width: DROPLET_SIZE,
    height: DROPLET_SIZE,
    borderRadius: DROPLET_SIZE / 2,
    backgroundColor: '#8B5CF6',
    zIndex: 2,
    // Hiệu ứng phát sáng tím điện tử (Glow)
    ...Platform.select({
      ios: {
        shadowColor: '#A855F7',
        shadowOpacity: 0.55,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 2 },
      },
      android: {
        elevation: 8,
      },
    }),
  },
  rippleRing: {
    position: 'absolute',
    top: (BAR_HEIGHT - DROPLET_SIZE) / 2,
    left: 0,
    width: DROPLET_SIZE,
    height: DROPLET_SIZE,
    borderRadius: DROPLET_SIZE / 2,
    borderWidth: 1.5,
    borderColor: 'rgba(168, 85, 247, 0.6)',
    zIndex: 1,
  },
});
