import type { BuildOptions } from "esbuild";
import type { TestdirFromOptions, TestdirOptions } from "vitest-testdirs";
import { join } from "node:path";
import { build as esbuildBuild } from "esbuild";
import { expect } from "vitest";
import { testdir } from "vitest-testdirs";
import { CDNImports } from "../src";

interface TestSetupOptions {
  cdn: "esm" | "unpkg" | "jsdelivr" | "skypack";
  versions?: Record<string, string>;
  exclude?: string[];
  testdirOptions?: TestdirFromOptions & TestdirOptions;
  esbuildOptions?: BuildOptions;
  fileName: string;
}
export async function buildWithCDN(
  fixturePath: string,
  options: TestSetupOptions,
) {
  const testdirPath = await testdir.from(fixturePath);

  if (options.cdn == null || !options.cdn) {
    throw new Error("cdn option is required");
  }

  const buildOptions: BuildOptions = {
    entryPoints: [join(testdirPath, `src/${options.fileName}`)],
    format: "esm",
    bundle: true,
    write: false,
    plugins: [
      CDNImports({
        cdn: options.cdn,
        versions: options.versions,
        exclude: options.exclude,
      }),
    ],
    outfile: join(testdirPath, "out.js"),
  };

  const result = await esbuildBuild({
    ...buildOptions,
    ...options.esbuildOptions,
  });

  expect({
    errors: result.errors,
    warnings: result.warnings,
  }).toEqual({ errors: [], warnings: [] });

  return {
    testdirPath,
    result,
  };
}
