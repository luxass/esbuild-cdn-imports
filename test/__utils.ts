import type { BuildOptions } from "esbuild";
import type { TestdirFromOptions, TestdirOptions } from "vitest-testdirs";
import type { Options as CDNImportsOptions } from "../src";
import { join } from "node:path";
import { build as esbuildBuild } from "esbuild";
import { expect } from "vitest";
import { testdir } from "vitest-testdirs";
import { CDNImports } from "../src";

interface TestSetupOptions {
  cdn: CDNImportsOptions["cdn"];
  versions?: CDNImportsOptions["versions"];
  exclude?: CDNImportsOptions["exclude"];
  useJsdelivrEsm?: CDNImportsOptions["useJsdelivrEsm"];
  defaultLoader?: CDNImportsOptions["defaultLoader"];
  relativeImportsHandler?: CDNImportsOptions["relativeImportsHandler"];
  testdirOptions?: TestdirFromOptions & TestdirOptions;
  esbuildOptions?: BuildOptions;
  fileName: string;
  allowWarnings?: boolean;
}
export async function buildWithCDN(
  fixturePath: string,
  options: TestSetupOptions,
) {
  const testdirPath = await testdir.from(fixturePath, options.testdirOptions);

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
        defaultLoader: options.defaultLoader,
        useJsdelivrEsm: options.useJsdelivrEsm,
        relativeImportsHandler: options.relativeImportsHandler,
        debug: true,
      }),
    ],
    outfile: join(testdirPath, "dist/out.js"),
  };

  const result = await esbuildBuild({
    ...buildOptions,
    ...options.esbuildOptions,
  });

  if (!options.allowWarnings) {
    expect(result.warnings).toEqual([]);
  }

  expect(result.errors).toEqual([]);

  return {
    testdirPath,
    result,
  };
}
