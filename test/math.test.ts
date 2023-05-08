import { describe, it, expect, assert } from "vitest";
import math from "../src/math";
import { makeInput } from "../src/parser";

describe("Math parser", () => {
  it("should fail to parse an empty string", () => {
    const input = makeInput("");
    const result = math.expr.parse(input);
    assert(result.isError);
  })
  it("should parse a number", () => {
    const input = makeInput("12");
    const result = math.expr.parse(input);
    assert(!result.isError);
    expect(result.value.type).toBe("number");
    const value = math.evaluate(result.value);
    expect(value).toBe(12);
  })
  it("should not parse a character", () => {
    const input = makeInput("a");
    const result = math.expr.parse(input);
    assert(result.isError);
  })
  it("should not parse a simple expression", () => {
    const input = makeInput("1 + 2");
    const result = math.expr.parse(input);
    assert(!result.isError);
    const value = math.evaluate(result.value);
    expect(value).toBe(3);
  })
  it("should parse an expression with plus or minus", () => {
    const input = makeInput("4 - 2 + 3");
    const result = math.expr.parse(input);
    assert(!result.isError);
    const value = math.evaluate(result.value);
    expect(value).toBe(5);
  })
  it("should parse an expression with add and multiply", () => {
    const input = makeInput("1 + 2 * 3");
    const result = math.expr.parse(input);
    assert(!result.isError);
    const value = math.evaluate(result.value);
    expect(value).toBe(7);
  })
  it("should parse an expression with parenthesis", () => {
    const input = makeInput("(1 + 2) * 3");
    const result = math.expr.parse(input);
    assert(!result.isError);
    const value = math.evaluate(result.value);
    expect(value).toBe(9);
  })
})