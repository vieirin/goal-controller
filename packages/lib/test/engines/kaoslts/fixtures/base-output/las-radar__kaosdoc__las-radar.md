# Requirements document: las-radar

Generated from its KAOS goal model.

## Goals

| Goal | Kind | Type | Category | Priority | Fit criterion |
| --- | --- | --- | --- | --- | --- |
| Ambulance service (RADAR's AmbulanceServiceModel) | Behavioral goal |  |  |  |  |
| Ambulance mobilised | Behavioral goal |  |  |  |  |
| Incident form encoded | Behavioral goal |  |  |  |  |
| Ambulance allocated | Behavioral goal |  |  |  |  |
| Mobilisation communicated | Behavioral goal |  |  |  |  |
| Mobilised ambulance travels to the incident | Behavioral goal |  |  |  |  |
| Mobilised ambulance located | Behavioral goal |  |  |  |  |
| Ambulances deployed | Behavioral goal |  |  |  |  |

## Goal details

None.

## Refinements

| Goal | Refined into | Alternative | Tactic | Status | System |
| --- | --- | --- | --- | --- | --- |
| Ambulance service (RADAR's AmbulanceServiceModel) | Ambulance mobilised, Mobilised ambulance travels to the incident, Ambulances deployed |  |  |  |  |
| Ambulance mobilised | Incident form encoded, Ambulance allocated, Mobilisation communicated |  |  |  |  |
| Mobilised ambulance travels to the incident | Mobilised ambulance located |  |  |  |  |

## Domain properties

None.

## Requirements and expectations

| Goal | Assigned to | As |
| --- | --- | --- |
| Incident form encoded | Incident Form Encoding Method: Current Paper-Based, Incident Form Encoding Method: Computer Based, Incident Form Encoding Method: Automated Call Location, Incident Form Encoding Method: Computer-Based and Automated Call Location | requirement |
| Ambulance allocated | Ambulance Allocation Method: Current Paper-Based, Ambulance Allocation Method: Interactive Allocation, Ambulance Allocation Method: Fully Automated Allocation | requirement |
| Mobilisation communicated | Mobilisation Communication Method: Current Radio-Based, Mobilisation Communication Method: MDT-System A, Mobilisation Communication Method: MDT-System B | requirement |
| Mobilised ambulance located | Ambulance Location Method: Current Radio and Paper-Based, Ambulance Location Method: Automated Vehicle Location A, Ambulance Location Method: Automated Vehicle Location B | requirement |
| Ambulances deployed | Additional Ambulance: Current_100_Amb, Additional Ambulance: 120_Amb, Additional Ambulance: 140_Amb, Additional Ambulance: 160_Amb, Additional Ambulance: 180_Amb, Additional Ambulance: 200_Amb | requirement |

## Agents

| Agent | Kind | Responsible for |
| --- | --- | --- |
| Incident Form Encoding Method: Current Paper-Based | Agent | Incident form encoded |
| Incident Form Encoding Method: Computer Based | Agent | Incident form encoded |
| Incident Form Encoding Method: Automated Call Location | Agent | Incident form encoded |
| Incident Form Encoding Method: Computer-Based and Automated Call Location | Agent | Incident form encoded |
| Ambulance Allocation Method: Current Paper-Based | Agent | Ambulance allocated |
| Ambulance Allocation Method: Interactive Allocation | Agent | Ambulance allocated |
| Ambulance Allocation Method: Fully Automated Allocation | Agent | Ambulance allocated |
| Mobilisation Communication Method: Current Radio-Based | Agent | Mobilisation communicated |
| Mobilisation Communication Method: MDT-System A | Agent | Mobilisation communicated |
| Mobilisation Communication Method: MDT-System B | Agent | Mobilisation communicated |
| Ambulance Location Method: Current Radio and Paper-Based | Agent | Mobilised ambulance located |
| Ambulance Location Method: Automated Vehicle Location A | Agent | Mobilised ambulance located |
| Ambulance Location Method: Automated Vehicle Location B | Agent | Mobilised ambulance located |
| Additional Ambulance: Current_100_Amb | Agent | Ambulances deployed |
| Additional Ambulance: 120_Amb | Agent | Ambulances deployed |
| Additional Ambulance: 140_Amb | Agent | Ambulances deployed |
| Additional Ambulance: 160_Amb | Agent | Ambulances deployed |
| Additional Ambulance: 180_Amb | Agent | Ambulances deployed |
| Additional Ambulance: 200_Amb | Agent | Ambulances deployed |

## Conflicts

None.
