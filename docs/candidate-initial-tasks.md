# Candidate initial tasks

ACI: ACI-TAIG-COMMAND-PORTAL-001
Source: `cisco_command_results/Results/Cisco_Command_Dataset.json` dataset 0.1.0
This report does not select a workflow at runtime and does not implement task resolution.

## How candidates were judged

A task is structurally traversable when it has a workflow, every phase command resolves, required syntax elements are bound in the workflow steps, cited sources resolve, and the task category has a coverage row. All 12 `seed_partial` tasks meet that bar. The loader accepts the whole package.

That structural bar is not the same as platform completeness. Every populated feature group is `seed_partial`. `completeness_claim` is false. `lab_validation` is false. Thirty-six other tasks are `command_only`: they have command records and aliases, and `workflow_ids` is empty. They are not candidates for a first procedure slice.

Coverage `command_ids` are commands whose `task_category_id` is the feature group. Workflow steps also use commands from other categories. A later resolver has to follow `phases`, not the coverage command list alone.

## Traversable tasks

| Task | Workflow | Category status | Configuration steps | Software on steps | Source release labels | Rollback |
| --- | --- | --- | ---: | --- | --- | --- |
| `task-locate-mac` | `locate-mac` | `mac` seed_partial | 0 | Cisco IOS XE only | IOS XE 17.15.x only | `none_read_only` |
| `task-interface-drops` | `interface-drops` | `tr-interface` seed_partial | 0 | Cisco IOS XE only | IOS XE 17.15.x only | `none_read_only` |
| `task-lacp-check` | `lacp-check` | `etherchannel` seed_partial | 0 | Cisco IOS XE only | IOS XE 17.15.x only | `none_read_only` |
| `task-add-trunk-vlan` | `add-trunk-vlan` | `trunk` seed_partial | 4 | Cisco IOS XE only | IOS XE 17.15.x only | `remove_only_new_addition` |
| `task-access-vlan20` | `access-vlan20` | `vlan` seed_partial | 7 | Cisco IOS XE only | IOS XE 17.15.x only | `restore_prior_values` |
| `task-save-backup` | `save-backup` | `config` seed_partial | 2 | Cisco IOS XE only | IOS XE 17.15.x only | `not_generic_restore` |
| `task-extended-acl` | `extended-acl` | `acl` seed_partial | 8 | IOS XE plus one IOS/IOS XE command | 17.15.x plus one multi-release source | `restore_binding_and_entries` |
| `task-ospf-adjacency` | `ospf-adjacency` | `ospf` seed_partial | 0 | IOS XE plus one IOS/IOS XE command | 17.15.x, 17.x, multi-release, and legacy-example labels | `none_read_only` |
| `task-ospf-link` | `ospf-link` | `ospf` seed_partial | 6 | IOS XE plus IOS/IOS XE | 17.15.x, 17.x, and an unvalidated multi-release source | `restore_prior_values` |
| `task-bgp-status` | `bgp-status` | `bgp-feature` seed_partial | 0 | IOS XE plus IOS/IOS XE | 17.15.x, 17.x, and an unvalidated multi-release source | `none_read_only` |
| `task-ssh-only` | `ssh-only` | `ssh` seed_partial | 9 | IOS XE plus one IOS/IOS XE command | 17.15.x, an unpinned guide, and a multi-release VTY source | `restore_captured_management_policy` |
| `task-dhcp-server` | `dhcp-server` | `dhcp` seed_partial | 7 | 10 Cisco IOS and 4 Cisco IOS XE steps | IOS XE 17.15.x and IOS 12.4 | `restore_prior_pool_state` |

Platform and release labels above come from the command records used in each workflow and from the sources cited by that workflow. All twelve workflow `platform_boundary` strings also tell the reader to evaluate step-level source boundaries, except where the workflow text itself already says the evidence is legacy, composite, or unpinned.

## Recommended bounded set

Use these four tasks as the first vertical-slice input to ACI-002:

1. `task-locate-mac`
2. `task-interface-drops`
3. `task-lacp-check`
4. `task-add-trunk-vlan`

The first three are read-only. Their configuration phases are empty, rollback is `none_read_only`, every step command is `Cisco IOS XE`, and every workflow source is Catalyst 9300 / IOS XE 17.15.x. Each has a verification phase, source ids, and a `seed_partial` coverage row.

`task-add-trunk-vlan` is the one configuration candidate in the set. Its steps and sources stay on that same 9300 / 17.15.x boundary, and its rollback strategy is `remove_only_new_addition` rather than a full prior-state restore. `task-access-vlan20` is the same class of evidence, with a longer configuration phase and `restore_prior_values`. It can follow the trunk task. It is not required to open the slice.

## Not in the first slice

- `task-dhcp-server` mixes IOS 12.4 DHCP records with IOS XE inspection commands. The research report says those legacy records must not be returned as confirmed IOS XE 17.15 syntax.
- `task-ssh-only` cites Catalyst 9300 SSH material together with Cisco 8300 material and an unpinned VTY guide. The workflow text calls the target integration untested. The recorded VTY example is lines 0–4.
- `task-ospf-link`, `task-ospf-adjacency`, and `task-bgp-status` include IOS XE 17.x or multi-release sources whose hardware or release is explicitly unvalidated. BGP is further limited to the base IPv4 form encoded in the workflow boundary.
- `task-extended-acl` includes one multi-release source.
- `task-save-backup` writes the filesystem and startup configuration. Rollback is `not_generic_restore`, and the workflow cites a single source.
- The 36 `command_only` tasks have no workflow. Alias text on those tasks is not a procedure.

No candidate is lab-validated. ACI-002 should keep `seed_partial`, source boundaries, and `documentation_reviewed_not_device_tested` visible on any task it resolves.
