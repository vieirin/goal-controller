/** What the GODA engine's tests share: a model written from its nodes and links. */

/** A one-actor model: its nodes' texts and properties, and its links (child → parent). */
export const model = (
  nodes: Array<
    [
      id: string,
      kind: 'Goal' | 'Task',
      text: string,
      props?: Record<string, string>,
    ]
  >,
  links: Array<[child: string, parent: string, kind?: 'And' | 'Or']>,
): string =>
  JSON.stringify({
    actors: [
      {
        id: 'actor',
        text: 'Robot',
        type: 'istar.Actor',
        x: 0,
        y: 0,
        nodes: nodes.map(([id, kind, text, props], i) => ({
          id,
          text,
          type: `istar.${kind}`,
          x: i * 100,
          y: 100,
          ...(props && { customProperties: props }),
        })),
      },
    ],
    dependencies: [],
    links: links.map(([child, parent, kind = 'And'], i) => ({
      id: `link${i}`,
      type: `istar.${kind}RefinementLink`,
      source: child,
      target: parent,
    })),
    tool: 'pistar.2.1.0',
    istar: '2.0',
    diagram: { width: 800, height: 600 },
  });
