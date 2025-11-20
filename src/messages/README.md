# Sistema de Mensajes - Backend

## Descripción General

El sistema de mensajes permite la comunicación en tiempo real entre usuarios (postulantes y empresas) de la plataforma. Incluye funcionalidades de chat, notificaciones, validaciones y WebSockets para una experiencia fluida.

## Características Implementadas

### 🚀 **Funcionalidades Principales**

- **Envío de mensajes** entre usuarios
- **Conversaciones** organizadas por usuario
- **Mensajes en tiempo real** via WebSockets
- **Indicadores de lectura** y mensajes no leídos
- **Búsqueda de mensajes** por contenido
- **Estadísticas** de mensajes por usuario
- **Rate limiting** para prevenir spam
- **Validaciones** de contenido y permisos

### 📁 **Estructura del Módulo**

```
src/messages/
├── dto/                           # Data Transfer Objects
│   ├── send-message.dto.ts       # DTO para enviar mensajes
│   ├── message-response.dto.ts   # DTOs de respuesta
│   └── index.ts                  # Exportaciones
├── guards/                       # Guards de autorización
│   └── message-permission.guard.ts
├── interceptors/                 # Interceptores
│   └── websocket-message.interceptor.ts
├── middleware/                   # Middlewares
│   └── message-rate-limit.middleware.ts
├── pipes/                       # Pipes de validación
│   └── message-content-validation.pipe.ts
├── config/                      # Configuración
│   └── message-validation.config.ts
├── messages.controller.ts        # Controlador HTTP
├── messages.service.ts          # Lógica de negocio
├── messages.gateway.ts          # Gateway WebSocket
├── messages.module.ts           # Módulo principal
├── messages.e2e-spec.ts        # Pruebas E2E
└── README.md                   # Documentación
```

## 🔌 **Endpoints de la API**

### **POST** `/api/messages`
Enviar un mensaje a otro usuario.

**Request Body:**
```json
{
  "toUserId": "uuid-del-usuario-destinatario",
  "message": "Contenido del mensaje"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Mensaje enviado correctamente",
  "data": {
    "id": "message-id",
    "fromUserId": "sender-id",
    "toUserId": "receiver-id",
    "content": "Contenido del mensaje",
    "isRead": false,
    "createdAt": "2024-01-01T00:00:00.000Z",
    "fromUser": { ... },
    "toUser": { ... }
  }
}
```

### **GET** `/api/messages`
Obtener lista de conversaciones del usuario.

**Response:**
```json
{
  "success": true,
  "message": "Conversaciones obtenidas correctamente",
  "data": [
    {
      "user": { ... },
      "lastMessage": { ... },
      "unreadCount": 3
    }
  ]
}
```

### **GET** `/api/messages/:userId`
Obtener conversación con un usuario específico.

**Response:**
```json
{
  "success": true,
  "message": "Conversación obtenida correctamente",
  "data": [
    {
      "id": "message-id",
      "content": "Mensaje 1",
      "isRead": true,
      "createdAt": "2024-01-01T00:00:00.000Z",
      "fromUser": { ... }
    }
  ]
}
```

### **PATCH** `/api/messages/:id/read`
Marcar un mensaje como leído.

**Response:**
```json
{
  "success": true,
  "message": "Mensaje marcado como leído correctamente",
  "data": { ... }
}
```

### **GET** `/api/messages/unread/count`
Obtener cantidad de mensajes no leídos.

**Response:**
```json
{
  "success": true,
  "message": "Cantidad de mensajes no leídos obtenida correctamente",
  "data": { "count": 5 }
}
```

### **GET** `/api/messages/stats`
Obtener estadísticas de mensajes del usuario.

**Response:**
```json
{
  "success": true,
  "message": "Estadísticas obtenidas correctamente",
  "data": {
    "totalMessages": 100,
    "unreadMessages": 5,
    "sentMessages": 60,
    "receivedMessages": 40
  }
}
```

### **GET** `/api/messages/search?q=query&limit=50`
Buscar mensajes por contenido.

**Query Parameters:**
- `q`: Término de búsqueda (requerido)
- `limit`: Límite de resultados (opcional, default: 50)

### **DELETE** `/api/messages/:id`
Eliminar un mensaje (solo el remitente puede eliminar).

## 🔌 **WebSocket Events**

### **Conexión**
```javascript
const socket = io('/messages', {
  auth: {
    token: 'jwt-token'
  }
});
```

### **Eventos del Cliente al Servidor**

#### `sendMessage`
```javascript
socket.emit('sendMessage', {
  toUserId: 'user-id',
  message: 'Contenido del mensaje'
});
```

#### `markAsRead`
```javascript
socket.emit('markAsRead', {
  messageId: 'message-id'
});
```

#### `joinConversation`
```javascript
socket.emit('joinConversation', {
  userId: 'other-user-id'
});
```

