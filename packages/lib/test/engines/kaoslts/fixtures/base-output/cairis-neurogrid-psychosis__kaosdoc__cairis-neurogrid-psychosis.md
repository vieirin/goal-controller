# Requirements document: cairis-neurogrid-psychosis

Generated from its KAOS goal model.

## Goals

| Goal | Kind | Type | Category | Priority | Fit criterion |
| --- | --- | --- | --- | --- | --- |
| Process clinical data on NeuroGrid | Behavioral goal | Achieve |  |  | TBC |
| Upload clinical data to NeuroGrid | Behavioral goal | Achieve |  |  | TBC |
| Anonymise data | Behavioral goal | Achieve |  |  | TBC |
| Anonymisation guidelines | Behavioral goal |  |  |  | None |
| Anonymised data | Behavioral goal |  |  |  | None |
| Upload authorisation | Behavioral goal | Achieve |  |  | TBC |
| Incorrect access response | Behavioral goal |  |  |  | None |
| NeuroGrid portal access | Behavioral goal | Achieve |  |  | TBC |
| NeuroGrid user authorisation | Behavioral goal | Achieve |  |  | TBC |
| Truststores | Behavioral goal |  |  |  | None |
| Certificate installation | Behavioral goal | Achieve |  |  | TBC |
| Certificate storage | Behavioral goal |  |  |  | None |
| Secure data transmission | Behavioral goal | Maintain |  |  | None |
| HTTPS data transfer | Behavioral goal |  |  |  | None |
| Encrypted data transfer | Behavioral goal |  |  |  | If any given packet is sniffed, no plaintext data is read. |
| API data transfer | Behavioral goal |  |  |  | None |
| Download analysis data | Behavioral goal | Achieve |  |  | TBC |
| Download authorisation | Behavioral goal | Achieve |  |  | TBC |
| Analysis complete acknowledgement | Behavioral goal | Achieve |  |  | TBC |
| Completion email | Behavioral goal |  |  |  | Email acknowledgement received after a simple job completes. |
| Download to WebDAV folder | Behavioral goal | Maintain |  |  | None |
| WebDAV client | Behavioral goal |  |  |  | None |
| Folder visibility | Behavioral goal |  |  |  | None |
| Folder permissions | Behavioral goal |  |  |  | None |
| XML response | Behavioral goal |  |  |  | None |
| Retrieval rate | Behavioral goal |  |  |  | None |
| Upload workflows to NeuroGrid | Behavioral goal | Maintain |  |  | None |
| Data-set access | Behavioral goal | Maintain |  |  | None |
| Dataset policy | Behavioral goal |  |  |  | None |
| Access sponsor | Behavioral goal |  |  |  | None |
| Sponsor clearance | Behavioral goal |  |  |  | None |
| Guest workflow submission | Behavioral goal |  |  |  | None |
| Analysis data location | Behavioral goal |  |  |  | None |
| Intermediate data removal | Behavioral goal |  |  |  | None |
| PreventUnauthorised Certificate Access | Behavioral goal |  |  |  | None |
| Prevent unauthorised site access | Behavioral goal | Achieve |  |  | TBC |
| Verify new staff | Behavioral goal | Achieve |  |  | TBC |
| Prevent Unauthorised PC access | Behavioral goal | Avoid |  |  | TBC |
| Timed login | Behavioral goal | Achieve |  |  | TBC |
| Disallow Multiple Logins | Behavioral goal | Avoid |  |  | TBC |
| Location-based Authentication | Behavioral goal | Achieve |  |  | TBC |
| User certificate addressability | Behavioral goal |  |  |  | Attempts to login to the NeuroGrid portal with credentials not possible from any other machine beyond that the user certificate was installed for. |
| Multi-Factor Authentication | Behavioral goal | Maintain |  |  | None |
| Analysis anonymisation | Behavioral goal |  |  |  | None |
| Guest node restriction | Behavioral goal |  |  |  | None |
| WebDAV folder retention | Behavioral goal |  |  |  | None |

