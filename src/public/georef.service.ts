import { Injectable, Logger } from "@nestjs/common";
import axios, { AxiosInstance } from "axios";

export interface GeorefProvince {
  id: string;
  nombre: string;
}

export interface GeorefMunicipality {
  id: string;
  nombre: string;
  provincia?: { nombre: string };
}

export interface GeorefLocality {
  id: string;
  nombre: string;
  municipio?: { nombre: string };
  provincia?: { nombre: string };
}

interface GeorefResponse<T> {
  cantidad: number;
  inicio: number;
  parametros: Record<string, any>;
  localidades?: T[];
}

@Injectable()
export class GeorefService {
  private readonly logger = new Logger(GeorefService.name);
  private readonly axiosInstance: AxiosInstance;
  private readonly baseUrl = "https://apis.datos.gob.ar/georef/api";

  constructor() {
    this.axiosInstance = axios.create({
      baseURL: this.baseUrl,
      timeout: 30000,
      headers: {
        "Content-Type": "application/json",
      },
    });
  }

  /**
   * Obtiene todas las provincias de Argentina
   */
  async getProvinces(): Promise<GeorefProvince[]> {
    try {
      const response = await this.axiosInstance.get("/provincias", {
        params: {
          formato: "json",
          max: 100,
        },
      });
      return response.data.provincias || [];
    } catch (error) {
      this.logger.error(`Error fetching provinces: ${error.message}`);
      throw error;
    }
  }

  /**
   * Obtiene los municipios de una provincia
   */
  async getMunicipalities(provinceId: string): Promise<GeorefMunicipality[]> {
    try {
      // Buscar la provincia por ID o nombre
      const provinces = await this.getProvinces();
      const province = provinces.find(
        (p) => p.id === provinceId || p.nombre === provinceId
      );

      if (!province) {
        throw new Error(`Province not found: ${provinceId}`);
      }

      const response = await this.axiosInstance.get("/municipios", {
        params: {
          provincia: province.nombre,
          formato: "json",
          max: 1000,
        },
      });

      return response.data.municipios || [];
    } catch (error) {
      this.logger.error(`Error fetching municipalities: ${error.message}`);
      throw error;
    }
  }

  /**
   * Obtiene las localidades de un municipio
   */
  async getLocalitiesByMunicipality(
    provinceId: string,
    municipalityId: string
  ): Promise<GeorefLocality[]> {
    try {
      const provinces = await this.getProvinces();
      const province = provinces.find(
        (p) => p.id === provinceId || p.nombre === provinceId
      );

      if (!province) {
        throw new Error(`Province not found: ${provinceId}`);
      }

      const municipalities = await this.getMunicipalities(provinceId);
      const municipality = municipalities.find(
        (m) => m.id === municipalityId || m.nombre === municipalityId
      );

      if (!municipality) {
        throw new Error(`Municipality not found: ${municipalityId}`);
      }

      const response = await this.axiosInstance.get("/localidades", {
        params: {
          provincia: province.nombre,
          municipio: municipality.nombre,
          formato: "json",
          max: 1000,
        },
      });

      return response.data.localidades || [];
    } catch (error) {
      this.logger.error(
        `Error fetching localities by municipality: ${error.message}`
      );
      throw error;
    }
  }

  /**
   * Obtiene todas las localidades de una provincia (más directo)
   */
  async getLocalitiesByProvince(provinceId: string): Promise<GeorefLocality[]> {
    try {
      const provinces = await this.getProvinces();
      const province = provinces.find(
        (p) => p.id === provinceId || p.nombre === provinceId
      );

      if (!province) {
        throw new Error(`Province not found: ${provinceId}`);
      }

      const response = await this.axiosInstance.get("/localidades", {
        params: {
          provincia: province.nombre,
          formato: "json",
          max: 5000, // Límite más seguro para evitar errores 400
        },
      });

      return response.data.localidades || [];
    } catch (error: any) {
      const errorMessage = error?.response?.data?.message || error?.message || 'Unknown error';
      const statusCode = error?.response?.status || error?.statusCode;
      this.logger.error(
        `Error fetching localities by province: ${errorMessage} (status: ${statusCode})`
      );
      this.logger.debug(`Province ID: ${provinceId}, Province name: ${province?.nombre}`);
      throw error;
    }
  }
}
