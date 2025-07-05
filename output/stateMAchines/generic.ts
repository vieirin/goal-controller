import { createMachine } from 'xstate';

export const machine = createMachine({
  context: {},
  id: 'Untitled',
  initial: 'initialState',
  states: {
    initialState: {
      on: {
        skip: {
          target: 'Goal not pursued',
        },
        achieve: {
          target: 'Goal achieved',
          guard: {
            type: 'pursuedAndChildrenAchieved',
          },
        },
        pursueItself: {
          target: 'Goal pursued',
          guard: {
            type: 'notPursuedAndNotAchieved',
          },
        },
      },
    },
    'Goal not pursued': {
      always: {
        target: 'initialState',
      },
    },
    'Goal achieved': {},
    'Goal pursued': {
      on: {
        'Event 1': {
          target: 'initialState',
        },
      },
    },
  },
}).withConfig({
  guards: {
    pursuedAndChildrenAchieved: function (context, event) {
      // Add your guard condition here
      return true;
    },
    notPursuedAndNotAchieved: function (context, event) {
      // Add your guard condition here
      return true;
    },
  },
});
