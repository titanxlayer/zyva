/**
 * ES7+ React/Redux snippets — Monaco completion items.
 * Equivalent to the VS Code extension by dsznajder.
 * All content is community-standard boilerplate, not proprietary.
 */

export interface Snippet {
  label: string;
  documentation: string;
  insertText: string;
}

export const REACT_SNIPPETS: Snippet[] = [
  // ── Components ───────────────────────────────────────────────────────────
  {
    label: 'rfc',
    documentation: 'React Functional Component',
    insertText: `import React from 'react';\n\ninterface \${1:ComponentName}Props {\n  \${2}\n}\n\nexport default function \${1:ComponentName}({ \${3} }: \${1:ComponentName}Props) {\n  return (\n    <div>\n      \${4}\n    </div>\n  );\n}`,
  },
  {
    label: 'rfce',
    documentation: 'React Functional Component (export named)',
    insertText: `import React from 'react';\n\nexport function \${1:ComponentName}() {\n  return (\n    <div>\n      \${2}\n    </div>\n  );\n}`,
  },
  {
    label: 'rafc',
    documentation: 'React Arrow Function Component',
    insertText: `const \${1:ComponentName} = () => {\n  return (\n    <div>\n      \${2}\n    </div>\n  );\n};\n\nexport default \${1:ComponentName};`,
  },

  // ── Hooks ────────────────────────────────────────────────────────────────
  {
    label: 'useState',
    documentation: 'useState hook',
    insertText: 'const [\${1:state}, set\${1/(.*)/${1:/capitalize}/}] = useState<\${2:type}>(\${3:initialValue});',
  },
  {
    label: 'useEffect',
    documentation: 'useEffect hook',
    insertText: 'useEffect(() => {\n  \${1}\n  return () => {\n    \${2}\n  };\n}, [\${3}]);',
  },
  {
    label: 'useCallback',
    documentation: 'useCallback hook',
    insertText: 'const \${1:callback} = useCallback(() => {\n  \${2}\n}, [\${3}]);',
  },
  {
    label: 'useMemo',
    documentation: 'useMemo hook',
    insertText: 'const \${1:memoizedValue} = useMemo(() => {\n  return \${2};\n}, [\${3}]);',
  },
  {
    label: 'useRef',
    documentation: 'useRef hook',
    insertText: 'const \${1:ref} = useRef<\${2:HTMLElement}>(null);',
  },
  {
    label: 'useContext',
    documentation: 'useContext hook',
    insertText: 'const \${1:value} = useContext(\${2:Context});',
  },
  {
    label: 'useReducer',
    documentation: 'useReducer hook',
    insertText: 'const [\${1:state}, dispatch] = useReducer(\${2:reducer}, \${3:initialState});',
  },

  // ── Async / fetch ────────────────────────────────────────────────────────
  {
    label: 'afn',
    documentation: 'Async function',
    insertText: 'async function \${1:name}(\${2}) {\n  try {\n    \${3}\n  } catch (error) {\n    console.error(error);\n  }\n}',
  },
  {
    label: 'afetch',
    documentation: 'Async fetch call',
    insertText: "const \${1:data} = await fetch('\${2:url}').then(r => r.json());",
  },

  // ── TypeScript ────────────────────────────────────────────────────────────
  {
    label: 'iface',
    documentation: 'TypeScript interface',
    insertText: 'interface \${1:Name} {\n  \${2};\n}',
  },
  {
    label: 'type',
    documentation: 'TypeScript type alias',
    insertText: 'type \${1:Name} = \${2};',
  },
  {
    label: 'enum',
    documentation: 'TypeScript enum',
    insertText: 'enum \${1:Name} {\n  \${2}\n}',
  },

  // ── CSS/Tailwind ─────────────────────────────────────────────────────────
  {
    label: 'clsx',
    documentation: 'clsx/cn className helper',
    insertText: 'className={cn(\${1})}',
  },
];
