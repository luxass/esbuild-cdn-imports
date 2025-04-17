import type { SupportedCDNS } from "cdn-resolve";
import type { Loader, OnResolveArgs, Plugin, PluginBuild } from "esbuild";
import { builtinModules } from "node:module";
import { extname, join } from "node:path";
import { normalize } from "node:path/posix";
import { normalizeCdnUrl, parsePackage } from "cdn-resolve";
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

  /**
   * Enable debug logging
   * @default false
   */
  debug?: boolean;
}

function resolveOptions(options?: Options) {
  return {
    cdn: options?.cdn ?? "esm",
    exclude: options?.exclude || [],
    versions: options?.versions || {},
    defaultLoader: options?.defaultLoader || "js",
    relativeImportsHandler: options?.relativeImportsHandler,
    useJsdelivrEsm: options?.useJsdelivrEsm == null ? true : options.useJsdelivrEsm,
    debug: options?.debug || false,
  };
}

// https://esbuild.github.io/api/#resolve-extensions
const RESOLVE_EXTENSIONS = [".tsx", ".ts", ".jsx", ".js", ".json"];

// Extensions to try for CJS requires that don't specify an extension
const CJS_EXTENSIONS = [".js", ".json", ".node", ".cjs"];

function isExternal(module: string, external: string[]) {
  if (!Array.isArray(external)) {
    throw new TypeError("external must be an array");
  }

  return external.find((it) => it === module || module.startsWith(`${it}/`));
}

const URL_RE = /^https?:\/\//;
const NPM_PATH_RE = /^\/npm\//;

// normalize jsdelivr paths that might include /npm/ prefix
function normalizeJsdelivrPath(pathname: string): string {
  return pathname.replace(NPM_PATH_RE, "/");
}

function normalizePath(cdn: SupportedCDNS, path: string): string {
  // first normalize the path using posix style
  const normalized = normalize(path);

  // convert backslashes to forward slashes and remove duplicate slashes
  const normalizedPath = normalized.replace(/\\+/g, "/").replace(/\/{2,}/g, "/");

  // ensure we have exactly one leading slash
  const withLeadingSlash = normalizedPath.startsWith("/") ? normalizedPath : `/${normalizedPath}`;

  return normalizeCdnUrl(cdn, withLeadingSlash);
}

async function tryFileWithExtensions(cdnType: SupportedCDNS, basePath: string, extensions: string[]) {
  for (const ext of extensions) {
    const url = `${basePath}${ext}`;
    try {
      const response = await fetch(normalizePath(cdnType, url), { method: "HEAD" });
      if (response.ok) {
        return url;
      }
    } catch {
      // Continue trying other extensions
    }
  }
  return null;
}

async function tryIndexWithExtensions(cdnType: SupportedCDNS, basePath: string, extensions: string[]) {
  for (const ext of extensions) {
    const indexPath = `${basePath}/index${ext}`;
    try {
      const response = await fetch(normalizePath(cdnType, indexPath), { method: "HEAD" });
      if (response.ok) {
        return indexPath;
      }
    } catch {
      // Continue trying other extensions
    }
  }
  return null;
}

