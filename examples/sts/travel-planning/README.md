# Travel planning (NESSoS chapter §2, Figs. 1, 10, 11, 12, 16; Table 1)

**Verdict:** provisionally accepted by the orchestrator (owner away), [#160](https://github.com/vieirin/goal-controller/issues/160#issuecomment-6208981577); the owner confirms before merge.

Paja, Dalpiaz, Giorgini, *STS-Tool: Security Requirements Engineering for Socio-Technical Systems*, Engineering Secure Future Internet Services and Systems, LNCS 8431 (2014) 65–96, §2 (STS-Tool v1.3):

- **Fig. 1a**, the social view (a tool screenshot); **Fig. 1b**, the information view; **Fig. 1c**, the authorisation view;
- **Figs. 10, 11, 12, 16**, the security needs over delegations, transmissions, organisational constraints and authorisations;
- **Table 1**, the security requirements derived from them; **Figs. 17–19**, the analyses' results (#161's references R3–R5, R8).

`travel-planning.txt` is the model, in the `sts` dialect.

## Mapping

| Fig. 1a | Kind | Id |
|---|---|---|
| Bob plays Tourist | agent, play, role | Bob, Tourist |
| Tourist: Trip planned AND-decomposed into Tickets booked and Hotel booked; these two combined (=) | goals, combines | G1–G3 |
| Tourist's Traveling Order (Trip planned reads, modifies and produces it) and ID Doc Copy (Hotel booked reads it) | documents | R1, R2 |
| Tickets booked delegated to TAS; Hotel booked to Hotel | delegations, the copies | G4, G10 |
| Traveling Order provided to TAS; ID Doc Copy to Hotel | transmissions, the copies | R3, R8 |
| TAS: Tickets booked OR-decomposed into Flight ticket booked and Train ticket booked; it needs Traveling Order; Flight ticket booked needs Itinerary details; Train ticket booked produces Tickets | goals, documents | G4–G6, R3–R5 |
| Flight ticket booked delegated to Amadeus Service; Itinerary details provided to it | delegation, transmission | G7, R6 |
| Amadeus Service: Flight ticket booked AND-decomposed into eticket generated and credit card verified, incompatible (≠, Fig. 12); eticket generated produces Flight tickets and needs Itinerary details | agent, goals, documents | G7–G9, R6, R7 |
| Hotel: Hotel booked needs and modifies ID Doc Copy; it re-delegates Hotel booked to Hotel Service (Fig. 18's violation); Room selected comes back from Hotel Service (Fig. 17's cycle) | role, goals | G10, G11, R8 |
| Hotel Service: Hotel booked AND-decomposed into Room selected and Prepayment made (±, read as ≠); Room selected delegated to Hotel; Prepayment made to Payment Service | agent, goals | G12–G14 |
| Payment Service: Prepayment made | agent, goal | G15 |
| ID Doc stolen threatens Hotel's ID Doc Copy; Ticket lost threatens Train ticket booked | events | E1, E2 |

| Fig. 1b | Kind | Id |
|---|---|---|
| Tourist owns Personal data and Itinerary; Destination and Schedule part of Itinerary | information | I1–I4 |
| Personal data tangible by Flight tickets and ID Doc copy; Itinerary by Itinerary details (TAS's) and Traveling order | tangible by | |
| ID Doc copy part of Traveling order | part of | |

| Fig. 16 (and Fig. 1c) | Granted | Prohibited | Information | Scope | Transferable |
|---|---|---|---|---|---|
| Tourist → TAS | read | modify, produce, transmit | I1, I2 | G4 (Tickets booked) | yes |
| Tourist → Hotel | read | modify, produce, transmit | I1 | G10 (Hotel booked) | yes |
| TAS → Amadeus Service | read, produce | modify, transmit | I2, I1 | G7 (Flight ticket booked) | no (dashed) |

| Security needs | From | On |
|---|---|---|
| non-repudiation of acceptance, true redundancy multi actor | Fig. 10 | Tickets booked (Tourist → TAS) |
| no-redelegation, trustworthiness | Fig. 10 | Hotel booked (Tourist → Hotel) |
| non-repudiation of delegation, availability 85% | Fig. 10 | Flight ticket booked (TAS → Amadeus Service) |
| trustworthiness | Fig. 1a (TRUST) | Prepayment made (Hotel Service → Payment Service) |
| integrity and confidentiality (sender), availability 98% | Fig. 11 and its text | Itinerary details (TAS → Amadeus Service) |

## Readings

1. **The needs are Figs. 10–11's, not Fig. 1a's.** Fig. 1a, an earlier screenshot, shows NO RE and NO-D on Tickets booked, and NO RE, NO-D and AVAIA on Flight ticket booked. Figs. 10–11 and Table 1 agree with each other, so the seed follows them.
2. **v1.3's words (#160 D-R3):** *need* is read, *provision* is transmission, U is read, D is transmit.
3. **An operation not highlighted is prohibited.** v1.3 marks allowed operations only, and §2.2 says "not allowing production expresses a security need on non-production". Table 1's non-modification, non-production and non-disclosure for TAS agree.
4. **The Tourist → TAS scope is Tickets booked.** That is §2.2's text and Table 1. Fig. 16 prints Flight ticket booked, and Fig. 1c prints Trip planned, which is the Tourist's goal and not TAS's.
5. **Who ensures integrity and confidentiality of Itinerary details:** the sender (Fig. 11's text, "TAS should ensure"). Table 1 names Amadeus Service responsible for integrity.
6. Hotel Service's ± between Room selected and Prepayment made is read as ≠ (incompatible).
7. Figs. 1b and 1c are drawn by hand. Their *Amadeus flight service* is Fig. 1a's Amadeus Service, and their *Flight tickets* is its document.
8. Fig. 1a's light boxes on the delegation and provision lines are the relationships' labels, not elements.
