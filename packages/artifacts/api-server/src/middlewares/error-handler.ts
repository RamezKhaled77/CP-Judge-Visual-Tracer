import type { ErrorRequestHandler } from "express";
import { logger } from "../lib/logger";

const dockerRequiredMarker = "Docker is required";

// Central error handler: turns thrown ZodErrors into 400s, body-parser
// failures into 400s, docker-outage runner errors into 503s, and anything
// else into a logged 500 — always structured JSON, never an HTML error page.
export const errorHandler: ErrorRequestHandler = (error, req, res, _next) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const anyError = error as any;

  if (anyError?.name === "ZodError" && Array.isArray(anyError.issues)) {
    return res.status(400).json({
      error: "Invalid request payload",
      details: anyError.issues.map((issue: { path: PropertyKey[]; message: string }) => ({
        path: issue.path.map(String).join("."),
        message: issue.message,
      })),
    });
  }

  if (anyError?.type === "entity.parse.failed") {
    return res.status(400).json({
      error: "Malformed request body",
      details: [{ message: anyError?.message ?? "Request body could not be parsed." }],
    });
  }

  if (anyError?.type === "entity.too.large") {
    return res.status(413).json({ error: "Request payload too large" });
  }

  if (typeof anyError?.message === "string" && anyError.message.startsWith(dockerRequiredMarker)) {
    return res.status(503).json({ error: anyError.message });
  }

  logger.error(
    { err: error, reqId: (req as unknown as { id?: number }).id },
    "Unhandled request error",
  );
  return res.status(500).json({
    error: String(anyError?.message ?? "Internal server error"),
  });
};
