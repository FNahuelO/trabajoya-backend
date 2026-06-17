import { Injectable } from "@nestjs/common";

export interface GeoCoordinates {
  lat: number;
  lng: number;
}

interface GeorefLocality {
  id: string;
  nombre: string;
  centroide?: { lat: number; lon: number };
}

interface GeorefProvince {
  id: string;
  nombre: string;
}

@Injectable()
export class GeorefService {
  private readonly baseUrl = "https://apis.datos.gob.ar/georef/api";
  private readonly geocodeCache = new Map<string, GeoCoordinates>();

  async getProvinces(): Promise<GeorefProvince[]> {
    const response = await fetch(`${this.baseUrl}/provincias?max=30`);
    if (!response.ok) {
      throw new Error(`GeoRef provincias error: ${response.status}`);
    }
    const data = await response.json();
    return data.provincias || [];
  }

  async getLocalitiesByProvince(provinceCode: string): Promise<GeorefLocality[]> {
    const response = await fetch(
      `${this.baseUrl}/localidades?provincia=${encodeURIComponent(provinceCode)}&max=5000`
    );
    if (!response.ok) {
      throw new Error(`GeoRef localidades error: ${response.status}`);
    }
    const data = await response.json();
    return data.localidades || [];
  }

  async geocodeLocality(
    city?: string | null,
    state?: string | null
  ): Promise<GeoCoordinates | null> {
    const normalizedCity = city?.trim();
    if (!normalizedCity) {
      return null;
    }

    const cacheKey = `${normalizedCity}|${state?.trim() || ""}`.toLowerCase();
    const cached = this.geocodeCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const params = new URLSearchParams({
      nombre: normalizedCity,
      max: "5",
    });
    if (state?.trim()) {
      params.append("provincia", state.trim());
    }

    try {
      const response = await fetch(`${this.baseUrl}/localidades?${params.toString()}`);
      if (!response.ok) {
        return null;
      }

      const data = await response.json();
      const localities: GeorefLocality[] = data.localidades || [];
      const match =
        localities.find(
          (loc) => loc.nombre.toLowerCase() === normalizedCity.toLowerCase()
        ) || localities[0];

      if (!match?.centroide?.lat || !match?.centroide?.lon) {
        return null;
      }

      const coords = { lat: match.centroide.lat, lng: match.centroide.lon };
      this.geocodeCache.set(cacheKey, coords);
      return coords;
    } catch (error) {
      console.warn("[GeorefService] Error geocodificando localidad:", error);
      return null;
    }
  }
}
