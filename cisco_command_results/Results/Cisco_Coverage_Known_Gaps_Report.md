# Coverage & Known Gaps

ACI: ACI-TAIG2K-CISCO-COMMAND-KNOWLEDGE-RESEARCH-001

Status: PARTIAL. 100 command templates; 12 workflows. No complete-reference denominator or coverage percentage.

| Task/feature group | Commands | Workflows | Status |
|---|---:|---:|---|
| Device identity, banners and time | 1 | 0 | seed_partial |
| CLI modes, help, history and filters | 6 | 0 | seed_partial |
| Save, back up and restore configuration | 6 | 1 | seed_partial |
| Software and image management | 0 | 0 | backlog |
| Platform, license and feature identification | 1 | 0 | seed_partial |
| VLANs and access ports | 6 | 1 | seed_partial |
| Trunks and DTP | 6 | 1 | seed_partial |
| Locate endpoints and MAC learning | 3 | 1 | seed_partial |
| STP, Rapid PVST and MST | 5 | 0 | seed_partial |
| LACP, PAgP and static EtherChannel | 6 | 1 | seed_partial |
| Port security | 3 | 0 | seed_partial |
| DHCP snooping, DAI, IP source guard and storm control | 0 | 0 | backlog |
| Physical ports, routed ports, SVIs, subinterfaces and loopbacks | 7 | 0 | seed_partial |
| IPv4, ARP and reachability | 1 | 0 | seed_partial |
| IPv6, ND and reachability | 0 | 0 | backlog |
| Static and default routes | 1 | 0 | seed_partial |
| Routing table, CEF and forwarding adjacency | 1 | 0 | seed_partial |
| VRFs and routing context | 1 | 0 | seed_partial |
| HSRP, VRRP and GLBP | 0 | 0 | backlog |
| OSPFv2 and OSPFv3 | 10 | 2 | seed_partial |
| EIGRP classic and named modes | 0 | 0 | backlog |
| IS-IS | 0 | 0 | backlog |
| RIP and legacy migration | 0 | 0 | backlog |
| BGP neighbors, address families and route policy | 6 | 1 | seed_partial |
| DHCP server, relay, client and lease diagnosis | 8 | 1 | seed_partial |
| DNS client and hostname resolution | 0 | 0 | backlog |
| NTP and time synchronization | 0 | 0 | backlog |
| NAT and PAT | 1 | 0 | seed_partial |
| Standard, extended, named and IPv6 ACLs | 6 | 1 | seed_partial |
| SSH and remote management | 7 | 1 | seed_partial |
| Local AAA, RADIUS and TACACS+ | 2 | 0 | seed_partial |
| Device and service hardening | 1 | 0 | seed_partial |
| Control-plane and management-plane protection | 0 | 0 | backlog |
| IOS IPsec, IKE and VPN dependencies | 0 | 0 | backlog |
| MACsec, TrustSec and identity services | 0 | 0 | backlog |
| SNMP | 0 | 0 | backlog |
| Syslog and logging | 0 | 0 | backlog |
| CDP and LLDP | 0 | 0 | backlog |
| SPAN, RSPAN, ERSPAN and packet capture | 0 | 0 | backlog |
| IP SLA and object tracking | 0 | 0 | backlog |
| NetFlow and flow telemetry | 0 | 0 | backlog |
| Classification, marking, policing, shaping and queuing | 0 | 0 | backlog |
| IGMP, PIM and multicast routing | 0 | 0 | backlog |
| GRE, tunnels and encapsulation | 0 | 0 | backlog |
| MPLS and VPN routing | 0 | 0 | backlog |
| Stacking, redundancy and high availability | 3 | 0 | seed_partial |
| NETCONF, RESTCONF, YANG, gNMI and EEM | 0 | 0 | backlog |
| SD-Access, VXLAN and LISP | 0 | 0 | backlog |
| PoE, optics and hardware resources | 0 | 0 | backlog |
| Interface errors, drops and MTU | 2 | 1 | seed_partial |
| Switching loops, VLAN and trunk failures | 0 | 0 | backlog |
| Routing and neighbor failures | 0 | 0 | backlog |
| End-to-end connectivity and path failures | 0 | 0 | backlog |
| CPU, memory, queues and throughput | 0 | 0 | backlog |
| Boot, crash, hardware and system failures | 0 | 0 | backlog |

## Important limitations

- Most optional syntax, hardware/license support, no/default behavior, and release histories require deeper record-level review.
- Documentation evidence does not equal parser/lab validation.
- No complete configuration chains for EIGRP, IPv6, FHRP, NAT, AAA servers, NTP, SNMP, syslog, SPAN, QoS, multicast, GRE, IPsec, automation or image upgrades.
- Limited NAT and management-service inspection records do not establish full configuration support.
- SSH is a composite preparation workflow; local authentication and full VTY ranges need target-specific qualification.
- Legacy DHCP has IOS 12.4 evidence only. Current XE DHCP server/relay/client coverage is a separate partition.
- Structured rollback is prior-state dependent; no/default is not an undo engine. Exact configure-replace behavior remains deferred.
- Cross-feature classifications are many-to-many: a counter command can serve interfaces and troubleshooting. Primary category alone is not the retrieval graph.
- “All commands” would require per-platform, per-release, per-feature inventories, including deferred and deprecated entries.

## Recommended next partition

Core CLI / Device Operations → Layer 2, pinned to Catalyst 9300 IOS XE 17.15.x. Acceptance: reconcile command headings, verify supported argument/no forms, resolve mode/default ambiguities, and add matching-image nonproduction lab evidence. Follow with Layer 3/IP, IGP, BGP, services, security, monitoring, QoS, advanced features and troubleshooting.