## Goal details

| Goal | Source | Stability | Formal specification | Issue |
| --- | --- | --- | --- | --- |
| Process clinical data on NeuroGrid | SF |  |  | None. |
| Upload clinical data to NeuroGrid | SF |  |  | None |
| Anonymise data | SF |  |  | None |
| Anonymisation guidelines | Interview data |  |  |  |
| Anonymised data | Interview data |  |  |  |
| Upload authorisation | SF |  |  | None |
| Incorrect access response | Interview data |  |  |  |
| NeuroGrid portal access | SF |  |  | None |
| NeuroGrid user authorisation | SF |  |  | None |
| Truststores | Interview data |  |  |  |
| Certificate installation | SF |  |  | None |
| Certificate storage | Certificate replay Misuse Case |  |  |  |
| Secure data transmission | SF |  |  | None |
| HTTPS data transfer | Interview data |  |  |  |
| Encrypted data transfer | Validation session. |  |  |  |
| API data transfer | Interview data |  |  |  |
| Download analysis data | SF |  |  | None |
| Download authorisation | SF |  |  | None |
| Analysis complete acknowledgement | SF |  |  | None |
| Completion email | Goal Model |  |  |  |
| Download to WebDAV folder | SF |  |  | None |
| WebDAV client | Interview data |  |  |  |
| Folder visibility | Interview data |  |  |  |
| Folder permissions | Interview data |  |  |  |
| XML response | Interview data |  |  |  |
| Retrieval rate | Interview data |  |  |  |
| Upload workflows to NeuroGrid | SF |  |  | None |
| Data-set access | SF |  |  | None |
| Dataset policy | Interview data |  |  |  |
| Access sponsor | Interview data |  |  |  |
| Sponsor clearance | Background material |  |  |  |
| Guest workflow submission | Interview data |  |  |  |
| Analysis data location | Background material |  |  |  |
| Intermediate data removal | Background material |  |  |  |
| PreventUnauthorised Certificate Access | SF |  |  | None |
| Prevent unauthorised site access | SF |  |  | None |
| Verify new staff | SF |  |  | None |
| Prevent Unauthorised PC access | SF |  |  | None |
| Timed login | SF |  |  | None |
| Disallow Multiple Logins | SF |  |  | None |
| Location-based Authentication | SF |  |  | None |
| User certificate addressability | Goal Model |  |  |  |
| Multi-Factor Authentication | SF |  |  | None |
| Analysis anonymisation | Download task |  |  |  |
| Guest node restriction | Interview data |  |  |  |
| WebDAV folder retention | Interview data |  |  |  |

## Refinements

| Goal | Refined into | Alternative | Tactic | Status | System |
| --- | --- | --- | --- | --- | --- |
| Process clinical data on NeuroGrid | Upload clinical data to NeuroGrid, Download analysis data, Upload workflows to NeuroGrid, Analysis data location, Intermediate data removal, Secure data analysis, Secure workflow submission |  |  |  |  |
| Upload clinical data to NeuroGrid | Anonymise data, Upload authorisation, NeuroGrid portal access, Secure data transmission, API data transfer |  |  |  |  |
| Anonymise data | Anonymisation guidelines, Anonymised data |  |  |  |  |
| Upload authorisation | Incorrect access response |  |  |  |  |
| NeuroGrid portal access | NeuroGrid user authorisation, Certificate installation |  |  |  |  |
| NeuroGrid user authorisation | Truststores |  |  |  |  |
| Certificate installation | Certificate storage |  |  |  |  |
| Secure data transmission | HTTPS data transfer, Encrypted data transfer |  |  |  |  |
| Download analysis data | NeuroGrid portal access, Download authorisation, Analysis complete acknowledgement, Secure data transmission, Download to WebDAV folder, XML response, Retrieval rate |  |  |  |  |
| Analysis complete acknowledgement | Completion email |  |  |  |  |
| Download to WebDAV folder | WebDAV client, Folder visibility, Folder permissions |  |  |  |  |
| Upload workflows to NeuroGrid | Data-set access, Guest workflow submission |  |  |  |  |
| Data-set access | Dataset policy, Access sponsor, Sponsor clearance |  |  |  |  |
| PreventUnauthorised Certificate Access | Prevent unauthorised site access | 1 of 4 |  |  |  |
| PreventUnauthorised Certificate Access | Prevent Unauthorised PC access | 2 of 4 |  |  |  |
| PreventUnauthorised Certificate Access | Location-based Authentication | 3 of 4 |  |  |  |
| PreventUnauthorised Certificate Access | Multi-Factor Authentication | 4 of 4 |  |  |  |
| Prevent unauthorised site access | Verify new staff |  |  |  |  |
| Prevent Unauthorised PC access | Timed login, Disallow Multiple Logins |  |  |  |  |
| Location-based Authentication | User certificate addressability |  |  |  |  |

