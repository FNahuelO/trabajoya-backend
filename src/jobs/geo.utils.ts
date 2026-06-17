import { GeorefService } from "../public/georef.service";

const georefService = new GeorefService();

export function haversineDistanceKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const earthRadiusKm = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusKm * c;
}

export function isRemoteJob(job: {
  workMode?: string | null;
  modalidad?: string | null;
}): boolean {
  const mode = (job.workMode || job.modalidad || "").toUpperCase();
  return mode === "REMOTO" || mode === "remoto";
}

export async function resolveJobCoordinates(job: {
  id?: string;
  latitude?: number | null;
  longitude?: number | null;
  city?: string | null;
  state?: string | null;
  location?: string | null;
  empresa?: {
    localidad?: string | null;
    ciudad?: string | null;
    provincia?: string | null;
  } | null;
}): Promise<{ lat: number; lng: number } | null> {
  if (
    typeof job.latitude === "number" &&
    typeof job.longitude === "number"
  ) {
    return { lat: job.latitude, lng: job.longitude };
  }

  let city = job.city?.trim();
  let state = job.state?.trim();

  if (!city && job.location) {
    const parts = job.location.split(",").map((part) => part.trim());
    city = parts[0] || undefined;
    state = parts[1] || state;
  }

  if (!city && job.empresa) {
    city = job.empresa.localidad?.trim() || job.empresa.ciudad?.trim();
    state = job.empresa.provincia?.trim() || state;
  }

  return georefService.geocodeLocality(city, state);
}

export async function enrichJobDataWithCoordinates<T extends Record<string, any>>(
  jobData: T
): Promise<T & { latitude?: number; longitude?: number }> {
  if (jobData.latitude != null && jobData.longitude != null) {
    return jobData;
  }

  const coords = await resolveJobCoordinates(jobData);
  if (!coords) {
    return jobData;
  }

  return {
    ...jobData,
    latitude: coords.lat,
    longitude: coords.lng,
  };
}
