const GENDER_MAP: Record<string, string> = {
  masculino: "Masculino",
  male: "Masculino",
  m: "Masculino",
  hombre: "Masculino",
  femenino: "Femenino",
  female: "Femenino",
  f: "Femenino",
  mujer: "Femenino",
  "no binario": "No binario",
  nonbinary: "No binario",
  "prefiero no decir": "Prefiero no decir",
};

const MARITAL_STATUS_MAP: Record<string, string> = {
  soltero: "Soltero/a",
  soltera: "Soltero/a",
  single: "Soltero/a",
  casado: "Casado/a",
  casada: "Casado/a",
  married: "Casado/a",
  divorciado: "Divorciado/a",
  divorciada: "Divorciado/a",
  divorced: "Divorciado/a",
  viudo: "Viudo/a",
  viuda: "Viudo/a",
  widowed: "Viudo/a",
};

const DOCUMENT_TYPE_MAP: Record<string, string> = {
  dni: "DNI",
  "documento nacional de identidad": "DNI",
  pasaporte: "Pasaporte",
  passport: "Pasaporte",
  ci: "CI",
  "cedula de identidad": "CI",
  otro: "Otro",
  other: "Otro",
};

export function normalizeGender(value?: string | null): string | null {
  if (!value?.trim()) return null;
  return GENDER_MAP[value.trim().toLowerCase()] || value.trim();
}

export function normalizeMaritalStatus(value?: string | null): string | null {
  if (!value?.trim()) return null;
  return MARITAL_STATUS_MAP[value.trim().toLowerCase()] || value.trim();
}

export function normalizeDocumentType(value?: string | null): string | null {
  if (!value?.trim()) return null;
  return DOCUMENT_TYPE_MAP[value.trim().toLowerCase()] || value.trim();
}

export function normalizeBirthDate(value?: string | null): string | null {
  if (!value?.trim()) return null;

  const trimmed = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }

  const slashMatch = trimmed.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (slashMatch) {
    const day = slashMatch[1].padStart(2, "0");
    const month = slashMatch[2].padStart(2, "0");
    let year = slashMatch[3];
    if (year.length === 2) {
      year = Number(year) > 30 ? `19${year}` : `20${year}`;
    }
    return `${year}-${month}-${day}`;
  }

  const parsed = new Date(trimmed);
  if (!Number.isNaN(parsed.getTime())) {
    const year = parsed.getUTCFullYear();
    const month = String(parsed.getUTCMonth() + 1).padStart(2, "0");
    const day = String(parsed.getUTCDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  return null;
}

export function parseBirthDateToUtcDate(value?: string | Date | null): Date | null {
  if (!value) return null;

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return new Date(
      Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate())
    );
  }

  const normalized = normalizeBirthDate(value);
  if (!normalized) return null;

  const [year, month, day] = normalized.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

export function formatBirthDateFromDb(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function normalizeDocumentNumber(value?: string | null): string | null {
  if (!value?.trim()) return null;
  const digits = value.replace(/\D/g, "");
  return digits.length >= 6 ? digits : null;
}

export function splitFullName(fullName?: string | null): {
  firstName: string | null;
  lastName: string | null;
} {
  if (!fullName?.trim()) {
    return { firstName: null, lastName: null };
  }

  const parts = fullName.trim().split(/\s+/);
  return {
    firstName: parts[0] || null,
    lastName: parts.slice(1).join(" ") || null,
  };
}
