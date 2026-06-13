/**
 * Browser-safe Prettier formatter using prettier/standalone.
 * Called from Monaco's document formatting provider.
 */

let prettierLoaded = false;

async function loadPrettier() {
  if (prettierLoaded) return;
  // Dynamically load prettier standalone + parsers (avoids SSR issues)
  prettierLoaded = true;
}

export async function formatWithPrettier(
  code: string,
  filepath: string,
): Promise<string> {
  try {
    const ext = filepath.split('.').pop()?.toLowerCase() || '';

    // Determine parser
    let parser: string;
    if (ext === 'ts' || ext === 'tsx') parser = 'typescript';
    else if (ext === 'js' || ext === 'jsx' || ext === 'mjs' || ext === 'cjs') parser = 'babel';
    else if (ext === 'css' || ext === 'scss' || ext === 'less') parser = 'css';
    else if (ext === 'html') parser = 'html';
    else if (ext === 'json') parser = 'json';
    else if (ext === 'md' || ext === 'mdx') parser = 'markdown';
    else if (ext === 'yaml' || ext === 'yml') parser = 'yaml';
    else return code; // no-op for unsupported

    // Dynamic imports to keep bundle splitting
    const [prettier, pluginBabel, pluginTs, pluginCss, pluginHtml, pluginMd] = await Promise.all([
      import('prettier/standalone'),
      import('prettier/plugins/babel'),
      import('prettier/plugins/typescript'),
      import('prettier/plugins/postcss'),
      import('prettier/plugins/html'),
      import('prettier/plugins/markdown'),
    ]);

    const plugins = [
      pluginBabel.default ?? pluginBabel,
      pluginTs.default ?? pluginTs,
      pluginCss.default ?? pluginCss,
      pluginHtml.default ?? pluginHtml,
      pluginMd.default ?? pluginMd,
    ];

    const formatted = await (prettier.default ?? prettier).format(code, {
      parser,
      plugins,
      semi: true,
      singleQuote: true,
      tabWidth: 2,
      trailingComma: 'es5',
      printWidth: 100,
    });

    return formatted;
  } catch (e) {
    console.warn('[Prettier] format error:', e);
    return code; // never break the editor
  }
}
