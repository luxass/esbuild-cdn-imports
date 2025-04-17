import { assert, describe, expect, it } from "vitest";
import { buildWithCDN } from "../__utils";

describe("jsdelivr: agents", () => {
  it("resolve agents with esm enabled", async () => {
    const { result } = await buildWithCDN(
      "test/fixtures/agents",
      {
        cdn: "jsdelivr",
        fileName: "agents.ts",
        allowWarnings: true,
      },
    );

    assert(result.outputFiles, "outputFiles should be defined");
    const outputText = result.outputFiles[0].text;

    expect(outputText).toContain("throw new Error('Failed to bundle");
  });

  it("resolve agents without esm", async () => {
    const { result } = await buildWithCDN(
      "test/fixtures/agents",
      {
        cdn: "jsdelivr",
        fileName: "agents.ts",
        useJsdelivrEsm: false,
        allowWarnings: true,
        esbuildOptions: {
          write: false,
          external: [
            "cloudflare:workers",
          ],
        },
      },
    );

    assert(result.outputFiles, "outputFiles should be defined");
    const outputText = result.outputFiles[0].text;
    expect(outputText).not.toContain("throw new Error('Failed to bundle");
  });
});
