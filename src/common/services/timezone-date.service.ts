export const ARGENTINA_TIME_ZONE = "America/Argentina/Buenos_Aires";

/**
 * Devuelve una fecha ajustada a hora local Argentina para persistir en columnas
 * timestamp sin zona horaria (legacy).
 */
export function getArgentinaLocalNow(): Date {
  const now = new Date();
  const parts = getTimeZoneParts(now, ARGENTINA_TIME_ZONE);
  const getPart = (type: Intl.DateTimeFormatPartTypes): number =>
    Number(parts.find((part) => part.type === type)?.value ?? 0);

  const year = getPart("year");
  const month = getPart("month");
  const day = getPart("day");
  const hour = getPart("hour");
  const minute = getPart("minute");
  const second = getPart("second");

  return new Date(Date.UTC(year, month - 1, day, hour, minute, second, now.getMilliseconds()));
}

function getTimeZoneParts(date: Date, timeZone: string): Intl.DateTimeFormatPart[] {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
}

/**
 * Formatea un instante absoluto como "YYYYMMDDTHHMMSS" en la zona horaria dada.
 * Útil para DTSTART/DTEND con TZID en archivos .ics.
 */
export function formatDateInTimeZone(
  date: Date,
  timeZone: string = ARGENTINA_TIME_ZONE
): string {
  const parts = getTimeZoneParts(date, timeZone);
  const get = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((part) => part.type === type)?.value ?? "00";

  return `${get("year")}${get("month")}${get("day")}T${get("hour")}${get("minute")}${get("second")}`;
}

/**
 * Formatea fecha/hora para mensajes al usuario en hora Argentina.
 */
export function formatArgentinaDateTime(date: Date): string {
  return date.toLocaleString("es-AR", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: ARGENTINA_TIME_ZONE,
  });
}
