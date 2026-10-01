# Cisco Command Knowledge Research Report

ACI: ACI-TAIG2K-CISCO-COMMAND-KNOWLEDGE-RESEARCH-001  
Research date: 2026-10-01  
Status: **PARTIAL — usable research foundation; broad command coverage remains open.**

## Findings

The useful unit is a task with a platform boundary, ordered CLI contexts, evidence to check, and recovery intent. A spelling-only command list cannot safely answer an engineer's question. This package contains **100 bounded command templates, 12 task workflows, 26 populated command families, 55 proposed feature/task groups, and 29 Cisco source entries**. Counts include variants and context commands; they are not counts of unique Cisco command roots. Taxonomy breadth is design coverage, not evidence of populated feature coverage.

The main evidence boundary is **Catalyst 9300, IOS XE 17.15.x**. Routing guides labeled 17.x, multi-release IOS references, and IOS 12.4 DHCP are separately labeled at record level. The primary release is a reproducible starting point, not a newest-release claim: Cisco's catalog also lists later releases, including 26.x.x (S24–S25). No NX-OS, ASA or IOS XR syntax is included.

## Source strategy and landscape

Cisco command references establish syntax and modes; configuration guides establish dependencies and sequences; troubleshooting documents explain observations. Every command has a source ID and relevant section label. Source URLs, release labels and review limits are in Cisco_Source_Index.json. Only selected sections were inspected, and no complete Cisco book was copied into this package. Descriptions are original summaries; CLI syntax is factual notation. No unofficial cheat sheet establishes command truth.

The 9300 reference separates CLI, Layer 2/3, routing, VLAN, security, hardware, system management and specialized features. The proposed navigation translates these into engineering jobs: operate a device; connect ports; address and forward packets; establish IGP/BGP routing; provide services; control access; observe traffic; control congestion; operate advanced features; diagnose symptoms. Discovery also surfaced useful groups beyond the ACI list: VRFs, IS-IS, DHCP snooping/DAI/IP source guard, storm control, NetFlow, MPLS, MACsec/TrustSec, SD-Access/LISP/VXLAN, PoE/optics and redundancy. These groups remain explicit backlog unless command records exist.

## Task relationships

Access-port, trunk, MAC lookup, interface-drop, OSPF setup/diagnosis, BGP verification, ACL, SSH, legacy DHCP, save/backup and LACP inspection chains are populated. Workflows link parameterized command IDs by phase. Configuration and verification commands are separate; tasks can reuse one record without duplicating facts. Relationships link each task to commands used during pre-check, configuration, verification and troubleshooting.

Examples use illustrative interfaces and documentation addresses. Authentication secrets remain placeholders. CLI entry steps and modes are explicit. Tasks state prior conditions, expected observations and original recovery advice. Workflows are research syntheses, not Cisco-certified designs or tested production procedures.

## Platform and version issues

- Switchport conversion can remove settings and interrupt the link (S02). Preserve prior interface state before using switchport/no switchport.
- Allowed-VLAN assignment replaces a trunk list; the add variant serves a different intent (S02–S03).
- OSPF process IDs are local. Interface-specific activation is recommended in the router guide; router-ID change behavior differs beginning with 17.13.1a (S10).
- A 2-WAY OSPF state can be normal between DROTHERs. EXSTART/EXCHANGE warrants MTU/DBD investigation but is not uniquely an MTU diagnosis (S22–S23).
- BGP IPv4 commands do not establish coverage of VPNv4, IPv6, EVPN, VRFs or policy interactions (S05, S11–S12).
- SSH algorithm/key requirements vary by release. Old documentation examples containing weak key sizes are not recommended. VTY example 0–4 does not prove the full device line range (S16–S18).
- DHCP records backed only by IOS 12.4 must not be returned as confirmed IOS XE 17.15 syntax (S19).

Some official documentation is internally uneven. The multi-release terminal reference has confusing transport-default/upgrade prose; do not derive a universal default from it. The STP MST reference contains a mode statement that needs separate guide validation. Neither ambiguity is silently normalized into a supported executable recommendation.

## Data model recommendation

Use JSON with immutable IDs and separate command, task, workflow, source and platform entities. Keep task aliases at both task and command level. Important additions to the requested schema are syntax_scope, source_evidence, support_status, deprecated_status, validation_status, last_reviewed, example_type, operational effect, per-step parameter bindings, decision branches, and rollback strategy. Unknown values are null or marked not_established; they are not invented defaults.

The supplied JSON Schema validates the current command contract. Referential integrity needs a second ingestion check: all source/category/task/command IDs must resolve. A later schema should constrain workflow parameters, mode transitions, release applicability and source-field evidence more deeply. The current schema is a foundation, not a universal Cisco grammar.

## Search preparation and maintenance

First determine task and target platform/release/feature context, then retrieve a workflow and its linked records. Match aliases such as “which interfaces are up,” “put a PC in VLAN 20” or “OSPF stuck in EXSTART.” Retrieve exact evidence and show ambiguity when target context is missing. Embeddings can find candidates; they must not manufacture unsupported syntax or remove the platform filter.

Maintain separate schema and dataset versions. Pin source book/release boundaries, retain command histories, record retrieval/review dates and source changes, and preserve superseded records with replacement IDs. Recheck affected records when Cisco publishes release notes, feature changes or documentation updates. Add nonproduction lab results only with platform, image, feature and test context. Never call a feature complete before reconciliation against a defined reference inventory and resolution of deferred entries.

## Gaps and next action

No full command-reference inventory/denominator was established; a percentage of all Cisco commands would be misleading. Most network services, IPv6, EIGRP, AAA server configuration, QoS, multicast, tunnels/VPN, automation, image/licensing and platform troubleshooting remain unpopulated. Source-level syntax depth is also partial: task forms omit many optional arguments.

**Next partition:** complete Core CLI and Layer 2 for the selected 9300/17.15.x boundary, including context commands, interface settings, PortFast, root selection/MST, LACP/PAgP/static channels and protections. Build a reconciled heading inventory, resolve source ambiguities, and validate workflows in a matching nonproduction lab. Then expand Layer 3/IP and current IOS XE services without relabeling legacy records.

The future application has not been built or declared ready. No Cisco device was accessed or configured.
