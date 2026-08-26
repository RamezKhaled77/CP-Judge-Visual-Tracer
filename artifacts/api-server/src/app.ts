import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import { errorHandler } from "./middlewares/error-handler";

// Same-origin deployments need no CORS at all; cross-origin clients must be
// explicitly allowed via ALLOWED_ORIGINS (comma-separated). Local dev hosts
// are permitted automatically outside production.
const configuredOrigins = (process.env.ALLOWED_ORIGINS ?? "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
const devOrigins = process.env.NODE_ENV === "production" ? [] : [/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/];

function isAllowedOrigin(origin: string): boolean {
  if (configuredOrigins.includes(origin)) return true;
  return devOrigins.some((pattern) => pattern.test(origin));
}

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(
  cors({
    origin(origin, callback) {
      if (!origin || isAllowedOrigin(origin)) return callback(null, true);
      return callback(null, false);
    },
  }),
);
app.use(express.json({ limit: "256kb" }));
app.use(express.urlencoded({ extended: true, limit: "256kb" }));

app.use("/api", router);

app.use(errorHandler);

export default app;
