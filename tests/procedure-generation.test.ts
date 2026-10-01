import { describe, expect, it } from "vitest";
import { loadKnowledgePackage, type LoadedKnowledge } from "../lib/knowledge";
import { discoverTaskInputContract, validateTaskInputs, type InputDiscoveryResult, type TaskInputValidation } from "../lib/inputs";
import { renderWorkflowCommands, type RenderResult } from "../lib/rendering";
import { buildTaskCatalog, resolveTask, type CatalogTask } from "../lib/tasks";
import { resolveWorkflow, type WorkflowResolution } from "../lib/workflows";
import { generateProcedure, type ProcedureResult } from "../lib/procedures";

async function loadedTask(taskId: string): Promise<{
  knowledge: LoadedKnowledge;
  task: CatalogTask;
  discovery: InputDiscoveryResult;
}> {
  const loaded = await loadKnowledgePackage();
  expect(loaded.ok).toBe(true);
  if (!loaded.ok) {
    throw new Error("knowledge did not load");
  }
  const catalog = buildTaskCatalog(loaded.knowledge);
  expect(catalog.ok).toBe(true);
  if (!catalog.ok) {
    throw new Error("catalog did not build");
  }
  const resolved = resolveTask(catalog.catalog, taskId);
  expect(resolved.state).toBe("RESOLVED");
  if (resolved.state !== "RESOLVED") {
    throw new Error("task did not resolve");
  }
  return { knowledge: loaded.knowledge, task: resolved.task, discovery: discoverTaskInputContract(loaded.knowledge, resolved.task) };
}

function generated(
  loaded: Awaited<ReturnType<typeof loadedTask>>,
  values: Record<string, string | number>,
): {
  knowledge: LoadedKnowledge;
  task: CatalogTask;
  discovery: InputDiscoveryResult;
  workflow: WorkflowResolution;
  validation: TaskInputValidation;
  rendered: RenderResult;
  procedure: ProcedureResult;
} {
  const validation = validateTaskInputs(loaded.discovery, values);
  const workflow = resolveWorkflow(loaded.knowledge, loaded.task, loaded.discovery, validation);
  const rendered = renderWorkflowCommands(loaded.knowledge, workflow, validation);
  return {
    knowledge: loaded.knowledge,
    task: loaded.task,
    discovery: loaded.discovery,
    workflow,
    validation,
    rendered,
    procedure: generateProcedure(loaded.knowledge, loaded.task, loaded.discovery, validation, workflow, rendered),
  };
}

function sectionCommands(procedure: ProcedureResult, phase: "pre_check" | "configuration" | "verification" | "troubleshooting"): string[] {
  if (procedure.state !== "GENERATED") {
    return [];
  }
  return procedure.workflows[0].sections.find((section) => section.phase === phase)?.steps.map((step) => step.renderedCommand) ?? [];
}

