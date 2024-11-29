// @ts-check
import { luxass } from "@luxass/eslint-config";

export default luxass({
  formatters: true,
}, {
  ignores: ["**/test/fixtures/**/*"],
});