## Domain properties

| Domain property | Description | In the refinement of |
| --- | --- | --- |
| Secure data analysis | We assume that the process of analysing data once it has been uploaded to NeuroGrid is secure. | Process clinical data on NeuroGrid |
| Secure workflow submission | We assume the process of submitting workflows to a NeuroGrid node is secure. | Process clinical data on NeuroGrid |
| Infrastructure knowledge | NeuroGrid API users have a working knowledge of the NeuroGrid infrastructure, and the security mechanisms used by it. |  |
| Physical infrastructure security | The NeuroGrid server nodes are physically secure. |  |
| Non-federated access control | Access Control Policies are non-federated, although they appear to be. |  |

## Requirements and expectations

| Goal | Assigned to | As |
| --- | --- | --- |
| Anonymisation guidelines |  | unassigned |
| Anonymised data |  | unassigned |
| Incorrect access response |  | unassigned |
| Truststores |  | unassigned |
| Certificate storage |  | unassigned |
| HTTPS data transfer |  | unassigned |
| Encrypted data transfer |  | unassigned |
| API data transfer |  | unassigned |
| Download authorisation |  | unassigned |
| Completion email |  | unassigned |
| WebDAV client |  | unassigned |
| Folder visibility |  | unassigned |
| Folder permissions | Sysadmin | requirement |
| XML response |  | unassigned |
| Retrieval rate |  | unassigned |
| Dataset policy |  | unassigned |
| Access sponsor |  | unassigned |
| Sponsor clearance |  | unassigned |
| Guest workflow submission |  | unassigned |
| Analysis data location |  | unassigned |
| Intermediate data removal |  | unassigned |
| Verify new staff |  | unassigned |
| Timed login |  | unassigned |
| Disallow Multiple Logins |  | unassigned |
| User certificate addressability |  | unassigned |
| Multi-Factor Authentication |  | unassigned |
| Analysis anonymisation |  | unassigned |
| Guest node restriction |  | unassigned |
| WebDAV folder retention | Sysadmin | requirement |

## Agents

| Agent | Kind | Responsible for |
| --- | --- | --- |
| Data Consumer | Agent |  |
| Data Provider | Agent |  |
| Social Engineer | Agent |  |
| Certificate Authority | Agent |  |
| Hacker | Agent |  |
| Researcher | Agent |  |
| Developer | Agent |  |
| Sysadmin | Agent | WebDAV folder retention, Folder permissions |

## Conflicts

None.

## Obstacles

| Obstacle | Category | Obstructs | Resolved by | Resolution |
| --- | --- | --- | --- | --- |
| Unauthorised portal access |  | NeuroGrid user authorisation, Certificate installation |  |  |
| Control web browser |  |  |  |  |
| XSS Exploit |  |  |  |  |
| Unattended workstation access |  |  |  |  |
| Access user certificate |  |  |  |  |
| Fraudulant certificate application |  |  |  |  |
| Certificate sharing |  |  |  |  |
| Unauthorised clinical data access |  | Sponsor clearance |  |  |
| Fraudulant ethical approval |  |  |  |  |
| Fraudulant clinical data access |  |  |  |  |