describe("proof procedure generation", () => {
  it("assembles the four proof workflows without adding commands", async () => {
    const cases = [
      {
        taskId: "task-locate-mac",
        values: { mac: "aabb.ccdd.eeff", interface: "Gi1/0/24", vlan_id: 30 },
        activity: "read_only",
        rollback: "none_read_only",
        configuration: [] as string[],
        verification: [
          "show mac address-table address aabb.ccdd.eeff",
          "show mac address-table interface Gi1/0/24",
          "show interfaces status",
        ],
        troubleshooting: ["show mac address-table vlan 30", "show interfaces trunk", "show spanning-tree"],
      },
      {
        taskId: "task-interface-drops",
        values: { interface: "Gi1/0/24" },
        activity: "read_only",
        rollback: "none_read_only",
        configuration: [] as string[],
        verification: ["show interfaces Gi1/0/24", "show interfaces Gi1/0/24 counters errors"],
        troubleshooting: ["show interfaces status", "show ip interface Gi1/0/24", "show interfaces Gi1/0/24 switchport"],
      },
      {
        taskId: "task-lacp-check",
        values: { group: 5 },
        activity: "read_only",
        rollback: "none_read_only",
        configuration: [] as string[],
        verification: ["show etherchannel summary", "show etherchannel 5 detail", "show lacp neighbor"],
        troubleshooting: ["show interfaces trunk", "show spanning-tree", "show interfaces status"],
      },
      {
        taskId: "task-add-trunk-vlan",
        values: { interface: "Gi1/0/48", vlan_list: "30,40", vlan_id: 30 },
        activity: "configuration_changing",
        rollback: "remove_only_new_addition",
        configuration: ["configure terminal", "interface Gi1/0/48", "switchport trunk allowed vlan add 30,40", "end"],
        verification: ["show interfaces trunk", "show interfaces Gi1/0/48 switchport"],
        troubleshooting: ["show spanning-tree", "show mac address-table vlan 30"],
      },
    ] as const;

    for (const spec of cases) {
      const { procedure } = generated(await loadedTask(spec.taskId), { ...spec.values, extra: "NOT-A-COMMAND-VALUE" });
      expect(procedure.state).toBe("GENERATED");
      if (procedure.state !== "GENERATED") {
        continue;
      }
      expect(procedure.taskId).toBe(spec.taskId);
      expect(procedure.activityEvidence).toBe(spec.activity);
      expect(procedure.configurationRequired).toBe(spec.configuration.length > 0);
      expect(procedure.procedureGenerated).toBe(true);
      expect(procedure.deviceExecutionAuthorized).toBe(false);
      expect(procedure.workflows).toHaveLength(1);
      expect(procedure.workflows[0].sections.map((section) => section.phase)).toEqual([
        "pre_check",
        "configuration",
        "verification",
        "troubleshooting",
      ]);
      expect(sectionCommands(procedure, "configuration")).toEqual([...spec.configuration]);
      expect(sectionCommands(procedure, "verification")).toEqual([...spec.verification]);
      expect(sectionCommands(procedure, "troubleshooting")).toEqual([...spec.troubleshooting]);
      expect(procedure.workflows[0].rollback.strategy).toBe(spec.rollback);
      expect(procedure.support.taskCoverageStatus).toBe("seed_partial");
      expect(procedure.support.completenessClaim).toBe(false);
      expect(procedure.support.labValidation).toBe(false);
      expect(procedure.support.validationStatus).toBe("documentation_reviewed_not_device_tested");
      expect(procedure.support.knownGaps.length).toBeGreaterThan(0);
      expect(procedure.environment.primaryBoundary).toEqual({ platform: "Catalyst 9300", software: "IOS XE", release: "17.15.x" });
      expect(procedure.environment.workflowPlatformBoundaries[0]).toContain("Catalyst 9300 / IOS XE 17.15.x");
      const commands = procedure.workflows[0].sections.flatMap((section) => section.steps.map((step) => step.renderedCommand));
      expect(commands.join("\n")).not.toContain("NOT-A-COMMAND-VALUE");
      expect(commands.join("\n")).not.toContain("write memory");
      expect(commands.join("\n")).not.toContain("copy running-config");
      expect(commands.join("\n")).not.toContain("0011.2233.4455");
      expect(procedure.engineerInputs.map((input) => input.acceptedValue).join("\n")).not.toContain("0011.2233.4455");
      expect(procedure.workflows[0].sections.flatMap((section) => section.steps).every((step) => step.observationValidation === "not_established")).toBe(true);
      expect(procedure.workflows[0].sections.find((section) => section.phase === "troubleshooting")?.steps.every((step) => step.normalPath === false)).toBe(true);
      expect(procedure.workflows[0].sections.find((section) => section.phase === "verification")?.steps.every((step) => step.normalPath === true)).toBe(true);
    }
  });

  it("keeps rollback instructions as source text and does not add rollback commands", async () => {
    const { procedure } = generated(await loadedTask("task-add-trunk-vlan"), {
      interface: "Gi1/0/48",
      vlan_list: "30,40",
      vlan_id: 30,
    });
    expect(procedure.state).toBe("GENERATED");
    if (procedure.state !== "GENERATED") {
      return;
    }
    expect(procedure.workflows[0].rollback.instructions).toEqual([
      "Remove VLAN 20 from the allowed list only if absent before this change.",
      "Restore any separately changed native VLAN/mode from captured state.",
    ]);
    const commands = procedure.workflows[0].sections.flatMap((section) => section.steps.map((step) => step.renderedCommand));
    expect(commands).not.toContain("Remove VLAN 20 from the allowed list only if absent before this change.");
    expect(commands.some((command) => command.includes("vlan remove"))).toBe(false);
  });
});

