import { describe, expect, it } from "vitest";
import express from "express";
import request from "supertest";
import { createJobQueue } from "../job-queue";

describe("Job Queue Middleware", () => {
  it("allows requests through up to maxConcurrent", async () => {
    const app = express();
    const queue = createJobQueue({ maxConcurrent: 2, maxQueueDepth: 2 });
    let ongoing = 0;
    let maxObserved = 0;

    app.get("/work", queue, async (_req, res) => {
      ongoing += 1;
      maxObserved = Math.max(maxObserved, ongoing);
      await new Promise((resolve) => setTimeout(resolve, 50));
      ongoing -= 1;
      res.json({ ok: true });
    });

    const [r1, r2] = await Promise.all([
      request(app).get("/work"),
      request(app).get("/work"),
    ]);

    expect(r1.status).toBe(200);
    expect(r2.status).toBe(200);
    expect(maxObserved).toBe(2);
  });

  it("queues requests up to maxQueueDepth and rejects with 429 when overflowed", async () => {
    const app = express();
    // 1 concurrent slot, 1 queue slot. The 3rd simultaneous request should fail with 429.
    const queue = createJobQueue({ maxConcurrent: 1, maxQueueDepth: 1 });

    app.get("/heavy", queue, async (_req, res) => {
      await new Promise((resolve) => setTimeout(resolve, 80));
      res.json({ ok: true });
    });

    const results = await Promise.all([
      request(app).get("/heavy"),
      request(app).get("/heavy"),
      request(app).get("/heavy"),
    ]);

    const statuses = results.map((r) => r.status);
    expect(statuses).toContain(200);
    expect(statuses).toContain(429);

    const rejected = results.find((r) => r.status === 429);
    expect(rejected?.header["retry-after"]).toBe("2");
    expect(rejected?.body.error).toMatch(/too many submissions/i);
  });
});
