import { describe, expect, it } from "vitest";
import { loadKnowledgePackage, type LoadedKnowledge } from "../lib/knowledge";
import { discoverTaskInputContract, validateTaskInputs, type TaskInputValidation } from "../lib/inputs";
import { buildTaskCatalog, resolveTask, type CatalogTask } from "../lib/tasks";
import { resolveWorkflow, type WorkflowResolution } from "../lib/workflows";
import { renderWorkflowCommands, type RenderResult } from "../lib/rendering";

async function loadedTask(taskId: string): Promise<{
  knowledge: LoadedKnowledge;
  task: CatalogTask;
  discovery: ReturnType<typeof discoverTaskInputContract>;
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
  return {
    knowledge: loaded.knowledge,
    task: resolved.task,
    discovery: discoverTaskInputContract(loaded.knowledge, resolved.task),
  };
}

function renderWith(
  loaded: Awaited<ReturnType<typeof loadedTask>>,
  values: Record<string, string | number>,
): { workflow: WorkflowResolution; validation: TaskInputValidation; rendered: RenderResult } {
  const validation = validateTaskInputs(loaded.discovery, values);
  const workflow = resolveWorkflow(loaded.knowledge, loaded.task, loaded.discovery, validation);
  return { workflow, validation, rendered: renderWorkflowCommands(loaded.knowledge, workflow, validation) };
}

function renderedLines(result: RenderResult): string[] {
  if (result.state !== "RENDERED") {
    return [];
  }
  return result.workflows[0].phases.flatMap((phase) => phase.commands.map((command) => `${phase.phase}|${command.commandId}|${command.renderedCommand}`));
}

