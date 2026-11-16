# Requirements document: cairis-acme-water-day

Generated from its KAOS goal model.

## Goals

| Goal | Kind | Type | Category | Priority | Fit criterion |
| --- | --- | --- | --- | --- | --- |
| Secure operating environment | Behavioral goal | Maintain |  |  | None |
| Secure network infrastructure | Behavioral goal | Maintain |  |  | None |
| Secure Routers | Behavioral goal | Maintain |  |  | None |
| Router Installation | Behavioral goal | Maintain |  |  | TBC |
| Router maintenance | Behavioral goal | Maintain |  |  | TBC |
| Intrusion Prevention System | Behavioral goal | Maintain |  |  | None |
| Firewall and DMZ | Behavioral goal | Maintain |  |  | None |
| Internet access | Behavioral goal | Maintain |  |  | None |
| Firewall rule attributes | Behavioral goal | Maintain |  |  | None |
| Firewall trafffic monitoring | Behavioral goal | Maintain |  |  | None |
| Malicious traffic blocking | Behavioral goal |  |  |  | None |
| Malicious traffic alert | Behavioral goal |  |  |  | None |
| Least privilege connections | Behavioral goal | Maintain |  |  | TBC |
| Firewall administration monitoring | Behavioral goal |  |  |  | Logs are changed when the firewall is updated, and the log indicates who made what change. |
| Hardware Firewall | Behavioral goal |  |  |  | Firewall software fails to run if any STCS or corporate applications are running on the same device. |
| Authorised SMB or WebDAV connections | Behavioral goal |  |  |  | An unknown application attempts to open an SMB and WebDAV connection to an address that requires routing through the firewall and fails. |
| Secure wifi | Behavioral goal | Maintain |  |  | None |
| Wifi encryption | Behavioral goal |  |  |  | None |
| SSID broadcast | Behavioral goal |  |  |  | None |
| Active Directory wifi control | Behavioral goal |  |  |  | A wifi device is added to the corporate network but not to Active Directory.  Access to a resource in Active Directory fails. |
| MAC address filtering | Behavioral goal |  |  |  | None |
| Secure Remote Access | Behavioral goal | Maintain |  |  | None |
| Access revocation | Behavioral goal | Maintain |  |  | TBC |
| Remote access inventory | Behavioral goal | Maintain |  |  | TBC |
| Third party requests | Behavioral goal |  |  |  | None |
| Third party remote access | Behavioral goal |  |  |  | None |
| Two-Factor Remote Access | Behavioral goal |  |  |  | None |
| Identifiable connections | Behavioral goal | Maintain |  |  | All network traffic can be tracked to registered, authorised, network point. |
| Active Directory Network Services | Behavioral goal | Maintain |  |  | Network connectivity to any SCADA, Telemetry, and Control System application workstation can be cut using Active Directory. |
| Secure changes | Behavioral goal | Maintain |  |  | None |
| ACME Change Control | Behavioral goal | Maintain |  |  | None |
| Critical Vendor patches | Behavioral goal | Maintain |  |  | None |
| Control testing | Behavioral goal | Maintain |  |  | When a patch is released, the written process log notes the testing carried out and the outcome. |
| Compensating controls | Behavioral goal | Maintain |  |  | TBC |
| Versioned PLC changes | Behavioral goal | Maintain |  |  | This can be achieved by using a centralised software repository. |
| Important Vendor patches | Behavioral goal | Maintain |  |  | TBC |
| Warranted connection | Behavioral goal | Maintain |  |  | The warrant for each SCADA, Telemetry, and Control System connection is recorded in the BMS. |
| Active Directory software deployment | Behavioral goal | Maintain |  |  | Automated alerts fire from the Active Directory domain controller when the software has been installed. |
| Warranted Access | Behavioral goal | Maintain |  |  | TBC |
| Administration access warrant | Behavioral goal |  |  |  | Group access for administrators is monitored manually, and each instance of access is logged. |
| Patch Risk Management | Behavioral goal | Maintain |  |  | Risk and impact assessment fields fields filled in for each approved patch. |
| Access Control | Behavioral goal | Maintain |  |  | None |
| User Id Least privilege | Behavioral goal | Maintain |  |  | None |
| Critical area logging | Behavioral goal | Maintain |  |  | None |
| Log file size | Behavioral goal | Maintain |  |  | None |
| Log file overwrite | Behavioral goal | Maintain |  |  | None |
| Id level access control | Behavioral goal | Maintain |  |  | TBC |
| EnterpriseSCADA access control | Behavioral goal | Maintain |  |  | TBC |
| Password policy | Behavioral goal | Maintain |  |  | TBC |
| Password expiration | Behavioral goal | Maintain |  |  | TBC |
| Password mixed characters | Behavioral goal | Maintain |  |  | None |
| Password length | Behavioral goal | Maintain |  |  | TBC |
| Password storage | Behavioral goal | Maintain |  |  | None |
| Vendor passwords | Behavioral goal | Maintain |  |  | TBC |
| TMS access control | Behavioral goal | Maintain |  |  | TBC |
| Credentials non-disclosure | Behavioral goal |  |  |  | TBC |
| Secure Operating Systems | Behavioral goal | Maintain |  |  | None |
| Standard build | Behavioral goal | Maintain |  |  | None |
| OS hardening | Behavioral goal | Maintain |  |  | TBC |
| Email routing | Behavioral goal |  |  |  |  |
| Inbuilt security | Behavioral goal |  |  |  | None |
| Port scan | Behavioral goal |  |  |  | None |
| Operating system logs | Behavioral goal | Maintain |  |  | Logging for future analysis. |
| Authorised removable media | Behavioral goal | Maintain |  |  | TBC |
| Scanned media | Behavioral goal | Maintain |  |  | None |
| Anti-virus | Behavioral goal | Maintain |  |  | TBC |
| Malware data scanning | Behavioral goal | Maintain |  |  | None |
| Product security configuration | Behavioral goal |  |  |  | None |
| Secure SLA | Behavioral goal | Maintain |  |  | TBC |
| Secure Roles | Behavioral goal | Maintain |  |  | None |
| Responsibility clarification | Behavioral goal |  |  |  | None |
| Router misuse prevention | Behavioral goal |  |  |  | Generic users and passwords are not present on any router devices.  For any given router under a particular contract, the contract states how service availability is maintained and what the partner's security policy expectations are, including explicit definitions of security requirements. |
| Product security accreditation | Behavioral goal | Achieve |  |  | None |
| Communication device backdoors | Behavioral goal |  |  |  | Network scans find no backdoor access. |
| Secure backup | Behavioral goal | Maintain |  |  | None |
| Backup media | Behavioral goal | Maintain |  |  | None |
| Backup testing | Behavioral goal | Maintain |  |  | Regular backup test to check integrity |
| Offsite backup | Behavioral goal | Maintain |  |  | None |
| Backup storage | Behavioral goal | Maintain |  |  | None |
| Backup hardware | Behavioral goal | Maintain |  |  | None |
| Backup transmission | Behavioral goal | Maintain |  |  | None |
| Backup logs | Behavioral goal | Maintain |  |  | None |
| Application program backup | Behavioral goal |  |  |  | Create new PC image. Download app |
| Compliance audit | Behavioral goal | Maintain |  |  | None |
| Remote connection audit | Behavioral goal | Maintain |  |  | None |
| Asset Inventory | Behavioral goal | Maintain |  |  | None |
| Build data | Behavioral goal | Maintain |  |  | None |
| Third party compliance | Behavioral goal | Maintain |  |  | TBC |
| Acceptable Use Policy | Behavioral goal |  |  |  | None |
| Secure site | Behavioral goal | Maintain |  |  | None |
| ICT awareness | Behavioral goal | Maintain |  |  | TBC |
| Key ICT security | Behavioral goal | Maintain |  |  | TBC |
| Fire suppression | Behavioral goal | Maintain |  |  | TBC |
| Fire detection | Behavioral goal | Maintain |  |  | TBC |
| Environmental controls | Behavioral goal | Maintain |  |  | TBC |
| Locked cabinets | Behavioral goal | Maintain |  |  | TBC |
| Locked doors | Behavioral goal | Maintain |  |  | TBC |
| Computer Rooms | Behavioral goal | Maintain |  |  | TBC |
| Power provision | Behavioral goal | Maintain |  |  | TBC |
| Industrialised secure cabinets | Behavioral goal | Maintain |  |  | Local operators periodically check security of cabinets. |
| Business activity asset | Behavioral goal | Maintain |  |  | None |
| Pay number sharing | Behavioral goal |  |  |  | None |

