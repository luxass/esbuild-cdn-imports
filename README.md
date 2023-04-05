<h1 align="center">CDN Import Plugin</h1>

This plugin intercepts imports and resolves them to a CDN URL. It is useful for places where the filesystem is not available, such as in the browser.
<br/>
<br/>

## 📦 Installation

```sh
pnpm install -D esbuild esbuild-plugin-cdn-imports
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

## 💻 Development

- Clone this repository
- Enable [Corepack](https://github.com/nodejs/corepack) using `corepack enable` (use `npm i -g corepack` for Node.js < 16.10)
- Install dependencies using `pnpm install`
- Run tests using `pnpm dev`

Published under [MIT License](./LICENCE).
