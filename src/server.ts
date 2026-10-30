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
