import { build } from "esbuild";
import { expect, test } from "vitest";

import { CDNImportPlugin } from "../src";

test("resolve @vue/reactivity from jsdelivr", async () => {
  const result = await build({
    entryPoints: ["./test/fixtures/vue-reactivity.ts"],
    format: "esm",
    bundle: true,
    write: false,
    plugins: [
      CDNImportPlugin({
        cdn: "jsdelivr"
      })
    ],
    outfile: "./test/fixtures/out/file.js"
  });
  expect({
    errors: result.errors,
    warnings: result.warnings
  }).toEqual({ errors: [], warnings: [] });

  const matchedImports = result.outputFiles[0].text.match(
    /^\/\/ cdn-imports:https:\/\/cdn.jsdelivr.net\/npm\//gm
  );

  expect(matchedImports).toHaveLength(3);
});

test("resolve @vue/reactivity@3.1.5 from jsdelivr", async () => {
  const result = await build({
    entryPoints: ["./test/fixtures/vue-reactivity.ts"],
    format: "esm",
    bundle: true,
    write: false,
    plugins: [
      CDNImportPlugin({
        cdn: "jsdelivr",
        versions: {
          "@vue/reactivity": "3.1.5"
        }
      })
    ],
    outfile: "./test/fixtures/out/file.js"
  });
  expect({
    errors: result.errors,
    warnings: result.warnings
  }).toEqual({ errors: [], warnings: [] });

  const matchedImports = result.outputFiles[0].text.match(
    /^\/\/ cdn-imports:https:\/\/cdn.jsdelivr.net\/npm\//gm
  );
  expect(result.outputFiles[0].text).toMatch(
    /^\/\/ cdn-imports:https:\/\/cdn.jsdelivr.net\/npm\/@vue\/reactivity@3\.1\.5/gm
  );

  expect(matchedImports).toHaveLength(3);
});

test("resolve react from jsdelivr with exclude", async () => {
  const result = await build({
    entryPoints: ["./test/fixtures/react.tsx"],
    format: "esm",
    bundle: true,
    write: false,
    plugins: [
      CDNImportPlugin({
        cdn: "jsdelivr",
        exclude: ["react"]
      })
    ],
    outfile: "./test/fixtures/out/file.js"
  });
  expect({
    errors: result.errors,
    warnings: result.warnings
  }).toEqual({ errors: [], warnings: [] });

  expect(result.outputFiles[0].text)
    .toBe(`// test/fixtures/node_modules/react/index.js
function useState(value) {
  return [1, () => {
  }];
}
function useEffect() {
  return () => {
  };
}
function React() {
  return {
    useState,
    useEffect
  };
}

// test/fixtures/react.tsx
function Page() {
  const [count, setCount] = useState(0);
  return /* @__PURE__ */ React.createElement("div", null);
}
export {
  Page
};
`);
});
