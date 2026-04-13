const ARGENTINA_TIME_ZONE = "America/Argentina/Buenos_Aires";

/**
 * Devuelve una fecha ajustada a hora local Argentina para persistir en columnas
 * timestamp sin zona horaria (legacy).
 */
export function getArgentinaLocalNow(): Date {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: ARGENTINA_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });

  const parts = formatter.formatToParts(now);
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
