import { describe, expect, it } from "vitest";
import { loadKnowledgePackage } from "../lib/knowledge";
import { discoverTaskInputContract, validateTaskInputs } from "../lib/inputs";
import { buildTaskCatalog, resolveTask, type CatalogTask } from "../lib/tasks";
import { resolveWorkflow, verificationSteps, type WorkflowResolution } from "../lib/workflows";

async function loadedTask(taskId: string): Promise<{
  knowledge: Awaited<ReturnType<typeof loadKnowledgePackage>> & { ok: true };
  task: CatalogTask;
  discovery: ReturnType<typeof discoverTaskInputContract>;
}> {
  const knowledge = await loadKnowledgePackage();
  expect(knowledge.ok).toBe(true);
  if (!knowledge.ok) {
    throw new Error("knowledge did not load");
  }
  const catalog = buildTaskCatalog(knowledge.knowledge);
  expect(catalog.ok).toBe(true);
  if (!catalog.ok) {
    throw new Error("catalog did not build");
  }
  const resolved = resolveTask(catalog.catalog, taskId);
  expect(resolved.state).toBe("RESOLVED");
  if (resolved.state !== "RESOLVED") {
    throw new Error("task did not resolve");
  }
  return { knowledge, task: resolved.task, discovery: discoverTaskInputContract(knowledge.knowledge, resolved.task) };
}

function resolveReady(
  loaded: Awaited<ReturnType<typeof loadedTask>>,
  values?: Record<string, string | number>,
  task: CatalogTask = loaded.task,
): WorkflowResolution {
  const supplied =
    values ??
    (loaded.discovery.ok
      ? Object.fromEntries(
          loaded.discovery.contract.inputs.filter((input) => input.requirement === "required").map((input) => [input.inputKey, input.exampleValue]),
        )
      : {});
  const validation = validateTaskInputs(loaded.discovery, supplied);
  return resolveWorkflow(loaded.knowledge.knowledge, task, loaded.discovery, validation);
}

function commandIds(resolution: WorkflowResolution): string[] {
  if (resolution.state !== "RESOLVED") {
    return [];
  }
  return resolution.workflows[0].phases.flatMap((phase) => phase.steps.map((step) => step.commandId));
}

function assertUnresolvedTemplates(value: unknown): void {
  if (Array.isArray(value)) {
    value.forEach(assertUnresolvedTemplates);
    return;
  }
  if (!value || typeof value !== "object") {
    return;
  }
  expect(value).not.toHaveProperty("syntax");
  expect(value).not.toHaveProperty("example");
  expect(value).not.toHaveProperty("renderedCommand");
  for (const child of Object.values(value)) {
    assertUnresolvedTemplates(child);
  }
}

