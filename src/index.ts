import type { SupportedCDNS } from "cdn-resolve";
import type { Loader, OnResolveArgs, Plugin, PluginBuild } from "esbuild";
import { builtinModules } from "node:module";
import { normalizeCdnUrl, parsePackage } from "cdn-resolve";
import { legacy, resolve } from "resolve.exports";
import { extname, join } from "./path";

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
   * The default loader to use for files, that doesn't have a file extension
   * @default js
   */
  defaultLoader?: Loader;

  /**
   * A callback that is called when a relative import is encountered.
   * @param {OnResolveArgs} args The arguments passed to the `onResolve` callback.
   * @param {PluginBuild} build The `PluginBuild` instance.
   * @returns {ReturnType<Parameters<PluginBuild["onResolve"]>[1]>} The result of the `onResolve` callback.
   */
  relativeImportsHandler?: (args: OnResolveArgs, build: PluginBuild) => ReturnType<Parameters<PluginBuild["onResolve"]>[1]>;

  /**
   * Use jsdelivr ESM for resolving imports.
   * @default true
   */
  useJsdelivrEsm?: boolean;
}

function resolveOptions(options?: Options) {
  return {
    cdn: options?.cdn ?? "esm",
    exclude: options?.exclude || [],
    versions: options?.versions || {},
    defaultLoader: options?.defaultLoader || "js",
    relativeImportsHandler: options?.relativeImportsHandler,
    useJsdelivrEsm: options?.useJsdelivrEsm || true,
  };
}

// https://esbuild.github.io/api/#resolve-extensions
const RESOLVE_EXTENSIONS = [".tsx", ".ts", ".jsx", ".js", ".json"];

function isExternal(module: string, external: string[]) {
  if (!Array.isArray(external)) {
    throw new TypeError("external must be an array");
  }

  return external.find((it) => it === module || it.startsWith(`${it}/`));
}

const URL_RE = /^https?:\/\//;

export function CDNImports(options?: Options): Plugin {
  const resolvedOptions = resolveOptions(options);

  return {
    name: "esbuild-cdn-imports",
    setup(build) {
      const externals = [
        ...(build.initialOptions.external || []),
        ...(builtinModules),
        ...(builtinModules.map((it) => `node:${it}`)),
      ];

      // intercept import paths starting with "http:" and "https:" so
      // esbuild doesn't attempt to map them to a file system location.
      build.onResolve({ filter: URL_RE }, (args) => ({
        path: args.path,
        namespace: "cdn-imports",
      }));

      // intercept all import paths inside downloaded files and resolve
      // them against the original URL of the downloaded file
      build.onResolve({ filter: /.*/, namespace: "cdn-imports" }, (args) => {
        if (isExternal(args.path, externals)) {
          return {
            external: true,
            path: args.path,
          };
        }

        if (!args.path.startsWith(".")) {
          let path = args.path;

          if (args.path.startsWith("/npm/") && resolvedOptions.cdn === "jsdelivr") {
            path = args.path.replace(/^\/npm\//, "/");
          }

          return {
            path: normalizeCdnUrl(resolvedOptions.cdn, path),
            namespace: "cdn-imports",
          };
        }

        const url = new URL(args.pluginData.url);

        const isFile = extname(url.pathname) !== "";
        const isLocalPath = args.path.startsWith("./");

        if (resolvedOptions.cdn === "jsdelivr" && isLocalPath) {
          if (isFile) {
            url.pathname = url.pathname.replace(/\/[^/]+$/, "");
          }
          url.pathname = join(url.pathname, args.path.slice(1));
        } else {
          url.pathname = join(url.pathname, "../", args.path);
        }

        return {
          path: url.toString(),
          namespace: "cdn-imports",
        };
      });

      build.onResolve({ filter: /.*/ }, async (args) => {
        if (args.kind === "entry-point") {
          return null;
        }

        if (args.path.startsWith(".")) {
          if (resolvedOptions.relativeImportsHandler) {
            return resolvedOptions.relativeImportsHandler(args, build);
          }

          return null;
        }

        const parsed = parsePackage(args.path);

        if (resolvedOptions.exclude.includes(parsed.name)) {
          return null;
        }

        if (isExternal(args.path, externals)) {
          return {
            external: true,
            path: args.path,
          };
        }

        if (resolvedOptions.versions[parsed.name]) {
          parsed.version = resolvedOptions.versions[parsed.name]!;
        }

        let subpath = parsed.path;

        if (!subpath) {
          const pkg = await fetch(normalizeCdnUrl(
            resolvedOptions.cdn,
            `${parsed.name}@${parsed.version}/package.json`,
          )).then((res) => res.json());

          const resolvedExport
              = resolve(pkg, ".", {
                require:
                  args.kind === "require-call"
                  || args.kind === "require-resolve",
              }) || legacy(pkg);

          if (typeof resolvedExport === "string") {
            subpath = resolvedExport.replace(/^\.?\/?/, "/");
          } else if (Array.isArray(resolvedExport) && resolvedExport.length > 0) {
            subpath = resolvedExport[0]!.replace(/^\.?\/?/, "/");
          }
        }

        if (subpath && subpath[0] !== "/") {
          subpath = `/${subpath}`;
        }

        return {
          path: normalizeCdnUrl(
            resolvedOptions.cdn,
            `${parsed.name}@${parsed.version}${subpath}${(resolvedOptions.useJsdelivrEsm && resolvedOptions.cdn) === "jsdelivr" ? "/+esm" : ""}`,
          ),
          namespace: "cdn-imports",
        };
      });

      build.onLoad(
        {
          filter: /.*/,
          namespace: "cdn-imports",
        },
        async (args) => {
          const res = await fetch(args.path);

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
              url: res.url,
            },
          };
        },
      );
    },
  };
}