describe("procedure generation failure fixtures", () => {
  it("does not generate a procedure when rendering is not complete", async () => {
    const loaded = await loadedTask("task-lacp-check");
    const validation = validateTaskInputs(loaded.discovery, {});
    const workflow = resolveWorkflow(loaded.knowledge, loaded.task, loaded.discovery, validation);
    const rendered = renderWorkflowCommands(loaded.knowledge, workflow, validation);
    const procedure = generateProcedure(loaded.knowledge, loaded.task, loaded.discovery, validation, workflow, rendered);
    expect(procedure.state).toBe("UPSTREAM_NOT_RENDERED");
    expect(procedure.procedureGenerated).toBe(false);
    expect(procedure).not.toHaveProperty("workflows");
  });

  it("does not generate a procedure for a command-only task", async () => {
    const loaded = await loadedTask("task-command-reload");
    const validation = validateTaskInputs(loaded.discovery, {});
    const workflow = resolveWorkflow(loaded.knowledge, loaded.task, loaded.discovery, validation);
    const rendered = renderWorkflowCommands(loaded.knowledge, workflow, validation);
    const procedure = generateProcedure(loaded.knowledge, loaded.task, loaded.discovery, validation, workflow, rendered);
    expect(procedure.state).toBe("UNSUPPORTED");
    if (procedure.state === "UNSUPPORTED") {
      expect(procedure.reason).toBe("procedure_not_established");
    }
    expect(procedure).not.toHaveProperty("workflows");
  });

  it("fails closed when rendered steps are missing, duplicated, or reordered", async () => {
    const missing = generated(await loadedTask("task-locate-mac"), { mac: "aabb.ccdd.eeff", interface: "Gi1/0/24", vlan_id: 30 });
    expect(missing.rendered.state).toBe("RENDERED");
    if (missing.rendered.state !== "RENDERED") {
      return;
    }
    const verification = missing.rendered.workflows[0].phases.find((phase) => phase.phase === "verification");
    expect(verification).toBeDefined();
    if (!verification) {
      return;
    }
    verification.commands = verification.commands.slice(0, 2);
    const missingProcedure = generateProcedure(missing.knowledge, missing.task, missing.discovery, missing.validation, missing.workflow, missing.rendered);
    expect(missingProcedure.state).toBe("INCOMPLETE_PROCEDURE");
    if (missingProcedure.state === "INCOMPLETE_PROCEDURE") {
      expect(missingProcedure.failures.some((item) => item.code === "MISSING_STEP")).toBe(true);
    }

    const duplicate = generated(await loadedTask("task-lacp-check"), { group: 5 });
    expect(duplicate.rendered.state).toBe("RENDERED");
    if (duplicate.rendered.state !== "RENDERED") {
      return;
    }
    const preCheck = duplicate.rendered.workflows[0].phases[0];
    preCheck.commands = [...preCheck.commands, preCheck.commands[0]];
    const duplicateProcedure = generateProcedure(duplicate.knowledge, duplicate.task, duplicate.discovery, duplicate.validation, duplicate.workflow, duplicate.rendered);
    expect(duplicateProcedure.state).toBe("INCOMPLETE_PROCEDURE");
    if (duplicateProcedure.state === "INCOMPLETE_PROCEDURE") {
      expect(duplicateProcedure.failures.some((item) => item.code === "DUPLICATE_STEP")).toBe(true);
    }

    const reordered = generated(await loadedTask("task-add-trunk-vlan"), { interface: "Gi1/0/48", vlan_list: "30,40", vlan_id: 30 });
    expect(reordered.rendered.state).toBe("RENDERED");
    if (reordered.rendered.state !== "RENDERED") {
      return;
    }
    const phases = [...reordered.rendered.workflows[0].phases];
    reordered.rendered.workflows[0].phases = [phases[1], phases[0], phases[2], phases[3]];
    const phaseProcedure = generateProcedure(reordered.knowledge, reordered.task, reordered.discovery, reordered.validation, reordered.workflow, reordered.rendered);
    expect(phaseProcedure.state).toBe("INCOMPLETE_PROCEDURE");
    if (phaseProcedure.state === "INCOMPLETE_PROCEDURE") {
      expect(phaseProcedure.failures.some((item) => item.code === "PHASE_ORDER")).toBe(true);
    }

    const stepOrder = generated(await loadedTask("task-add-trunk-vlan"), { interface: "Gi1/0/48", vlan_list: "30,40", vlan_id: 30 });
    expect(stepOrder.rendered.state).toBe("RENDERED");
    if (stepOrder.rendered.state !== "RENDERED") {
      return;
    }
    const configuration = stepOrder.rendered.workflows[0].phases.find((phase) => phase.phase === "configuration");
    expect(configuration).toBeDefined();
    if (!configuration) {
      return;
    }
    configuration.commands = [configuration.commands[1], configuration.commands[0], configuration.commands[2], configuration.commands[3]];
    const stepProcedure = generateProcedure(stepOrder.knowledge, stepOrder.task, stepOrder.discovery, stepOrder.validation, stepOrder.workflow, stepOrder.rendered);
    expect(stepProcedure.state).toBe("INCOMPLETE_PROCEDURE");
    if (stepProcedure.state === "INCOMPLETE_PROCEDURE") {
      expect(stepProcedure.failures.some((item) => item.code === "STEP_ORDER")).toBe(true);
    }
  });

  it("fails closed for a blank command, missing source, missing boundary, or malformed activity", async () => {
    const blank = generated(await loadedTask("task-lacp-check"), { group: 5 });
    expect(blank.rendered.state).toBe("RENDERED");
    if (blank.rendered.state !== "RENDERED") {
      return;
    }
    blank.rendered.workflows[0].phases[0].commands[0].renderedCommand = "";
    const blankProcedure = generateProcedure(blank.knowledge, blank.task, blank.discovery, blank.validation, blank.workflow, blank.rendered);
    expect(blankProcedure.state).toBe("INCOMPLETE_PROCEDURE");
    if (blankProcedure.state === "INCOMPLETE_PROCEDURE") {
      expect(blankProcedure.failures.some((item) => item.code === "MISSING_RENDERED_COMMAND")).toBe(true);
    }

    const source = generated(await loadedTask("task-locate-mac"), { mac: "aabb.ccdd.eeff", interface: "Gi1/0/24", vlan_id: 30 });
    expect(source.rendered.state).toBe("RENDERED");
    if (source.rendered.state !== "RENDERED" || source.workflow.state !== "RESOLVED") {
      return;
    }
    source.rendered.workflows[0].phases[0].commands[0].sourceIds = [];
    source.workflow.workflows[0].phases[0].steps[0].command.sources = [];
    const sourceProcedure = generateProcedure(source.knowledge, source.task, source.discovery, source.validation, source.workflow, source.rendered);
    expect(sourceProcedure.state).toBe("INCOMPLETE_PROCEDURE");
    if (sourceProcedure.state === "INCOMPLETE_PROCEDURE") {
      expect(sourceProcedure.failures.some((item) => item.code === "MISSING_SOURCE")).toBe(true);
    }

    const boundary = generated(await loadedTask("task-interface-drops"), { interface: "Gi1/0/24" });
    expect(boundary.rendered.state).toBe("RENDERED");
    if (boundary.rendered.state !== "RENDERED" || boundary.workflow.state !== "RESOLVED") {
      return;
    }
    boundary.workflow.workflows[0].platformBoundary = "";
    boundary.rendered.workflows[0].platformBoundary = "";
    const boundaryProcedure = generateProcedure(boundary.knowledge, boundary.task, boundary.discovery, boundary.validation, boundary.workflow, boundary.rendered);
    expect(boundaryProcedure.state).toBe("INCOMPLETE_PROCEDURE");
    if (boundaryProcedure.state === "INCOMPLETE_PROCEDURE") {
      expect(boundaryProcedure.failures.some((item) => item.code === "MISSING_PLATFORM")).toBe(true);
    }

    const rollback = generated(await loadedTask("task-lacp-check"), { group: 5 });
    expect(rollback.workflow.state).toBe("RESOLVED");
    if (rollback.workflow.state !== "RESOLVED") {
      return;
    }
    rollback.workflow.workflows[0].rollbackStrategy = "";
    const rollbackProcedure = generateProcedure(rollback.knowledge, rollback.task, rollback.discovery, rollback.validation, rollback.workflow, rollback.rendered);
    expect(rollbackProcedure.state).toBe("INCOMPLETE_PROCEDURE");
    if (rollbackProcedure.state === "INCOMPLETE_PROCEDURE") {
      expect(rollbackProcedure.failures.some((item) => item.code === "MISSING_ROLLBACK")).toBe(true);
    }

    const activity = generated(await loadedTask("task-locate-mac"), { mac: "aabb.ccdd.eeff", interface: "Gi1/0/24", vlan_id: 30 });
    expect(activity.rendered.state).toBe("RENDERED");
    if (activity.rendered.state !== "RENDERED") {
      return;
    }
    activity.rendered.activityEvidence = "invented" as typeof activity.rendered.activityEvidence;
    const activityProcedure = generateProcedure(activity.knowledge, activity.task, activity.discovery, activity.validation, activity.workflow, activity.rendered);
    expect(activityProcedure.state).toBe("DATA_ERROR");
    if (activityProcedure.state === "DATA_ERROR") {
      expect(activityProcedure.failures.some((item) => item.code === "MALFORMED_ACTIVITY")).toBe(true);
    }
  });
});
