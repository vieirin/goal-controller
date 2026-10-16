# Stay permit (the STS-ml manual's running example: Figs. 9, 14, 16, 18, 20)

*Socio-Technical Security Modeling Language*, for STS-Tool 2.0 & 2.1 (rev 1.0), UniTN; §1.2 the scenario:

- **Fig. 9**, the social view; **Fig. 14**, separation of duties; **Fig. 16**, threats;
- **Fig. 18**, the information view; **Fig. 20**, the authorisation view;
- **Table 2**, the derived requirements (C1–C27); **Figs. 23–26**, the analyses' results.

`stay-permit.txt` is the model, in the `sts` dialect.

## Mapping

| Fig. 9 | Kind | Id |
|---|---|---|
| Student: Write doc for I.O, delegated to Program Coordinator (No-Rep, No-del) | role, goal | G1 |
| Program Coordinator: Write doc for I.O (copy) AND-decomposed into Get Student Record, Write Official Doc and Sign doc; Write Official Doc OR-decomposed into Update old doc and Write new doc; Write doc for I.O produces Signed Official Doc | role, goals, document | G2–G7, R1 |
| Write new doc delegated to Secretary (No-Rep, No-del); Get Student Record to Secretary (No-Rep, Tru) | delegations | G13, G8 |
| Secretary: Get Student Record (copy) AND-decomposed into Get Student Pers. Data and Derive Financial Stat., which is AND-decomposed into Obtain UTD Statement and Check Income Adequacy; Get Student Record reads Student support document; Get Student Pers. Data reads Personal data file; Obtain UTD Statement reads Income Statement; Write new doc (copy) reads and modifies Document Template | role, goals, documents | G8–G13, R2–R5 |
| Get Student Pers. Data delegated to IS Manager (No-Rep, Auth); Obtain UTD Statement to IS Manager (Red) | delegations | G14, G15 |
| IS Manager: Get Student Pers. Data produces Personal data file; Obtain UTD Statement produces Income Statement | role, goals, documents | G14, G15, R6, R7 |
| Personal data file transmitted to Secretary (Auth, Con, Ava); Income Statement (Int, Con) | transmissions | R3, R4 |
| Fig. 14: Program Coordinator and Secretary incompatible | roles, incompatible | |
| Fig. 16: DDoS attack threatens IS Manager's Get Student Pers. Data; Info Integrity loss its Personal data file | events | E1, E2 |
| Fig. 18: Student owns PersonalData and FinancialStatus, Program Coordinator Signature; Signature tangible by Signed Official Doc, PersonalData by Personal data file, FinancialStatus by Income Statement (both IS Manager's); these two part of Student support document | information | I1–I3 |

| Fig. 20 | Granted | Prohibited | Information | Scope | Transferable |
|---|---|---|---|---|---|
| Student → IS Manager | read, produce, transmit | | I1, I2 | G14 (Get Student Pers. Data) | yes |
| IS Manager → Secretary | read | modify, transmit | I2, I1 | G8 (Get Student Record) | yes |
| Student → Program Coordinator | read | produce | I2, I1 | G2 (Write doc for I.O) | yes |
| Program Coordinator → Secretary | read | modify | I2, I1 | G8 (Get Student Record) | no |

## Readings

1. **Which needs:** the figure's tags. Where a tag has no type, the type comes from Table 2 or the text:
   - Write doc for I.O's and Get Student Record's No-Rep: acceptance (C9, C11);
   - Write new doc's No-Rep: delegation (C10);
   - Get Student Pers. Data's No-Rep: acceptance (C21);
   - its Auth: delegatee (§2.1, the IS Manager authenticates);
   - Obtain UTD Statement's Red: true redundancy single (§2.1);
   - Personal data file's Auth: receiver (§3 (v));
   - Con and Int: the sender (§2.1, the IS Manager ensures them);
   - Ava: 86% (C24).
2. **Where the figure and the text or Table 2 differ, the figure is followed:**
   - Table 2 puts true_rm, no-redelegation and non-repudiation on Get Student Pers. Data (C20–C22), and §2.1 gives Obtain UTD Statement availability 90% and both authentications. The figure has Red on Obtain UTD Statement and No-Rep, Auth on Get Student Pers. Data.
   - §2.1 gives Income Statement availability 70%; the figure shows no Ava on it.
3. **Program Coordinator → Secretary is not transferable:** §2.3 says "granting a non-transferrable authorization". The figure's line style can't be told apart at its resolution.
4. **Fig. 15's CoD is not in the seed:** its second goal, *Fill tax returns*, is in no other figure.
5. In Fig. 20, an operation neither ticked nor crossed is unspecified (2.x, #160 D-R3).
