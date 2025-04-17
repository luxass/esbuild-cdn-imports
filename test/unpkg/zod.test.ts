import { assert, describe, expect, it } from "vitest";
import { buildWithCDN } from "../__utils";

describe("unpkg: zod", () => {
  it("resolve zod", async () => {
    const { result } = await buildWithCDN(
      "test/fixtures/zod",
      {
        cdn: "unpkg",
        fileName: "zod.ts",
      },
    );

    assert(result.outputFiles, "outputFiles should be defined");
    const outputText = result.outputFiles[0].text;

    expect(outputText).toMatch(
      /^\/\/ cdn-imports:https:\/\/unpkg.com\/zod/gm,
    );
  });

  it("resolve zod@3.24.2", async () => {
    const { result } = await buildWithCDN(
      "test/fixtures/zod",
      {
        cdn: "unpkg",
        fileName: "zod.ts",
        versions: {
          zod: "3.24.2",
        },
      },
    );

    assert(result.outputFiles, "outputFiles should be defined");
    const outputText = result.outputFiles[0].text;

    expect(outputText).toMatch(
      /^\/\/ cdn-imports:https:\/\/unpkg.com\/zod@3\.24\.2/gm,
    );
  });
});
