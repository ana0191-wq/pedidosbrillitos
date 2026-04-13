import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Safely parse a numeric value. Strips commas, returns null for empty/NaN.
 * Never returns 0 for missing data — only returns 0 if the input is literally "0".
 */
export function parseNum(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined || value === '') return null;
  const cleaned = typeof value === 'string' ? value.replace(/,/g, '').trim() : String(value);
  if (cleaned === '') return null;
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

/**
 * Format a number as currency. Returns "—" for null/undefined/NaN.
 */
export function fmtMoney(n: number | null | undefined): string {
  if (n === null || n === undefined || isNaN(n)) return '—';
  return `$${n.toFixed(2)}`;
}
