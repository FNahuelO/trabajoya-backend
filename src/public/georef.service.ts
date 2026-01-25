import { Injectable, Logger } from "@nestjs/common";
import axios, { AxiosInstance } from "axios";
import * as fs from "fs";
import * as path from "path";

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

interface StaticLocationData {
  provinces: Array<{
    id: string;
    code: string;
    name: string;
  }>;
  localities: Array<{
    id: string;
    name: string;
    provinceId: string;
    provinceName: string;
    municipalityId?: string;
    municipalityName?: string;
  }>;
  lastUpdated: string;
}

@Injectable()
export class GeorefService {
  private readonly logger = new Logger(GeorefService.name);
  private readonly axiosInstance: AxiosInstance;
  private readonly baseUrl = "https://apis.datos.gob.ar/georef/api";
  private staticData: StaticLocationData | null = null;
  private staticDataLoaded = false;

  constructor() {
    this.axiosInstance = axios.create({
      baseURL: this.baseUrl,
      timeout: 30000,
      headers: {
        "Content-Type": "application/json",
      },
    });
    this.loadStaticData();
  }

  /**
   * Carga los datos estáticos desde el archivo JSON
   */
  private loadStaticData(): void {
    try {
      const dataPath = path.join(process.cwd(), "src", "data", "argentina-locations.json");
      if (fs.existsSync(dataPath)) {
        const fileContent = fs.readFileSync(dataPath, "utf-8");
        this.staticData = JSON.parse(fileContent);
        this.staticDataLoaded = true;
        this.logger.log(
          `✅ Datos estáticos cargados: ${this.staticData.provinces.length} provincias, ${this.staticData.localities.length} localidades`
        );
      } else {
        this.logger.warn(
          `⚠️ Archivo de datos estáticos no encontrado en ${dataPath}. Usando API de GeoRef como fallback.`
        );
        this.logger.warn(
          `💡 Ejecuta 'npm run download-locations' para generar el archivo con TODAS las localidades.`
        );
      }
    } catch (error: any) {
      this.logger.error(`Error cargando datos estáticos: ${error.message}`);
      this.staticDataLoaded = false;
    }
  }

