import process from "node:process";
import {
  builtinModules,
} from "node:module";
import { writeFile } from "node:fs/promises";

async function run() {
  const filteredModules = builtinModules.filter((module) => {
    return !module.startsWith("_") && !module.startsWith("internal/");
  });

  const modules = [...filteredModules, ...filteredModules.map((module) => `node:${module}`)];

  const result = `export const builtinModules = [
  ${modules.map((module) => `"${module}"`).join(",\n  ")}
] as const;`;

  await writeFile("src/builtin-modules.ts", result);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
