import { assert, describe, expect, it } from "vitest";
import { buildWithCDN } from "../__utils";

describe("esm: zod", () => {
  it("resolve zod", async () => {
    const { result } = await buildWithCDN(
      "test/fixtures/zod",
      {
        cdn: "esm",
        fileName: "zod.ts",
      },
    );

    assert(result.outputFiles, "outputFiles should be defined");
    const outputText = result.outputFiles[0].text;

    expect(outputText).toMatch(
      /^\/\/ cdn-imports:https:\/\/esm.sh\/zod/gm,
    );
  });

  it("resolve zod@3.24.2", async () => {
    const { result } = await buildWithCDN(
      "test/fixtures/zod",
      {
        cdn: "esm",
        fileName: "zod.ts",
        versions: {
          zod: "3.24.2",
        },
      },
    );

    assert(result.outputFiles, "outputFiles should be defined");
    const outputText = result.outputFiles[0].text;

    expect(outputText).toMatch(
      /^\/\/ cdn-imports:https:\/\/esm.sh\/zod@3\.24\.2/gm,
    );
  });
});
