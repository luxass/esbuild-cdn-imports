import { build } from "esbuild";
import { expect, test } from "vitest";
import { CDNImports } from "../src";

test("resolve @vue/reactivity from skypack.dev", async () => {
  const result = await build({
    entryPoints: ["./test/fixtures/vue-reactivity.ts"],
    format: "esm",
    bundle: true,
    write: false,
    plugins: [
      CDNImports({
        cdn: "skypack"
      })
    ],
    outfile: "./test/fixtures/out/file.js"
  });
  expect({
    errors: result.errors,
    warnings: result.warnings
  }).toEqual({ errors: [], warnings: [] });

  const matchedImports = result.outputFiles[0].text.match(
    /^\/\/ cdn-imports:https:\/\/cdn.skypack.dev\//gm
  );

  expect(matchedImports).toHaveLength(2);
});

test("resolve @vue/reactivity@3.1.5 from skypack.dev", async () => {
  const result = await build({
    entryPoints: ["./test/fixtures/vue-reactivity.ts"],
    format: "esm",
    bundle: true,
    write: false,
    plugins: [
      CDNImports({
        cdn: "skypack",
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
    /^\/\/ cdn-imports:https:\/\/cdn.skypack.dev\//gm
  );

  expect(result.outputFiles[0].text).toMatch(
    /^\/\/ cdn-imports:https:\/\/cdn.skypack.dev\/-\/@vue\/reactivity@v3\.1\.5/gm
  );

  expect(matchedImports).toHaveLength(2);
});

test("resolve react from skypack.dev with exclude", async () => {
  const result = await build({
    entryPoints: ["./test/fixtures/react.tsx"],
    format: "esm",
    bundle: true,
    write: false,
    plugins: [
      CDNImports({
        cdn: "skypack",
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
