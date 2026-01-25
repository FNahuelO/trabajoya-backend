import { Injectable } from "@nestjs/common";
import { Country, State, City } from "country-state-city";

import { translateCountry, translateProvince } from "./translations";
import { GeorefService } from "./georef.service";

export interface CountryDto {
  code: string;
  name: string;
}

export interface ProvinceDto {
  code: string;
  name: string;
}

export interface CityDto {
  id: string;
  name: string;
}

@Injectable()
export class LocationService {
  constructor(private readonly georefService: GeorefService) {}

  /**
   * Obtiene todos los países
   */
  getCountries(): CountryDto[] {
    const countries = Country.getAllCountries();
    return countries.map((country) => ({
      code: country.isoCode,
      name: translateCountry(country.isoCode, country.name),
    }));
  }

  /**
   * Obtiene las provincias/estados de un país
   */
  async getProvinces(countryCode: string): Promise<ProvinceDto[]> {
    // Para Argentina, usar Georef API
    if (countryCode === "AR") {
      try {
        const provinces = await this.georefService.getProvinces();
        return provinces
          .map((province) => ({
            code: province.id,
            name: province.nombre,
          }))
          .sort((a, b) => a.name.localeCompare(b.name, "es", { sensitivity: "base" }));
      } catch (error) {
        // Fallback a country-state-city si falla Georef
        const states = State.getStatesOfCountry(countryCode);
        return states
          .map((state) => ({
            code: state.isoCode,
            name: translateProvince(countryCode, state.name),
          }))
          .sort((a, b) => a.name.localeCompare(b.name, "es", { sensitivity: "base" }));
      }
    }

    // Para otros países, usar country-state-city
    const states = State.getStatesOfCountry(countryCode);
    return states
      .map((state) => ({
        code: state.isoCode,
        name: translateProvince(countryCode, state.name),
      }))
      .sort((a, b) => a.name.localeCompare(b.name, "es", { sensitivity: "base" }));
  }

  /**
   * Obtiene las ciudades de una provincia/estado
   */
  async getCities(
    countryCode: string,
    provinceCode: string
  ): Promise<CityDto[]> {
    // Para Argentina, usar Georef API
    if (countryCode === "AR") {
      try {
        const localities = await this.georefService.getLocalitiesByProvince(
          provinceCode
        );
        if (localities && localities.length > 0) {
          return localities
            .map((locality) => ({
              id: locality.id,
              name: locality.nombre,
            }))
            .sort((a, b) => a.name.localeCompare(b.name, "es", { sensitivity: "base" }));
        }
      } catch (error: any) {
        // Log del error pero continuar con fallback
        console.warn(
          `[LocationService] GeoRef falló para provincia ${provinceCode}, usando fallback:`,
          error?.message || error
        );
      }
      
      // Fallback a country-state-city si falla Georef o devuelve vacío
      try {
        const cities = City.getCitiesOfState(countryCode, provinceCode);
        if (cities && cities.length > 0) {
          return cities
            .map((city, index) => ({
              id: `${countryCode}-${provinceCode}-${index}`,
              name: city.name,
            }))
            .sort((a, b) => a.name.localeCompare(b.name, "es", { sensitivity: "base" }));
        }
      } catch (error: any) {
        console.warn(
          `[LocationService] Fallback también falló para provincia ${provinceCode}:`,
          error?.message || error
        );
      }
      
      // Si todo falla, devolver array vacío
      return [];
    }

    // Para otros países, usar country-state-city
    const cities = City.getCitiesOfState(countryCode, provinceCode);
    return cities
      .map((city, index) => ({
        id: `${countryCode}-${provinceCode}-${index}`,
        name: city.name,
      }))
      .sort((a, b) => a.name.localeCompare(b.name, "es", { sensitivity: "base" }));
  }
}
