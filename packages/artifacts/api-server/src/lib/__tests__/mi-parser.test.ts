import { describe, expect, it } from "vitest";
import { miField, miObjects, miFrames, miVariables, miChildren } from "../cpp-runner";

describe("GDB MI Parsers", () => {
  describe("miField", () => {
    it("extracts simple string values", () => {
      const record = 'reason="breakpoint-hit",bkptno="1",func="main"';
      expect(miField(record, "reason")).toBe("breakpoint-hit");
      expect(miField(record, "bkptno")).toBe("1");
      expect(miField(record, "func")).toBe("main");
    });

    it("handles escaped quotes and backslashes properly", () => {
      const record = 'msg="Hello \\"world\\" from \\\\tmp\\\\dir"';
      expect(miField(record, "msg")).toBe('Hello "world" from \\tmp\\dir');
    });

    it("returns empty string when field is absent", () => {
      const record = 'func="main"';
      expect(miField(record, "missing")).toBe("");
    });
  });

  describe("miObjects", () => {
    it("extracts single balanced object", () => {
      const record = 'result={level="0",addr="0x1234",func="main"}';
      const extracted = miObjects(record, "result={");
      expect(extracted).toEqual(['level="0",addr="0x1234",func="main"']);
    });

    it("extracts multiple nested objects with braces inside quotes", () => {
      const record =
        'stack=[frame={level="0",func="solve",args=[{name="a",value="{1, 2}"}]},frame={level="1",func="main"}]';
      const frames = miObjects(record, "frame={");
      expect(frames).toHaveLength(2);
      expect(frames[0]).toBe('level="0",func="solve",args=[{name="a",value="{1, 2}"}]');
      expect(frames[1]).toBe('level="1",func="main"');
    });
  });

  describe("miFrames", () => {
    it("extracts and maps call stack frames", () => {
      const record =
        'stack=[frame={level="0",addr="0x401156",func="fib",file="main.cpp",fullname="/work/main.cpp",line="6"},frame={level="1",addr="0x401200",func="main",file="main.cpp",fullname="/work/main.cpp",line="15"}]';
      const frames = miFrames(record);
      expect(frames).toEqual([
        { function: "fib", line: 6, file: "/work/main.cpp" },
        { function: "main", line: 15, file: "/work/main.cpp" },
      ]);
    });

    it("filters out frames with non-positive line numbers", () => {
      const record =
        'stack=[frame={level="0",func="??",file="??",line="0"},frame={level="1",func="main",fullname="/work/main.cpp",line="12"}]';
      const frames = miFrames(record);
      expect(frames).toEqual([
        { function: "main", line: 12, file: "/work/main.cpp" },
      ]);
    });
  });

  describe("miVariables", () => {
    it("parses scalars, pointers, and aggregates without value", () => {
      const record =
        'variables=[{name="x",arg="0",type="int",value="42"},{name="vec",type="std::vector<int>"},{name="msg",type="char *",value="0x402000 \\"test\\""}]';
      const vars = miVariables(record);
      expect(vars).toEqual([
        { name: "x", type: "int", value: "42" },
        { name: "vec", type: "std::vector<int>", value: null },
        { name: "msg", type: "char *", value: '0x402000 "test"' },
      ]);
    });
  });

  describe("miChildren", () => {
    it("parses varobj children correctly", () => {
      const record =
        'numchild="2",children=[child={name="var1.public",exp="public",numchild="2"},child={name="var1.x",exp="x",numchild="0",type="int",value="10"}]';
      const children = miChildren(record);
      expect(children).toEqual([
        { name: "var1.public", exp: "public", type: "", value: null, numchild: 2 },
        { name: "var1.x", exp: "x", type: "int", value: "10", numchild: 0 },
      ]);
    });
  });
});
