import { assert, describe, expect, it } from "vitest";
import { buildWithCDN } from "../__utils";

describe("jsdelivr: zod", () => {
  it("resolve zod", async () => {
    const { result } = await buildWithCDN(
      "test/fixtures/zod",
      {
        cdn: "jsdelivr",
        fileName: "zod.ts",
      },
    );

    assert(result.outputFiles, "outputFiles should be defined");
    const outputText = result.outputFiles[0].text;

    expect(outputText).toMatch(
      /^\/\/ cdn-imports:https:\/\/cdn.jsdelivr.net\/npm\/zod/gm,
    );
  });

  it("resolve zod@3.24.2", async () => {
    const { result } = await buildWithCDN(
      "test/fixtures/zod",
      {
        cdn: "jsdelivr",
        fileName: "zod.ts",
        versions: {
          zod: "3.24.2",
        },
      },
    );

    assert(result.outputFiles, "outputFiles should be defined");
    const outputText = result.outputFiles[0].text;

    expect(outputText).toMatchSnapshot();

    expect(outputText).toMatch(
      /^\/\/ cdn-imports:https:\/\/cdn.jsdelivr.net\/npm\/zod@3\.24\.2/gm,
    );
  });

  describe("without jsdelivr esm flag", () => {
    it("resolve zod", async () => {
      const { result } = await buildWithCDN(
        "test/fixtures/zod",
        {
          cdn: "jsdelivr",
          fileName: "zod.ts",
          useJsdelivrEsm: false,
          versions: {
            zod: "3.24.2",
          },
        },
      );

      assert(result.outputFiles, "outputFiles should be defined");
      const outputText = result.outputFiles[0].text;
      expect(outputText).toMatchSnapshot();

      expect(outputText).toMatch(
        /^\/\/ cdn-imports:https:\/\/cdn.jsdelivr.net\/npm\/zod@3\.24\.2/gm,
      );
    });
  });
});
