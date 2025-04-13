import { assert, describe, expect, it } from "vitest";
import { buildWithCDN } from "../__utils";

describe("jsdelivr: react", () => {
  it("resolve react", async () => {
    const { result } = await buildWithCDN(
      "test/fixtures/react",
      {
        cdn: "jsdelivr",
        fileName: "react.tsx",
      },
    );

    assert(result.outputFiles, "outputFiles should be defined");
    const outputText = result.outputFiles[0].text;

    expect(outputText).toMatch(
      /^\/\/ cdn-imports:https:\/\/cdn.jsdelivr.net\/npm\/react/gm,
    );
  });

  it("resolve react@18.2.0", async () => {
    const { result } = await buildWithCDN(
      "test/fixtures/react",
      {
        cdn: "jsdelivr",
        fileName: "react.tsx",
        versions: {
          react: "18.2.0",
        },
      },
    );

    assert(result.outputFiles, "outputFiles should be defined");
    const outputText = result.outputFiles[0].text;

    expect(outputText).toMatchSnapshot();

    expect(outputText).toMatch(
      /^\/\/ cdn-imports:https:\/\/cdn.jsdelivr.net\/npm\/react@18\.2\.0/gm,
    );
  });

  describe("without jsdelivr esm flag", () => {
    it("resolve react", async () => {
      const { result } = await buildWithCDN(
        "test/fixtures/react",
        {
          cdn: "jsdelivr",
          fileName: "react.tsx",
          useJsdelivrEsm: false,
          versions: {
            react: "19.1.0",
          },
        },
      );

      assert(result.outputFiles, "outputFiles should be defined");
      const outputText = result.outputFiles[0].text;
      expect(outputText).toMatchSnapshot();

      expect(outputText).toMatch(
        /^\/\/ cdn-imports:https:\/\/cdn.jsdelivr.net\/npm\/react@19\.1\.0/gm,
      );
    });
  });
});
