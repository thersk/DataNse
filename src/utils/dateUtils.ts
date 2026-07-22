/**
 * Date and trading day calculation utilities
 */

/**
 * Returns current Date adjusted to Indian Standard Time (IST, UTC+5:30)
 */
export function getISTDate(): Date {
  const now = new Date();
  const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
  return new Date(utc + (330 * 60000));
}

/**
 * Checks if current IST time is after 10:30 PM (22:30 IST)
 */
export function isAfter1030PMIST(): boolean {
  const ist = getISTDate();
  const hours = ist.getHours();
  const minutes = ist.getMinutes();
  return hours > 22 || (hours === 22 && minutes >= 30);
}

/**
 * Returns default selected date string (YYYY-MM-DD) based on IST current time:
 * - If today is weekend (Sat/Sun), returns most recent Friday.
 * - If today is weekday and time is after 10:30 PM IST, returns today's date (data should be out).
 * - If today is weekday and time is before 10:30 PM IST, returns today's date as default target,
 *   or yesterday if before 10:30 PM.
 */
export function getDefaultSelectedDateStr(): string {
  const ist = getISTDate();
  
  // If weekend, move backward to Friday
  let target = new Date(ist.getTime());
  while (target.getDay() === 0 || target.getDay() === 6) {
    target.setDate(target.getDate() - 1);
  }

  // If today is a weekday but before 10:30 PM IST, today's report may not be published yet on NSE archives.
  // However, returning today's date allows auto-fetch to try today, or fallback to yesterday.
  return formatDateToInput(target);
}

export function formatDateToInput(date: Date): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function formatDateToNSE(date: Date): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${dd}-${mm}-${yyyy}`;
}

export function formatDateToReadable(date: Date): string {
  return date.toLocaleDateString("en-US", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/**
 * Calculates 'count' consecutive trading days starting on or before targetDate.
 * Skips Saturday (6) and Sunday (0).
 */
export function getTradingDays(targetDate: Date, count = 3): Date[] {
  const tradingDays: Date[] = [];
  let curr = new Date(targetDate.getTime());

  // If selected date is a Saturday or Sunday, move backward to Friday
  while (curr.getDay() === 0 || curr.getDay() === 6) {
    curr.setDate(curr.getDate() - 1);
  }

  while (tradingDays.length < count) {
    const day = curr.getDay();
    if (day !== 0 && day !== 6) {
      tradingDays.push(new Date(curr.getTime()));
    }
    curr.setDate(curr.getDate() - 1);
  }

  return tradingDays;
}

export function getDdmmyyyy(date: Date): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${dd}${mm}${yyyy}`;
}

export function getNseDownloadLink(date: Date): string {
  const ddmmyyyy = getDdmmyyyy(date);
  return `https://archives.nseindia.com/content/nsccl/fao_participant_oi_${ddmmyyyy}.csv`;
}

