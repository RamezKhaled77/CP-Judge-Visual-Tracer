import { describe, expect, it } from "vitest";
import request from "supertest";
import app from "../app";

describe("API Routes Contract", () => {
  describe("GET /api/healthz", () => {
    it("returns 200 with status ok", async () => {
      const res = await request(app).get("/api/healthz");
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ status: "ok" });
    });
  });

  describe("GET /api/problems", () => {
    it("returns array of built-in problems without internal resource limits", async () => {
      const res = await request(app).get("/api/problems");
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(1);

      const first = res.body[0];
      expect(first).toHaveProperty("id");
      expect(first).toHaveProperty("title");
      expect(first).toHaveProperty("difficulty");
      expect(first).toHaveProperty("description");
      expect(first).toHaveProperty("starterCode");
      expect(first).toHaveProperty("testCases");
      expect(first).not.toHaveProperty("limits");
    });
  });

  describe("GET /api/problems/:problemId", () => {
    it("returns problem details for valid ID", async () => {
      const res = await request(app).get("/api/problems/sum-two");
      expect(res.status).toBe(200);
      expect(res.body.id).toBe("sum-two");
      expect(res.body).not.toHaveProperty("limits");
    });

    it("returns 404 for unknown problem ID", async () => {
      const res = await request(app).get("/api/problems/non-existent-id");
      expect(res.status).toBe(404);
      expect(res.body).toEqual({ error: "Problem not found" });
    });
  });

  describe("POST /api/submissions validation", () => {
    it("returns 400 Bad Request when payload is empty or invalid", async () => {
      const res = await request(app)
        .post("/api/submissions")
        .send({ code: "", problemId: "" });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe("Invalid request payload");
      expect(res.body.details).toBeDefined();
    });

    it("returns 404 when problem does not exist", async () => {
      const res = await request(app)
        .post("/api/submissions")
        .send({ code: "int main(){}", problemId: "ghost-problem" });

      expect(res.status).toBe(404);
      expect(res.body).toEqual({ error: "Problem not found" });
    });
  });

  describe("POST /api/trace validation", () => {
    it("returns 400 Bad Request when code is missing", async () => {
      const res = await request(app)
        .post("/api/trace")
        .send({ code: "", input: "" });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe("Invalid request payload");
    });
  });

  describe("GET /api/trace/:traceId", () => {
    it("returns 404 for unknown trace ID", async () => {
      const res = await request(app).get("/api/trace/tr_unknown_123");
      expect(res.status).toBe(404);
      expect(res.body).toEqual({ error: "Trace not found" });
    });

    it("returns 200 and saved trace data when trace ID exists in repository", async () => {
      const { saveTrace } = await import("../lib/trace-repo");
      const saved = await saveTrace({
        source: "int main() { int x = 10; return 0; }",
        input: "test-input",
        trace: [
          {
            step: 0,
            line: 1,
            function: "main",
            locals: [{ name: "x", type: "int", value: "10" }],
            stack: [{ function: "main", line: 1 }],
            arrays: [],
          },
        ],
        truncated: false,
        error: null,
      });

      expect(saved.id).toBeDefined();

      const res = await request(app).get(`/api/trace/${saved.id}`);
      expect(res.status).toBe(200);
      expect(res.body.id).toBe(saved.id);
      expect(res.body.source).toBe(saved.source);
      expect(res.body.trace).toHaveLength(1);
      expect(res.body.trace[0].locals[0]).toEqual({ name: "x", type: "int", value: "10" });
    });
  });
});