## Goal details

| Goal | Source | Stability | Formal specification | Issue |
| --- | --- | --- | --- | --- |
| Secure operating environment | Anon |  |  | None |
| Secure network infrastructure | Anon |  |  | None |
| Secure Routers | Anon |  |  | None |
| Router Installation | Anon |  |  | Standard 7.4(ff) |
| Router maintenance | Anon |  |  | Standard 7.4(ff) |
| Intrusion Prevention System | Anon |  |  | Standard 7.2(v) |
| Firewall and DMZ | Anon |  |  | Standard 7.2(u)<br>Standard 7.3(x) |
| Internet access | Anon |  |  | Standard 7.7(uu) |
| Firewall rule attributes | Anon |  |  | Standard 7.3(aa) |
| Firewall trafffic monitoring | Anon |  |  | Standard 7.3(bb)<br>Standard 7.3(ee) |
| Malicious traffic blocking | Standard 7.3(cc) |  |  |  |
| Malicious traffic alert | Standard 7.3(dd), Standard 7.12(yyy) |  |  |  |
| Least privilege connections | Anon |  |  | Standard 7.2(v) |
| Firewall administration monitoring | Anon |  |  |  |
| Hardware Firewall | Standard 7.3(y) |  |  |  |
| Authorised SMB or WebDAV connections | Anon |  |  |  |
| Secure wifi | Anon |  |  | Standard 7.5 |
| Wifi encryption | Standard 7.5(jj) |  |  |  |
| SSID broadcast | Standard 7.5(kk) |  |  |  |
| Active Directory wifi control | Standard 7.5(mm) |  |  |  |
| MAC address filtering | Standard 7.5(ll) |  |  |  |
| Secure Remote Access | Anon |  |  | Standard 7.6 |
| Access revocation | Anon |  |  | Standard 7.6(qq) |
| Remote access inventory | Anon |  |  | Standard 7.6(nn) |
| Third party requests | Standard 7.6(rr) |  |  |  |
| Third party remote access | Standard 7.6(ss) |  |  |  |
| Two-Factor Remote Access | Standard 7.6(pp) |  |  |  |
| Identifiable connections | Anon |  |  | Standard 7.2(s) |
| Active Directory Network Services | Anon |  |  | Standard 7.2(q) |
| Secure changes | Anon |  |  |  |
| ACME Change Control | Anon |  |  | Standard 7.1(n) |
| Critical Vendor patches | Anon |  |  | Standard 7.11(ppp) |
| Control testing | Anon |  |  | Standard 7.11(sss) |
| Compensating controls | Anon |  |  | Standard 7.11(ttt)<br>Standard 7.11(vvv) |
| Versioned PLC changes | Anon |  |  | Standard 7.14(ssss) |
| Important Vendor patches | Anon |  |  | Standard 7.11(rrr) |
| Warranted connection | Anon |  |  | Standard 7.2(t) |
| Active Directory software deployment | Anon |  |  | Standard 7.2(r).  Relying on Active Directory to disallow installations over logged installation. |
| Warranted Access | Anon |  |  | Standard 7.8(ww) |
| Administration access warrant | Standard 7.8(bbb) |  |  |  |
| Patch Risk Management | Anon |  |  | Standard 7.11(qqq) |
| Access Control | Anon |  |  | None |
| User Id Least privilege | Anon |  |  | Standard 7.8(aaa) |
| Critical area logging | Anon |  |  | Standard 7.12(aaaa) |
| Log file size | Anon |  |  | Standard 7.12(bbbb) |
| Log file overwrite | Anon |  |  | Standard 7.12(cccc) |
| Id level access control | Anon |  |  | Standard 7.8(xx)<br>Standard 7.8(zz) |
| EnterpriseSCADA access control | Anon |  |  | Standard 7.8(ccc) |
| Password policy | Anon |  |  | None |
| Password expiration | Anon |  |  | Standard 7.9(fff) |
| Password mixed characters | Anon |  |  | Standard 7.9(ggg) |
| Password length | Anon |  |  | Standard 7.9(eee) |
| Password storage | Anon |  |  | Standard 7.9 (jjj) |
| Vendor passwords | Anon |  |  | Standard 7.9(hhh) |
| TMS access control | Anon |  |  | Standard 7.8(ddd) |
| Credentials non-disclosure | Standard 7.8(yy), Standard 7.9(iii) |  |  |  |
| Secure Operating Systems | Anon |  |  |  |
| Standard build | Anon |  |  | Standard 7.1 (l) |
| OS hardening | Anon |  |  | Standard 7.10(kkk)<br>Standard 7.10(mmm) |
| Email routing | Standard 7.7 (vv) |  |  |  |
| Inbuilt security | Standard 7.10(nnn) |  |  |  |
| Port scan | Standard 7.10(lll) |  |  |  |
| Operating system logs | Anon |  |  | Standard 7.12(zzz) |
| Authorised removable media | Anon |  |  | Standard 7.10(ooo) |
| Scanned media | Anon |  |  | Standard 7.11(www) |
| Anti-virus | Anon |  |  | Standard 7.11(uuu) |
| Malware data scanning | Anon |  |  | Standard 7.11(xxx) |
| Product security configuration | Standard 7.14(qqqq) |  |  |  |
| Secure SLA | Anon |  |  | Standard 7.1(o) |
| Secure Roles | Anon |  |  | Standard 5(a) |
| Responsibility clarification | Standard 5(b) |  |  |  |
| Router misuse prevention | Standard 7.4(hh) |  |  |  |
| Product security accreditation | Anon |  |  | Standard 7.1(p) |
| Communication device backdoors | Standard 7.6(tt) |  |  |  |
| Secure backup | Anon |  |  | Standard 7.13(dddd) |
| Backup media | Anon |  |  | Standard 7.13(eeee) |
| Backup testing | Anon |  |  | Standard 7.13(ffff) |
| Offsite backup | Anon |  |  | Standard 7.14(gggg) |
| Backup storage | Anon |  |  | Standard 7.13(hhhh) |
| Backup hardware | Anon |  |  | Standard 7.13(iiii) |
| Backup transmission | Anon |  |  | Standard 7.13(hhhh) |
| Backup logs | Anon |  |  | Standard 7.13(jjjj) |
| Application program backup | Standard 7.14(kkkk) |  |  |  |
| Compliance audit | Anon |  |  | Standard 7.14 |
| Remote connection audit | Anon |  |  | Standard 7.14(nnnn) |
| Asset Inventory | Anon |  |  | Standard 7.14(oooo) |
| Build data | Anon |  |  | Standard 7.14(pppp) |
| Third party compliance | Anon |  |  | Standard 7.14(rrrr) |
| Acceptable Use Policy | Standard 7.14(mmmm) |  |  |  |
| Secure site | Anon |  |  | Standard 7.15(tttt) |
| ICT awareness | Anon |  |  | Organisational InfoSec Policy 2.9 para 4. |
| Key ICT security | Anon |  |  | Organisational InfoSec Policy 2.9 para 2. |
| Fire suppression | Anon |  |  | Standard 7.15(aaaaa) |
| Fire detection | Anon |  |  | Standard 7.15(zzzz) |
| Environmental controls | Anon |  |  | Standard 7.15(yyyy) |
| Locked cabinets | Anon |  |  | Standard 7.15(vvvv) |
| Locked doors | Anon |  |  | Standard 7.15(xxxx) |
| Computer Rooms | Anon |  |  | Standard 7.15(uuuu) |
| Power provision | Anon |  |  | Standard 7.15(bbbbb) |
| Industrialised secure cabinets | Anon |  |  | Standard 7.15(wwww) |
| Business activity asset | Anon |  |  | Organisational InfoSec Policy 2.5 para 1. |
| Pay number sharing | Anon |  |  |  |

