/**
 * Normaliza DATABASE_URL para Supabase / PostgreSQL en entornos serverless.
 */
export function normalizeDatabaseUrl(rawUrl?: string | null): string | null {
  if (!rawUrl?.trim()) {
    return null;
  }

  let url = rawUrl.trim();

  try {
    const normalized = url.replace(/^postgresql:\/\//, "https://");
    const parsed = new URL(normalized);
    const params = parsed.searchParams;
    const host = parsed.hostname.toLowerCase();
    const isSupabase = host.includes("supabase.com") || host.includes("supabase.co");

    if (isSupabase || !params.has("sslmode")) {
      params.set("sslmode", "require");
    }

    if (parsed.port === "6543" && !params.has("pgbouncer")) {
      params.set("pgbouncer", "true");
    }

    if (!params.has("connect_timeout")) {
      params.set("connect_timeout", "30");
    }

    if (!params.has("pool_timeout")) {
      params.set("pool_timeout", "30");
    }

  const query = params.toString();
    const auth =
      parsed.username || parsed.password
        ? `${decodeURIComponent(parsed.username)}:${decodeURIComponent(parsed.password)}@`
        : "";
    const port = parsed.port ? `:${parsed.port}` : "";
    const path = parsed.pathname || "/postgres";

    url = `postgresql://${auth}${parsed.hostname}${port}${path}${
      query ? `?${query}` : ""
    }`;
  } catch {
    if (!url.includes("sslmode=")) {
      url += url.includes("?") ? "&sslmode=require" : "?sslmode=require";
    }
  }

  return url;
}
