/**
 * An engine's generation options, as data (goal-controller#118): each
 * one's value is one of the property value types (`bool`, `number`, `int`,
 * `enum`: ValueConfig's), with its default. The workbench renders the
 * options menu, checks a manifest's options and keeps them from these.
 * Nothing here knows any engine.
 */
import type { ValueConfig } from './schema';

type Typed<T extends 'bool' | 'number' | 'int' | 'enum', D> = {
  value: Extract<ValueConfig, { type: T }>;
  default: D;
};

export type OptionDefinition = {
  key: string;
  label: string;
  /** what it does, under its label */
  help?: string;
  /**
   * what the options button says of it: `{value}` is its value (an enum's,
   * its label); a `bool`'s only when it is on. None: the button doesn't.
   */
  summary?: string;
  /**
   * turning it on is asked for, with what it does (`text`, its paragraphs)
   * and the button that does it (`action`); turning it off is not
   */
  confirm?: { text: readonly string[]; action: string };
} & (
  | Typed<'bool', boolean>
  | Typed<'number', number>
  | Typed<'int', number>
  | Typed<'enum', string>
);

/** The value an option takes: a `bool`'s a boolean, an `enum`'s one of its values. */
export type OptionValue<O extends OptionDefinition> = O['value'] extends {
  type: 'bool';
}
  ? boolean
  : O['value'] extends { type: 'int' | 'number' }
    ? number
    : O['value'] extends { options: readonly { value: infer V }[] }
      ? V
      : never;

/** The values of a list of options, by key. */
export type OptionValues<O extends OptionDefinition> = {
  [D in O as D['key']]: OptionValue<D>;
};

/** Whether `value` is one an option takes. */
export const isOptionValue = (
  option: OptionDefinition,
  value: unknown,
): boolean => {
  const config = option.value;
  switch (config.type) {
    case 'bool':
      return typeof value === 'boolean';
    case 'number':
      return typeof value === 'number' && Number.isFinite(value);
    case 'int':
      return (
        Number.isInteger(value) &&
        (config.min === undefined || (value as number) >= config.min) &&
        (config.max === undefined || (value as number) <= config.max)
      );
    case 'enum':
      return (
        typeof value === 'string' &&
        (config.open === true || config.options.some((o) => o.value === value))
      );
  }
};

/**
 * Type-checks a list of options, keeping their literal types (an enum's
 * values), and checks what the types cannot: each key once, each default a
 * value its option takes.
 */
export const defineOptions = <const O extends readonly OptionDefinition[]>(
  options: O,
): O => {
  const keys = new Set<string>();
  for (const option of options) {
    if (keys.has(option.key)) throw new Error(`option ${option.key}: twice`);
    keys.add(option.key);
    if (!isOptionValue(option, option.default))
      throw new Error(
        `option ${option.key}: its default ${JSON.stringify(option.default)} is not one of its values`,
      );
  }
  return options;
};

/** The options' defaults, by key. */
export const optionDefaults = <O extends OptionDefinition>(
  options: readonly O[],
): OptionValues<O> =>
  Object.fromEntries(
    options.map((option) => [option.key, option.default]),
  ) as OptionValues<O>;

/** What the options button says of a set of values: each option's `summary`, in order. */
export const optionsSummary = (
  options: readonly OptionDefinition[],
  values: Readonly<Record<string, unknown>>,
): string =>
  options
    .flatMap((option) => {
      const value = values[option.key] ?? option.default;
      if (option.summary === undefined) return [];
      if (option.value.type === 'bool')
        return value === true ? [option.summary] : [];
      const shown =
        option.value.type === 'enum'
          ? (option.value.options.find((o) => o.value === value)?.label ??
            String(value))
          : String(value);
      return [option.summary.replace('{value}', shown)];
    })
    .join(' · ');
