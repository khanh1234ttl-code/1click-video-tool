import { describe, expect, it } from "vitest";
import { joinPath } from "./paths";

describe("joinPath", () => {
  it("uses the folder's own separator", () => {
    expect(joinPath("D:\\Ảnh\\dự án", "_1click", "raw")).toBe("D:\\Ảnh\\dự án\\_1click\\raw");
    expect(joinPath("/Users/an/Ảnh", "Output")).toBe("/Users/an/Ảnh/Output");
    expect(joinPath("/Users/an/Ảnh/", "Output")).toBe("/Users/an/Ảnh/Output");
  });
});
