import { createContainer } from "./container.js";
import { API_PREFIX } from "./shared/http/api.routes.js";
import { createApp } from "./shared/http/app.js";

// Arranque del servidor HTTP: `npm run dev` (recarga al guardar) o `npm start`.
const port = Number(process.env["PORT"] ?? 3000);
const container = createContainer();
const app = createApp(container);

if (process.env["NODE_ENV"] !== "production") {
  console.warn("⚠ Modo desarrollo: se acepta la cabecera X-Actor-Id (nunca en producción).");
}
// Verificación de tokens (ADR-008).
console.log(
  container.authMode === "jwt"
    ? "✔ Tokens: JWT verificado localmente con JWT_SECRET"
    : "⚠ Tokens: falta JWT_SECRET; solo funcionan las cabeceras de desarrollo (X-Actor-*)",
);
// Fuente de los datos del módulo administrativo (ADR-007).
if (container.administrativeSource === "saga") {
  console.log("✔ Módulo administrativo: API de Saga (SAGA_API_URL). Cuentas reales enlazadas por security_user_id");
} else {
  // Modo simulado: fácil de confundir con un error de permisos, así que se avisa en detalle.
  console.warn(
    [
      "⚠ Módulo administrativo: MODO SIMULADO (falta SAGA_API_URL).",
      "  · Se leen las tablas de prueba del esquema administrativo, no Saga.",
      "  · Las cuentas reales NO quedan enlazadas: talleristas, estudiantes y acudientes reciben 403",
      "    («tu cuenta no está enlazada…») y el login devuelve saga.linked = false.",
      '  · Para usar Saga real: SAGA_API_URL="https://saga-up-backend-lr4u.onrender.com" en el .env.',
    ].join("\n"),
  );
}

const server = app.listen(port, () => {
  console.log(`✔ API escuchando en http://localhost:${port}${API_PREFIX}`);
});

const shutdown = () => {
  server.close(() => {
    void container.prisma.$disconnect().finally(() => process.exit(0));
  });
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
