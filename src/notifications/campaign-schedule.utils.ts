export const DEFAULT_CAMPAIGN_TIMEZONE = "America/Argentina/Buenos_Aires";

const WEEKDAY_MAP: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

export function parseTimeHHmm(time: string): { hours: number; minutes: number } {
  const match = /^(\d{1,2}):(\d{2})$/.exec(time.trim());
  if (!match) {
    throw new Error("Formato de hora inválido. Usá HH:mm (ej: 20:00)");
  }

  const hours = Number(match[1]);
  const minutes = Number(match[2]);

  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    throw new Error("Hora fuera de rango");
  }

  return { hours, minutes };
}

function getDatePartsInTimezone(date: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    weekday: "short",
  }).formatToParts(date);

  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";

  return {
    year: parseInt(get("year"), 10),
    month: parseInt(get("month"), 10),
    day: parseInt(get("day"), 10),
    hour: parseInt(get("hour"), 10),
    minute: parseInt(get("minute"), 10),
    dayOfWeek: WEEKDAY_MAP[get("weekday")] ?? 0,
  };
}

function zonedDateTimeToUtc(
  year: number,
  month: number,
  day: number,
  hours: number,
  minutes: number,
  timezone: string
): Date {
  let guess = new Date(Date.UTC(year, month - 1, day, hours, minutes, 0, 0));

  for (let attempt = 0; attempt < 4; attempt++) {
    const parts = getDatePartsInTimezone(guess, timezone);

    const diffMinutes =
      (hours - parts.hour) * 60 +
      (minutes - parts.minute) +
      (day - parts.day) * 24 * 60;

    if (
      diffMinutes === 0 &&
      parts.year === year &&
      parts.month === month &&
      parts.day === day
    ) {
      return guess;
    }

    guess = new Date(guess.getTime() + diffMinutes * 60 * 1000);
  }

  return guess;
}

export function computeNextRecurringRunAt(
  daysOfWeek: number[],
  timeHHmm: string,
  timezone: string,
  after: Date = new Date()
): Date {
  const { hours, minutes } = parseTimeHHmm(timeHHmm);
  const uniqueDays = [...new Set(daysOfWeek)];

  if (uniqueDays.length === 0) {
    throw new Error("Seleccioná al menos un día de la semana");
  }

  for (let offset = 0; offset < 8; offset++) {
    const probe = new Date(after.getTime() + offset * 86_400_000);
    const parts = getDatePartsInTimezone(probe, timezone);

    if (!uniqueDays.includes(parts.dayOfWeek)) {
      continue;
    }

    const runAt = zonedDateTimeToUtc(
      parts.year,
      parts.month,
      parts.day,
      hours,
      minutes,
      timezone
    );

    if (runAt > after) {
      return runAt;
    }
  }

  throw new Error("No se pudo calcular la próxima ejecución");
}

export function formatScheduleSummary(
  scheduleType: "ONCE" | "RECURRING",
  scheduledAt?: Date | null,
  recurrenceDays?: number[],
  recurrenceTime?: string | null,
  timezone?: string,
  maxRuns?: number | null,
  runsCompleted?: number
): string {
  const dayLabels = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

  if (scheduleType === "ONCE" && scheduledAt) {
    return new Intl.DateTimeFormat("es-AR", {
      timeZone: timezone || DEFAULT_CAMPAIGN_TIMEZONE,
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(scheduledAt);
  }

  if (scheduleType === "RECURRING" && recurrenceDays?.length && recurrenceTime) {
    const days = [...recurrenceDays]
      .sort((a, b) => a - b)
      .map((day) => dayLabels[day] ?? String(day))
      .join(", ");
    const limitLabel =
      maxRuns != null
        ? ` (${runsCompleted ?? 0}/${maxRuns} envíos)`
        : "";
    return `Cada ${days} a las ${recurrenceTime}${limitLabel}`;
  }

  return "-";
}