describe("proof command rendering", () => {
  it("renders the four proof workflows from engineer values, not research examples", async () => {
    const cases = [
      {
        taskId: "task-locate-mac",
        values: { mac: "aabb.ccdd.eeff", interface: "Gi1/0/24", vlan_id: 30 },
        activity: "read_only",
        lines: [
          "pre_check|version|show version",
          "verification|mac-address|show mac address-table address aabb.ccdd.eeff",
          "verification|mac-interface|show mac address-table interface Gi1/0/24",
          "verification|show-status|show interfaces status",
          "troubleshooting|mac-vlan|show mac address-table vlan 30",
          "troubleshooting|show-trunk|show interfaces trunk",
          "troubleshooting|stp-show|show spanning-tree",
        ],
      },
      {
        taskId: "task-interface-drops",
        values: { interface: "Gi1/0/24" },
        activity: "read_only",
        lines: [
          "pre_check|version|show version",
          "pre_check|run|show running-config",
          "verification|show-if|show interfaces Gi1/0/24",
          "verification|show-errors|show interfaces Gi1/0/24 counters errors",
          "troubleshooting|show-status|show interfaces status",
          "troubleshooting|show-ip-if|show ip interface Gi1/0/24",
          "troubleshooting|show-switchport|show interfaces Gi1/0/24 switchport",
        ],
      },
      {
        taskId: "task-lacp-check",
        values: { group: 5 },
        activity: "read_only",
        lines: [
          "pre_check|run|show running-config",
          "verification|ether-summary|show etherchannel summary",
          "verification|ether-detail|show etherchannel 5 detail",
          "verification|lacp-neighbor|show lacp neighbor",
          "troubleshooting|show-trunk|show interfaces trunk",
          "troubleshooting|stp-show|show spanning-tree",
          "troubleshooting|show-status|show interfaces status",
        ],
      },
      {
        taskId: "task-add-trunk-vlan",
        values: { interface: "Gi1/0/48", vlan_list: "30,40", vlan_id: 30 },
        activity: "configuration_changing",
        lines: [
          "pre_check|run|show running-config",
          "pre_check|show-trunk|show interfaces trunk",
          "pre_check|show-vlan|show vlan brief",
          "configuration|conf|configure terminal",
          "configuration|interface|interface Gi1/0/48",
          "configuration|trunk-add|switchport trunk allowed vlan add 30,40",
          "configuration|end|end",
          "verification|show-trunk|show interfaces trunk",
          "verification|show-switchport|show interfaces Gi1/0/48 switchport",
          "troubleshooting|stp-show|show spanning-tree",
          "troubleshooting|mac-vlan|show mac address-table vlan 30",
        ],
      },
    ] as const;

    for (const spec of cases) {
      const { rendered } = renderWith(await loadedTask(spec.taskId), { ...spec.values, extra: "NOT-A-COMMAND-VALUE" });
      expect(rendered.state).toBe("RENDERED");
      if (rendered.state !== "RENDERED") {
        continue;
      }
      expect(rendered.activityEvidence).toBe(spec.activity);
      expect(rendered.deviceExecutionAuthorized).toBe(false);
      expect(rendered.procedureGenerated).toBe(false);
      expect(rendered.support.completenessClaim).toBe(false);
      expect(rendered.support.labValidation).toBe(false);
      expect(rendered.support.taskCoverageStatus).toBe("seed_partial");
      expect(renderedLines(rendered)).toEqual([...spec.lines]);
      const renderedText = rendered.workflows[0].phases.flatMap((phase) => phase.commands.map((command) => command.renderedCommand)).join("\n");
      expect(renderedText).not.toContain("NOT-A-COMMAND-VALUE");
      expect(renderedText).not.toContain("0011.2233.4455");
      expect(renderedText).not.toContain("GigabitEthernet1/0/10");
      expect(renderedText).not.toContain("GigabitEthernet1/0/1");
      const substituted = rendered.workflows[0].phases.flatMap((phase) => phase.commands).filter((command) => command.substitutions.length > 0);
      expect(substituted.every((command) => command.template !== command.renderedCommand)).toBe(true);
      expect(substituted.every((command) => command.template.includes("<"))).toBe(true);
      const staticCommands = rendered.workflows[0].phases.flatMap((phase) => phase.commands).filter((command) => command.substitutions.length === 0);
      expect(staticCommands.every((command) => command.template === command.renderedCommand)).toBe(true);
      expect(rendered.workflows[0].phases.map((phase) => phase.phase)).toEqual([
        "pre_check",
        "configuration",
        "verification",
        "troubleshooting",
      ]);
    }
  });

  it("keeps one engineer interface value across interface-drops commands", async () => {
    const { rendered } = renderWith(await loadedTask("task-interface-drops"), { interface: "Gi1/0/24" });
    expect(rendered.state).toBe("RENDERED");
    if (rendered.state !== "RENDERED") {
      return;
    }
    const uses = rendered.workflows[0].phases
      .flatMap((phase) => phase.commands)
      .filter((command) => command.engineerInputKeys.includes("interface"));
    expect(uses.map((command) => command.commandId)).toEqual(["show-if", "show-errors", "show-ip-if", "show-switchport"]);
    expect(uses.every((command) => command.renderedCommand.includes("Gi1/0/24"))).toBe(true);
    expect(uses.every((command) => command.substitutions[0].researchValue === "GigabitEthernet1/0/10")).toBe(true);
    expect(uses.every((command) => command.substitutions[0].engineerValue === "Gi1/0/24")).toBe(true);
  });

  it("renders multiple placeholders and keeps same-name DHCP addresses distinct", async () => {
    const loaded = await loadedTask("task-dhcp-server");
    expect(loaded.discovery.ok).toBe(true);
    if (!loaded.discovery.ok) {
      return;
    }
    const values = Object.fromEntries(
      loaded.discovery.contract.inputs.filter((input) => input.requirement === "required").map((input) => [input.inputKey, input.exampleValue]),
    );
    values.low = "203.0.113.10";
    values.prefix = "203.0.113.0";
    values.mask = "255.255.255.128";
    values["dhcp-router.address"] = "203.0.113.1";
    values["dhcp-dns.address"] = "203.0.113.53";
    const { rendered } = renderWith(loaded, values);
    expect(rendered.state).toBe("RENDERED");
    if (rendered.state !== "RENDERED") {
      return;
    }
    const byId = new Map(
      rendered.workflows[0].phases.flatMap((phase) => phase.commands).map((command) => [command.commandId, command.renderedCommand]),
    );
    expect(byId.get("dhcp-exclude")).toBe("ip dhcp excluded-address 203.0.113.10");
    expect(byId.get("dhcp-network")).toBe("network 203.0.113.0 255.255.255.128");
    expect(byId.get("dhcp-router")).toBe("default-router 203.0.113.1");
    expect(byId.get("dhcp-dns")).toBe("dns-server 203.0.113.53");
    expect(JSON.stringify(rendered)).not.toContain("192.0.2.20");
    const network = rendered.workflows[0].phases.flatMap((phase) => phase.commands).find((command) => command.commandId === "dhcp-network");
    expect(network?.substitutions.map((item) => item.placeholder)).toEqual(["prefix", "mask"]);
    expect(network?.template).toBe("network <prefix> <mask>");
  });

  it("preserves an engineer value that contains placeholder punctuation", async () => {
    const { rendered } = renderWith(await loadedTask("task-locate-mac"), {
      mac: "aa<bb>.ccdd.eeff",
      interface: "Gi1/0/24",
      vlan_id: 30,
    });
    expect(rendered.state).toBe("RENDERED");
    if (rendered.state !== "RENDERED") {
      return;
    }
    const mac = rendered.workflows[0].phases.flatMap((phase) => phase.commands).find((command) => command.commandId === "mac-address");
    expect(mac?.renderedCommand).toBe("show mac address-table address aa<bb>.ccdd.eeff");
    expect(mac?.template).toBe("show mac address-table address <mac>");
  });
});

