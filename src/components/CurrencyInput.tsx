import React, { useState, useEffect, useCallback, useRef } from 'react';
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
 * Format chuỗi ký tự hoặc số thành định dạng phân tách hàng nghìn bằng dấu phẩy (,)
 * Ví dụ: 1000 -> "1,000", 1500000 -> "1,500,000"
 * Trả về chuỗi rỗng nếu giá trị là 0, undefined, null để hiển thị placeholder tự nhiên
 */
export function formatCurrencyVND(val: number | string | undefined | null): string {
  if (val === undefined || val === null || val === '' || val === 0 || val === '0') {
    return '';
  }
  const str = typeof val === 'number' ? Math.round(val).toString() : val.toString();
  const digitsOnly = str.replace(/[^\d]/g, '');
  if (!digitsOnly || digitsOnly === '0') return '';
  const normalized = digitsOnly.replace(/^0+/, '');
  if (!normalized) return '';
  return normalized.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/**
 * Chuyển chuỗi định dạng (VD: "1,500,000") thành số nguyên numeric (VD: 1500000)
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
  const inputRef = useRef<any>(null);

  // Đồng bộ khi value bên ngoài thay đổi (chỉ update nếu giá trị thực sự khác nhau)
  useEffect(() => {
    if (value === undefined || value === null || value === '' || value === 0 || value === '0') {
      if (formattedText !== '') {
        setFormattedText('');
      }
      return;
    }

    const targetFormatted = formatCurrencyVND(value);
    const currentNum = parseCurrencyVND(formattedText);
    const targetNum = typeof value === 'number' ? value : parseCurrencyVND(value);

    if (targetNum !== currentNum) {
      setFormattedText(targetFormatted);
    }
  }, [value, formattedText]);

  const handleChangeText = useCallback(
    (text: string) => {
      const digitsOnly = text.replace(/[^\d]/g, '');

      // Nếu xóa hết hoặc chỉ còn số 0, đưa ô về rỗng (hiện placeholder 0, không giật số 0)
      if (!digitsOnly || digitsOnly === '0') {
        setFormattedText('');
        onChangeValue?.(0);
        onChangeFormattedText?.('');
        return;
      }

      // Xóa các số 0 thừa ở đầu nếu người dùng gõ số mới (VD: "05" -> "5")
      const normalized = digitsOnly.replace(/^0+/, '');
      if (!normalized) {
        setFormattedText('');
        onChangeValue?.(0);
        onChangeFormattedText?.('');
        return;
      }

      const nextFormatted = normalized.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
      const numericVal = parseInt(normalized, 10) || 0;

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

  const handleFocus = useCallback(
    (e: any) => {
      setIsFocused(true);
      onFocus?.(e);
    },
    [onFocus]
  );

  const handleBlur = useCallback(
    (e: any) => {
      setIsFocused(false);
      onBlur?.(e);
    },
    [onBlur]
  );

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
        ref={inputRef}
        style={[styles.input, inputStyle]}
        value={formattedText}
        onChangeText={handleChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        keyboardType="numeric"
        editable={editable}
        onFocus={handleFocus}
        onBlur={handleBlur}
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
    height: 46,
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
    fontSize: 15, // Tăng thêm 1 size theo yêu cầu
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
    fontSize: 13, // Tăng thêm 1 size
    fontWeight: '700',
    color: colors.textSecondary,
    marginLeft: 4,
  },
});
