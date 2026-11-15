# Requirements document: ebanking

Generated from its KAOS goal model.

## Goals

| Goal | Kind | Type | Category | Priority | Fit criterion |
| --- | --- | --- | --- | --- | --- |
| Avoid [AccountNumber&PinKnownByUnauthorized] | Behavioral goal | Avoid | Confidentiality |  |  |
| Avoid [RepeatableAccountNumberCheckFromPin] | Behavioral goal | Avoid | Confidentiality |  |  |
| Avoid [RepeatablePinCheckFromAccountNumber] | Behavioral goal | Avoid | Confidentiality |  |  |

## Goal details

| Goal | Source | Stability | Formal specification | Issue |
| --- | --- | --- | --- | --- |
| Avoid [AccountNumber&PinKnownByUnauthorized] |  |  | ∀ p: Person, acc: Account · ¬ (Owner(p, acc) ∨ Proxy(p, acc) ∨ Manager(p, acc)) ⇒ ¬ (KnowsV[p] acc.AccNum ∧ KnowsV[p] acc.PIN) |  |

## Refinements

None.

## Domain properties

None.

## Requirements and expectations

| Goal | Assigned to | As |
| --- | --- | --- |
| Avoid [AccountNumber&PinKnownByUnauthorized] |  | unassigned |
| Avoid [RepeatableAccountNumberCheckFromPin] |  | unassigned |
| Avoid [RepeatablePinCheckFromAccountNumber] |  | unassigned |

## Agents

| Agent | Kind | Responsible for |
| --- | --- | --- |
| Thief | Agent | Achieve [AccountNumberCheckedForPinMatch], Achieve [CheckIteratedOnOtherAccountNumbersIfNoMatch], Achieve [PinCheckedForAccountNumberMatch], Achieve [CheckIteratedOnOtherPinsIfNoMatch] |
| Banking System | Agent | RepeatableAccountNumberCheckFromPin, RepeatablePinCheckFromAccountNumber |

## Conflicts

None.

## Threats

| Anti-goal | Obstructs | Assigned to | As |
| --- | --- | --- | --- |
| Achieve [MoneyStolenFromBankAccounts] |  |  | anti-goal |
| Achieve [AccountsAttacked] |  |  | anti-goal |
| Achieve [MoneyTakenFromAttackedAccounts] |  |  | anti-goal |
| Achieve [PaymentMediumKnownByThief] |  |  | anti-goal |
| Achieve [ThiefKnowsWhichBank] |  |  | anti-goal |
| Achieve [ThiefKnowsAccountStructure] |  |  | anti-goal |
| Achieve [AccountNumber&PinKnownByThief] |  |  | anti-goal |
| Achieve [PinKnown&MatchingAccountNumberFound] |  |  | anti-goal |
| Achieve [PinKnown] |  |  | anti-goal |
| Achieve [MatchingAccountNumberFound] |  |  | anti-goal |
| Achieve [AccountNumberCheckedForPinMatch] |  | Thief | anti-requirement |
| Achieve [CheckIteratedOnOtherAccountNumbersIfNoMatch] |  | Thief | anti-requirement |
| RepeatableAccountNumberCheckFromPin |  | Banking System | vulnerability |
| Achieve [AccountNumberKnown&MatchingPinFound] |  |  | anti-goal |
| Achieve [AccountNumberKnown] |  |  | anti-goal |
| Achieve [MatchingPinFound] |  |  | anti-goal |
| Achieve [PinCheckedForAccountNumberMatch] |  | Thief | anti-requirement |
| Achieve [CheckIteratedOnOtherPinsIfNoMatch] |  | Thief | anti-requirement |
| RepeatablePinCheckFromAccountNumber |  | Banking System | vulnerability |

## Obstacles

| Obstacle | Category | Obstructs | Resolved by | Resolution |
| --- | --- | --- | --- | --- |
| Achieve [MoneyStolenFromBankAccounts] | AntiGoal |  |  |  |
| Achieve [AccountsAttacked] | AntiGoal |  |  |  |
| Achieve [MoneyTakenFromAttackedAccounts] | AntiGoal |  |  |  |
| Achieve [PaymentMediumKnownByThief] | AntiGoal |  |  |  |
| Achieve [ThiefKnowsWhichBank] | AntiGoal |  |  |  |
| Achieve [ThiefKnowsAccountStructure] | AntiGoal |  |  |  |
| Achieve [AccountNumber&PinKnownByThief] | AntiGoal |  |  |  |
| Achieve [PinKnown&MatchingAccountNumberFound] | AntiGoal |  |  |  |
| Achieve [PinKnown] | AntiGoal |  |  |  |
| Achieve [MatchingAccountNumberFound] | AntiGoal |  |  |  |
| Achieve [AccountNumberCheckedForPinMatch] | AntiGoal |  |  |  |
| Achieve [CheckIteratedOnOtherAccountNumbersIfNoMatch] | AntiGoal |  |  |  |
| RepeatableAccountNumberCheckFromPin | AntiGoal |  | Avoid [RepeatableAccountNumberCheckFromPin] | obstacle prevention |
| Achieve [AccountNumberKnown&MatchingPinFound] | AntiGoal |  |  |  |
| Achieve [AccountNumberKnown] | AntiGoal |  |  |  |
| Achieve [MatchingPinFound] | AntiGoal |  |  |  |
| Achieve [PinCheckedForAccountNumberMatch] | AntiGoal |  |  |  |
| Achieve [CheckIteratedOnOtherPinsIfNoMatch] | AntiGoal |  |  |  |
| RepeatablePinCheckFromAccountNumber | AntiGoal |  | Avoid [RepeatablePinCheckFromAccountNumber] | obstacle prevention |