describe("command rendering failure fixtures", () => {
  it("does not render when inputs are not READY", async () => {
    const loaded = await loadedTask("task-lacp-check");
    const validation = validateTaskInputs(loaded.discovery, {});
    const workflow = resolveWorkflow(loaded.knowledge, loaded.task, loaded.discovery, validation);
    const rendered = renderWorkflowCommands(loaded.knowledge, workflow, validation);
    expect(rendered.state).toBe("UPSTREAM_NOT_READY");
    expect(rendered).not.toHaveProperty("workflows");
    expect(rendered.deviceExecutionAuthorized).toBe(false);
  });

  it("does not render a command-only task", async () => {
    const loaded = await loadedTask("task-command-reload");
    const validation = validateTaskInputs(loaded.discovery, {});
    const workflow = resolveWorkflow(loaded.knowledge, loaded.task, loaded.discovery, validation);
    const rendered = renderWorkflowCommands(loaded.knowledge, workflow, validation);
    expect(workflow.state).toBe("WORKFLOW_NOT_ESTABLISHED");
    expect(rendered.state).toBe("UPSTREAM_NOT_READY");
    expect(rendered).not.toHaveProperty("workflows");
  });

  it("fails closed for a missing template, malformed syntax, or placeholder without an element", async () => {
    const missing = await loadedTask("task-lacp-check");
    const ready = renderWith(missing, { group: 5 });
    expect(ready.workflow.state).toBe("RESOLVED");
    const command = missing.knowledge.indexes.commandsById.get("ether-detail");
    expect(command).toBeDefined();
    if (!command || ready.workflow.state !== "RESOLVED") {
      return;
    }
    command.syntax = "";
    const missingTemplate = renderWorkflowCommands(missing.knowledge, ready.workflow, ready.validation);
    expect(missingTemplate.state).toBe("DATA_ERROR");
    if (missingTemplate.state === "DATA_ERROR") {
      expect(missingTemplate.failures.some((failure) => failure.code === "MISSING_TEMPLATE")).toBe(true);
    }

    const malformed = await loadedTask("task-lacp-check");
    const malformedReady = renderWith(malformed, { group: 5 });
    const malformedCommand = malformed.knowledge.indexes.commandsById.get("ether-detail");
    expect(malformedCommand).toBeDefined();
    if (!malformedCommand || malformedReady.workflow.state !== "RESOLVED") {
      return;
    }
    malformedCommand.syntax = "show etherchannel [group] detail";
    const malformedResult = renderWorkflowCommands(malformed.knowledge, malformedReady.workflow, malformedReady.validation);
    expect(malformedResult.state).toBe("DATA_ERROR");
    if (malformedResult.state === "DATA_ERROR") {
      expect(malformedResult.failures.some((failure) => failure.code === "MALFORMED_TEMPLATE")).toBe(true);
    }

    const unbound = await loadedTask("task-locate-mac");
    const unboundReady = renderWith(unbound, { mac: "aabb.ccdd.eeff", interface: "Gi1/0/24", vlan_id: 30 });
    const mac = unbound.knowledge.indexes.commandsById.get("mac-address");
    expect(mac).toBeDefined();
    if (!mac || unboundReady.workflow.state !== "RESOLVED") {
      return;
    }
    mac.syntax = "show mac address-table address <mac> <extra>";
    const unboundResult = renderWorkflowCommands(unbound.knowledge, unboundReady.workflow, unboundReady.validation);
    expect(unboundResult.state).toBe("DATA_ERROR");
    expect(unboundResult).not.toHaveProperty("workflows");
  });

  it("fails closed when a required placeholder or engineer key cannot be resolved", async () => {
    const loaded = await loadedTask("task-locate-mac");
    const ready = renderWith(loaded, { mac: "aabb.ccdd.eeff", interface: "Gi1/0/24", vlan_id: 30 });
    expect(ready.workflow.state).toBe("RESOLVED");
    if (ready.workflow.state !== "RESOLVED") {
      return;
    }
    const step = ready.workflow.workflows[0].phases.find((phase) => phase.phase === "verification")?.steps[0];
    expect(step?.commandId).toBe("mac-address");
    if (!step) {
      return;
    }
    const stripped = renderWorkflowCommands(loaded.knowledge, ready.workflow, { ...ready.validation, accepted: {} });
    expect(stripped.state).toBe("UNRESOLVED_PLACEHOLDER");
    expect(JSON.stringify(stripped)).not.toContain("show mac address-table address");

    step.bindings = [{ ...step.bindings[0], engineerInputKey: null }];
    const brokenKey = renderWorkflowCommands(loaded.knowledge, ready.workflow, ready.validation);
    expect(brokenKey.state).toBe("BINDING_ERROR");
    if (brokenKey.state === "BINDING_ERROR") {
      expect(brokenKey.failures.some((failure) => failure.code === "BINDING_ERROR")).toBe(true);
    }
  });

  it("does not substitute a credential placeholder", async () => {
    const loaded = await loadedTask("task-locate-mac");
    const ready = renderWith(loaded, { mac: "aabb.ccdd.eeff", interface: "Gi1/0/24", vlan_id: 30 });
    expect(ready.workflow.state).toBe("RESOLVED");
    const command = loaded.knowledge.indexes.commandsById.get("mac-address");
    if (!command || ready.workflow.state !== "RESOLVED") {
      return;
    }
    command.syntax = "show mac address-table address <secret>";
    command.syntax_elements[0].name = "secret";
    const step = ready.workflow.workflows[0].phases.find((phase) => phase.phase === "verification")?.steps[0];
    expect(step).toBeDefined();
    if (!step) {
      return;
    }
    step.bindings = [{ ...step.bindings[0], parameterName: "secret", syntaxElementName: "secret", engineerInputKey: "secret" }];
    const validation = {
      ...ready.validation,
      accepted: {
        ...ready.validation.accepted,
        secret: { original: "hunter2", normalized: "hunter2" },
      },
    };
    const rendered = renderWorkflowCommands(loaded.knowledge, ready.workflow, validation);
    expect(rendered.state).toBe("UNSUPPORTED");
    expect(JSON.stringify(rendered)).not.toContain("hunter2");
    expect(rendered.deviceExecutionAuthorized).toBe(false);
  });
});