describe("proof workflow resolution", () => {
  it("resolves the four workflow-backed tasks in phase and step order", async () => {
    const expected = {
      "task-locate-mac": {
        workflowId: "locate-mac",
        activity: "read_only",
        rollback: "none_read_only",
        commands: ["version", "mac-address", "mac-interface", "show-status", "mac-vlan", "show-trunk", "stp-show"],
        sources: ["S02", "S04", "S07"],
        counts: [1, 0, 3, 3],
      },
      "task-interface-drops": {
        workflowId: "interface-drops",
        activity: "read_only",
        rollback: "none_read_only",
        commands: ["version", "run", "show-if", "show-errors", "show-status", "show-ip-if", "show-switchport"],
        sources: ["S04", "S07", "S08"],
        counts: [2, 0, 2, 3],
      },
      "task-lacp-check": {
        workflowId: "lacp-check",
        activity: "read_only",
        rollback: "none_read_only",
        commands: ["run", "ether-summary", "ether-detail", "lacp-neighbor", "show-trunk", "stp-show", "show-status"],
        sources: ["S02", "S04", "S08", "S28"],
        counts: [1, 0, 3, 3],
      },
      "task-add-trunk-vlan": {
        workflowId: "add-trunk-vlan",
        activity: "configuration_changing",
        rollback: "remove_only_new_addition",
        commands: ["run", "show-trunk", "show-vlan", "conf", "interface", "trunk-add", "end", "show-trunk", "show-switchport", "stp-show", "mac-vlan"],
        sources: ["S01", "S02", "S03", "S04", "S07", "S08", "S09"],
        counts: [3, 4, 2, 2],
      },
    } as const;

    for (const [taskId, spec] of Object.entries(expected)) {
      const loaded = await loadedTask(taskId);
      const examples = loaded.discovery.ok
        ? Object.fromEntries(loaded.discovery.contract.inputs.filter((input) => input.requirement === "required").map((input) => [input.inputKey, input.exampleValue]))
        : {};
      const resolution = resolveReady(loaded, { ...examples, unused: "UNIQUE-ENGINEER-VALUE" });
      expect(resolution.state).toBe("RESOLVED");
      if (resolution.state !== "RESOLVED") {
        continue;
      }
      expect(resolution.activityEvidence).toBe(spec.activity);
      expect(resolution.workflows).toHaveLength(1);
      const workflow = resolution.workflows[0];
      expect(workflow.workflowId).toBe(spec.workflowId);
      expect(workflow.platformBoundary).toBe("Catalyst 9300 / IOS XE 17.15.x; evaluate each step source boundary");
      expect(workflow.rollbackStrategy).toBe(spec.rollback);
      expect(workflow.phases.map((phase) => phase.phase)).toEqual(["pre_check", "configuration", "verification", "troubleshooting"]);
      expect(workflow.phases.map((phase) => phase.steps.length)).toEqual([...spec.counts]);
      expect(commandIds(resolution)).toEqual([...spec.commands]);
      expect(workflow.sourceIds).toEqual([...spec.sources]);
      expect(workflow.sources.map((source) => source.sourceId)).toEqual([...spec.sources]);
      expect(resolution.support.taskCoverageStatus).toBe("seed_partial");
      expect(resolution.support.coverageRowStatus).toBe(resolution.support.categoryCoverageStatus);
      expect(resolution.support.completenessClaim).toBe(false);
      expect(resolution.support.labValidation).toBe(false);
      expect(resolution.support.primaryBoundary).toEqual({ platform: "Catalyst 9300", software: "IOS XE", release: "17.15.x" });
      expect(resolution.support.knownGaps.length).toBeGreaterThan(0);
      expect(resolution.deviceExecutionAuthorized).toBe(false);
      expect(resolution.commandsRendered).toBe(false);
      expect(resolution.procedureGenerated).toBe(false);
      expect(verificationSteps(workflow).every((step) => step.phase === "verification")).toBe(true);
      expect(verificationSteps(workflow)).toHaveLength(spec.counts[2]);
      assertUnresolvedTemplates(resolution);
      expect(JSON.stringify(resolution)).not.toContain("UNIQUE-ENGINEER-VALUE");
    }
  });

  it("preserves engineer input keys without substituting engineer values", async () => {
    const resolution = resolveReady(await loadedTask("task-locate-mac"), {
      mac: "UNIQUE-ENGINEER-VALUE",
      interface: "GigabitEthernet9/9/9",
      vlan_id: 99999,
    });
    expect(resolution.state).toBe("RESOLVED");
    if (resolution.state !== "RESOLVED") {
      return;
    }
    const bindings = resolution.workflows[0].phases.flatMap((phase) => phase.steps.flatMap((step) => step.bindings));
    expect(bindings).toEqual([
      { parameterName: "mac", syntaxElementName: "mac", engineerInputKey: "mac", researchValue: "0011.2233.4455" },
      { parameterName: "interface", syntaxElementName: "interface", engineerInputKey: "interface", researchValue: "GigabitEthernet1/0/10" },
      { parameterName: "vlan_id", syntaxElementName: "vlan_id", engineerInputKey: "vlan_id", researchValue: 20 },
    ]);
    expect(JSON.stringify(resolution)).not.toContain("UNIQUE-ENGINEER-VALUE");
    expect(JSON.stringify(resolution)).not.toContain("GigabitEthernet9/9/9");
    const verification = verificationSteps(resolution.workflows[0]).map((step) => step.commandId);
    expect(verification).toEqual(["mac-address", "mac-interface", "show-status"]);
  });

  it("keeps one interface binding identity across interface-drops steps", async () => {
    const resolution = resolveReady(await loadedTask("task-interface-drops"));
    expect(resolution.state).toBe("RESOLVED");
    if (resolution.state !== "RESOLVED") {
      return;
    }
    const interfaceSteps = resolution.workflows[0].phases
      .flatMap((phase) => phase.steps)
      .filter((step) => step.bindings.some((binding) => binding.parameterName === "interface"));
    expect(interfaceSteps.map((step) => step.commandId)).toEqual(["show-if", "show-errors", "show-ip-if", "show-switchport"]);
    expect(interfaceSteps.every((step) => step.bindings[0].engineerInputKey === "interface")).toBe(true);
  });

  it("does not follow alphabetical or coverage order for configuration steps", async () => {
    const resolution = resolveReady(await loadedTask("task-add-trunk-vlan"));
    expect(resolution.state).toBe("RESOLVED");
    if (resolution.state !== "RESOLVED") {
      return;
    }
    const configuration = resolution.workflows[0].phases.find((phase) => phase.phase === "configuration");
    expect(configuration?.steps.map((step) => step.commandId)).toEqual(["conf", "interface", "trunk-add", "end"]);
    const trunkBindings = resolution.workflows[0].phases.flatMap((phase) => phase.steps.flatMap((step) => step.bindings));
    expect(trunkBindings.map((binding) => binding.engineerInputKey)).toEqual(["interface", "vlan_list", "interface", "vlan_id"]);
  });

  it("preserves a legacy workflow boundary instead of replacing it with the primary release", async () => {
    const resolution = resolveReady(await loadedTask("task-dhcp-server"));
    expect(resolution.state).toBe("RESOLVED");
    if (resolution.state !== "RESOLVED") {
      return;
    }
    expect(resolution.workflows[0].platformBoundary).toContain("IOS 12.4");
    expect(resolution.support.primaryBoundary.release).toBe("17.15.x");
    expect(resolution.workflows[0].platformBoundary).not.toBe("Catalyst 9300 / IOS XE 17.15.x");
  });
});

