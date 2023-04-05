import type { SupportedCDNS } from "cdn-resolve";
import { normalizeCdnUrl, parsePackage } from "cdn-resolve";
import type { Loader, Plugin } from "esbuild";
import { ofetch } from "ofetch";
import { extname, join } from "path-browserify";
import { legacy, resolve } from "resolve.exports";

export interface Options {
  /**
   * The CDN to use for resolving imports.
   * @default "esm"
   */
  cdn?: SupportedCDNS;

  /**
   * Exclude certain packages from being resolved by the CDN.
   */
  exclude?: string[];

  /**
   * Versions to use for certain packages.
   */
  versions?: Record<string, string>;

  /**
   * The default loader to use for files, that are doesn't have a file extension
   * @default js
   */
  defaultLoader?: Loader;
}

function resolveOptions(options?: Options): Required<Options> {
  return {
    cdn: options?.cdn ?? "esm",
    exclude: options?.exclude || [],
    versions: options?.versions || {},
    defaultLoader: options?.defaultLoader || "js"
  };
}

// https://esbuild.github.io/api/#resolve-extensions
const RESOLVE_EXTENSIONS = [".tsx", ".ts", ".jsx", ".js", ".json"];

function isExternal(module: string, external: string[]) {
  if (!Array.isArray(external)) {
    throw new TypeError("external must be an array");
  }

  return external.some((pattern) => {
    return pattern === module || pattern.startsWith(`${pattern}/`);
  });
}

export function CDNImportPlugin(options?: Options): Plugin {
  const resolvedOptions = resolveOptions(options);
  return {
    name: "esbuild-cdn-imports",
    setup(ctx) {
      ctx.onResolve(
        {
          filter: /^https?:\/\//
        },
        async (args) => {
          return {
            path: args.path,
            namespace: "cdn-imports"
          };
        }
      );

      ctx.onResolve(
        {
          filter: /.*/,
          namespace: "cdn-imports"
        },
        async (args) => {
          if (isExternal(args.path, ctx.initialOptions.external || [])) {
            return {
              path: args.path,
              external: true
            };
          }

          if (!args.path.startsWith(".")) {
            return {
              path: normalizeCdnUrl(resolvedOptions.cdn, args.path),
              namespace: "cdn-imports"
            };
          }

          const url = new URL(args.pluginData.url);

          if (resolvedOptions.cdn === "esm") {
            url.pathname = join("../", args.path);
          } else if (
            resolvedOptions.cdn === "skypack" ||
            resolvedOptions.cdn === "jsdelivr"
          ) {
            url.pathname = join(url.pathname, args.path);
          } else if (resolvedOptions.cdn === "unpkg") {
            url.pathname = join(url.pathname, "../", args.path);
          } else {
            throw new Error(`Unsupported CDN: ${resolvedOptions.cdn}`);
          }

          return {
            path: url.toString(),
            namespace: "cdn-imports"
          };
        }
      );

      ctx.onResolve(
        {
          filter: /.*/
        },
        async (args) => {
          if (args.kind === "entry-point") {
            return null;
          }

          if (args.path[0] === ".") {
            throw new Error(`Unexpected relative import: ${args.path}`);
          }

          const parsed = parsePackage(args.path);

          if (resolvedOptions.exclude.includes(parsed.name)) {
            return null;
          }

          if (isExternal(args.path, ctx.initialOptions.external || [])) {
            return {
              external: true,
              path: args.path
            };
          }

          if (resolvedOptions.versions[parsed.name]) {
            parsed.version = resolvedOptions.versions[parsed.name];
          }

          let subpath = parsed.path;

          if (!subpath) {
            const pkg = await ofetch(
              normalizeCdnUrl(
                resolvedOptions.cdn,
                `${parsed.name}@${parsed.version}/package.json`
              ),
              {
                parseResponse: JSON.parse
              }
            );

            const resolvedExport =
              resolve(pkg, ".", {
                require:
                  args.kind === "require-call" ||
                  args.kind === "require-resolve"
              }) || legacy(pkg);

            if (typeof resolvedExport === "string") {
              subpath = resolvedExport.replace(/^\.?\/?/, "/");
            } else if (
              Array.isArray(resolvedExport) &&
              resolvedExport.length > 0
            ) {
              subpath = resolvedExport[0].replace(/^\.?\/?/, "/");
            }
          }

          if (subpath && subpath[0] !== "/") {
            subpath = `/${subpath}`;
          }

          return {
            path: normalizeCdnUrl(
              resolvedOptions.cdn,
              `${parsed.name}@${parsed.version}${subpath}`
            ),
            namespace: "cdn-imports"
          };
        }
      );

      ctx.onLoad(
        {
          filter: /.*/,
          namespace: "cdn-imports"
        },
        async (args) => {
          const res = await ofetch.native(args.path);

          if (!res.ok) {
            throw new Error(`failed to load ${res.url}: ${res.status}`);
          }
          let loader: Loader = resolvedOptions.defaultLoader;
          const ext = extname(res.url);

          if (RESOLVE_EXTENSIONS.includes(ext)) {
            loader = ext.slice(1) as Loader;
          } else if (ext === ".mjs" || ext === ".cjs") {
            loader = "js";
          }

          return {
            contents: new Uint8Array(await res.arrayBuffer()),
            loader,
            pluginData: {
              url: res.url
            }
          };
        }
      );
    }
  };
}