## Refinements

| Goal | Refined into | Alternative | Tactic | Status | System |
| --- | --- | --- | --- | --- | --- |
| Secure operating environment | Secure network infrastructure, Secure changes, Access Control, Secure Operating Systems, Secure SLA, Secure Roles, Product security accreditation, Secure backup, Compliance audit, Secure site, Business activity asset |  |  |  |  |
| Secure network infrastructure | Secure Routers, Intrusion Prevention System, Firewall and DMZ, Secure wifi, Secure Remote Access, Identifiable connections |  |  |  |  |
| Secure Routers | Router Installation, Router maintenance |  |  |  |  |
| Firewall and DMZ | Internet access, Firewall rule attributes, Firewall trafffic monitoring, Least privilege connections, Firewall administration monitoring, Hardware Firewall, Authorised SMB or WebDAV connections |  |  |  |  |
| Firewall trafffic monitoring | Malicious traffic blocking, Malicious traffic alert |  |  |  |  |
| Secure wifi | Wifi encryption, SSID broadcast, Active Directory wifi control, MAC address filtering |  |  |  |  |
| Secure Remote Access | Access revocation, Remote access inventory, Third party requests, Third party remote access, Two-Factor Remote Access |  |  |  |  |
| Identifiable connections | Active Directory Network Services |  |  |  |  |
| Active Directory Network Services | Active Directory wifi control |  |  |  |  |
| Secure changes | ACME Change Control, Critical Vendor patches, Compensating controls, Versioned PLC changes, Important Vendor patches, Warranted connection, Active Directory software deployment, Warranted Access, Patch Risk Management |  |  |  |  |
| Critical Vendor patches | Control testing |  |  |  |  |
| Compensating controls | Control testing |  |  |  |  |
| Important Vendor patches | Control testing |  |  |  |  |
| Warranted Access | Administration access warrant |  |  |  |  |
| Access Control | User Id Least privilege, Critical area logging, Id level access control, EnterpriseSCADA access control, Password policy, TMS access control, Credentials non-disclosure |  |  |  |  |
| Critical area logging | Log file size, Log file overwrite |  |  |  |  |
| Password policy | Password expiration, Password mixed characters, Password length, Password storage, Vendor passwords |  |  |  |  |
| Secure Operating Systems | Standard build, Operating system logs, Authorised removable media, Anti-virus, Product security configuration |  |  |  |  |
| Standard build | OS hardening |  |  |  |  |
| OS hardening | Email routing, Inbuilt security, Port scan |  |  |  |  |
| Operating system logs | Log file overwrite, Log file size |  |  |  |  |
| Authorised removable media | Scanned media |  |  |  |  |
| Anti-virus | Compensating controls | 1 of 2 |  |  |  |
| Anti-virus | Malware data scanning | 2 of 2 |  |  |  |
| Secure Roles | Responsibility clarification, Router misuse prevention |  |  |  |  |
| Product security accreditation | Communication device backdoors |  |  |  |  |
| Secure backup | Backup media, Backup testing, Offsite backup, Backup hardware, Backup transmission, Backup logs, Application program backup |  |  |  |  |
| Offsite backup | Backup storage |  |  |  |  |
| Compliance audit | Remote connection audit, Asset Inventory, Third party compliance, Acceptable Use Policy |  |  |  |  |
| Asset Inventory | Build data, Product security configuration |  |  |  |  |
| Third party compliance | Third party remote access |  |  |  |  |
| Secure site | ICT awareness, Key ICT security, Fire suppression, Fire detection, Environmental controls, Locked cabinets, Locked doors, Computer Rooms, Power provision, Industrialised secure cabinets |  |  |  |  |

