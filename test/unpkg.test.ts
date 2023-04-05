import { build } from "esbuild";
import { expect, test } from "vitest";

import { CDNImportPlugin } from "../src";

test("resolve @vue/reactivity from unpkg.com", async () => {
  const result = await build({
    entryPoints: ["./test/fixtures/vue-reactivity.ts"],
    format: "esm",
    bundle: true,
    write: false,
    plugins: [
      CDNImportPlugin({
        cdn: "unpkg"
      })
    ],
    outfile: "./test/fixtures/out/file.js"
  });
  expect({
    errors: result.errors,
    warnings: result.warnings
  }).toEqual({ errors: [], warnings: [] });

  const matchedImports = result.outputFiles[0].text.match(
    /^\/\/ cdn-imports:https:\/\/unpkg.com\//gm
  );

  expect(matchedImports).toHaveLength(3);
});

test("resolve @vue/reactivity@3.1.5 from unpkg.com", async () => {
  const result = await build({
    entryPoints: ["./test/fixtures/vue-reactivity.ts"],
    format: "esm",
    bundle: true,
    write: false,
    plugins: [
      CDNImportPlugin({
        cdn: "unpkg",
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
    /^\/\/ cdn-imports:https:\/\/unpkg.com\//gm
  );

  expect(result.outputFiles[0].text).toMatch(
    /^\/\/ cdn-imports:https:\/\/unpkg.com\/@vue\/reactivity@3\.1\.5/gm
  );

  expect(matchedImports).toHaveLength(3);
});

test("resolve react from unpkg.com with exclude", async () => {
  const result = await build({
    entryPoints: ["./test/fixtures/react.tsx"],
    format: "esm",
    bundle: true,
    write: false,
    plugins: [
      CDNImportPlugin({
        cdn: "unpkg",
        exclude: ["react"]
      })
    ],
    outfile: "./test/fixtures/out/file.js"
  });
  expect({
    errors: result.errors,
    warnings: result.warnings
  }).toEqual({ errors: [], warnings: [] });

  expect(result.outputFiles[0].text).toBe(`// test/fixtures/node_modules/react/index.js
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
