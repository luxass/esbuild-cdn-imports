import { defaultExclude, defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // We set the timeout to 10s because sometimes teh packages
    // are not cached and needs to be rebuilt and that takes a while.
    testTimeout: 10000,
    exclude: [
      // we don't want to look at the fixtures
      ...defaultExclude,
      "./test/fixtures/**",
    ],
  },
});
