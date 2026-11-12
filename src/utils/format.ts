/**
 * Định dạng số tiền sang định dạng tiền tệ VND (ví dụ: 150.000 VND)
 */
export function formatVND(amount: number): string {
  if (isNaN(amount)) return '0 VND';
  const formatted = Math.abs(amount)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${formatted} VND`;
}

/**
 * Định dạng ngày giờ thân thiện cho người dùng Việt Nam
 */
export function formatDateTime(isoString: string): string {
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString;

    const hours = d.getHours().toString().padStart(2, '0');
    const minutes = d.getMinutes().toString().padStart(2, '0');
    const day = d.getDate().toString().padStart(2, '0');
    const month = (d.getMonth() + 1).toString().padStart(2, '0');
    const year = d.getFullYear();

    return `${hours}:${minutes} · ${day}/${month}/${year}`;
  } catch {
    return isoString;
  }
}

/**
 * Định dạng ngày ngắn gọn (DD/MM)
 */
export function formatShortDate(isoString: string): string {
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return '';
    const day = d.getDate().toString().padStart(2, '0');
    const month = (d.getMonth() + 1).toString().padStart(2, '0');
    return `${day}/${month}`;
  } catch {
    return '';
  }
}
