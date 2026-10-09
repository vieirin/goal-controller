/**
 * The Edge engines' property suites (`props/*.pctl`, `*.props`): PRISM
 * properties, one per statement, `//` comments, a statement continuing over
 * lines until its brackets close, an optional label (`"name": P=? [ F done ]`).
 * They are kept as text: the model checker reads them, not the workbench.
 */
import type {
  ParsedResource,
  ProjectResourceParser,
  ResourceDiagnostic,
} from '../../projectResources';

export type EdgeProperty = {
  /** its label, if it has one */
  name?: string;
  text: string;
  /** where it is in its file */
  from: number;
  to: number;
};

export type EdgePropertySuites = { path: string; properties: EdgeProperty[] }[];

const OPEN: Record<string, string> = { ')': '(', ']': '[', '}': '{' };

/** One suite's statements, and the brackets that don't close. */
const statementsOf = (
  path: string,
  text: string,
  diagnostics: ResourceDiagnostic[],
): EdgeProperty[] => {
  const properties: EdgeProperty[] = [];
  const open: { char: string; at: number }[] = [];
  let start = -1;
  const close = (to: number) => {
    if (start < 0) return;
    const raw = text.slice(start, to);
    const label = /^\s*"([^"]+)"\s*:/.exec(raw);
    properties.push({
      ...(label && { name: label[1] }),
      text: raw.trim(),
      from: start,
      to: start + raw.trimEnd().length,
    });
    start = -1;
  };
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i]!;
    if (char === '/' && text[i + 1] === '/') {
      const end = text.indexOf('\n', i);
      if (open.length === 0) close(i);
      i = end < 0 ? text.length : end - 1;
      continue;
    }
    if (char === '"') {
      const end = text.indexOf('"', i + 1);
      if (start < 0) start = i;
      i = end < 0 ? text.length : end;
      continue;
    }
    if (char === '\n') {
      if (open.length === 0) close(i);
      continue;
    }
    if (/\s/.test(char)) continue;
    if (start < 0) start = i;
    if (char === '(' || char === '[' || char === '{')
      open.push({ char, at: i });
    else if (char in OPEN) {
      const top = open.pop();
      if (!top || top.char !== OPEN[char])
        diagnostics.push({
          path,
          severity: 'error',
          message: top
            ? `${char} closes ${top.char}`
            : `${char} closes nothing`,
          from: i,
          to: i + 1,
        });
    }
  }
  for (const { char, at } of open)
    diagnostics.push({
      path,
      severity: 'error',
      message: `${char} is not closed`,
      from: at,
      to: at + 1,
    });
  close(text.length);
  return properties;
};

export const parseProperties: ProjectResourceParser<EdgePropertySuites> = (
  files,
): ParsedResource<EdgePropertySuites> => {
  const diagnostics: ResourceDiagnostic[] = [];
  const suites = files.map((file) => ({
    path: file.path,
    properties: statementsOf(file.path, file.text, diagnostics),
  }));
  return {
    symbols: {
      properties: suites.flatMap(({ path, properties }) =>
        properties.map((property, index) => ({
          name: property.name ?? `${path.split('/').pop()}#${index + 1}`,
          detail:
            property.text.length > 60
              ? `${property.text.slice(0, 59)}…`
              : property.text,
        })),
      ),
    },
    data: suites,
    diagnostics,
  };
};
