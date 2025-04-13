import { assert, describe, expect, it } from "vitest";
import { buildWithCDN } from "../__utils";

describe("unpkg: react", () => {
  it("resolve react", async () => {
    const { result } = await buildWithCDN(
      "test/fixtures/react",
      {
        cdn: "unpkg",
        fileName: "react.tsx",
      },
    );

    assert(result.outputFiles, "outputFiles should be defined");
    const outputText = result.outputFiles[0].text;

    expect(outputText).toMatch(
      /^\/\/ cdn-imports:https:\/\/unpkg.com\/react/gm,
    );
  });

  it("resolve react@18.2.0", async () => {
    const { result } = await buildWithCDN(
      "test/fixtures/react",
      {
        cdn: "unpkg",
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
      /^\/\/ cdn-imports:https:\/\/unpkg.com\/react@18\.2\.0/gm,
    );
  });
});
