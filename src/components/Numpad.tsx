import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated';
import { Delete } from 'lucide-react-native';
import { colors } from '../theme/colors';

interface NumpadProps {
  onPressDigit: (digit: string) => void;
  onPressBackspace: () => void;
  onPressClear: () => void;
}

interface KeyProps {
  label?: string;
  icon?: React.ReactNode;
  isSpecial?: boolean;
  isAction?: boolean;
  onPress: () => void;
  onLongPress?: () => void;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const NumpadKey: React.FC<KeyProps> = ({
  label,
  icon,
  isSpecial,
  isAction,
  onPress,
  onLongPress,
}) => {
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  const handlePressIn = () => {
    scale.value = withTiming(0.96, { duration: 60 });
    opacity.value = withTiming(0.85, { duration: 60 });
  };

  const handlePressOut = () => {
    scale.value = withTiming(1, { duration: 100 });
    opacity.value = withTiming(1, { duration: 100 });
  };

  return (
    <AnimatedPressable
      style={[
        styles.keyButton,
        isSpecial && styles.specialKey,
        isAction && styles.actionKey,
        animatedStyle,
      ]}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={onPress}
      onLongPress={onLongPress}
    >
      {icon ? (
        icon
      ) : (
        <Text style={[styles.keyText, isSpecial && styles.specialKeyText]}>
          {label}
        </Text>
      )}
    </AnimatedPressable>
  );
};

export const Numpad: React.FC<NumpadProps> = ({
  onPressDigit,
  onPressBackspace,
  onPressClear,
}) => {
  return (
    <View style={styles.container}>
      {/* Hàng 1: 1, 2, 3 */}
      <View style={styles.row}>
        {['1', '2', '3'].map((item) => (
          <NumpadKey
            key={item}
            label={item}
            onPress={() => onPressDigit(item)}
          />
        ))}
      </View>

      {/* Hàng 2: 4, 5, 6 */}
      <View style={styles.row}>
        {['4', '5', '6'].map((item) => (
          <NumpadKey
            key={item}
            label={item}
            onPress={() => onPressDigit(item)}
          />
        ))}
      </View>

      {/* Hàng 3: 7, 8, 9 */}
      <View style={styles.row}>
        {['7', '8', '9'].map((item) => (
          <NumpadKey
            key={item}
            label={item}
            onPress={() => onPressDigit(item)}
          />
        ))}
      </View>

      {/* Hàng 4: 000, 0, Backspace */}
      <View style={styles.row}>
        <NumpadKey
          label="000"
          isSpecial
          onPress={() => onPressDigit('000')}
        />

        <NumpadKey
          label="0"
          onPress={() => onPressDigit('0')}
        />

        <NumpadKey
          isAction
          icon={<Delete size={22} color="#E2E8F0" />}
          onPress={onPressBackspace}
          onLongPress={onPressClear}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    paddingHorizontal: 4,
    gap: 8,
  },
  row: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'space-between',
  },
  keyButton: {
    flex: 1,
    height: 52,
    backgroundColor: colors.surface,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  specialKey: {
    backgroundColor: colors.surface,
  },
  actionKey: {
    backgroundColor: colors.track,
  },
  keyText: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  specialKeyText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textSecondary,
  },
});
