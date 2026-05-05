import { parse, isValid, format } from "date-fns";

/**
 * Parses a date string in DD/MM/YYYY or YYYY-MM-DD format.
 * Returns null if the date is invalid.
 */
export function parseRobustDate(dateStr: string | undefined | null): Date | null {
  if (!dateStr) return null;

  // Try DD/MM/YYYY
  const parsedSlash = parse(dateStr, "dd/MM/yyyy", new Date());
  if (isValid(parsedSlash)) return parsedSlash;

  // Try YYYY-MM-DD
  const parsedDash = parse(dateStr, "yyyy-MM-dd", new Date());
  if (isValid(parsedDash)) return parsedDash;

  // Try common ISO formats or native Date constructor as last resort
  const nativeDate = new Date(dateStr);
  if (isValid(nativeDate)) return nativeDate;

  return null;
}

/**
 * Formats a date to ISO (YYYY-MM-DD) for consistency.
 */
export function formatToISO(date: Date | string | null | undefined): string | null {
  if (!date) return null;
  const d = typeof date === "string" ? parseRobustDate(date) : date;
  if (!d || !isValid(d)) return null;
  return format(d, "yyyy-MM-dd");
}

/**
 * Formats a date to DD/MM/YYYY for UI/Templates.
 */
export function formatToDisplay(date: Date | string | null | undefined): string | null {
  if (!date) return null;
  const d = typeof date === "string" ? parseRobustDate(date) : date;
  if (!d || !isValid(d)) return null;
  return format(d, "dd/MM/yyyy");
}
