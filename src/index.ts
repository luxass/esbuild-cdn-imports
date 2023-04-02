import type { SupportedCDNS } from "cdn-resolve";
import { normalizeCdnUrl, parsePackage } from "cdn-resolve";
import type { Loader, Plugin } from "esbuild";
import { ofetch } from "ofetch";
import { join } from "path-browserify";
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
}

function resolveOptions(options?: Options): Required<Options> {
  return {
    cdn: options?.cdn ?? "esm",
    exclude: [],
    versions: {}
  };
}

function isExternal(module: string, external: string[]) {
  if (!Array.isArray(external)) {
    throw new TypeError("external must be an array");
  }

  return external.some((pattern) => {
    return pattern === module || pattern.startsWith(`${pattern}/`);
  });
}

function CDNImportPlugin(options?: Options): Plugin {
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
          url.pathname = join("../", args.path);
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
          console.log("ON RESOLVE WITHOUT NAMESPACE ARGS", args);
          if (args.path[0] === ".") {
            throw new Error(`Unexpected relative import: ${args.path}`);
          }

          if (isExternal(args.path, ctx.initialOptions.external || [])) {
            return {
              external: true,
              path: args.path
            };
          }

          const parsed = parsePackage(args.path);
          let subpath = parsed.path;
          console.log("oa", parsed);

          if (!subpath) {
            console.log(
              "fetching package.json",
              `${parsed.name}@${parsed.version}/package.json`,
              normalizeCdnUrl(
                resolvedOptions.cdn,
                `${parsed.name}@${parsed.version}/package.json`
              )
            );
            const pkg = await ofetch(
              normalizeCdnUrl(
                resolvedOptions.cdn,
                `${parsed.name}@${parsed.version}/package.json`
              ),
              {
                parseResponse: JSON.parse
              }
            );

            console.log("pkg", pkg);

            const p =
              resolve(pkg, ".", {
                require:
                  args.kind === "require-call" ||
                  args.kind === "require-resolve"
              }) || legacy(pkg);

            if (Array.isArray(p) && p.length > 0) {
              subpath = p[0].replace(/^\.?\/?/, "/");
            }
          }

          console.log("subpath", subpath);

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
          const res = await ofetch(args.path);
          if (!res.ok) {
            throw new Error(`failed to load ${res.url}: ${res.status}`);
          }
          console.log(res.url);
          // const loader = inferLoader(res.url);
          return {
            contents: new Uint8Array(await res.arrayBuffer()),
            loader: "js" as Loader,
            pluginData: {
              url: res.url
            }
          };
        }
      );
    }
  };
}

export default CDNImportPlugin;
