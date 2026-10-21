/**
 * Vocabulary profiles of the KAOS dialects (goal-controller#192, D1 of #192,
 * logged on #189): a second logged source for the keys the `kaos` dialect
 * gives a vocabulary, selected by the importer that writes a model from that
 * source and recorded on the model (`diagram.customProperties.vocabulary`).
 * A model with a profile is read with its vocabularies in place of the
 * `kaos` dialect's (`withVocabularyProfile`), in every KAOS mode (kaos,
 * kaosdoc, kaosprop, kaosexpert, kaosres): its values are still checked, a
 * value outside the profile's is still a Problem, and nothing is widened for
 * any other model.
 *
 * A profile may also declare the text keys its importer writes that the
 * `kaos` dialect has none for (CAIRIS's requirement `type`, a probability's
 * rationale), so they are the model's own keys, not unknown ones.
 */
import {
  property,
  type AnyDialect,
  type EnumOptionInput,
  type PropertyDefinition,
} from '@goal-controller/dialect';

/**
 * CAIRIS's enumerations (Faily, *Designing Usable and Secure Software with
 * IRIS and CAIRIS*, Springer 2018; `cairis/config/goals.dtd` at
 * cairis-platform/cairis `44cc57d`, Apache 2.0), which CAIRIS enforces and
 * writes verbatim, each the source of the key it is for.
 */
export const CAIRIS_VOCABULARIES = {
  /**
   * a goal's category (`goal_environment@category`, `goals.dtd:39`), the
   * goal's pattern: KAOS's Achieve, Maintain and Avoid, the book's Optimize
   * spelled out (Improve, Increase, Maximise, Minimise), and the security
   * responses (Accept, Transfer, Mitigate, Deter, Prevent, Detect, React)
   */
  Type: [
    'Achieve',
    'Maintain',
    'Avoid',
    'Improve',
    'Increase',
    'Maximise',
    'Minimise',
    'Accept',
    'Transfer',
    'Mitigate',
    'Deter',
    'Prevent',
    'Detect',
    'React',
  ],
  /** a goal's priority (`goal_environment@priority`, `goals.dtd:40`) */
  Priority: ['Low', 'Medium', 'High'],
  /** an obstacle's category (`obstacle_environment@category`, `goals.dtd:63`), as the file writes it */
  ObstacleCategory: [
    'Confidentiality_Threat',
    'Integrity_Threat',
    'Availability_Threat',
    'Accountability_Threat',
    'Vulnerability',
    'Duration',
    'Frequency',
    'Demands',
    'Goal_Support',
    'Anonymity_Threat',
    'Pseudonymity_Threat',
    'Unlinkability_Threat',
    'Unobservability_Threat',
    'Threat',
    'Loss',
    'Hazard',
  ],
  /** a domain property's type (`domainproperty@type`, `goals.dtd:28`) */
  Kind: ['Hypothesis', 'Invariant'],
} as const satisfies Record<string, readonly EnumOptionInput[]>;

/** The profiles, by the name a model records. */
export const VOCABULARY_PROFILES = ['cairis'] as const;
export type VocabularyProfile = (typeof VOCABULARY_PROFILES)[number];

/** The key a model records its profile under (`diagram.customProperties`). */
export const VOCABULARY_KEY = 'vocabulary';

const isProfile = (text: string): text is VocabularyProfile =>
  (VOCABULARY_PROFILES as readonly string[]).includes(text);

/**
 * A model's profile, by what its diagram records; null when it records none
 * (or one no dialect has: its values are then read with `kaos`'s). The
 * diagram's custom properties are piStar's open string map.
 */
export const vocabularyProfileOf = (model: {
  readonly diagram?: {
    readonly customProperties?: Readonly<Record<string, string>>;
  };
}): VocabularyProfile | null => {
  const recorded = model.diagram?.customProperties?.[VOCABULARY_KEY];
  return recorded !== undefined && isProfile(recorded) ? recorded : null;
};

/** The kinds of a KAOS model whose keys a profile replaces or adds, as the dialects name them. */
const GOALS = ['kaos.BehavioralGoal', 'kaos.Softgoal'] as const;
const OBSTACLE = 'kaosObstacles.Obstacle';
const DOMAIN_PROPERTY = 'kaos.DomainProperty';
const AGENTS = ['kaos.Agent', 'kaos.EnvironmentAgent'] as const;
const LEGS = [
  'kaos.RefinementLinkStart',
  'kaosObstacles.ObstacleRefinementLinkStart',
] as const;
const RATIONALE_LINKS = [
  ...LEGS,
  'kaosObstacles.ObstructionLink',
  'kaosObstacles.ResolutionLink',
  'kaos.Conflict',
  'kaos.ResponsibilityAssignment',
] as const;

const text = (key: string, help: string) => property.text(key, { help });
const enumOf = (
  key: string,
  options: readonly EnumOptionInput[],
  help: string,
) => property.enum(key, ['', ...options], { help });

const SOURCE = text('Source', 'its originator, as CAIRIS records it');
const CONCERN = text(
  'Concern',
  'the assets it concerns, by name (CAIRIS’s concerns), comma-separated',
);
const TAGS = text('Tags', 'its CAIRIS tags, comma-separated');
const RATIONALE = text('Rationale', 'its rationale, as CAIRIS records it');

/**
 * A profile: by element kind, the keys whose vocabularies it gives and the
 * text keys it adds; by link kind, the text keys it adds. Keyed by the
 * dialects' kind names (a dialect's kinds are strings: `AnyDialect`).
 */
