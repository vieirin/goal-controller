/**
 * A small XML reader for MutRoSe's world knowledge: elements, attributes and
 * text, with their offsets, and what is wrong with the text. No DOM (it runs
 * in Node, the browser and the language server's worker alike); no DTDs,
 * namespaces or CDATA, which world files don't use.
 */

export type XmlElement = {
  name: string;
  attributes: Record<string, string>;
  children: XmlElement[];
  /** its text, trimmed (an element with children has none) */
  text: string;
  from: number;
  to: number;
};

export type XmlProblem = { message: string; from: number; to: number };

const ENTITIES: Record<string, string> = {
  lt: '<',
  gt: '>',
  amp: '&',
  quot: '"',
  apos: "'",
};

const decode = (text: string): string =>
  text.replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (whole, entity: string) =>
    entity.startsWith('#x')
      ? String.fromCodePoint(parseInt(entity.slice(2), 16))
      : entity.startsWith('#')
        ? String.fromCodePoint(Number(entity.slice(1)))
        : (ENTITIES[entity] ?? whole),
  );

const NAME = /[A-Za-z_][\w.:-]*/y;
const ATTRIBUTE = /\s+([A-Za-z_][\w.:-]*)\s*=\s*("([^"]*)"|'([^']*)')/y;

/** The document's root element (null when there is none), and its problems. */
export const readXml = (
  text: string,
): { root: XmlElement | null; problems: XmlProblem[] } => {
  const problems: XmlProblem[] = [];
  const stack: XmlElement[] = [];
  // the elements opened at the top: the first is the root, any other an error
  const tops: XmlElement[] = [];
  let textFrom = 0;
  let pos = 0;
  const addText = (to: number) => {
    const top = stack[stack.length - 1];
    const chunk = text.slice(textFrom, to);
    if (top) top.text += chunk;
    else if (chunk.trim())
      problems.push({
        message: 'Text outside the root element',
        from: textFrom,
        to,
      });
  };
  while (pos < text.length) {
    const open = text.indexOf('<', pos);
    if (open < 0) break;
    addText(open);
    if (text.startsWith('<!--', open)) {
      const end = text.indexOf('-->', open + 4);
      if (end < 0) {
        problems.push({
          message: 'Unclosed comment',
          from: open,
          to: text.length,
        });
        pos = text.length;
        break;
      }
      pos = textFrom = end + 3;
      continue;
    }
    if (text.startsWith('<?', open) || text.startsWith('<!', open)) {
      const end = text.indexOf('>', open);
      pos = textFrom = end < 0 ? text.length : end + 1;
      continue;
    }
    const closing = text[open + 1] === '/';
    NAME.lastIndex = open + (closing ? 2 : 1);
    const name = NAME.exec(text)?.[0];
    if (!name) {
      problems.push({
        message: 'Expected a tag name after <',
        from: open,
        to: open + 1,
      });
      pos = textFrom = open + 1;
      continue;
    }
    let at = NAME.lastIndex;
    if (closing) {
      const end = text.indexOf('>', at);
      const to = end < 0 ? text.length : end + 1;
      const top = stack.pop();
      if (!top)
        problems.push({ message: `</${name}> closes nothing`, from: open, to });
      else if (top.name !== name) {
        problems.push({
          message: `</${name}> closes <${top.name}>`,
          from: open,
          to,
        });
        stack.push(top);
        // a tag open further up: it closes there, and those inside it with it
        const match = stack.map((e) => e.name).lastIndexOf(name);
        if (match >= 0) {
          const [closed, ...inside] = stack.splice(match);
          for (const unclosed of inside) unclosed.to = open;
          closed!.to = to;
        }
      } else top.to = to;
      pos = textFrom = to;
      continue;
    }
    const element: XmlElement = {
      name,
      attributes: {},
      children: [],
      text: '',
      from: open,
      to: open,
    };
    for (;;) {
      ATTRIBUTE.lastIndex = at;
      const attribute = ATTRIBUTE.exec(text);
      if (!attribute) break;
      element.attributes[attribute[1]!] = decode(
        attribute[3] ?? attribute[4] ?? '',
      );
      at = ATTRIBUTE.lastIndex;
    }
    const rest = /^\s*(\/?)>/.exec(text.slice(at));
    if (!rest) {
      const end = text.indexOf('>', at);
      problems.push({
        message: `<${name}>: its attributes are not \`name="value"\``,
        from: open,
        to: end < 0 ? text.length : end + 1,
      });
      pos = textFrom = end < 0 ? text.length : end + 1;
      continue;
    }
    const to = at + rest[0].length;
    const parent = stack[stack.length - 1];
    if (parent) parent.children.push(element);
    else {
      if (tops.length)
        problems.push({
          message: `<${name}>: a document has one root element`,
          from: open,
          to,
        });
      tops.push(element);
    }
    if (rest[1]) element.to = to;
    else stack.push(element);
    pos = textFrom = to;
  }
  for (const unclosed of stack) {
    problems.push({
      message: `<${unclosed.name}> is not closed`,
      from: unclosed.from,
      to: unclosed.from + unclosed.name.length + 1,
    });
    unclosed.to = text.length;
  }
  const root = tops[0] ?? null;
  const finish = (element: XmlElement) => {
    element.text = element.children.length ? '' : decode(element.text).trim();
    element.children.forEach(finish);
  };
  if (root) finish(root);
  else if (!problems.length)
    problems.push({ message: 'No root element', from: 0, to: text.length });
  return { root, problems };
};
