# esbuild-plugin-cdn-imports

[![npm version][npm-version-src]][npm-version-href]
[![npm downloads][npm-downloads-src]][npm-downloads-href]

✨ Intercepts imports and resolves them to a CDN URL - useful for places where the filesystem is not available, such as in the browser.

## 📦 Installation

```sh
npm install -D esbuild esbuild-plugin-cdn-imports
```

## 📚 Usage

Add this to your build file

```js
import { build } from "esbuild";
import { CDNImports } from "esbuild-plugin-cdn-imports";

const yourConfig = {};

await build({
  ...yourConfig,
  plugins: [
    CDNImports({
      // Available cdns: "esm", "unpkg", "jsdelivr", "skypack"
      cdn: "esm",
      versions: {
        // The version of the package to use
        // If not specified, the latest version will be used
        "react": "17.0.2",
        "react-dom": "17.0.2"
      },
      // This will not be resolved to a CDN URL
      exclude: ["@prisma/client"]
    })
  ]
});
```

## 📄 License

Published under [MIT License](./LICENSE).

<!-- Badges -->

[npm-version-src]: https://img.shields.io/npm/v/esbuild-plugin-cdn-imports?style=flat&colorA=18181B&colorB=4169E1
[npm-version-href]: https://npmjs.com/package/esbuild-plugin-cdn-imports
[npm-downloads-src]: https://img.shields.io/npm/dm/esbuild-plugin-cdn-imports?style=flat&colorA=18181B&colorB=4169E1
[npm-downloads-href]: https://npmjs.com/package/esbuild-plugin-cdn-imports