type Profile = {
  vocabularies: ReadonlyMap<string, readonly PropertyDefinition[]>;
  keys: ReadonlyMap<string, readonly PropertyDefinition[]>;
  links: ReadonlyMap<string, readonly PropertyDefinition[]>;
};

const goalVocabularies = [
  enumOf(
    'Type',
    CAIRIS_VOCABULARIES.Type,
    'its category, as CAIRIS has it (goals.dtd): Achieve, Maintain, Avoid, Improve, Increase, Maximise, Minimise, or a security response',
  ),
  enumOf(
    'Priority',
    CAIRIS_VOCABULARIES.Priority,
    'its priority, as CAIRIS has it: Low, Medium, High',
  ),
];
const goalKeys = [
  CONCERN,
  TAGS,
  // a requirement's (D3 of #192: a requirement is a leaf goal); CAIRIS's
  // `type` and `priority` are its own keys, text, beside the goal's Type and
  // Priority, whose vocabularies are a goal's
  text(
    'RequirementType',
    'a requirement’s type, as CAIRIS has it (Functional, Security, …)',
  ),
  text(
    'RequirementPriority',
    'a requirement’s priority, as CAIRIS has it (1, 2, 3)',
  ),
  text('Label', 'a requirement’s label, as CAIRIS numbers it'),
  text('Reference', 'the asset or environment a requirement is on, by name'),
  text(
    'ReferenceType',
    'whether a requirement is on an asset or an environment',
  ),
  RATIONALE,
];
const legKeys = [
  RATIONALE,
  text(
    'Alternative',
    'Yes when CAIRIS marks the refinement as an alternate goal tree (alternative_id 1)',
  ),
];
const agentKeys = [
  text(
    'RoleType',
    'its role’s type, as CAIRIS has it (Stakeholder, Attacker, …)',
  ),
  text('ShortCode', 'its role’s short code'),
];

const PROFILES: Readonly<Record<VocabularyProfile, Profile>> = {
  cairis: {
    vocabularies: new Map<string, readonly PropertyDefinition[]>([
      ...GOALS.map((kind) => [kind, goalVocabularies] as const),
      [
        OBSTACLE,
        [
          enumOf(
            'Category',
            CAIRIS_VOCABULARIES.ObstacleCategory,
            'its category, as CAIRIS has it (goals.dtd): a threat, a vulnerability, a usability obstacle, a loss or a hazard',
          ),
        ],
      ],
      [
        DOMAIN_PROPERTY,
        [
          enumOf(
            'Kind',
            CAIRIS_VOCABULARIES.Kind,
            'whether it is a Hypothesis or an Invariant, as CAIRIS has it',
          ),
        ],
      ],
    ]),
    keys: new Map<string, readonly PropertyDefinition[]>([
      ...GOALS.map((kind) => [kind, goalKeys] as const),
      [
        OBSTACLE,
        [
          SOURCE,
          CONCERN,
          TAGS,
          text(
            'Rationale',
            'its probability’s rationale, as CAIRIS records it',
          ),
        ],
      ],
      [DOMAIN_PROPERTY, [SOURCE, TAGS]],
      ...AGENTS.map((kind) => [kind, agentKeys] as const),
    ]),
    links: new Map<string, readonly PropertyDefinition[]>([
      ...RATIONALE_LINKS.map((kind) => [kind, [RATIONALE]] as const),
      ...LEGS.map((kind) => [kind, legKeys] as const),
    ]),
  },
};

/** A list of a kind's keys with a profile's: its vocabularies in place of the same keys, its keys added after. */
const profiled = (
  list: readonly PropertyDefinition[],
  vocabularies: readonly PropertyDefinition[] = [],
  keys: readonly PropertyDefinition[] = [],
): readonly PropertyDefinition[] => {
  const replacing = new Map(vocabularies.map((p) => [p.key, p]));
  const own = new Set(list.map((p) => p.key));
  return [
    ...list.map((p) => replacing.get(p.key) ?? p),
    ...keys.filter((p) => !own.has(p.key)),
  ];
};

/**
 * A KAOS dialect read with a profile: each key the profile has a vocabulary
 * for takes it, and the profile's keys are added to their kinds (on a kind
 * the dialect has; a link kind's whether or not the dialect gives it keys).
 * The dialect itself when there is no profile.
 */
export const withVocabularyProfile = (
  definition: AnyDialect,
  profile: VocabularyProfile | null,
): AnyDialect => {
  if (!profile) return definition;
  const { vocabularies, keys, links } = PROFILES[profile];
  const properties = Object.fromEntries(
    Object.entries(definition.properties).map(
      ([kind, list]: [string, readonly PropertyDefinition[]]) => [
        kind,
        profiled(list, vocabularies.get(kind), keys.get(kind)),
      ],
    ),
  );
  const linkKinds = new Set([
    ...Object.keys(definition.links ?? {}),
    ...links.keys(),
  ]);
  return {
    ...definition,
    properties,
    links: Object.fromEntries(
      [...linkKinds].map((kind) => [
        kind,
        profiled(definition.links?.[kind] ?? [], [], links.get(kind)),
      ]),
    ),
  };
};

/** A KAOS dialect as a model reads it: with the profile it records, if any. */
export const dialectForModel = (
  definition: AnyDialect,
  model: Parameters<typeof vocabularyProfileOf>[0],
): AnyDialect => withVocabularyProfile(definition, vocabularyProfileOf(model));
