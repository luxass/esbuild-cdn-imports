import type { Platform, Plugin, PluginBuild } from "esbuild";

export interface TextTransform {
  platform?: Platform
  text: string
  to?: never
}

export interface ToTransform {
  platform?: Platform
  to: string
  text?: never
}

export type ImportTransform = TextTransform | ToTransform;

function transformer({
  build,
  from,
  to,
  text
}: {
  build: PluginBuild
  from: string
  to?: string
  text?: string
}) {
  const filter = new RegExp(`^${from}$`);

  build.onResolve({ filter }, (args) => {
    if (args.resolveDir === "") return;

    return {
      path: args.path,
      namespace: "import-transform",
      pluginData: {
        resolveDir: args.resolveDir,
        name: from
      }
    };
  });

  build.onLoad({ filter, namespace: "import-transform" }, (args) => {
    const code =
      text ||
      `
    export * from '${args.path.replace(args.pluginData.name, to!)}';
    export { default } from '${args.path.replace(args.pluginData.name, to!)}';
  `;

    return {
      contents: code,
      resolveDir: args.pluginData.resolveDir
    };
  });
}

const ImportTransformPlugin = (
  modules?: Record<string, string | ImportTransform>
): Plugin => ({
  name: "import-transform",
  setup(build) {
    for (const [mod, transform] of Object.entries(modules || {})) {
      if (typeof transform === "object") {
        const { platform, text, to } = transform;
        if (platform && build.initialOptions.platform !== platform) return;

        if (!text && !to) {
          throw new Error(
            "ImportTransformPlugin: Either `text` or `to` is required"
          );
        }

        transformer({
          build,
          from: mod,
          ...(text ? { text } : { to })
        });
      } else if (typeof transform === "string") {
        transformer({
          build,
          from: mod,
          to: transform
        });
      }
    }
  }
});

export default ImportTransformPlugin;
