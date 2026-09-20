/**
 * Restaurant Business Hours & Shift Utilities
 * 
 * Working hours: 2:00 PM to 2:00 AM
 * Operational shift buffer: 1:00 PM (13:00) to 3:00 AM (next morning)
 */

export const SHIFT_HOURS = {
  startHour: 13, // 1:00 PM
  endHour: 3,   // 3:00 AM next day
};

/**
 * Returns the current active business date string in YYYY-MM-DD format.
 * If current time is between midnight and 12:59 PM (e.g. 1:30 AM during night shift),
 * the active shift belongs to the previous calendar day.
 */
export function getCurrentBusinessDate(now: Date = new Date()): string {
  const d = new Date(now);
  if (d.getHours() < SHIFT_HOURS.startHour) {
    d.setDate(d.getDate() - 1);
  }
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * Given a business date string (YYYY-MM-DD), returns the start and end Date objects
 * for that 1-day shift: from 1:00 PM on dateStr to 3:00 AM the following morning.
 */
export function getBusinessDayRange(dateStr: string): { start: Date; end: Date } {
  const [year, month, day] = dateStr.split("-").map(Number);
  const start = new Date(year, month - 1, day, 13, 0, 0, 0); // 1:00 PM
  const end = new Date(year, month - 1, day + 1, 3, 0, 0, 0); // 3:00 AM next morning
  return { start, end };
}

/**
 * Maps an order's createdAt timestamp to its corresponding business date string (YYYY-MM-DD).
 * Any order placed before 1:00 PM (e.g. 12 AM - 3 AM) is credited to yesterday's shift.
 */
export function getBusinessDateForOrder(createdAt: string | number | Date): string {
  const d = new Date(createdAt);
  if (d.getHours() < SHIFT_HOURS.startHour) {
    d.setDate(d.getDate() - 1);
  }
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * Chronological sequence of operational hours for the revenue chart:
 * From 1:00 PM to 3:00 AM (15 operational hours)
 */
export const SHIFT_HOUR_SEQUENCE = [13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 0, 1, 2, 3];

export function formatHourLabel(h: number): string {
  if (h === 0) return "12 AM";
  if (h === 12) return "12 PM";
  if (h > 12) return `${h - 12} PM`;
  return `${h} AM`;
}
