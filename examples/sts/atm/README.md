# ATM meteo information (IJSSE 2014, Fig. 1)

Meland, Paja, Gjære, Paul, Dalpiaz, Giorgini, *Threat Analysis in Goal-Oriented Security Requirements Modelling*, International Journal of Secure Software Engineering 5(2) (2014):

- **Fig. 1**, an STS-ml model of the ATM scenario with events and threats;
- **Fig. 5**, the threat propagation the tool prints for it (#161's reference R7).

`atm.txt` is the model, in the `sts` dialect.

## Mapping

| Fig. 1 | Kind | Id |
|---|---|---|
| Pilot: MET conditions accessed contributes ++ to Fly safe; MET conditions accessed delegated to Aircraft system | role, goals, contribution (`help`, #160) | G1, G2 |
| Aircraft system: MET conditions accessed (copy) AND-decomposed into MET info requested and MET info received. MET info requested is AND-decomposed into Req. message signed and Req. message encrypted, needs Aircraft ID and produces Secure MET request. MET info received is AND-decomposed into Info integrity verified and Message decrypted, both needing Secure MET info object | role, goals, documents | G3–G9, R1–R3 |
| SWIM access point: MET info req. brokered AND-decomposed into Request integrity verified, MET info signed and MET info encrypted, producing Secure MET info object; Request integrity verified needs Secure MET request; MET info signed and MET info encrypted need MET info object | role, goals, documents | G10–G13, R4–R6 |
| Meteo service provider: MET request processed AND-decomposed into Customer verified (needs Secure MET request) and MET info published (needs MET conditions data, produces MET info object); MET data observed produces MET conditions data | role, goals, documents | G14–G17, R7–R9 |
| Secure MET request: Aircraft system → SWIM → Meteo service provider (INTEG each); MET info object: Meteo service provider → SWIM (INTEG, AVAIA); Secure MET info object: SWIM → Aircraft system (INTEG, AVAIA) | transmissions | |
| Bad weather → Fly safe; Consumer spoofing → Aircraft ID; Incompatible encryption → MET info encrypted and Message decrypted; Publisher spoofing → SWIM access point; Erroneous data impact flight → Meteo's MET info object; Free access to paid data → Meteo service provider | events | E1–E6 |

## Readings

1. **All four actors are roles:** the line is at the bottom of each circle.
2. **INTEG is the sender's integrity:** v2.x tags it without a party.
3. **AVAIA has no level** in the figure, and `availability` is a percentage, so it is not in the seed.
4. **MET info encrypted is SWIM's**, as the figure draws it. §3 calls it "the meteo service provider's goal".
5. **The ++ contribution is `help`** (#160, agreed with #161). STS-Tool's `.sts` has a contribution type, but none of the published samples holds one, so the `.sts` writer can't write it. This seed's native round trip loses it, with the writer's warning.
