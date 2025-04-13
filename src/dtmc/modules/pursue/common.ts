import { achieved, pursued, separator } from '../../../mdp/common';

export const beenAchieved = (
  goalId: string,
  { condition }: { condition: boolean }
) => {
  return `${achieved(goalId)}=${condition ? 1 : 0}`;
};

export const beenPursued = (
  goalId: string,
  { condition }: { condition: boolean }
) => {
  return `${pursued(goalId)}=${condition ? 1 : 0}`;
};

export const beenAchievedAndPursued = (
  goalId: string,
  { achieved, pursued }: { achieved: boolean; pursued: boolean }
) => {
  return [
    beenPursued(goalId, { condition: pursued }),
    beenAchieved(goalId, { condition: achieved }),
  ].join(separator('and'));
};
