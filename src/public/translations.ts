/**
 * Mapeo de traducciones de países y estados al español
 * Para países muy comunes usados en Latinoamérica
 */

const countryTranslations: Record<string, string> = {
  // Europa
  "United Kingdom": "Reino Unido",
  Spain: "España",
  France: "Francia",
  Germany: "Alemania",
  Italy: "Italia",
  Portugal: "Portugal",

  // América del Norte
  "United States": "Estados Unidos",
  Canada: "Canadá",
  Mexico: "México",

  // Centroamérica y Caribe
  Guatemala: "Guatemala",
  "El Salvador": "El Salvador",
  Honduras: "Honduras",
  Nicaragua: "Nicaragua",
  "Costa Rica": "Costa Rica",
  Panama: "Panamá",
  Cuba: "Cuba",
  "Dominican Republic": "República Dominicana",
  "Puerto Rico": "Puerto Rico",
  Jamaica: "Jamaica",
  Haiti: "Haití",

  // América del Sur
  Brazil: "Brasil",
  Argentina: "Argentina",
  Chile: "Chile",
  Colombia: "Colombia",
  Peru: "Perú",
  Venezuela: "Venezuela",
  Ecuador: "Ecuador",
  Bolivia: "Bolivia",
  Paraguay: "Paraguay",
  Uruguay: "Uruguay",

  // Otros
  China: "China",
  Japan: "Japón",
  India: "India",
  Australia: "Australia",
  "New Zealand": "Nueva Zelanda",
  "South Africa": "Sudáfrica",
  Russia: "Rusia",
};

// Mapeo de provincias argentinas (las más usadas)
const argentinaProvinceTranslations: Record<string, string> = {
  "Buenos Aires": "Buenos Aires",
  Córdoba: "Córdoba",
  "Santa Fe": "Santa Fe",
  Mendoza: "Mendoza",
  Tucumán: "Tucumán",
  Salta: "Salta",
  Catamarca: "Catamarca",
  Chaco: "Chaco",
  Chubut: "Chubut",
  Corrientes: "Corrientes",
  "Entre Ríos": "Entre Ríos",
  Formosa: "Formosa",
  Jujuy: "Jujuy",
  "La Pampa": "La Pampa",
  "La Rioja": "La Rioja",
  Misiones: "Misiones",
  Neuquén: "Neuquén",
  "Río Negro": "Río Negro",
  "San Juan": "San Juan",
  "San Luis": "San Luis",
  "Santa Cruz": "Santa Cruz",
  "Santiago del Estero": "Santiago del Estero",
  "Tierra del Fuego": "Tierra del Fuego",
  "Ciudad Autónoma de Buenos Aires": "Ciudad Autónoma de Buenos Aires",
};

// Mapeo de estados de México
const mexicoStateTranslations: Record<string, string> = {
  Aguascalientes: "Aguascalientes",
  "Baja California": "Baja California",
  "Baja California Sur": "Baja California Sur",
  Campeche: "Campeche",
  Chiapas: "Chiapas",
  Chihuahua: "Chihuahua",
  "Ciudad de México": "Ciudad de México",
  Coahuila: "Coahuila",
  Colima: "Colima",
  Durango: "Durango",
  Guanajuato: "Guanajuato",
  Guerrero: "Guerrero",
  Hidalgo: "Hidalgo",
  Jalisco: "Jalisco",
  México: "Estado de México",
  Michoacán: "Michoacán",
  Morelos: "Morelos",
  Nayarit: "Nayarit",
  "Nuevo León": "Nuevo León",
  Oaxaca: "Oaxaca",
  Puebla: "Puebla",
  Querétaro: "Querétaro",
  "Quintana Roo": "Quintana Roo",
  "San Luis Potosí": "San Luis Potosí",
  Sinaloa: "Sinaloa",
  Sonora: "Sonora",
  Tabasco: "Tabasco",
  Tamaulipas: "Tamaulipas",
  Tlaxcala: "Tlaxcala",
  Veracruz: "Veracruz",
  Yucatán: "Yucatán",
  Zacatecas: "Zacatecas",
};

/**
 * Traduce un nombre de país al español
 */
export function translateCountry(
  countryCode: string,
  englishName: string
): string {
  // Si es Argentina y ya está en español, retornar tal cual
  if (countryCode === "AR" && englishName === "Argentina") {
    return englishName;
  }

  return countryTranslations[englishName] || englishName;
}

/**
 * Traduce un nombre de provincia/estado al español
 */
export function translateProvince(
  countryCode: string,
  englishName: string
): string {
  if (countryCode === "AR") {
    return argentinaProvinceTranslations[englishName] || englishName;
  }

  if (countryCode === "MX") {
    return mexicoStateTranslations[englishName] || englishName;
  }

  return englishName;
}