export function CDNImports(options?: Options): Plugin {
  const resolvedOptions = resolveOptions(options);

  const debugLog = (...args: any[]) => {
    if (resolvedOptions.debug) {
      // eslint-disable-next-line no-console
      console.debug("[CDNImports]", ...args);
    }
  };

  return {
    name: "esbuild-cdn-imports",
    setup(build) {
      const externals = [
        ...(build.initialOptions.external || []),
        ...(builtinModules),
        ...(builtinModules.map((it) => `node:${it}`)),
      ];

      // keep track of package.json contents to avoid refetching
      const packageJsonCache = new Map<string, any>();

      async function getPackageJson(packageName: string, version: string) {
        const cacheKey = `${packageName}@${version}`;
        if (packageJsonCache.has(cacheKey)) {
          return packageJsonCache.get(cacheKey);
        }

        const url = normalizePath(
          resolvedOptions.cdn,
          `${packageName}@${version}/package.json`,
        );

        const res = await fetch(url);
        if (!res.ok) {
          throw new Error(`Failed to fetch package.json for ${packageName}@${version}: ${res.status}`);
        }

        const pkg = await res.json();
        packageJsonCache.set(cacheKey, pkg);
        return pkg;
      }

      // intercept import paths starting with "http:" and "https:" so esbuild doesn't attempt to map them to a file system location
      build.onResolve({ filter: URL_RE }, (args) => ({
        path: args.path,
        namespace: "cdn-imports",
      }));

      // intercept all import paths inside downloaded files and resolve them against the original URL of the downloaded file
      build.onResolve({ filter: /.*/, namespace: "cdn-imports" }, async (args) => {
        debugLog("Intercepted import from CDN:", args);

        if (isExternal(args.path, externals)) {
          return {
            external: true,
            path: args.path,
          };
        }

        // handle absolute module imports inside cdn files
        if (!args.path.startsWith(".")) {
          let path = args.path;

          // handle paths that start with /npm/ for jsdelivr
          if (args.path.startsWith("/npm/") && resolvedOptions.cdn === "jsdelivr") {
            path = normalizeJsdelivrPath(args.path);
            debugLog("Normalized /npm/ path:", { original: args.path, normalized: path });
          }

          // check if this is a package with a subpath (e.g., @modelcontextprotocol/sdk/types.js)
          const isPackageWithSubpath = path.includes("/") && !path.startsWith("http");

          if (isPackageWithSubpath) {
            // for packages with subpaths, try to resolve them directly
            try {
              // first try with the path as is
              const url = normalizePath(resolvedOptions.cdn, path);
              const response = await fetch(url, { method: "HEAD" });
              if (response.ok) {
                debugLog("Package with subpath exists, using directly:", url);
                return {
                  path: url,
                  namespace: "cdn-imports",
                  pluginData: {
                    jsdelivrEsm: resolvedOptions.useJsdelivrEsm && resolvedOptions.cdn === "jsdelivr",
                  },
                };
              }

              // if that fails, try parsing as a package
              const parsed = parsePackage(path);
              if (resolvedOptions.versions[parsed.name]) {
                parsed.version = resolvedOptions.versions[parsed.name]!;
              }

              // try with the parsed package
              const packageUrl = normalizePath(
                resolvedOptions.cdn,
                `${parsed.name}@${parsed.version}${parsed.path || ""}`,
              );

              const packageResponse = await fetch(packageUrl, { method: "HEAD" });

              if (packageResponse.ok) {
                debugLog("Package with subpath resolved, using:", packageUrl);

                return {
                  path: packageUrl,
                  namespace: "cdn-imports",
                  pluginData: {
                    jsdelivrEsm: resolvedOptions.useJsdelivrEsm && resolvedOptions.cdn === "jsdelivr",
                  },
                };
              }
            } catch (e) {
              debugLog("Failed to resolve package with subpath:", e);
              // continue with regular resolution
            }
          } else {
            // for regular paths, try to fetch the url directly first
            try {
              const url = normalizePath(resolvedOptions.cdn, path);
              const response = await fetch(url, { method: "HEAD" });

              debugLog("Direct URL check:", { url, redirected: response.redirected });

              if (response.ok && !response.redirected) {
                debugLog("URL exists, using directly:", url);
                return {
                  path: url,
                  namespace: "cdn-imports",
                  pluginData: {
                    jsdelivrEsm: resolvedOptions.useJsdelivrEsm && resolvedOptions.cdn === "jsdelivr",
                  },
                };
              }
            } catch (e) {
              debugLog("Failed to fetch URL directly:", e);
              // continue with regular resolution
            }
          }

          // handle like a regular module import
          const parsed = parsePackage(path);

          if (resolvedOptions.versions[parsed.name]) {
            parsed.version = resolvedOptions.versions[parsed.name]!;
          }

          let subpath = parsed.path;

          try {
            const pkg = await getPackageJson(parsed.name, parsed.version);

            if (!subpath) {
              // no subpath specified, resolve to main entry point
              const resolvedExport = resolve(pkg, ".", {
                require: args.kind === "require-call" || args.kind === "require-resolve",
              }) || legacy(pkg);

              if (typeof resolvedExport === "string") {
                subpath = resolvedExport.replace(/^\.?\/?/, "/");
              } else if (Array.isArray(resolvedExport) && resolvedExport.length > 0) {
                subpath = resolvedExport[0]!.replace(/^\.?\/?/, "/");
              }
            } else {
              // subpath specified, resolve using exports field if available
              const subpathWithoutLeadingSlash = subpath.startsWith("/") ? subpath.slice(1) : subpath;

              const resolvedExport = resolve(pkg, subpathWithoutLeadingSlash, {
                require: args.kind === "require-call" || args.kind === "require-resolve",
              }) || legacy(pkg);

              if (typeof resolvedExport === "string") {
                subpath = resolvedExport.replace(/^\.?\/?/, "/");
              } else if (Array.isArray(resolvedExport) && resolvedExport.length > 0) {
                subpath = resolvedExport[0]!.replace(/^\.?\/?/, "/");
              }

              debugLog("Resolved subpath:", {
                name: parsed.name,
                version: parsed.version,
                subpath,
                resolvedExport,
              });
            }

            if (subpath && subpath[0] !== "/") {
              subpath = `/${subpath}`;
            }

            debugLog("Resolved main module path:", {
              name: parsed.name,
              version: parsed.version,
              subpath,
            });

            return {
              path: normalizePath(
                resolvedOptions.cdn,
                `${parsed.name}@${parsed.version}${subpath == null ? "" : subpath}`,
              ),
              pluginData: {
                jsdelivrEsm: resolvedOptions.useJsdelivrEsm && resolvedOptions.cdn === "jsdelivr",
              },
              namespace: "cdn-imports",
            };
          } catch (e) {
            debugLog("Error resolving package:", e);
            // default fallback path
            return {
              path: normalizePath(resolvedOptions.cdn, path),
              namespace: "cdn-imports",
            };
          }
        }

        // handle relative imports within cdn files
        const url = new URL(args.pluginData.packageUrl);
        debugLog("Resolving relative import:", { url, path: args.path });

        const isCJS = args.kind === "require-call" || args.kind === "require-resolve";
        let urlPathname = url.pathname;

        // normalize pathname to handle /npm/ prefix in jsdelivr urls
        if (resolvedOptions.cdn === "jsdelivr" && NPM_PATH_RE.test(urlPathname)) {
          urlPathname = normalizeJsdelivrPath(urlPathname);
          debugLog("Normalized URL pathname:", { original: url.pathname, normalized: urlPathname });
        }

        // normalize the relative path
        const relativePath = args.path;
        if (relativePath.startsWith("./") || relativePath.startsWith("../")) {
          // split the pathname into segments
          const segments = urlPathname.split("/");
          // find where the package version ends (e.g., @vue/shared@1.0.0)
          const versionEndIndex = segments.findIndex((s) => s.includes("@") && !s.startsWith("@"));
          if (versionEndIndex !== -1) {
            // get the base path (everything up to and including the version)
            const basePath = segments.slice(0, versionEndIndex + 1).join("/");
            // get the directory path after the version
            const dirPath = segments.slice(versionEndIndex + 1, -1).join("/");
            // combine with the relative path
            const resolvedPath = join(basePath, dirPath, relativePath);
            debugLog("Resolved relative path:", resolvedPath);

            // for commonjs requires without extension, try to resolve with extensions
            if (isCJS && !extname(resolvedPath)) {
              // first try with extensions
              const resolvedWithExt = await tryFileWithExtensions(
                resolvedOptions.cdn,
                resolvedPath,
                CJS_EXTENSIONS,
              );

              if (resolvedWithExt) {
                debugLog("Resolved with extension:", resolvedWithExt);
                return {
                  path: normalizePath(resolvedOptions.cdn, resolvedWithExt),
                  namespace: "cdn-imports",
                };
              }

              // then try as directory with index
              const resolvedIndex = await tryIndexWithExtensions(
                resolvedOptions.cdn,
                resolvedPath,
                CJS_EXTENSIONS,
              );

              if (resolvedIndex) {
                debugLog("Resolved as directory index:", resolvedIndex);
                return {
                  path: normalizePath(resolvedOptions.cdn, resolvedIndex),
                  namespace: "cdn-imports",
                };
              }
            }

            // if we couldn't resolve with extensions or it's not cjs, use the path directly
            return {
              path: normalizePath(resolvedOptions.cdn, resolvedPath),
              namespace: "cdn-imports",
            };
          }
        }

        // this shouldn't happen given the condition above, but just in case
        return {
          path: normalizePath(resolvedOptions.cdn, urlPathname),
          namespace: "cdn-imports",
        };
      });

      // handle initial module resolution from source code
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

        // handle paths that start with /npm/ for jsdelivr
        if (args.path.startsWith("/npm/") && resolvedOptions.cdn === "jsdelivr") {
          const normalizedPath = normalizeJsdelivrPath(args.path);
          debugLog("Normalized /npm/ path:", { original: args.path, normalized: normalizedPath });

          return {
            path: normalizePath(resolvedOptions.cdn, normalizedPath),
            namespace: "cdn-imports",
          };
        }

        try {
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
          const isCJS = args.kind === "require-call" || args.kind === "require-resolve";

          try {
            const pkg = await getPackageJson(parsed.name, parsed.version);

            if (!subpath) {
              // no subpath specified, resolve main entry point
              const resolvedExport = resolve(pkg, ".", { require: isCJS }) || legacy(pkg);

              if (typeof resolvedExport === "string") {
                subpath = resolvedExport.replace(/^\.?\/?/, "/");
              } else if (Array.isArray(resolvedExport) && resolvedExport.length > 0) {
                subpath = resolvedExport[0]!.replace(/^\.?\/?/, "/");
              } else if (isCJS && pkg.main) {
                // fallback to main field for cjs
                subpath = `/${pkg.main}`;
              } else if (!isCJS && pkg.module) {
                // fallback to module field for esm
                subpath = `/${pkg.module}`;
              } else if (pkg.main) {
                // last fallback to main
                subpath = `/${pkg.main}`;
              }
            } else {
              // try to resolve subpath using exports field
              const subpathWithoutLeadingSlash = subpath.startsWith("/") ? subpath.slice(1) : subpath;

              const resolvedExport = resolve(pkg, subpathWithoutLeadingSlash, { require: isCJS }) || legacy(pkg);

              if (typeof resolvedExport === "string") {
                subpath = resolvedExport.replace(/^\.?\/?/, "/");
              } else if (Array.isArray(resolvedExport) && resolvedExport.length > 0) {
                subpath = resolvedExport[0]!.replace(/^\.?\/?/, "/");
              } else if (isCJS) {
                // for cjs with no exports resolution, try with file extensions
                const baseSubpath = subpath.startsWith("/") ? subpath : `/${subpath}`;
                const resolvedWithExt = await tryFileWithExtensions(
                  resolvedOptions.cdn,
                  `${parsed.name}@${parsed.version}${baseSubpath}`,
                  CJS_EXTENSIONS,
                );

                if (resolvedWithExt) {
                  // return the resolved path directly
                  return {
                    path: normalizePath(resolvedOptions.cdn, resolvedWithExt),
                    namespace: "cdn-imports",
                  };
                }
              }
            }

            if (subpath && subpath[0] !== "/") {
              subpath = `/${subpath}`;
            }

            debugLog("Final resolved path:", {
              name: parsed.name,
              version: parsed.version,
              subpath,
              isCJS,
            });

            return {
              path: normalizePath(
                resolvedOptions.cdn,
                `${parsed.name}@${parsed.version}${subpath}`,
              ),
              pluginData: {
                jsdelivrEsm: !isCJS && resolvedOptions.useJsdelivrEsm && resolvedOptions.cdn === "jsdelivr",
              },
              namespace: "cdn-imports",
            };
          } catch (e) {
            debugLog("Error resolving package:", e);
            // fallback to direct path
            const fullPath = parsed.path
              ? `${parsed.name}@${parsed.version}${parsed.path}`
              : `${parsed.name}@${parsed.version}`;

            return {
              path: normalizePath(resolvedOptions.cdn, fullPath),
              namespace: "cdn-imports",
            };
          }
        } catch (e) {
          debugLog("Error parsing package:", e);
          return null;
        }
      });

      build.onLoad(
        {
          filter: /.*/,
          namespace: "cdn-imports",
        },
        async (args) => {
          debugLog("Loading:", args.path);

          const hasJsdelivrEsm = args.pluginData != null && "jsdelivrEsm" in args.pluginData && args.pluginData.jsdelivrEsm;

          if (resolvedOptions.useJsdelivrEsm && resolvedOptions.cdn === "jsdelivr" && hasJsdelivrEsm && !args.path.endsWith("+esm")) {
            args.path += "/+esm";
          }

          // normalize path but preserve protocol double slashes (e.g., https://)
          const normalizedPath = args.path.replace(/(?<!:)\/{2,}/g, "/").replace(/\\+/g, "/");

          debugLog("Load Normalized path:", { original: args.path, normalized: normalizedPath });
          const res = await fetch(normalizedPath);

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

          debugLog("Loaded file:", { url: res.url, loader });

          return {
            contents: new Uint8Array(await res.arrayBuffer()),
            loader,
            pluginData: {
              packageUrl: res.url,
            },
          };
        },
      );
    },
  };
}