## Domain properties

| Domain property | Description | In the refinement of |
| --- | --- | --- |
| PC infrastructure | Works diary GT concept |  |

## Requirements and expectations

| Goal | Assigned to | As |
| --- | --- | --- |
| Router Installation | ICT Partner | requirement |
| Router maintenance | ICT Partner | requirement |
| Intrusion Prevention System | Information Security Manager | requirement |
| Internet access | Instrument Technician | requirement |
| Firewall rule attributes | Information Security Manager | requirement |
| Malicious traffic blocking |  | unassigned |
| Malicious traffic alert |  | unassigned |
| Least privilege connections | Information Security Manager | requirement |
| Firewall administration monitoring |  | unassigned |
| Hardware Firewall |  | unassigned |
| Authorised SMB or WebDAV connections |  | unassigned |
| Wifi encryption |  | unassigned |
| SSID broadcast |  | unassigned |
| Active Directory wifi control |  | unassigned |
| MAC address filtering |  | unassigned |
| Access revocation | Information Security Manager | requirement |
| Remote access inventory | Information Security Manager | requirement |
| Third party requests |  | unassigned |
| Third party remote access |  | unassigned |
| Two-Factor Remote Access |  | unassigned |
| ACME Change Control | ICT Partner | requirement |
| Control testing | ICT Partner | requirement |
| Versioned PLC changes | Instrument Technician | requirement |
| Warranted connection |  | unassigned |
| Active Directory software deployment | ICT Partner | requirement |
| Administration access warrant |  | unassigned |
| Patch Risk Management | Information Security Manager | requirement |
| User Id Least privilege | ICT Partner | requirement |
| Log file size | ICT Partner | requirement |
| Log file overwrite | ICT Partner | requirement |
| Id level access control | ICT Partner | requirement |
| EnterpriseSCADA access control | Information Security Manager | requirement |
| Password expiration | ICT Partner | requirement |
| Password mixed characters | Plant Operator | requirement |
| Password length | ICT Partner | requirement |
| Password storage | Plant Operator | requirement |
| Vendor passwords |  | unassigned |
| TMS access control | Information Security Manager | requirement |
| Credentials non-disclosure |  | unassigned |
| Email routing |  | unassigned |
| Inbuilt security |  | unassigned |
| Port scan |  | unassigned |
| Scanned media | Plant Operator | requirement |
| Malware data scanning |  | unassigned |
| Product security configuration |  | unassigned |
| Secure SLA | Information Security Manager | requirement |
| Responsibility clarification |  | unassigned |
| Router misuse prevention |  | unassigned |
| Communication device backdoors |  | unassigned |
| Backup media | ICT Partner | requirement |
| Backup testing | ICT Partner | requirement |
| Backup storage | ICT Partner | requirement |
| Backup hardware | ICT Partner | requirement |
| Backup transmission | ICT Partner | requirement |
| Backup logs | ICT Partner | requirement |
| Application program backup |  | unassigned |
| Remote connection audit | ICT Partner | requirement |
| Build data | ICT Partner | requirement |
| Acceptable Use Policy |  | unassigned |
| ICT awareness |  | unassigned |
| Key ICT security |  | unassigned |
| Fire suppression | Facilities Management | requirement |
| Fire detection | Facilities Management | requirement |
| Environmental controls | Facilities Management | requirement |
| Locked cabinets | Facilities Management | requirement |
| Locked doors | Facilities Management | requirement |
| Computer Rooms | Facilities Management | requirement |
| Power provision | Facilities Management | requirement |
| Industrialised secure cabinets | Information Security Manager | requirement |
| Business activity asset |  | unassigned |
| Pay number sharing |  | unassigned |

