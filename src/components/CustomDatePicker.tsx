import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Pressable,
  Dimensions,
  Platform,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
  runOnJS,
} from 'react-native-reanimated';
import {
  ChevronLeft,
  ChevronRight,
  X,
  Calendar as CalendarIcon,
  Check,
  ChevronDown,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

export type DatePickerMode = 'DATE' | 'MONTH' | 'DAY_OF_MONTH';

export interface MonthYearValue {
  year: number;
  month: number; // 0 - 11
}

export interface CustomDatePickerProps {
  visible: boolean;
  onClose: () => void;
  mode?: DatePickerMode;
  /**
   * For mode === 'DATE': Date object or YYYY-MM-DD string
   * For mode === 'MONTH': { year: number, month: number } or Date object
   * For mode === 'DAY_OF_MONTH': number (1 - 31)
   */
  value?: Date | string | number | MonthYearValue;
  onConfirm: (val: any) => void;
  title?: string;
  markedDates?: string[]; // Array of 'YYYY-MM-DD' with transactions
}

const WEEKDAYS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
const MONTH_NAMES = [
  'Tháng 1',
  'Tháng 2',
  'Tháng 3',
  'Tháng 4',
  'Tháng 5',
  'Tháng 6',
  'Tháng 7',
  'Tháng 8',
  'Tháng 9',
  'Tháng 10',
  'Tháng 11',
  'Tháng 12',
];

const pad = (n: number) => n.toString().padStart(2, '0');

const triggerHaptic = () => {
  try {
    Haptics.selectionAsync();
  } catch {
    // Ignore on unsupported devices
  }
};

export const CustomDatePicker: React.FC<CustomDatePickerProps> = ({
  visible,
  onClose,
  mode = 'DATE',
  value,
  onConfirm,
  title,
  markedDates = [],
}) => {
  // Parsing initial selected values
  const today = useMemo(() => new Date(), []);

  // Internal state for DATE mode
  const [selectedDate, setSelectedDate] = useState<Date>(() => {
    if (value instanceof Date) return value;
    if (typeof value === 'string') {
      const parsed = new Date(value);
      return isNaN(parsed.getTime()) ? new Date() : parsed;
    }
    return new Date();
  });

  // Internal state for navigation (Month / Year)
  const [viewYear, setViewYear] = useState<number>(() => {
    if (value instanceof Date) return value.getFullYear();
    if (typeof value === 'object' && value && 'year' in value) return value.year;
    if (typeof value === 'string') {
      const parsed = new Date(value);
      if (!isNaN(parsed.getTime())) return parsed.getFullYear();
    }
    return new Date().getFullYear();
  });

  const [viewMonth, setViewMonth] = useState<number>(() => {
    if (value instanceof Date) return value.getMonth();
    if (typeof value === 'object' && value && 'month' in value) return value.month;
    if (typeof value === 'string') {
      const parsed = new Date(value);
      if (!isNaN(parsed.getTime())) return parsed.getMonth();
    }
    return new Date().getMonth();
  });

  // Internal state for DAY_OF_MONTH mode
  const [selectedDayOfMonth, setSelectedDayOfMonth] = useState<number>(() => {
    if (typeof value === 'number' && value >= 1 && value <= 31) return value;
    return new Date().getDate();
  });

  // Internal state for Quick Month/Year selector popup
  const [isMonthYearPopupOpen, setIsMonthYearPopupOpen] = useState<boolean>(false);
  const [popupYear, setPopupYear] = useState<number>(viewYear);

  // Sync internal state when modal becomes visible or value prop changes
  useEffect(() => {
    if (visible) {
      setIsMonthYearPopupOpen(false);
      if (mode === 'DATE') {
        const d =
          value instanceof Date
            ? value
            : typeof value === 'string'
            ? new Date(value)
            : new Date();
        const validDate = isNaN(d.getTime()) ? new Date() : d;
        setSelectedDate(validDate);
        setViewYear(validDate.getFullYear());
        setViewMonth(validDate.getMonth());
      } else if (mode === 'MONTH') {
        if (typeof value === 'object' && value && 'year' in value && 'month' in value) {
          setViewYear(value.year);
          setViewMonth(value.month);
        } else if (value instanceof Date) {
          setViewYear(value.getFullYear());
          setViewMonth(value.getMonth());
        } else {
          setViewYear(new Date().getFullYear());
          setViewMonth(new Date().getMonth());
        }
      } else if (mode === 'DAY_OF_MONTH') {
        if (typeof value === 'number' && value >= 1 && value <= 31) {
          setSelectedDayOfMonth(value);
        }
      }
    }
  }, [visible, value, mode]);

  // Marked dates set for fast lookup
  const markedSet = useMemo(() => new Set(markedDates), [markedDates]);

  // Navigation handlers
  const handlePrevMonth = () => {
    triggerHaptic();
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    triggerHaptic();
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  const handlePrevYear = () => {
    triggerHaptic();
    setViewYear((y) => y - 1);
  };

  const handleNextYear = () => {
    triggerHaptic();
    setViewYear((y) => y + 1);
  };

  // Quick preset handlers (DATE mode)
  const handleSelectPreset = (offsetDays: number) => {
    triggerHaptic();
    const d = new Date();
    d.setDate(d.getDate() - offsetDays);
    onConfirm(d);
    onClose();
  };

  // Date selection in calendar grid
  const handleDayPress = (year: number, month: number, day: number) => {
    triggerHaptic();
    const newDate = new Date(year, month, day);
    setSelectedDate(newDate);
    // If selecting a day in previous/next month, update view
    if (month !== viewMonth || year !== viewYear) {
      setViewMonth(month);
      setViewYear(year);
    }
  };

  // Month selection in MONTH mode
  const handleMonthPress = (monthIdx: number) => {
    triggerHaptic();
    setViewMonth(monthIdx);
    onConfirm({ year: viewYear, month: monthIdx });
    onClose();
  };

  // Day of month selection in DAY_OF_MONTH mode
  const handleDayOfMonthPress = (day: number) => {
    triggerHaptic();
    setSelectedDayOfMonth(day);
    onConfirm(day);
    onClose();
  };

  // Confirm button handler for DATE mode
  const handleConfirmDate = () => {
    triggerHaptic();
    onConfirm(selectedDate);
    onClose();
  };

  // Grid calculation for DATE mode (Monday - Sunday)
  const calendarDays = useMemo(() => {
    const firstDay = new Date(viewYear, viewMonth, 1);
    // JS getDay(): 0 is Sun, 1 is Mon... convert so Mon is 0, Sun is 6
    const firstDayOfWeek = (firstDay.getDay() + 6) % 7;
    const daysInCurrentMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const daysInPrevMonth = new Date(viewYear, viewMonth, 0).getDate();

    const days: {
      day: number;
      month: number;
      year: number;
      isCurrentMonth: boolean;
      dateKey: string;
    }[] = [];

    // 1. Days from previous month
    for (let i = firstDayOfWeek - 1; i >= 0; i--) {
      const d = daysInPrevMonth - i;
      const m = viewMonth === 0 ? 11 : viewMonth - 1;
      const y = viewMonth === 0 ? viewYear - 1 : viewYear;
      days.push({
        day: d,
        month: m,
        year: y,
        isCurrentMonth: false,
        dateKey: `${y}-${pad(m + 1)}-${pad(d)}`,
      });
    }

    // 2. Days from current month
    for (let d = 1; d <= daysInCurrentMonth; d++) {
      days.push({
        day: d,
        month: viewMonth,
        year: viewYear,
        isCurrentMonth: true,
        dateKey: `${viewYear}-${pad(viewMonth + 1)}-${pad(d)}`,
      });
    }

    // 3. Days from next month to complete rows (Cố định chuẩn 42 ô = 6 hàng x 7 ngày để không lệch chiều cao)
    const totalCells = 42;
    const remaining = totalCells - days.length;
    for (let d = 1; d <= remaining; d++) {
      const m = viewMonth === 11 ? 0 : viewMonth + 1;
      const y = viewMonth === 11 ? viewYear + 1 : viewYear;
      days.push({
        day: d,
        month: m,
        year: y,
        isCurrentMonth: false,
        dateKey: `${y}-${pad(m + 1)}-${pad(d)}`,
      });
    }

    return days;
  }, [viewYear, viewMonth]);

  const defaultTitle =
    title ||
    (mode === 'DATE'
      ? 'Chọn ngày giao dịch'
      : mode === 'MONTH'
      ? 'Chọn tháng thống kê'
      : 'Chọn ngày trong tháng');

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />

        <View style={styles.bottomSheet}>
          {/* Top Sheet Drag Handle */}
          <View style={styles.dragHandle} />

          {/* Sheet Header */}
          <View style={styles.sheetHeader}>
            <View style={styles.headerLeft}>
              <View style={styles.headerIconContainer}>
                <CalendarIcon size={18} color="#A855F7" />
              </View>
              <Text style={styles.sheetTitle}>{defaultTitle}</Text>
            </View>

            <TouchableOpacity
              style={styles.closeBtn}
              onPress={onClose}
              activeOpacity={0.7}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <X size={18} color="#94A3B8" />
            </TouchableOpacity>
          </View>

          {/* ============================================================= */}
          {/* 1. MODE: DATE (Chọn ngày chi tiết)                           */}
          {/* ============================================================= */}
          {mode === 'DATE' && (
            <View style={styles.contentBody}>
              {/* Quick Preset Chips */}
              <View style={styles.presetsRow}>
                <TouchableOpacity
                  style={styles.presetChip}
                  onPress={() => handleSelectPreset(0)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.presetChipText}>Hôm nay</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.presetChip}
                  onPress={() => handleSelectPreset(1)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.presetChipText}>Hôm qua</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.presetChip}
                  onPress={() => handleSelectPreset(2)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.presetChipText}>Hôm kia</Text>
                </TouchableOpacity>
              </View>

              {/* Month & Year Navigation Header (Bấm vào Tháng/Năm để mở popup chọn nhanh) */}
              <View style={styles.monthNavRow}>
                <TouchableOpacity
                  style={styles.navArrowBtn}
                  onPress={handlePrevMonth}
                  activeOpacity={0.7}
                >
                  <ChevronLeft size={20} color="#CBD5E1" />
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.navMonthYearBtn}
                  onPress={() => {
                    triggerHaptic();
                    setPopupYear(viewYear);
                    setIsMonthYearPopupOpen(true);
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={styles.navMonthYearText}>
                    {MONTH_NAMES[viewMonth]}, {viewYear}
                  </Text>
                  <ChevronDown size={14} color="#A855F7" style={{ marginLeft: 5 }} />
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.navArrowBtn}
                  onPress={handleNextMonth}
                  activeOpacity={0.7}
                >
                  <ChevronRight size={20} color="#CBD5E1" />
                </TouchableOpacity>
              </View>

              {/* Weekday Labels (T2 -> CN) */}
              <View style={styles.weekdayRow}>
                {WEEKDAYS.map((w, idx) => (
                  <Text
                    key={w}
                    style={[
                      styles.weekdayLabel,
                      idx === 6 && styles.weekdaySunday,
                    ]}
                  >
                    {w}
                  </Text>
                ))}
              </View>

              {/* 7-column Calendar Days Grid */}
              <View style={styles.daysGrid}>
                {calendarDays.map((item) => {
                  const isSelected =
                    selectedDate.getFullYear() === item.year &&
                    selectedDate.getMonth() === item.month &&
                    selectedDate.getDate() === item.day;

                  const isToday =
                    today.getFullYear() === item.year &&
                    today.getMonth() === item.month &&
                    today.getDate() === item.day;

                  const hasMark = markedSet.has(item.dateKey);

                  return (
                    <TouchableOpacity
                      key={item.dateKey}
                      style={[
                        styles.dayCell,
                        isSelected && styles.dayCellSelected,
                        !isSelected && isToday && styles.dayCellToday,
                      ]}
                      onPress={() => handleDayPress(item.year, item.month, item.day)}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[
                          styles.dayText,
                          !item.isCurrentMonth && styles.dayTextDimmed,
                          isSelected && styles.dayTextSelected,
                        ]}
                      >
                        {item.day}
                      </Text>

                      {/* Dot indicators: Today or Marked transaction */}
                      {isSelected ? null : hasMark ? (
                        <View style={styles.markedDot} />
                      ) : isToday ? (
                        <View style={styles.todayDot} />
                      ) : null}
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Confirm Button */}
              <TouchableOpacity
                style={styles.confirmBtn}
                onPress={handleConfirmDate}
                activeOpacity={0.8}
              >
                <Check size={18} color="#FFFFFF" strokeWidth={2.5} style={{ marginRight: 6 }} />
                <Text style={styles.confirmBtnText}>
                  Chọn ngày {pad(selectedDate.getDate())}/{pad(selectedDate.getMonth() + 1)}/{selectedDate.getFullYear()}
                </Text>
              </TouchableOpacity>

              {/* Popup Chọn Nhanh Tháng & Năm (Thay thế nhảy tháng thủ công) */}
              {isMonthYearPopupOpen && (
                <View style={styles.monthYearPopupOverlay}>
                  <View style={styles.monthYearPopupCard}>
                    {/* Header: Chuyển năm và nút đóng */}
                    <View style={styles.popupHeader}>
                      <View style={styles.popupYearNav}>
                        <TouchableOpacity
                          style={styles.popupNavArrowBtn}
                          onPress={() => {
                            triggerHaptic();
                            setPopupYear((y) => y - 1);
                          }}
                          activeOpacity={0.7}
                        >
                          <ChevronLeft size={18} color="#CBD5E1" />
                        </TouchableOpacity>

                        <Text style={styles.popupYearText}>Năm {popupYear}</Text>

                        <TouchableOpacity
                          style={styles.popupNavArrowBtn}
                          onPress={() => {
                            triggerHaptic();
                            setPopupYear((y) => y + 1);
                          }}
                          activeOpacity={0.7}
                        >
                          <ChevronRight size={18} color="#CBD5E1" />
                        </TouchableOpacity>
                      </View>

                      <TouchableOpacity
                        style={styles.popupCloseBtn}
                        onPress={() => {
                          triggerHaptic();
                          setIsMonthYearPopupOpen(false);
                        }}
                        activeOpacity={0.7}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <X size={16} color="#94A3B8" />
                      </TouchableOpacity>
                    </View>

                    {/* Lưới 12 tháng */}
                    <View style={styles.popupMonthsGrid}>
                      {MONTH_NAMES.map((name, idx) => {
                        const isSelected = popupYear === viewYear && viewMonth === idx;
                        const isCurrentMonth =
                          today.getFullYear() === popupYear && today.getMonth() === idx;

                        return (
                          <TouchableOpacity
                            key={`popup-month-${idx}`}
                            style={[
                              styles.popupMonthCell,
                              isSelected && styles.popupMonthCellSelected,
                              !isSelected && isCurrentMonth && styles.popupMonthCellCurrent,
                            ]}
                            onPress={() => {
                              triggerHaptic();
                              setViewYear(popupYear);
                              setViewMonth(idx);
                              setIsMonthYearPopupOpen(false);
                            }}
                            activeOpacity={0.7}
                          >
                            <Text
                              style={[
                                styles.popupMonthText,
                                isSelected && styles.popupMonthTextSelected,
                              ]}
                            >
                              {name}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                </View>
              )}
            </View>
          )}

          {/* ============================================================= */}
          {/* 2. MODE: MONTH (Chọn Tháng / Năm thống kê)                    */}
          {/* ============================================================= */}
          {mode === 'MONTH' && (
            <View style={styles.contentBody}>
              {/* Year Navigation Header */}
              <View style={styles.monthNavRow}>
                <TouchableOpacity
                  style={styles.navArrowBtn}
                  onPress={handlePrevYear}
                  activeOpacity={0.7}
                >
                  <ChevronLeft size={20} color="#CBD5E1" />
                </TouchableOpacity>

                <Text style={styles.navMonthYearText}>Năm {viewYear}</Text>

                <TouchableOpacity
                  style={styles.navArrowBtn}
                  onPress={handleNextYear}
                  activeOpacity={0.7}
                >
                  <ChevronRight size={20} color="#CBD5E1" />
                </TouchableOpacity>
              </View>

              {/* 12 Months Grid (3 x 4) */}
              <View style={styles.monthsGrid}>
                {MONTH_NAMES.map((name, idx) => {
                  const isSelected = viewMonth === idx;
                  const isCurrentMonth =
                    today.getFullYear() === viewYear && today.getMonth() === idx;

                  return (
                    <TouchableOpacity
                      key={name}
                      style={[
                        styles.monthCell,
                        isSelected && styles.monthCellSelected,
                        !isSelected && isCurrentMonth && styles.monthCellCurrent,
                      ]}
                      onPress={() => handleMonthPress(idx)}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[
                          styles.monthCellText,
                          isSelected && styles.monthCellTextSelected,
                        ]}
                      >
                        {name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}

          {/* ============================================================= */}
          {/* 3. MODE: DAY_OF_MONTH (Chọn ngày 1 - 31)                      */}
          {/* ============================================================= */}
          {mode === 'DAY_OF_MONTH' && (
            <View style={styles.contentBody}>
              <Text style={styles.dayOfMonthSubtitle}>
                Chạm để chọn ngày trong tháng (thường là ngày 1 - 31)
              </Text>

              <View style={styles.dayOfMonthGrid}>
                {Array.from({ length: 31 }).map((_, idx) => {
                  const d = idx + 1;
                  const isSelected = selectedDayOfMonth === d;

                  return (
                    <TouchableOpacity
                      key={`day-${d}`}
                      style={[
                        styles.dayOfMonthCell,
                        isSelected && styles.dayOfMonthCellSelected,
                      ]}
                      onPress={() => handleDayOfMonthPress(d)}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[
                          styles.dayOfMonthText,
                          isSelected && styles.dayOfMonthTextSelected,
                        ]}
                      >
                        {d}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
  },
  bottomSheet: {
    backgroundColor: '#12141F',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
  },
  dragHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignSelf: 'center',
    marginBottom: 14,
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: 'rgba(139, 92, 246, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  sheetTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  contentBody: {
    paddingBottom: 4,
    position: 'relative',
    minHeight: 416,
  },

  // Quick Presets
  presetsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  presetChip: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: '#1A1D2B',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  presetChipText: {
    fontSize: 12,
    color: '#CBD5E1',
    fontWeight: '600',
  },

  // Month & Year Nav
  monthNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
    paddingHorizontal: 2,
  },
  navArrowBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: '#1A1D2B',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  navMonthYearBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: '#1A1D2B',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  navMonthYearText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#F8FAFC',
  },

  // Weekday row
  weekdayRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  weekdayLabel: {
    flex: 1,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  weekdaySunday: {
    color: '#F43F5E',
  },

  // Calendar Days Grid (Cố định chuẩn 6 hàng = 264px để khi đổi tháng không bị lệch)
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    height: 264,
    marginBottom: 16,
  },
  dayCell: {
    width: `${100 / 7}%`,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    borderRadius: 12,
    marginVertical: 2,
  },
  dayCellSelected: {
    backgroundColor: '#8B5CF6',
  },
  dayCellToday: {
    borderWidth: 1,
    borderColor: 'rgba(168, 85, 247, 0.5)',
  },
  dayText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#F8FAFC',
  },
  dayTextDimmed: {
    color: '#64748B',
    opacity: 0.35,
  },
  dayTextSelected: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  todayDot: {
    position: 'absolute',
    bottom: 4,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#C084FC',
  },
  markedDot: {
    position: 'absolute',
    bottom: 4,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#F59E0B',
  },

  // Confirm Button
  confirmBtn: {
    flexDirection: 'row',
    height: 46,
    borderRadius: 14,
    backgroundColor: '#8B5CF6',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 4,
  },
  confirmBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  // Mode MONTH Grid
  monthsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  monthCell: {
    width: '31%',
    height: 48,
    borderRadius: 12,
    backgroundColor: '#1A1D2B',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  monthCellSelected: {
    backgroundColor: '#8B5CF6',
    borderColor: '#A855F7',
  },
  monthCellCurrent: {
    borderWidth: 1,
    borderColor: 'rgba(168, 85, 247, 0.5)',
  },
  monthCellText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#CBD5E1',
  },
  monthCellTextSelected: {
    color: '#FFFFFF',
    fontWeight: '700',
  },

  // Mode DAY_OF_MONTH Grid
  dayOfMonthSubtitle: {
    fontSize: 13,
    color: '#64748B',
    marginBottom: 14,
    textAlign: 'center',
  },
  dayOfMonthGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    justifyContent: 'center',
    marginBottom: 8,
  },
  dayOfMonthCell: {
    width: '12.5%',
    height: 40,
    borderRadius: 10,
    backgroundColor: '#1A1D2B',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dayOfMonthCellSelected: {
    backgroundColor: '#8B5CF6',
    borderColor: '#A855F7',
  },
  dayOfMonthText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#CBD5E1',
  },
  dayOfMonthTextSelected: {
    color: '#FFFFFF',
    fontWeight: '700',
  },

  // Quick Month/Year Selector Overlay Styles
  monthYearPopupOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(10, 12, 20, 0.94)',
    borderRadius: 18,
    zIndex: 99,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 8,
  },
  monthYearPopupCard: {
    width: '100%',
    backgroundColor: '#161926',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    padding: 14,
  },
  popupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  popupYearNav: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  popupNavArrowBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#1A1D2B',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  popupYearText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#F8FAFC',
    minWidth: 80,
    textAlign: 'center',
  },
  popupCloseBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  popupMonthsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  popupMonthCell: {
    width: '31%',
    height: 44,
    borderRadius: 10,
    backgroundColor: '#1A1D2B',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  popupMonthCellSelected: {
    backgroundColor: '#8B5CF6',
    borderColor: '#A855F7',
  },
  popupMonthCellCurrent: {
    borderWidth: 1,
    borderColor: 'rgba(168, 85, 247, 0.5)',
  },
  popupMonthText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#CBD5E1',
  },
  popupMonthTextSelected: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
});
