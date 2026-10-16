# The STS-Tool tutorial samples: expected analyses (goal-controller#161)

The three tutorial models published on sts-tool.eu (eGov, Healthcare, TasLab) are not committed. They are STS-Tool exports; the stress script fetches them and checks each against the `sha256` recorded here. Each `<sample>/expected-analyses.json` holds:

- `source` and `sha256`: the `.exp` as downloaded, and the `.sts` model inside it;
- `findings`: green's three analyses on the model as red's importer reads it (`readSts`, then the analysis view). For each finding it keeps the kind, the severity and the message;
- `requirements`: the security requirements the model derives, by name;
- `report`: the rows that STS-Tool's own report (`Scenario_*_Report.pdf`, published beside the model) prints;
- `differences`: every difference between those rows and green's findings. Each is keyed by its kind and what it is about, and classified by its #160 item:
  - **E…**: an erratum, where the report contradicts the definition in the paper; #160 quotes both;
  - **D-G20**: a disagreement about our reading, or a finding the report prints as several rows.

The analyses are defined from the published sources only (#160 item 1); nothing here comes from the tool's binary (#160, the EULA note).