## Agents

| Agent | Kind | Responsible for |
| --- | --- | --- |
| Plant Operator | Agent | Scanned media, Password storage, Password mixed characters |
| Information Security Manager | Agent | Least privilege connections, Firewall rule attributes, Access revocation, Remote access inventory, Intrusion Prevention System, TMS access control, EnterpriseSCADA access control, Secure SLA, Patch Risk Management, Industrialised secure cabinets |
| Vendor | Agent |  |
| Cracker | Agent |  |
| ICT Partner | Agent | Build data, Router maintenance, Router Installation, Remote connection audit, ACME Change Control, Log file overwrite, Log file size, Password expiration, Password length, Id level access control, User Id Least privilege, Backup media, Backup testing, Backup hardware, Backup transmission, Backup logs, Backup storage, Active Directory software deployment, Control testing |
| Instrument Technician | Agent | Internet access, Versioned PLC changes |
| Petty Criminal | Agent |  |
| Integrator | Agent |  |
| Facilities Management | Agent | Fire suppression, Fire detection, Environmental controls, Locked cabinets, Locked doors, Computer Rooms, Power provision |
| Machine | Agent |  |

## Conflicts

None.

## Obstacles

| Obstacle | Category | Obstructs | Resolved by | Resolution |
| --- | --- | --- | --- | --- |
| Ubiquitous identity data |  | Credentials non-disclosure |  |  |
| Exposed ICT cabinets |  | ICT awareness, Key ICT security |  |  |
| Surplus equipment |  | ICT awareness |  |  |
| Accessible equipment |  |  |  |  |
| Unsanitised equipment |  |  |  |  |
| Unused PC application |  | Business activity asset |  |  |
| Malware application |  |  |  |  |
| Malicious remote installation |  |  |  |  |
| Desktop installation |  | Authorised removable media |  |  |
| DLL preloading |  |  |  |  |
| Redundant application |  |  |  |  |
| Zero-day threat exploit |  | Malware data scanning |  |  |
| Unscanned media |  | Scanned media |  |  |
| Scanning software disabled |  |  |  |  |
| Scanning software not installed |  |  |  |  |
| Software incompatibility |  |  |  |  |
| Vendor passwords unchanged |  | Vendor passwords |  |  |
| Undetected malicious traffic |  | Malicious traffic alert |  |  |
| Crafted packets |  |  |  |  |
| Incomplete firewall rule-set |  |  |  |  |
| Unavailable software repository |  | Active Directory software deployment |  |  |
