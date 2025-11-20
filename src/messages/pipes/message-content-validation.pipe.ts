import { PipeTransform, Injectable, BadRequestException } from "@nestjs/common";

@Injectable()
export class MessageContentValidationPipe implements PipeTransform {
  transform(value: any) {
    if (!value || typeof value !== "string") {
      throw new BadRequestException(
        "El contenido del mensaje debe ser una cadena de texto"
      );
    }

    // Limpiar el contenido del mensaje
    const cleanedContent = value.trim();

    // Validar que no esté vacío después de limpiar
    if (cleanedContent.length === 0) {
      throw new BadRequestException("El mensaje no puede estar vacío");
    }

    // Validar longitud máxima
    if (cleanedContent.length > 1000) {
      throw new BadRequestException(
        "El mensaje no puede exceder los 1000 caracteres"
      );
    }

    // Validar que no contenga solo espacios en blanco
    if (!cleanedContent.replace(/\s/g, "").length) {
      throw new BadRequestException(
        "El mensaje no puede contener solo espacios en blanco"
      );
    }

    // Filtrar contenido inapropiado (básico)
    const inappropriateWords = ["spam", "scam", "fraud"]; // Agregar más palabras según sea necesario
    const lowerContent = cleanedContent.toLowerCase();

    for (const word of inappropriateWords) {
      if (lowerContent.includes(word)) {
        throw new BadRequestException(
          "El mensaje contiene contenido inapropiado"
        );
      }
    }

    return cleanedContent;
  }
}
