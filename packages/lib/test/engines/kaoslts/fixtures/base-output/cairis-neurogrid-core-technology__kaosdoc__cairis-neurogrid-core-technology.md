# Requirements document: cairis-neurogrid-core-technology

Generated from its KAOS goal model.

## Goals

| Goal | Kind | Type | Category | Priority | Fit criterion |
| --- | --- | --- | --- | --- | --- |
| Anonymisation guidelines | Behavioral goal |  |  |  | None |
| Anonymised data | Behavioral goal |  |  |  | None |
| Truststores | Behavioral goal |  |  |  | None |
| Certificate storage | Behavioral goal |  |  |  | None |
| Incorrect access response | Behavioral goal |  |  |  | None |
| User certificate addressability | Behavioral goal |  |  |  | Attempts to login to the NeuroGrid portal with credentials not possible from any other machine beyond that the user certificate was installed for. |
| Dataset policy | Behavioral goal |  |  |  | None |
| Access sponsor | Behavioral goal |  |  |  | None |
| Sponsor clearance | Behavioral goal |  |  |  | None |
| Guest workflow submission | Behavioral goal |  |  |  | None |
| Guest node restriction | Behavioral goal |  |  |  | None |
| WebDAV client | Behavioral goal |  |  |  | None |
| WebDAV folder retention | Behavioral goal |  |  |  | None |
| Folder visibility | Behavioral goal |  |  |  | None |
| Folder permissions | Behavioral goal |  |  |  | None |
| Meta-data query | Behavioral goal |  |  |  | None |
| HTTPS data transfer | Behavioral goal |  |  |  | None |
| Encrypted data transfer | Behavioral goal |  |  |  | If any given packet is sniffed, no plaintext data is read. |
| Completion email | Behavioral goal |  |  |  | Email acknowledgement received after a simple job completes. |
| API data transfer | Behavioral goal |  |  |  | None |

## Goal details

| Goal | Source | Stability | Formal specification | Issue |
| --- | --- | --- | --- | --- |
| Anonymisation guidelines | Interview data |  |  |  |
| Anonymised data | Interview data |  |  |  |
| Truststores | Interview data |  |  |  |
| Certificate storage | Certificate replay Misuse Case |  |  |  |
| Incorrect access response | Interview data |  |  |  |
| User certificate addressability | Goal Model |  |  |  |
| Dataset policy | Interview data |  |  |  |
| Access sponsor | Interview data |  |  |  |
| Sponsor clearance | Background material |  |  |  |
| Guest workflow submission | Interview data |  |  |  |
| Guest node restriction | Interview data |  |  |  |
| WebDAV client | Interview data |  |  |  |
| WebDAV folder retention | Interview data |  |  |  |
| Folder visibility | Interview data |  |  |  |
| Folder permissions | Interview data |  |  |  |
| Meta-data query | Interview data |  |  |  |
| HTTPS data transfer | Interview data |  |  |  |
| Encrypted data transfer | Validation session. |  |  |  |
| Completion email | Goal Model |  |  |  |
| API data transfer | Interview data |  |  |  |

## Refinements

None.

## Domain properties

| Domain property | Description | In the refinement of |
| --- | --- | --- |
| Infrastructure knowledge | NeuroGrid API users have a working knowledge of the NeuroGrid infrastructure, and the security mechanisms used by it. |  |
| Physical infrastructure security | The NeuroGrid server nodes are physically secure. |  |
| Non-federated access control | Access Control Policies are non-federated, although they appear to be. |  |

## Requirements and expectations

| Goal | Assigned to | As |
| --- | --- | --- |
| Anonymisation guidelines |  | unassigned |
| Anonymised data |  | unassigned |
| Truststores |  | unassigned |
| Certificate storage |  | unassigned |
| Incorrect access response |  | unassigned |
| User certificate addressability |  | unassigned |
| Dataset policy |  | unassigned |
| Access sponsor |  | unassigned |
| Sponsor clearance |  | unassigned |
| Guest workflow submission |  | unassigned |
| Guest node restriction |  | unassigned |
| WebDAV client |  | unassigned |
| WebDAV folder retention | Sysadmin | requirement |
| Folder visibility |  | unassigned |
| Folder permissions | Sysadmin | requirement |
| Meta-data query |  | unassigned |
| HTTPS data transfer |  | unassigned |
| Encrypted data transfer |  | unassigned |
| Completion email |  | unassigned |
| API data transfer |  | unassigned |

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
| Inter-process data transmission |  |  |  |  |
| Workflow-Workflow data transfer |  |  |  |  |
| Workflow IPC |  |  |  |  |
| Guest workflow submissions |  | Guest workflow submission |  |  |
| Insecure internal data transmission |  | Encrypted data transfer |  |  |
| Unencrypted data transmission |  |  |  |  |
| Unsigned data transmission |  |  |  |  |
