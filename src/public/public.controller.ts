import { Controller, Get, Param } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { Public } from "../common/decorators/public.decorator";
import { LocationService } from "./location.service";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import {
  ApiResponse,
  createResponse,
} from "src/common/mapper/api-response.mapper";

type FaqItem = {
  question: string;
  answer: string;
};

@ApiTags("public")
@Controller("api/public")
export class PublicController {
  constructor(private readonly locationService: LocationService) {}

  @Get("faqs")
  @Public()
  getFaqs(): ApiResponse<FaqItem[]> {
    const faqs: FaqItem[] = [
      {
        question: "¿Cómo creo una cuenta en TrabajoYa?",
        answer:
          "Desde la pantalla de inicio, elegí tu tipo de cuenta y seguí los pasos de registro con email o Google.",
      },
      {
        question: "¿Puedo iniciar sesión o crear una cuenta con Google?",
        answer:
          "Sí. En las pantallas de registro e inicio de sesión disponés del botón ‘Continuar con Google’.",
      },
      {
        question:
          "No puedo ingresar a mi cuenta / Olvidé mi contraseña, ¿cómo la recupero?",
        answer:
          "Usá la opción ‘¿Has olvidado tu contraseña?’ para recibir un enlace de restablecimiento en tu email.",
      },
      {
        question: "¿Cómo cambio mi contraseña?",
        answer:
          "Desde Mi cuenta > Seguridad podés actualizar tu contraseña en cualquier momento.",
      },
      {
        question: "¿Cómo cambio mi email?",
        answer:
          "Desde Mi cuenta > Datos personales, editá tu correo y guardá los cambios.",
      },
      {
        question: "¿Cómo elimino mi cuenta?",
        answer:
          "Podés solicitar la eliminación en Mi cuenta. Recordá que es una acción permanente.",
      },
      {
        question: "¿Cómo cargo mi CV?",
        answer:
          "En tu perfil podés adjuntar tu CV en PDF o completar los campos para generarlo automáticamente.",
      },
      {
        question: "¿Cómo me postulo a un aviso?",
        answer:
          "Ingresá al detalle del empleo y presioná ‘Postularme’. Te pediremos confirmar tus datos.",
      },
      {
        question: "Si cambio mi CV, ¿la empresa lo verá actualizado?",
        answer:
          "Sí. Las empresas verán siempre la última versión disponible al momento de revisar tu postulación.",
      },
      {
        question: "¿Puedo modificar o eliminar una postulación?",
        answer:
          "Podés retirar una postulación desde la sección Postulaciones, salvo que el proceso ya haya finalizado.",
      },
    ];

    return createResponse({
      success: true,
      message: "FAQs obtenidas correctamente",
      data: faqs,
    });
  }

  @Get("locations/countries")
  @Public()
  getCountries(): { success: boolean; message: string; data: any[] } {
    const countries = this.locationService.getCountries();
    return {
      success: true,
      message: "Países obtenidos correctamente",
      data: countries.sort((a, b) => a.name.localeCompare(b.name)),
    };
  }

  @Get("locations/countries/:countryCode/provinces")
  @Public()
  async getProvinces(@Param("countryCode") countryCode: string): Promise<{
    success: boolean;
    message: string;
    data: any[];
  }> {
    const provinces = await this.locationService.getProvinces(countryCode);
    return {
      success: true,
      message: "Provincias obtenidas correctamente",
      data: provinces.sort((a, b) => a.name.localeCompare(b.name)),
    };
  }

  @Get("locations/countries/:countryCode/provinces/:provinceCode/cities")
  @Public()
  async getCities(
    @Param("countryCode") countryCode: string,
    @Param("provinceCode") provinceCode: string
  ): Promise<{
    success: boolean;
    message: string;
    data: any[];
  }> {
    const cities = await this.locationService.getCities(
      countryCode,
      provinceCode
    );
    return {
      success: true,
      message: "Ciudades obtenidas correctamente",
      data: cities.sort((a, b) => a.name.localeCompare(b.name)),
    };
  }

  @Get("references/job-areas")
  @Public()
  getJobAreas(): { success: boolean; message: string; data: string[] } {
    const areas = [
      "Administración y Gestión",
      "Atención al Cliente",
      "Banca y Finanzas",
      "Comercial y Ventas",
      "Comunicación y Marketing",
      "Diseño",
      "Educación",
      "Enfermería y Salud",
      "Ingeniería",
      "IT y Tecnología",
      "Legal",
      "Logística y Transporte",
      "Medicina",
      "Operaciones",
      "Producción",
      "Recursos Humanos",
      "Servicios",
      "Turismo y Hostelería",
      "Otro",
    ];

    return {
      success: true,
      message: "Áreas de trabajo obtenidas correctamente",
      data: areas.sort((a, b) => a.localeCompare(b)),
    };
  }

  @Get("health")
  @Public()
  getHealth(): { status: string; timestamp: string } {
    return {
      status: "ok",
      timestamp: new Date().toISOString(),
    };
  }

  @Get("references/company-activities")
  @Public()
  getCompanyActivities(): {
    success: boolean;
    message: string;
    data: string[];
  } {
    const activities = [
      "Agricultura y Ganadería",
      "Alimentación y Bebidas",
      "Arquitectura y Construcción",
      "Automotriz",
      "Banca y Servicios Financieros",
      "Bienes de Consumo",
      "Comercio y Retail",
      "Consultoría",
      "Educación",
      "Energía y Utilities",
      "Entretenimiento y Medios",
      "Farmacéutica",
      "Hotelería y Turismo",
      "Inmobiliaria",
      "Internet y Tecnología",
      "Manufactura",
      "Marketing y Publicidad",
      "Medios de Comunicación",
      "Minera y Petrolera",
      "Organizaciones sin Fines de Lucro",
      "Salud y Medicina",
      "Servicios Profesionales",
      "Software y Desarrollo",
      "Telecomunicaciones",
      "Transporte y Logística",
      "Otro",
    ];

    return {
      success: true,
      message: "Actividades empresariales obtenidas correctamente",
      data: activities.sort((a, b) => a.localeCompare(b)),
    };
  }
}
