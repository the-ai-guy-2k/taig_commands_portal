# Engineer UI shell and task discovery

ACI: ACI-TAIG-COMMAND-PORTAL-007
Depends on the accepted task catalog. The shell discovers and selects tasks. It does not collect engineer inputs, render commands, or show a procedure.

## UI architecture

The home page is a server component. It calls `loadTaskCatalog` and `discoveryPageModel`. A successful catalog becomes a plain `DiscoveryCatalog` with no resolver maps. `TaskDiscovery` is the client workspace. It filters and selects from that catalog. It does not import the knowledge loader, the task resolver, or Cisco JSON files.

`app/loading.tsx` is the LOADING state. A catalog or knowledge failure renders `DataError` with `DATA_ERROR` and no task cards.

## Catalog source

Task identity, title, aliases, category id, category label, workflow availability, coverage, activity evidence, platform boundary, and validation status are copied from the catalog service. The shell does not reclassify a task. Counts shown in the header are the catalog counts: 48 tasks, 12 workflow-backed, 36 command-only.

Category options are catalog categories whose `taskCount` is greater than zero, using the catalog label. Categories with no tasks are omitted from the filter because they cannot narrow the list. All 48 tasks remain available under All categories.

## Search behavior

Search is a display filter. After the same trim, whitespace collapse, and case fold used by task input normalization, a task stays visible when the text is contained in its task id, title, category label, or an alias. A category choice keeps only that `categoryId`.

The filter does not call `resolveTask`. It does not pick one winner when several tasks match. It does not create a task id from the typed text. The phrase `locate mac` is not an exact alias and does not reveal `task-locate-mac`.

## Selected-task state

Choosing a task button stores that catalog `taskId`. The selected panel is the handoff for Capability 8:

- task id
- title
- category id and label
- workflow availability
- coverage status
- activity evidence
- platform boundary, when a workflow has one
- validation status

Search and category changes do not replace the selected id.

## Support-state treatment

Workflow availability `present` is labeled Workflow-backed. `absent` is labeled Command-only. Coverage is shown as the catalog value. Workflow-backed proof tasks stay `seed_partial` and `documentation_reviewed_not_device_tested`. The shell says inputs and the procedure are not on this screen.

The header states that the knowledge base is partial, documentation-reviewed, and not device tested, and it shows the catalog completeness claim and lab validation flags. The primary research boundary and excluded software come from the package. A workflow platform boundary is shown only when the catalog task has one. That is not a claim that every task supports every Cisco platform.

## Command-only behavior

Selecting a command-only task sets `WORKFLOW_NOT_ESTABLISHED` and shows: "Command guidance only. Workflow not established. Procedure not available." The panel does not open an input form or a procedure.

## Data-error behavior

If `loadTaskCatalog` fails, the page shows the error code and message and stops. It does not substitute a hard-coded task list.

## States

- LOADING: route loading status
- READY: catalog visible and nothing selected
- NO_MATCHES: the current filter matches nothing
- SELECTED: a workflow-backed task is selected
- WORKFLOW_NOT_ESTABLISHED: a command-only task is selected
- DATA_ERROR: the catalog did not load

## ACI-008 boundary

This screen ends at the selected task. Capability 8 adds the dynamic task form and the procedure view. This shell does not render required-input fields, validation feedback, command blocks, or copy actions.
