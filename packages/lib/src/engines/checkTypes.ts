/**
 * Framework type regressions for engine checks (goal-controller#222):
 * `checkOn` / `checks` keep `props` as the dialect's `PropertyValues`, not
 * `any` from a stale `@goal-controller/goal-language` build. Editors prefer
 * workspace sources via project references in this package's tsconfig.
 *
 * Toy dialect only (no engine): same shape `checkOn` reads elsewhere
 * (`{ properties }`, as edgeFamily's `EDGE`).
 */
import { property } from '@goal-controller/dialect';
import type {
  CheckInput,
  OwnerPropertiesOf,
  PropertyValues,
} from '@goal-controller/goal-language';
import { checkOn, checks } from './checks';

type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
type IsAny<T> = 0 extends 1 & T ? true : false;
const same = <T extends true>(): T => true as T;

const { enum: choice, int } = property.for();

const toyProperties = {
  goal: [
    choice(
      'flag',
      [
        ['', 'off'],
        ['on', 'on'],
        ['off', 'off'],
      ],
      { help: 'on or off' },
    ),
    int('n', { min: 0, help: 'a count' }),
  ],
} as const;

const toy = { properties: toyProperties };

type GoalProps = PropertyValues<
  OwnerPropertiesOf<typeof toy, { element: 'goal' }>
>;
type GoalInput = CheckInput<OwnerPropertiesOf<typeof toy, { element: 'goal' }>>;

same<Same<GoalProps['flag'], 'on' | 'off' | null | undefined>>();
same<Same<GoalProps['n'], number | null | undefined>>();
same<Same<IsAny<GoalProps['flag']>, false>>();
same<Same<IsAny<GoalInput['props']['flag']>, false>>();

checkOn(toy, { element: 'goal' })(({ props }) => {
  same<Same<typeof props.flag, 'on' | 'off' | null | undefined>>();
  same<Same<typeof props.n, number | null | undefined>>();
  same<Same<IsAny<typeof props.flag>, false>>();
  // @ts-expect-error flag is the enum's options, not a free string
  const _flag: Exclude<typeof props.flag, null | undefined> = 'maybe';
  void _flag;
  return null;
});

checks({
  'toy.goal.flag': checkOn(toy, { element: 'goal' })(({ props }) => {
    same<Same<typeof props.flag, 'on' | 'off' | null | undefined>>();
    same<Same<IsAny<typeof props.flag>, false>>();
    return null;
  }),
});
