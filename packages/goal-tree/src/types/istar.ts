/**
 * Types for iStar models (piStar save files), provided by @istar-ts/core.
 * These represent the model structure before conversion to goal tree.
 *
 * A model is typed by its kinds (goal-controller#185): iStar 2.0's by
 * default, KAOS's or NFR's when read with their roots (`parsePistar(text,
 * { metamodel: KAOS_OBSTACLES })`), and `string` when its framework is known
 * only at run time. A mapper reads a model of its dialect's framework: one
 * holding another framework's kinds doesn't compile (`ModelFor`).
 */
import type {
  FRAMEWORK_KINDS,
  Framework,
  FrameworkElementKind,
} from '@goal-controller/dialect';
import type {
  ElementKind,
  IstarActor,
  IstarElement,
  IstarLink,
  IstarModel,
  LinkKind,
  NodeKind,
} from '@istar-ts/core';

export type id = string;

/** Kinds of intentional elements that can appear in a goal tree */
export type NodeType = NodeKind;

/** Custom properties this project reads from goal-model elements (values are strings, as piStar stores them) */
export type CustomPropertiesData = {
  // common
  Description?: string;
  root?: string;

  // EDGE goal/task properties
  maxRetries?: string;

  // EDGE goal properties
  cost?: string;
  utility?: string;
  dependsOn?: string;
  variables?: string;
  type?: string;

  // EDGE Goal properties: Maintain/assertion properties
  maintain?: string;
  assertion?: string;

  // SLEEC Task properties
  PreCond?: string;
  TriggeringEvent?: string;
  TemporalConstraint?: string;
  PostCond?: string;
  ObstacleEvent?: string;

  // SLEEC properties
  Type?: string;
  Source?: string;
  Class?: string;
  NormPrinciple?: string;
  Proxy?: string;
  AddedValue?: string;
  Condition?: string;
  Event?: string;
  ContextEvent?: string;

  // Resource-specific properties
  initialValue?: string;
  lowerBound?: string;
  upperBound?: string;

  // Allow additional string properties
  [key: string]: string | undefined;
};

export type Node<K extends string = ElementKind> = IstarElement<K>;

export type Actor = IstarActor;

export type Link<K extends string = LinkKind> = IstarLink<K>;

/** A model, typed by its element and link kinds (iStar 2.0's by default). */
export type Model<
  EK extends string = ElementKind,
  LK extends string = LinkKind,
> = IstarModel<EK, LK>;

/** A model of any framework, as goal-tree's own code reads it: its kinds as strings. */
export type AnyModel = Model<string, string>;

/** Each framework's element kinds, as its root reads them (iStar 2.0's: core's). */
type FrameworkElementKinds = { readonly 'istar-2.0': ElementKind } & {
  readonly [F in keyof typeof FRAMEWORK_KINDS]: FrameworkElementKind<F>;
};

/** The element kinds of every framework but `F`: a model holding one is not `F`'s. */
export type ForeignElementKind<F extends Framework> = Exclude<
  FrameworkElementKinds[Framework],
  FrameworkElementKinds[F]
>;

/** The framework of a dialect's models: its `framework`, iStar 2.0 when it has none. */
export type FrameworkOf<D> = D extends { framework: infer F extends Framework }
  ? F
  : D extends { framework?: infer F extends Framework }
    ? F | 'istar-2.0'
    : 'istar-2.0';

/**
 * A model as a mapper of dialect `D` reads it: any whose element kinds are
 * none of another framework's. A model whose kinds are known only at run
 * time (`string`, a file's own metamodel, the workbench's parse) is any
 * framework's; the mapper's dialect checks it then.
 */
export type ModelFor<D, EK extends string, LK extends string> = Model<EK, LK> &
  (string extends EK
    ? unknown
    : [Extract<EK, ForeignElementKind<FrameworkOf<D>>>] extends [never]
      ? unknown
      : {
          readonly '[a model of another framework]': Extract<
            EK,
            ForeignElementKind<FrameworkOf<D>>
          >;
        });
