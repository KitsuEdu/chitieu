/**
 * Financial Calculator Utilities
 * Safe parsing and evaluation of math expressions (+, -, ×, ÷)
 * without using eval(), rounded to integer VND.
 */

/**
 * Evaluates a mathematical expression safely using MDAS rules.
 * Supports +, -, × (*), ÷ (/) and decimal numbers.
 * Returns rounded integer VND.
 */
export function evaluateExpression(expr: string): number {
  if (!expr || expr.trim() === '') return 0;

  // Chuẩn hóa toán tử về chuẩn * và /
  const clean = expr.replace(/×/g, '*').replace(/÷/g, '/');

  // Tokenize số và toán tử
  const tokens: (number | string)[] = [];
  let currentNum = '';

  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];
    if (ch === ' ') continue;

    if (['+', '-', '*', '/'].includes(ch)) {
      if (currentNum !== '') {
        const val = parseFloat(currentNum);
        if (!isNaN(val)) tokens.push(val);
        currentNum = '';
      }
      tokens.push(ch);
    } else {
      currentNum += ch;
    }
  }

  if (currentNum !== '') {
    const val = parseFloat(currentNum);
    if (!isNaN(val)) tokens.push(val);
  }

  if (tokens.length === 0) return 0;

  // Nếu token cuối cùng là toán tử đang chờ (VD: "50000 +"), loại bỏ nó
  if (typeof tokens[tokens.length - 1] === 'string') {
    tokens.pop();
  }

  if (tokens.length === 0) return 0;

  // Lần duyệt 1: Xử lý Nhân (*) và Chia (/) trước
  const pass1: (number | string)[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (token === '*' || token === '/') {
      const prev = pass1.pop();
      const next = tokens[++i];

      if (typeof prev !== 'number' || typeof next !== 'number') {
        if (prev !== undefined) pass1.push(prev);
        continue;
      }

      const res = token === '*' ? prev * next : next !== 0 ? prev / next : 0;
      pass1.push(res);
    } else {
      pass1.push(token);
    }
  }

  // Lần duyệt 2: Xử lý Cộng (+) và Trừ (-)
  let result = typeof pass1[0] === 'number' ? pass1[0] : 0;
  for (let i = 1; i < pass1.length; i += 2) {
    const op = pass1[i];
    const next = pass1[i + 1];
    if (typeof next !== 'number') break;

    if (op === '+') {
      result += next;
    } else if (op === '-') {
      result -= next;
    }
  }

  return Math.round(result);
}

/**
 * Checks if the expression contains pending or active operators (+, -, ×, ÷)
 */
export function hasPendingOperator(expr: string): boolean {
  return /[+\-×÷*/]/.test(expr);
}

/**
 * Formats a mathematical expression with dot separators (e.g. "35000 + 15000" -> "35.000 + 15.000")
 */
export function formatExpressionWithDots(expr: string): string {
  if (!expr || expr === '0') return '0';

  const parts = expr.split(/([+\-×÷*/])/);
  return parts
    .map((part) => {
      const trimmed = part.trim();
      if (['+', '-', '×', '÷', '*', '/'].includes(trimmed)) {
        const displayOp = trimmed === '*' ? '×' : trimmed === '/' ? '÷' : trimmed;
        return ` ${displayOp} `;
      }
      if (!trimmed) return '';

      // Tách phần nguyên và phần thập phân (nếu có)
      const [intPart, decPart] = trimmed.split('.');
      const formattedInt = (intPart || '0').replace(/\B(?=(\d{3})+(?!\d))/g, '.');
      return decPart !== undefined ? `${formattedInt}.${decPart}` : formattedInt;
    })
    .join('')
    .trim();
}

/**
 * Generates smart suggestions for quick amounts.
 * - If expr evaluates to 0: [20.000, 35.000, 50.000, 100.000, 500.000]
 * - If typing digits (e.g. 45): [45.000, 450.000, 4.500.000]
 */
export function getSmartChips(expr: string): { label: string; value: number }[] {
  // Trích xuất số cuối cùng đang nhập nếu có toán tử
  const parts = expr.split(/[+\-×÷*/]/);
  const lastSegment = parts[parts.length - 1].trim();
  const num = parseInt(lastSegment, 10);

  if (!num || num <= 0) {
    return [
      { label: '20.000', value: 20000 },
      { label: '35.000', value: 35000 },
      { label: '50.000', value: 50000 },
      { label: '100.000', value: 100000 },
      { label: '500.000', value: 500000 },
    ];
  }

  if (num < 1000) {
    const v1 = num * 1000;
    const v2 = num * 10000;
    const v3 = num * 100000;
    return [
      { label: formatExpressionWithDots(v1.toString()), value: v1 },
      { label: formatExpressionWithDots(v2.toString()), value: v2 },
      { label: formatExpressionWithDots(v3.toString()), value: v3 },
    ];
  }

  // Số đã >= 1000 (VD: gõ 50000)
  return [
    { label: formatExpressionWithDots(num.toString()), value: num },
    { label: formatExpressionWithDots((num * 10).toString()), value: num * 10 },
    { label: formatExpressionWithDots((num * 100).toString()), value: num * 100 },
  ];
}

/**
 * Formats a Date object into Vietnamese format: "Thứ Năm, 12/11/2026"
 */
export function formatVietnameseDate(date: Date): string {
  const days = [
    'Chủ Nhật',
    'Thứ Hai',
    'Thứ Ba',
    'Thứ Tư',
    'Thứ Năm',
    'Thứ Sáu',
    'Thứ Bảy',
  ];
  const dayName = days[date.getDay()];
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const yyyy = date.getFullYear();
  return `${dayName}, ${dd}/${mm}/${yyyy}`;
}