  /**
   * Obtiene todas las provincias de Argentina
   * Usa datos estáticos si están disponibles, sino usa la API
   */
  async getProvinces(): Promise<GeorefProvince[]> {
    // Intentar usar datos estáticos primero
    if (this.staticDataLoaded && this.staticData) {
      return this.staticData.provinces
        .map((p) => ({
          id: p.id,
          nombre: p.name,
        }))
        .sort((a, b) => a.nombre.localeCompare(b.nombre, "es", { sensitivity: "base" }));
    }

    // Fallback a API
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
   * Usa datos estáticos si están disponibles, sino usa la API
   */
  async getLocalitiesByProvince(provinceId: string): Promise<GeorefLocality[]> {
    // Intentar usar datos estáticos primero
    if (this.staticDataLoaded && this.staticData) {
      // Buscar provincia por ID, código o nombre (case insensitive)
      const provinceIdLower = provinceId.toLowerCase().trim();
      const province = this.staticData.provinces.find(
        (p) =>
          p.id === provinceId ||
          p.code === provinceId ||
          p.name === provinceId ||
          p.id.toLowerCase() === provinceIdLower ||
          p.code.toLowerCase() === provinceIdLower ||
          p.name.toLowerCase() === provinceIdLower
      );

      if (!province) {
        this.logger.warn(
          `Provincia no encontrada en datos estáticos: ${provinceId}. Intentando con API...`
        );
        // Continuar con fallback a API
      } else {
        // Filtrar localidades de esta provincia
        const localities = this.staticData.localities.filter(
          (loc) =>
            loc.provinceId === province.id ||
            loc.provinceName === province.name ||
            loc.provinceId === province.code
        );

        this.logger.log(
          `✅ Obtenidas ${localities.length} localidades de "${province.name}" desde datos estáticos`
        );

        return localities
          .map((loc) => ({
            id: loc.id,
            nombre: loc.name,
            provincia: {
              id: loc.provinceId,
              nombre: loc.provinceName,
            },
            municipio: loc.municipalityId
              ? {
                  id: loc.municipalityId,
                  nombre: loc.municipalityName || "",
                }
              : undefined,
          }))
          .sort((a, b) => a.nombre.localeCompare(b.nombre, "es", { sensitivity: "base" }));
      }
    }

    // Fallback a API si no hay datos estáticos o no se encontró la provincia
    try {
      const provinces = await this.getProvinces();
      const province = provinces.find(
        (p) => p.id === provinceId || p.nombre === provinceId
      );

      if (!province) {
        throw new Error(`Province not found: ${provinceId}`);
      }

      // Intentar primero sin el parámetro max (usar el default de la API)
      let response;
      let attempt = 0;
      const maxLimits = [undefined, 100, 500, 1000, 5000]; // undefined = sin límite, luego probar con límites
      
      for (const maxLimit of maxLimits) {
        attempt++;
        try {
          const params: any = {
            provincia: province.nombre,
            formato: "json",
          };
          
          // Solo agregar max si está definido
          if (maxLimit !== undefined) {
            params.max = maxLimit;
          }
          
          this.logger.debug(
            `Intento ${attempt}: Obteniendo localidades para provincia "${province.nombre}" con max=${maxLimit || 'default'}`
          );
          
          response = await this.axiosInstance.get("/localidades", { params });
          
          // Si llegamos aquí, la petición fue exitosa
          const localities = response.data.localidades || [];
          this.logger.debug(
            `✅ Éxito obteniendo ${localities.length} localidades para "${province.nombre}" con max=${maxLimit || 'default'}`
          );
          
          // Si obtenemos menos localidades que el máximo, probablemente ya tenemos todas
          if (maxLimit && localities.length < maxLimit) {
            break;
          }
          
          // Si no hay límite o obtenimos el máximo, verificar si hay más
          const total = response.data.cantidad || 0;
          if (localities.length >= total) {
            break;
          }
          
          // Si hay más datos y no tenemos límite, necesitamos paginar
          // Por ahora, devolvemos lo que tenemos
          if (!maxLimit && localities.length < total) {
            this.logger.warn(
              `⚠️ Solo se obtuvieron ${localities.length} de ${total} localidades. Considera usar datos estáticos.`
            );
          }
          
          break;
        } catch (error: any) {
          const statusCode = error?.response?.status;
          const errorData = error?.response?.data;
          
          // Si es el último intento, lanzar el error
          if (attempt === maxLimits.length) {
            this.logger.error(
              `❌ Todos los intentos fallaron para provincia "${province.nombre}"`
            );
            this.logger.error(`Error details: ${JSON.stringify(errorData)}`);
            throw error;
          }
          
          // Si es error 400, intentar con el siguiente límite
          if (statusCode === 400) {
            this.logger.warn(
              `⚠️ Error 400 con max=${maxLimit || 'default'}, intentando siguiente opción...`
            );
            continue;
          }
          
          // Si es otro tipo de error, lanzarlo inmediatamente
          throw error;
        }
      }

      return response.data.localidades || [];
    } catch (error: any) {
      const errorMessage = error?.response?.data?.message || error?.message || 'Unknown error';
      const statusCode = error?.response?.status || error?.statusCode;
      const errorData = error?.response?.data;
      
      // Intentar obtener el nombre de la provincia para el log
      let provinceName = 'Unknown';
      try {
        const provinces = await this.getProvinces();
        const province = provinces.find(
          (p) => p.id === provinceId || p.nombre === provinceId
        );
        if (province) {
          provinceName = province.nombre;
        }
      } catch {
        // Si falla obtener las provincias, usar solo el ID
      }
      
      this.logger.error(
        `Error fetching localities by province: ${errorMessage} (status: ${statusCode})`
      );
      this.logger.error(`Error details: ${JSON.stringify(errorData)}`);
      this.logger.error(`Province ID: ${provinceId}, Province name: ${provinceName}`);
      throw error;
    }
  }
}