#### `leaveConversation`
```javascript
socket.emit('leaveConversation', {
  userId: 'other-user-id'
});
```

#### `typing`
```javascript
socket.emit('typing', {
  userId: 'other-user-id',
  isTyping: true
});
```

### **Eventos del Servidor al Cliente**

#### `newMessage`
```javascript
socket.on('newMessage', (message) => {
  // Nuevo mensaje recibido
  console.log('Nuevo mensaje:', message);
});
```

#### `messageSent`
```javascript
socket.on('messageSent', (message) => {
  // Confirmación de mensaje enviado
  console.log('Mensaje enviado:', message);
});
```

#### `messageRead`
```javascript
socket.on('messageRead', (data) => {
  // Mensaje marcado como leído
  console.log('Mensaje leído:', data.messageId);
});
```

#### `unreadCount`
```javascript
socket.on('unreadCount', (data) => {
  // Contador de mensajes no leídos actualizado
  console.log('Mensajes no leídos:', data.count);
});
```

#### `userTyping`
```javascript
socket.on('userTyping', (data) => {
  // Usuario está escribiendo
  console.log('Usuario escribiendo:', data.userId, data.isTyping);
});
```

## 🛡️ **Seguridad y Validaciones**

### **Rate Limiting**
- Máximo 10 mensajes por minuto por usuario
- Máximo 100 mensajes por hora por usuario
- Máximo 500 mensajes por día por usuario

### **Validaciones de Contenido**
- Longitud mínima: 1 carácter
- Longitud máxima: 1000 caracteres
- Filtrado de palabras prohibidas
- Detección de patrones sospechosos

### **Permisos**
- Solo el remitente puede eliminar sus mensajes
- Solo el destinatario puede marcar mensajes como leídos
- Los usuarios solo pueden ver sus propias conversaciones

## 🗄️ **Base de Datos**

### **Modelo Message**
```prisma
model Message {
  id          String   @id @default(uuid())
  fromUserId  String
  toUserId    String
  content     String
  isRead      Boolean  @default(false)
  createdAt   DateTime @default(now())
  fromUser    User     @relation("SentMessages", fields: [fromUserId], references: [id], onDelete: Cascade)
  toUser      User     @relation("ReceivedMessages", fields: [toUserId], references: [id], onDelete: Cascade)
}
```

## 🧪 **Pruebas**

### **Ejecutar Pruebas E2E**
```bash
npm run test:e2e messages
```

### **Ejecutar Pruebas Unitarias**
```bash
npm run test messages
```

## 🚀 **Configuración**

### **Variables de Entorno**
```env
# WebSocket
FRONTEND_URL=http://localhost:3000

# Rate Limiting
MESSAGE_RATE_LIMIT_PER_MINUTE=10
MESSAGE_RATE_LIMIT_PER_HOUR=100
MESSAGE_RATE_LIMIT_PER_DAY=500

# Validación
MAX_MESSAGE_LENGTH=1000
MIN_MESSAGE_LENGTH=1
```

### **Configuración de WebSocket**
```typescript
// En messages.gateway.ts
@WebSocketGateway({
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
  },
  namespace: '/messages',
})
```

## 📊 **Monitoreo y Logs**

### **Logs Importantes**
- Conexiones/desconexiones de WebSocket
- Envío de mensajes
- Errores de validación
- Rate limiting activado

### **Métricas Recomendadas**
- Número de mensajes enviados por hora
- Tiempo de respuesta de la API
- Conexiones WebSocket activas
- Errores de validación por tipo

## 🔧 **Mantenimiento**

### **Limpieza de Datos**
- Los mensajes se eliminan automáticamente cuando se elimina un usuario
- Considerar implementar archivado de mensajes antiguos
- Limpiar entradas de rate limiting expiradas

### **Optimizaciones**
- Índices en la base de datos para búsquedas
- Paginación para conversaciones largas
- Cache de contadores de mensajes no leídos

## 🐛 **Solución de Problemas**

### **Problemas Comunes**

1. **WebSocket no conecta**
   - Verificar token JWT válido
   - Revisar configuración de CORS
   - Verificar que el namespace sea correcto

2. **Mensajes no se envían**
   - Verificar rate limiting
   - Revisar validaciones de contenido
   - Verificar permisos de usuario

3. **Notificaciones no llegan**
   - Verificar que el usuario esté conectado
   - Revisar configuración del gateway
   - Verificar eventos de WebSocket

## 📈 **Mejoras Futuras**

- [ ] Notificaciones push
- [ ] Adjuntos de archivos
- [ ] Mensajes temporales
- [ ] Reacciones a mensajes
- [ ] Mensajes de estado (escribiendo...)
- [ ] Cifrado end-to-end
- [ ] Modo offline
- [ ] Sincronización entre dispositivos
