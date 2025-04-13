import { assert, describe, expect, it } from "vitest";
import { buildWithCDN } from "../__utils";

describe("unpkg: @vue/reactivity", () => {
  it("resolve @vue/reactivity", async () => {
    const { result } = await buildWithCDN(
      "test/fixtures/vue-reactivity",
      {
        cdn: "unpkg",
        fileName: "vue-reactivity.ts",
      },
    );

    assert(result.outputFiles, "outputFiles should be defined");

    const outputText = result.outputFiles[0].text;

    expect(outputText).toMatch(
      /^\/\/ cdn-imports:https:\/\/unpkg.com\/@vue\/reactivity/gm,
    );

    const matchedImports = result.outputFiles[0].text.match(
      /^\/\/ cdn-imports:https:\/\/unpkg.com\/@vue\//gm,
    );

    expect(matchedImports).toHaveLength(4);
  });

  it("resolve @vue/reactivity@3.1.5", async () => {
    const { result } = await buildWithCDN(
      "test/fixtures/vue-reactivity",
      {
        cdn: "unpkg",
        fileName: "vue-reactivity.ts",
        versions: {
          "@vue/reactivity": "3.1.5",
        },
      },
    );

    assert(result.outputFiles, "outputFiles should be defined");
    const outputText = result.outputFiles[0].text;

    expect(outputText).toMatchSnapshot();

    expect(outputText).toMatch(
      /^\/\/ cdn-imports:https:\/\/unpkg.com\/@vue\/reactivity@3\.1\.5/gm,
    );

    const matchedImports = result.outputFiles[0].text.match(
      /^\/\/ cdn-imports:https:\/\/unpkg.com\/@vue\//gm,
    );

    expect(matchedImports).toHaveLength(3);
  });
});
