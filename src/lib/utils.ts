import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function parseToUTC(dateString: string | undefined | null): Date {
  if (!dateString) return new Date();
  
  // If it already has Z or + offset, new Date() handles it correctly as UTC/Offset
  // If not, we append Z to force UTC interpretation (standard for Supabase timestamps)
  const isoString = dateString.includes('Z') || dateString.includes('+') 
    ? dateString 
    : `${dateString.replace(' ', 'T')}Z`;
  
  const date = new Date(isoString);
  return isNaN(date.getTime()) ? new Date() : date;
}

/**
 * Formats a UTC date string to the user's local time.
 * Explicitly treats the input as UTC to ensure the browser performs the correct shift.
 */
export function formatToLocalTime(dateString: string | undefined | null) {
  if (!dateString) return "";
  
  try {
    const date = parseToUTC(dateString);

    // Use Intl.DateTimeFormat to explicitly convert to local time
    return new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      minute: 'numeric',
      hour12: true,
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
    }).format(date);
  } catch (error) {
    console.error("Format error:", error);
    return "Error formatting date";
  }
}

/**
 * Formats a UTC date string to the user's local time (full date).
 */
export function formatToLocalFullDate(dateString: string | undefined | null) {
  if (!dateString) return "";
  
  try {
    const date = parseToUTC(dateString);
    
    return new Intl.DateTimeFormat('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
    }).format(date);
  } catch (error) {
    return "Error";
  }
}
