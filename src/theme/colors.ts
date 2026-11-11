/**
 * Design System: Matte Minimalist & Subtle Accent
 * Triết lý: Đen nhám phẳng, tối giản, sang trọng, loại bỏ gradient thừa thãi.
 */
export const colors = {
  // Screen & Flat Matte Surfaces
  bg: '#090A0F',               // Đen obsidian phẳng
  surface: '#161926',          // Nền card nội dung phẳng, nhám, sang trọng
  surfaceSecondary: '#12141F', // Nền lớp phụ, bottom bar
  surfaceElevated: '#1D2132',  // Popover, input, chip
  surfaceGlass: 'rgba(255, 255, 255, 0.03)',

  // Borders (Đường viền siêu mỏng 1px tách lớp tự nhiên)
  border: 'rgba(255, 255, 255, 0.07)',
  borderLight: 'rgba(255, 255, 255, 0.12)',
  borderAccent: 'rgba(139, 92, 246, 0.3)',

  // Subtle Primary Accent (Dùng có chừng mực, tinh tế)
  primary: '#8B5CF6',          // Violet tinh giản
  primaryBright: '#A855F7',    // Electric Purple cho điểm nhấn active
  primaryLight: '#C084FC',     // Text link/action
  primarySoft: 'rgba(139, 92, 246, 0.1)',

  // Semantic (Thu / Chi) - Màu phẳng, tương phản cao, dễ đọc
  income: '#34D399',           // Mint Green
  incomeSoft: 'rgba(52, 211, 153, 0.1)',
  expense: '#F43F5E',          // Rose
  expenseSoft: 'rgba(244, 63, 94, 0.1)',

  // Warnings / Status
  warning: '#F59E0B',
  warningSoft: 'rgba(245, 158, 11, 0.1)',

  // Typography (Tuyệt đối Solid Color, sắc nét, không dùng gradient text)
  textPrimary: '#F8FAFC',      // Trắng ngọc cho số tiền, tiêu đề lớn
  textSecondary: '#94A3B8',    // Xám trung tính cho nhãn phụ, ngày tháng
  textMuted: '#64748B',        // Chú thích nhỏ, placeholder

  // Tracks & Bars
  track: '#1E2030',            // Rãnh progress bar, bar chart
  trackFill: '#8B5CF6',        // Cột chi tiêu solid
} as const;

export type ThemeColors = typeof colors;