describe("workflow resolution failure fixtures", () => {
  it("does not build a workflow for a command-only task", async () => {
    const loaded = await loadKnowledgePackage();
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) {
      return;
    }
    const catalog = buildTaskCatalog(loaded.knowledge);
    expect(catalog.ok).toBe(true);
    if (!catalog.ok) {
      return;
    }
    const resolved = resolveTask(catalog.catalog, "task-command-reload");
    expect(resolved.state).toBe("RESOLVED");
    if (resolved.state !== "RESOLVED") {
      return;
    }
    const discovery = discoverTaskInputContract(loaded.knowledge, resolved.task);
    const validation = validateTaskInputs(discovery, {});
    const resolution = resolveWorkflow(loaded.knowledge, resolved.task, discovery, validation);
    expect(resolution.state).toBe("WORKFLOW_NOT_ESTABLISHED");
    expect(resolution).not.toHaveProperty("workflows");
  });

  it("stops when required inputs are missing", async () => {
    const resolution = resolveReady(await loadedTask("task-lacp-check"), {});
    expect(resolution.state).toBe("UPSTREAM_NOT_READY");
    if (resolution.state !== "UPSTREAM_NOT_READY") {
      return;
    }
    expect(resolution.upstreamState).toBe("NEEDS_INPUT");
    expect(resolution).not.toHaveProperty("workflows");
  });

  it("returns DATA_ERROR for a missing workflow, command, source, phase, step, or binding", async () => {
    const missingWorkflow = await loadedTask("task-lacp-check");
    const brokenTask = {
      ...missingWorkflow.task,
      workflows: [{ ...missingWorkflow.task.workflows[0], workflowId: "missing-workflow" }],
    };
    const missing = resolveReady(missingWorkflow, undefined, brokenTask);
    expect(missing.state).toBe("DATA_ERROR");
    if (missing.state === "DATA_ERROR") {
      expect(missing.errors.some((error) => error.code === "MISSING_WORKFLOW")).toBe(true);
    }

    const missingCommand = await loadedTask("task-lacp-check");
    const workflow = missingCommand.knowledge.knowledge.indexes.workflowsById.get("lacp-check");
    expect(workflow).toBeDefined();
    if (!workflow) {
      return;
    }
    workflow.phases.verification[1].command_id = "missing-command";
    const missingCommandResolution = resolveReady(missingCommand);
    expect(missingCommandResolution.state).toBe("DATA_ERROR");
    if (missingCommandResolution.state === "DATA_ERROR") {
      expect(missingCommandResolution.errors.some((error) => error.code === "MISSING_COMMAND")).toBe(true);
    }

    const missingSource = await loadedTask("task-locate-mac");
    const located = missingSource.knowledge.knowledge.indexes.workflowsById.get("locate-mac");
    expect(located).toBeDefined();
    if (!located) {
      return;
    }
    located.source_ids.push("NO-SUCH-SOURCE");
    const missingSourceResolution = resolveReady(missingSource);
    expect(missingSourceResolution.state).toBe("DATA_ERROR");
    if (missingSourceResolution.state === "DATA_ERROR") {
      expect(missingSourceResolution.errors.some((error) => error.code === "MISSING_SOURCE")).toBe(true);
    }

    const malformedPhase = await loadedTask("task-interface-drops");
    const drops = malformedPhase.knowledge.knowledge.indexes.workflowsById.get("interface-drops");
    expect(drops).toBeDefined();
    if (!drops) {
      return;
    }
    drops.phases.verification = undefined as unknown as typeof drops.phases.verification;
    const malformedPhaseResolution = resolveReady(malformedPhase);
    expect(malformedPhaseResolution.state).toBe("DATA_ERROR");
    if (malformedPhaseResolution.state === "DATA_ERROR") {
      expect(malformedPhaseResolution.errors.some((error) => error.code === "MALFORMED_PHASE")).toBe(true);
    }

    const malformedStep = await loadedTask("task-interface-drops");
    const dropsAgain = malformedStep.knowledge.knowledge.indexes.workflowsById.get("interface-drops");
    expect(dropsAgain).toBeDefined();
    if (!dropsAgain) {
      return;
    }
    dropsAgain.phases.pre_check[0] = { note: null } as unknown as typeof dropsAgain.phases.pre_check[0];
    const malformedStepResolution = resolveReady(malformedStep);
    expect(malformedStepResolution.state).toBe("DATA_ERROR");
    if (malformedStepResolution.state === "DATA_ERROR") {
      expect(malformedStepResolution.errors.some((error) => error.code === "MALFORMED_STEP")).toBe(true);
    }

    const brokenBinding = await loadedTask("task-add-trunk-vlan");
    const trunk = brokenBinding.knowledge.knowledge.indexes.workflowsById.get("add-trunk-vlan");
    expect(trunk).toBeDefined();
    if (!trunk) {
      return;
    }
    trunk.phases.configuration[2].parameter_values.not_a_parameter = "20";
    const brokenBindingResolution = resolveReady(brokenBinding);
    expect(brokenBindingResolution.state).toBe("DATA_ERROR");
    if (brokenBindingResolution.state === "DATA_ERROR") {
      expect(brokenBindingResolution.errors.some((error) => error.code === "BROKEN_BINDING")).toBe(true);
    }
  });

  it("returns DATA_ERROR for a duplicate command id, a broken verification reference, and coverage drift", async () => {
    const duplicate = await loadedTask("task-lacp-check");
    const command = duplicate.knowledge.knowledge.indexes.commandsById.get("ether-detail");
    expect(command).toBeDefined();
    if (!command) {
      return;
    }
    duplicate.knowledge.knowledge.dataset.commands.push({ ...command, version_notes: "conflicting duplicate" });
    const duplicateResolution = resolveReady(duplicate);
    expect(duplicateResolution.state).toBe("DATA_ERROR");
    if (duplicateResolution.state === "DATA_ERROR") {
      expect(duplicateResolution.errors.some((error) => error.code === "DUPLICATE_COMMAND")).toBe(true);
    }

    const verification = await loadedTask("task-locate-mac");
    const mac = verification.knowledge.knowledge.indexes.commandsById.get("mac-address");
    expect(mac).toBeDefined();
    if (!mac) {
      return;
    }
    mac.verification_command_ids = ["missing-verification"];
    const verificationResolution = resolveReady(verification);
    expect(verificationResolution.state).toBe("DATA_ERROR");
    if (verificationResolution.state === "DATA_ERROR") {
      expect(verificationResolution.errors.some((error) => error.code === "UNRESOLVED_VERIFICATION")).toBe(true);
    }

    const coverage = await loadedTask("task-locate-mac");
    const row = coverage.knowledge.knowledge.indexes.coverageByCategoryId.get("mac");
    expect(row).toBeDefined();
    if (!row) {
      return;
    }
    row.status = "backlog";
    const coverageResolution = resolveReady(coverage);
    expect(coverageResolution.state).toBe("DATA_ERROR");
    if (coverageResolution.state === "DATA_ERROR") {
      expect(coverageResolution.errors.some((error) => error.code === "COVERAGE_INCONSISTENCY")).toBe(true);
    }
  });

  it("surfaces an excluded command platform as CONFLICT and does not merge boundaries", async () => {
    const loaded = await loadedTask("task-lacp-check");
    const command = loaded.knowledge.knowledge.indexes.commandsById.get("ether-detail");
    expect(command).toBeDefined();
    if (!command) {
      return;
    }
    command.software_family = "NX-OS";
    const conflict = resolveReady(loaded);
    expect(conflict.state).toBe("CONFLICT");
    if (conflict.state !== "CONFLICT") {
      return;
    }
    expect(conflict.conflicts[0].code).toBe("PLATFORM_CONFLICT");
    expect(conflict).not.toHaveProperty("workflows");
  });

  it("returns DATA_ERROR when relationship edges contradict the ordered steps", async () => {
    const loaded = await loadedTask("task-lacp-check");
    loaded.knowledge.knowledge.dataset.relationships.push({
      from_id: "task-lacp-check",
      to_id: "not-a-step",
      type: "uses_in_pre_check",
      workflow_id: "lacp-check",
    });
    const resolution = resolveReady(loaded);
    expect(resolution.state).toBe("DATA_ERROR");
    if (resolution.state === "DATA_ERROR") {
      expect(resolution.errors.some((error) => error.code === "RELATIONSHIP_MISMATCH")).toBe(true);
    }
  });
});
