const axios = require("axios");

const BASE_URL = "http://localhost:3000/api/messages";
const TEST_TOKEN = "your-test-jwt-token-here"; // Reemplazar con un token válido

const headers = {
  Authorization: `Bearer ${TEST_TOKEN}`,
  "Content-Type": "application/json",
};

async function testMessagesAPI() {
  console.log("🚀 Iniciando pruebas del sistema de mensajes...\n");

  try {
    // 1. Probar envío de mensaje
    console.log("1. Probando envío de mensaje...");
    const sendMessageResponse = await axios.post(
      `${BASE_URL}`,
      {
        toUserId: "test-receiver-id",
        message: "Hola, este es un mensaje de prueba",
      },
      { headers }
    );
    console.log("✅ Mensaje enviado:", sendMessageResponse.data.message);
    console.log("📝 ID del mensaje:", sendMessageResponse.data.data.id);
    console.log("");

    // 2. Probar obtención de conversaciones
    console.log("2. Probando obtención de conversaciones...");
    const conversationsResponse = await axios.get(`${BASE_URL}`, { headers });
    console.log(
      "✅ Conversaciones obtenidas:",
      conversationsResponse.data.message
    );
    console.log(
      "📊 Número de conversaciones:",
      conversationsResponse.data.data.length
    );
    console.log("");

    // 3. Probar conversación específica
    console.log("3. Probando conversación específica...");
    const conversationResponse = await axios.get(
      `${BASE_URL}/test-receiver-id`,
      { headers }
    );
    console.log("✅ Conversación obtenida:", conversationResponse.data.message);
    console.log(
      "💬 Número de mensajes:",
      conversationResponse.data.data.length
    );
    console.log("");

    // 4. Probar contador de mensajes no leídos
    console.log("4. Probando contador de mensajes no leídos...");
    const unreadCountResponse = await axios.get(`${BASE_URL}/unread/count`, {
      headers,
    });
    console.log("✅ Contador obtenido:", unreadCountResponse.data.message);
    console.log("🔢 Mensajes no leídos:", unreadCountResponse.data.data.count);
    console.log("");

    // 5. Probar estadísticas
    console.log("5. Probando estadísticas de mensajes...");
    const statsResponse = await axios.get(`${BASE_URL}/stats`, { headers });
    console.log("✅ Estadísticas obtenidas:", statsResponse.data.message);
    console.log("📈 Total de mensajes:", statsResponse.data.data.totalMessages);
    console.log("📨 Mensajes enviados:", statsResponse.data.data.sentMessages);
    console.log(
      "📥 Mensajes recibidos:",
      statsResponse.data.data.receivedMessages
    );
    console.log("");

    // 6. Probar búsqueda de mensajes
    console.log("6. Probando búsqueda de mensajes...");
    const searchResponse = await axios.get(`${BASE_URL}/search?q=prueba`, {
      headers,
    });
    console.log("✅ Búsqueda completada:", searchResponse.data.message);
    console.log("🔍 Resultados encontrados:", searchResponse.data.data.length);
    console.log("");

    console.log("🎉 ¡Todas las pruebas completadas exitosamente!");
  } catch (error) {
    console.error(
      "❌ Error en las pruebas:",
      error.response?.data || error.message
    );

    if (error.response?.status === 401) {
      console.log("\n💡 Sugerencia: Verifica que el token JWT sea válido");
    } else if (error.response?.status === 400) {
      console.log(
        "\n💡 Sugerencia: Verifica que los datos de entrada sean correctos"
      );
    } else if (error.response?.status === 404) {
      console.log(
        "\n💡 Sugerencia: Verifica que el servidor esté ejecutándose en el puerto 3000"
      );
    }
  }
}

// Función para probar WebSockets
function testWebSocket() {
  console.log("\n🔌 Probando conexión WebSocket...");

  const io = require("socket.io-client");
  const socket = io("http://localhost:3000/messages", {
    auth: {
      token: TEST_TOKEN,
    },
  });

  socket.on("connect", () => {
    console.log("✅ Conectado al WebSocket");

    // Probar envío de mensaje via WebSocket
    socket.emit("sendMessage", {
      toUserId: "test-receiver-id",
      message: "Mensaje via WebSocket",
    });
  });

  socket.on("messageSent", (data) => {
    console.log("✅ Mensaje enviado via WebSocket:", data.id);
  });

  socket.on("newMessage", (data) => {
    console.log("📨 Nuevo mensaje recibido:", data.content);
  });

  socket.on("unreadCount", (data) => {
    console.log("🔢 Contador actualizado:", data.count);
  });

  socket.on("error", (error) => {
    console.error("❌ Error en WebSocket:", error);
  });

  socket.on("disconnect", () => {
    console.log("🔌 Desconectado del WebSocket");
  });

  // Desconectar después de 5 segundos
  setTimeout(() => {
    socket.disconnect();
    console.log("🏁 Pruebas de WebSocket completadas");
  }, 5000);
}

// Ejecutar pruebas
if (require.main === module) {
  testMessagesAPI().then(() => {
    testWebSocket();
  });
}

module.exports = { testMessagesAPI, testWebSocket };
