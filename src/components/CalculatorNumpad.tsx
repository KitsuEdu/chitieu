import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import {
  Delete,
  ChevronRight,
} from 'lucide-react-native';
import { colors } from '../theme/colors';
import { getSmartChips } from '../utils/calculator';

interface CalculatorNumpadProps {
  expression: string;
  evaluatedAmount: number;
  hasPendingOperator: boolean;
  onPressDigit: (digit: string) => void;
  onPressOperator: (op: string) => void;
  onPressBackspace: () => void;
  onPressClear: () => void;
  onPressEqual: () => void;
  onPressChip: (value: number) => void;
  onSave: () => void;
  onFocusNote?: () => void;
  onAttachImage?: () => void;
  containerStyle?: any;
  hideSaveButton?: boolean;
}

interface KeyProps {
  label?: string;
  icon?: React.ReactNode;
  isOperator?: boolean;
  isSpecial?: boolean;
  isAction?: boolean;
  customStyle?: any;
  textStyle?: any;
  onPress: () => void;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const triggerHaptic = () => {
  try {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  } catch {
    // Ignore haptic error on unsupported devices
  }
};

const CalculatorKey: React.FC<KeyProps> = ({
  label,
  icon,
  isOperator,
  isSpecial,
  isAction,
  customStyle,
  textStyle,
  onPress,
}) => {
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  const handlePressIn = () => {
    triggerHaptic();
    scale.value = withTiming(0.95, { duration: 50 });
    opacity.value = withTiming(0.85, { duration: 50 });
  };

  const handlePressOut = () => {
    scale.value = withTiming(1, { duration: 80 });
    opacity.value = withTiming(1, { duration: 80 });
  };

  return (
    <AnimatedPressable
      style={[
        styles.keyButton,
        isOperator && styles.operatorKey,
        isSpecial && styles.specialKey,
        isAction && styles.actionKey,
        customStyle,
        animatedStyle,
      ]}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={onPress}
    >
      {icon ? (
        icon
      ) : (
        <Text
          style={[
            styles.keyText,
            isOperator && styles.operatorKeyText,
            isSpecial && styles.specialKeyText,
            isAction && styles.actionKeyText,
            textStyle,
          ]}
        >
          {label}
        </Text>
      )}
    </AnimatedPressable>
  );
};

export const CalculatorNumpad: React.FC<CalculatorNumpadProps> = ({
  expression,
  evaluatedAmount,
  hasPendingOperator,
  onPressDigit,
  onPressOperator,
  onPressBackspace,
  onPressClear,
  onPressEqual,
  onPressChip,
  onSave,
  onFocusNote,
  onAttachImage,
  containerStyle,
  hideSaveButton = false,
}) => {
  const chips = getSmartChips(expression);
  const canSave = evaluatedAmount > 0;

  return (
    <View style={[styles.container, containerStyle]}>
      {/* 1. Action Bar: Nút Lưu full màn hình ngang */}
      {!hideSaveButton && (
        <View style={styles.actionBar}>
          <Pressable
            style={[
              styles.saveButton,
              canSave ? styles.saveButtonActive : styles.saveButtonDisabled,
            ]}
            onPressIn={triggerHaptic}
            onPress={onSave}
            disabled={!canSave}
          >
            <Text
              style={[
                styles.saveButtonText,
                canSave ? styles.saveButtonTextActive : styles.saveButtonTextDisabled,
              ]}
            >
              Lưu
            </Text>
          </Pressable>
        </View>
      )}

      {/* 2. Smart Suggestion Chips */}
      <View style={styles.chipsRow}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipsScroll}
        >
          {chips.map((chip, index) => (
            <Pressable
              key={`chip-${index}-${chip.value}`}
              style={styles.chipButton}
              onPressIn={triggerHaptic}
              onPress={() => onPressChip(chip.value)}
            >
              <Text style={styles.chipText}>{chip.label}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      {/* 3. Calculator Grid: 4 cột x 5 hàng */}
      <View style={styles.gridContainer}>
        {/* Hàng 1: C, ÷, ×, ⌫ */}
        <View style={styles.row}>
          <CalculatorKey
            label="C"
            isSpecial
            textStyle={{ color: '#34D399' }}
            onPress={onPressClear}
          />
          <CalculatorKey
            label="÷"
            isOperator
            textStyle={{ color: '#34D399' }}
            onPress={() => onPressOperator('÷')}
          />
          <CalculatorKey
            label="×"
            isOperator
            textStyle={{ color: '#34D399' }}
            onPress={() => onPressOperator('×')}
          />
          <CalculatorKey
            icon={<Delete size={22} color="#34D399" />}
            isOperator
            onPress={onPressBackspace}
          />
        </View>

        {/* Hàng 2: 7, 8, 9, - */}
        <View style={styles.row}>
          <CalculatorKey label="7" onPress={() => onPressDigit('7')} />
          <CalculatorKey label="8" onPress={() => onPressDigit('8')} />
          <CalculatorKey label="9" onPress={() => onPressDigit('9')} />
          <CalculatorKey
            label="-"
            isOperator
            textStyle={{ color: '#34D399' }}
            onPress={() => onPressOperator('-')}
          />
        </View>

        {/* Hàng 3: 4, 5, 6, + */}
        <View style={styles.row}>
          <CalculatorKey label="4" onPress={() => onPressDigit('4')} />
          <CalculatorKey label="5" onPress={() => onPressDigit('5')} />
          <CalculatorKey label="6" onPress={() => onPressDigit('6')} />
          <CalculatorKey
            label="+"
            isOperator
            textStyle={{ color: '#34D399' }}
            onPress={() => onPressOperator('+')}
          />
        </View>

        {/* Hàng 4 & 5 (Cols 1-3) + Nút Action 2 hàng (Col 4) */}
        <View style={styles.bottomBlockRow}>
          {/* Cột 1, 2, 3: chứa 2 hàng phím */}
          <View style={styles.threeColumnsLeft}>
            {/* Sub-row 1: 1, 2, 3 */}
            <View style={styles.subRow}>
              <CalculatorKey label="1" onPress={() => onPressDigit('1')} />
              <CalculatorKey label="2" onPress={() => onPressDigit('2')} />
              <CalculatorKey label="3" onPress={() => onPressDigit('3')} />
            </View>

            {/* Sub-row 2: 0, 000, . */}
            <View style={styles.subRow}>
              <CalculatorKey label="0" onPress={() => onPressDigit('0')} />
              <CalculatorKey label="000" onPress={() => onPressDigit('000')} />
              <CalculatorKey label="." onPress={() => onPressDigit('.')} />
            </View>
          </View>

          {/* Cột 4: Nút lớn gấp đôi (= hoặc >) */}
          <View style={styles.singleColumnRight}>
            <CalculatorKey
              isAction
              customStyle={styles.doubleHeightActionKey}
              label={hasPendingOperator ? '=' : undefined}
              icon={
                !hasPendingOperator ? (
                  <ChevronRight size={28} color="#FFFFFF" strokeWidth={2.5} />
                ) : undefined
              }
              onPress={hasPendingOperator ? onPressEqual : onSave}
            />
          </View>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#12141F',
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 20,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.07)',
  },
  actionBar: {
    width: '100%',
    marginBottom: 10,
  },
  saveButton: {
    width: '100%',
    height: 46,
    borderRadius: 23,
    justifyContent: 'center',
    alignItems: 'center',
  },
  saveButtonActive: {
    backgroundColor: '#8B5CF6',
  },
  saveButtonDisabled: {
    backgroundColor: '#1E2235',
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '700',
  },
  saveButtonTextActive: {
    color: '#FFFFFF',
  },
  saveButtonTextDisabled: {
    color: '#64748B',
  },
  chipsRow: {
    marginBottom: 12,
  },
  chipsScroll: {
    gap: 8,
    paddingRight: 10,
  },
  chipButton: {
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 18,
    backgroundColor: '#1A1D2C',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.07)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#E2E8F0',
  },
  gridContainer: {
    gap: 8,
  },
  row: {
    flexDirection: 'row',
    gap: 8,
  },
  subRow: {
    flexDirection: 'row',
    gap: 8,
  },
  bottomBlockRow: {
    flexDirection: 'row',
    gap: 8,
  },
  threeColumnsLeft: {
    flex: 3,
    gap: 8,
  },
  singleColumnRight: {
    flex: 1,
  },
  keyButton: {
    flex: 1,
    height: 50,
    backgroundColor: '#1A1D2C',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.04)',
  },
  operatorKey: {
    backgroundColor: '#161926',
  },
  specialKey: {
    backgroundColor: '#161926',
  },
  actionKey: {
    backgroundColor: '#8B5CF6',
  },
  doubleHeightActionKey: {
    height: 108, // 50 * 2 + 8 gap
    borderRadius: 12,
  },
  keyText: {
    fontSize: 22,
    fontWeight: '600',
    color: '#F8FAFC',
  },
  operatorKeyText: {
    fontSize: 24,
    color: '#34D399',
  },
  specialKeyText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#34D399',
  },
  actionKeyText: {
    fontSize: 26,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
