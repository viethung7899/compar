import { describe, it, expect, assert } from "vitest";
import {Parser, item, makeInput} from "../src/parser"

describe("Item parser", () => {
  it("should not be able to parse an item on empty string", () => {
    const input = makeInput("");
    const result = item.parse(input);
    expect(result.isError).toBe(true);
  })

  it("should not be able to parse an item on non-empty string", () => {
    const input = makeInput("a");
    const result = item.parse(input);
    assert(!result.isError);
    expect(result.value).toBe("a");
  })
});