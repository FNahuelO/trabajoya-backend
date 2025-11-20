export const MESSAGE_VALIDATION_CONFIG = {
  // Límites de contenido
  MAX_MESSAGE_LENGTH: 1000,
  MIN_MESSAGE_LENGTH: 1,

  // Rate limiting
  MAX_MESSAGES_PER_MINUTE: 10,
  MAX_MESSAGES_PER_HOUR: 100,
  MAX_MESSAGES_PER_DAY: 500,

  // Palabras prohibidas (básico)
  FORBIDDEN_WORDS: [
    "spam",
    "scam",
    "fraud",
    "phishing",
    "hack",
    "virus",
    "malware",
  ],

  // Patrones de contenido sospechoso
  SUSPICIOUS_PATTERNS: [
    /https?:\/\/[^\s]+/g, // URLs
    /[A-Z]{3,}/g, // Texto en mayúsculas excesivo
    /!{3,}/g, // Múltiples signos de exclamación
    /\.{3,}/g, // Múltiples puntos
  ],

  // Configuración de WebSocket
  WEBSOCKET: {
    NAMESPACE: "/messages",
    CONNECTION_TIMEOUT: 30000, // 30 segundos
    PING_TIMEOUT: 60000, // 1 minuto
    PING_INTERVAL: 25000, // 25 segundos
  },

  // Configuración de notificaciones
  NOTIFICATIONS: {
    ENABLE_PUSH_NOTIFICATIONS: true,
    ENABLE_EMAIL_NOTIFICATIONS: false,
    BATCH_NOTIFICATIONS: true,
    BATCH_SIZE: 10,
  },
} as const;
