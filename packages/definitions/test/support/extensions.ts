import {
  defineExtension,
  edgeV2,
  istar4RationalAgents,
  withExtension,
  type ExtensionDefinition,
} from '../../src';

/** iStar4RationalAgents' stereotypes and tagged values over EdgeV2. */
export const ra = withExtension(edgeV2, istar4RationalAgents);

/** EdgeV2 with a dialect like iStar4RationalAgents, but these groupers and stereotypes. */
export const withStereotypes = (
  groupers: ExtensionDefinition['groupers'],
  stereotypes: ExtensionDefinition['stereotypes'],
) =>
  withExtension(
    edgeV2,
    defineExtension({
      ...istar4RationalAgents,
      groupers,
      stereotypes,
      taggedValues: [],
    }) as ExtensionDefinition,
  );
