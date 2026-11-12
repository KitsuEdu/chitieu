import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  TextInput,
  Text,
  StyleSheet,
  TouchableOpacity,
  StyleProp,
  ViewStyle,
  TextStyle,
  TextInputProps,
} from 'react-native';
import { X } from 'lucide-react-native';
import { colors } from '../theme/colors';

export interface CurrencyInputProps extends Omit<TextInputProps, 'value' | 'onChangeText'> {
  value?: number | string;
  onChangeValue?: (numericValue: number) => void;
  onChangeFormattedText?: (formattedText: string) => void;
  placeholder?: string;
  suffix?: string;
  allowClear?: boolean;
  containerStyle?: StyleProp<ViewStyle>;
  inputStyle?: StyleProp<TextStyle>;
  suffixStyle?: StyleProp<TextStyle>;
}

/**
 * Format chuỗi ký tự hoặc số thành định dạng phân tách hàng nghìn bằng dấu chấm (.)
 * Ví dụ: 1000 -> "1.000", 1500000 -> "1.500.000"
 */
export function formatCurrencyVND(val: number | string | undefined | null): string {
  if (val === undefined || val === null || val === '') return '';
  const str = typeof val === 'number' ? Math.round(val).toString() : val.toString();
  const digitsOnly = str.replace(/[^\d]/g, '');
  if (!digitsOnly) return '';
  // Xóa số 0 thừa ở đầu nếu độ dài > 1 (VD: "05000" -> "5000")
  const normalized = digitsOnly.replace(/^0+(?=\d)/, '');
  return normalized.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/**
 * Chuyển chuỗi định dạng (VD: "1.500.000") thành số nguyên numeric (VD: 1500000)
 */
export function parseCurrencyVND(val: string | undefined | null): number {
  if (!val) return 0;
  const digitsOnly = val.replace(/[^\d]/g, '');
  return parseInt(digitsOnly, 10) || 0;
}

export const CurrencyInput: React.FC<CurrencyInputProps> = ({
  value,
  onChangeValue,
  onChangeFormattedText,
  placeholder = '0',
  suffix = 'VND',
  allowClear = true,
  containerStyle,
  inputStyle,
  suffixStyle,
  editable = true,
  onFocus,
  onBlur,
  ...restProps
}) => {
  const [formattedText, setFormattedText] = useState<string>(() =>
    formatCurrencyVND(value)
  );
  const [isFocused, setIsFocused] = useState<boolean>(false);

  // Đồng bộ khi value bên ngoài thay đổi
  useEffect(() => {
    const formatted = formatCurrencyVND(value);
    setFormattedText(formatted);
  }, [value]);

  const handleChangeText = useCallback(
    (text: string) => {
      const nextFormatted = formatCurrencyVND(text);
      const numericVal = parseCurrencyVND(nextFormatted);

      setFormattedText(nextFormatted);
      onChangeValue?.(numericVal);
      onChangeFormattedText?.(nextFormatted);
    },
    [onChangeValue, onChangeFormattedText]
  );

  const handleClear = useCallback(() => {
    setFormattedText('');
    onChangeValue?.(0);
    onChangeFormattedText?.('');
  }, [onChangeValue, onChangeFormattedText]);

  return (
    <View
      style={[
        styles.container,
        isFocused && styles.containerFocused,
        !editable && styles.containerDisabled,
        containerStyle,
      ]}
    >
      <TextInput
        style={[styles.input, inputStyle]}
        value={formattedText}
        onChangeText={handleChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        keyboardType="numeric"
        editable={editable}
        onFocus={(e) => {
          setIsFocused(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setIsFocused(false);
          onBlur?.(e);
        }}
        {...restProps}
      />

      {allowClear && formattedText.length > 0 && editable && (
        <TouchableOpacity
          onPress={handleClear}
          style={styles.clearBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          activeOpacity={0.7}
        >
          <X size={14} color={colors.textMuted} />
        </TouchableOpacity>
      )}

      {suffix ? (
        <Text style={[styles.suffixText, suffixStyle]}>{suffix}</Text>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
  },
  containerFocused: {
    borderColor: colors.primary,
    backgroundColor: 'rgba(139, 92, 246, 0.04)',
  },
  containerDisabled: {
    opacity: 0.5,
  },
  input: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
    paddingVertical: 0,
    minWidth: 0,
  },
  clearBtn: {
    padding: 4,
    marginRight: 4,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
  },
  suffixText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
    marginLeft: 4,
  },
});
