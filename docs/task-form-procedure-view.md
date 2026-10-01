# Dynamic task form and procedure view

Capability 8 lets an engineer enter the required inputs for a selected workflow-backed task and read the procedure the existing backend produces. The UI does not invent fields, validation rules, or commands.

## Dynamic form architecture

`loadEngineerPortal` loads the knowledge package once, builds the task catalog, and builds a form catalog. `buildFormCatalog` calls `discoverTaskInputContract` only for tasks whose workflow availability is `present`. Each field is a projection of that contract: input key, description, required or optional, and a source-backed example used as help text. Examples are not written into the inputs.

Command-only tasks are omitted from the form catalog. Selecting one shows the accepted notice: workflow not established, procedure not available. The UI does not infer inputs from tagged commands.

If a contract field name is a credential name (`isCredentialName` from the renderer), the form is not shown. The state is `UNSUPPORTED_VALIDATION` with code `CREDENTIAL_INPUT`. No current workflow contract hits that path.

Inputs are `type="text"`. The form does not set `required`, `pattern`, `min`, or `max`, and it does not check MAC format, VLAN range, interface grammar, or cross-field Cisco meaning. Those rules are not established by the backend.

## Backend integration

The browser calls the server action `generateTaskProcedure(taskId, values)`. That action calls `runTaskProcedure`, which uses the accepted services in order:

1. Load knowledge and the catalog.
2. `getTaskById` for the stable task id.
3. `discoverTaskInputContract`.
4. `validateTaskInputs`.

If validation state is not `READY`, the action returns that state and a null procedure. It does not call workflow resolution, rendering, or procedure generation.

If validation state is `READY`, it continues through `resolveWorkflow`, `renderWorkflowCommands`, and `generateProcedure`. A `GENERATED` result is mapped to the procedure view. Any other result is a blocking state with a null procedure. A knowledge or catalog failure is `DATA_ERROR`. There is no example-output fallback.

## Validation handling

The status text keeps the backend state name:

- `NEEDS_INPUT` lists the missing keys.
- `INVALID_INPUT` shows the backend messages.
- `CONFLICT` shows the backend messages.
- `UNSUPPORTED_VALIDATION` says a procedure is not established for the task.
- `DATA_ERROR` says the procedure cannot be generated from the loaded knowledge.
- `READY` means the governed procedure can be generated. It does not authorize commands on a live device.

Missing required fields are also associated with those inputs. Generate stays available so an incomplete form can return `NEEDS_INPUT` from the backend. It is disabled only while a request is in flight.

## Generation flow

Session states include `FORM_READY`, `GENERATING`, the validation states above, `GENERATED`, `UPSTREAM_ERROR`, and `DATA_ERROR`.

Generate snapshots the current values and a generation id, shows "Generating the procedure from the catalog. This does not contact a device.", then applies the result only if that generation id is still current. A later keystroke or task change increments the id, so a late response is ignored.

## Procedure view structure

A generated procedure is shown below the workspace, in this order:

1. Notice: device execution is not authorized, `seed_partial` where present, completeness claim false, lab validation false, and `documentation_reviewed_not_device_tested`.
2. Task summary: title, task id, activity, workflow id.
3. Engineer inputs: accepted key and value.
4. Environment and support: platform boundary, coverage, package status, completeness, lab validation, validation status, excluded software.
5. Phases in backend order: pre-check, configuration, verification, troubleshooting.
6. Rollback and recovery: strategy and instruction text.
7. Warnings and cautions: source-backed metadata, or an explicit empty statement.
8. Sources.
9. Known gaps.

An empty configuration phase stays visible. For a read-only task the text is "No configuration commands. Configuration is not required." Troubleshooting is a separate section and says it is not the normal path. Rollback instructions stay text. The view does not add commands that the procedure does not contain.

Rendered commands are shown in code blocks. A Copy control copies that rendered text to the clipboard. It does not run the command.

## Stale-result behavior

Changing the selected task clears the input values and the generated procedure. Changing a relevant input clears the generated procedure and returns the session to `FORM_READY`. A failed generation also clears any previous procedure. The previous procedure is not left on screen as if it matched the new values.

## Command-only behavior

Command-only tasks remain in the catalog and remain selectable. Selection does not show the form or the Generate control. The panel states that workflow is not established and a procedure is not available.

## Security boundary

The form does not collect a device username, password, enable secret, SSH key, SNMP community, API token, or other production credential. `deviceExecutionAuthorized` stays false on every portal result and is shown on a generated procedure. There is no SSH, NETCONF, RESTCONF, or configuration push. Copying text does not send it anywhere except the local clipboard.

## ACI-009 handoff

ACI-009 is Failure / Coverage UX. This capability does not add a failure-coverage screen, a validated badge, or a change to `seed_partial`, completeness, or lab-validation truth. Those facts stay visible on the generated procedure and in the shell note.
