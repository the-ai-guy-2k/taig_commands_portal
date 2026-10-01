import { describe, expect, it } from "vitest";
import { loadKnowledgePackage } from "../lib/knowledge";
import { discoverTaskInputContract, validateTaskInputs } from "../lib/inputs";
import { buildTaskCatalog, resolveTask, type CatalogTask } from "../lib/tasks";

async function proofTask(taskId: string): Promise<{ knowledge: Awaited<ReturnType<typeof loadKnowledgePackage>> & { ok: true }; task: CatalogTask }> {
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
  return { knowledge, task: resolved.task };
}

describe("proof task input contracts", () => {
  it("derives distinct required inputs for the four workflow-backed tasks", async () => {
    const expected = {
      "task-locate-mac": ["mac", "interface", "vlan_id"],
      "task-interface-drops": ["interface"],
      "task-lacp-check": ["group"],
      "task-add-trunk-vlan": ["interface", "vlan_list", "vlan_id"],
    } as const;

    for (const [taskId, keys] of Object.entries(expected)) {
      const { knowledge, task } = await proofTask(taskId);
      const discovery = discoverTaskInputContract(knowledge.knowledge, task);
      expect(discovery.ok).toBe(true);
      if (!discovery.ok) {
        continue;
      }
      expect(discovery.contract.inputs.map((input) => input.inputKey)).toEqual(keys);
      expect(discovery.contract.inputs.every((input) => input.requirement === "required")).toBe(true);
      expect(discovery.contract.inputs.every((input) => input.validation.range === "not_established")).toBe(true);
      expect(discovery.contract.inputs.every((input) => input.validation.format === "not_established")).toBe(true);
      expect(discovery.contract.deviceExecutionAuthorized).toBe(false);
      expect(JSON.stringify(discovery.contract)).not.toMatch(/show mac address-table|switchport trunk/);
      const missing = validateTaskInputs(discovery, {});
      expect(missing.state).toBe("NEEDS_INPUT");
      expect(missing.missing.map((item) => item.inputKey)).toEqual(keys);
      expect(missing.deviceExecutionAuthorized).toBe(false);
    }
  });

  it("consolidates interface across interface-drops steps and keeps trunk parameters distinct", async () => {
    const drops = await proofTask("task-interface-drops");
    const dropsContract = discoverTaskInputContract(drops.knowledge.knowledge, drops.task);
    expect(dropsContract.ok).toBe(true);
    if (!dropsContract.ok) {
      return;
    }
    expect(dropsContract.contract.inputs[0].uses.map((use) => use.commandId)).toEqual([
      "show-if",
      "show-errors",
      "show-ip-if",
      "show-switchport",
    ]);
    expect(dropsContract.contract.inputs[0].exampleValue).toBe("GigabitEthernet1/0/10");

    const trunk = await proofTask("task-add-trunk-vlan");
    const trunkContract = discoverTaskInputContract(trunk.knowledge.knowledge, trunk.task);
    expect(trunkContract.ok).toBe(true);
    if (!trunkContract.ok) {
      return;
    }
    const byKey = Object.fromEntries(trunkContract.contract.inputs.map((input) => [input.inputKey, input]));
    expect(byKey.interface.exampleValue).toBe("GigabitEthernet1/0/1");
    expect(byKey.interface.uses.map((use) => use.commandId)).toEqual(["interface", "show-switchport"]);
    expect(byKey.vlan_list.exampleValue).toBe("20");
    expect(byKey.vlan_id.exampleValue).toBe(20);
    expect(byKey.vlan_list.parameterName).not.toBe(byKey.vlan_id.parameterName);
  });

  it("returns READY for complete values without enforcing unstated Cisco ranges or formats", async () => {
    const { knowledge, task } = await proofTask("task-locate-mac");
    const discovery = discoverTaskInputContract(knowledge.knowledge, task);
    const ready = validateTaskInputs(discovery, {
      mac: "not-a-mac",
      interface: "  GigabitEthernet1/0/10  ",
      vlan_id: "99999",
    });
    expect(ready.state).toBe("READY");
    expect(ready.accepted.mac).toEqual({ original: "not-a-mac", normalized: "not-a-mac" });
    expect(ready.accepted.interface.normalized).toBe("GigabitEthernet1/0/10");
    expect(ready.accepted.interface.original).toBe("  GigabitEthernet1/0/10  ");
    expect(ready.conflicts).toEqual([]);
    expect(ready.deviceExecutionAuthorized).toBe(false);
    expect(discovery.ok && discovery.contract.inputs.every((input) => input.validation.range === "not_established")).toBe(true);

    const { knowledge: trunkKnowledge, task: trunkTask } = await proofTask("task-add-trunk-vlan");
    const trunkDiscovery = discoverTaskInputContract(trunkKnowledge.knowledge, trunkTask);
    const trunkReady = validateTaskInputs(trunkDiscovery, {
      interface: "GigabitEthernet1/0/1",
      vlan_list: "20",
      vlan_id: 99,
    });
    expect(trunkReady.state).toBe("READY");
    expect(trunkReady.conflicts).toEqual([]);
  });

  it("reports one missing value, several missing values, and unknown keys", async () => {
    const { knowledge, task } = await proofTask("task-lacp-check");
    const discovery = discoverTaskInputContract(knowledge.knowledge, task);
    expect(validateTaskInputs(discovery, {}).missing.map((item) => item.inputKey)).toEqual(["group"]);
    expect(validateTaskInputs(discovery, { group: "   " }).state).toBe("NEEDS_INPUT");
    const ready = validateTaskInputs(discovery, { group: 1, other: "ignored" });
    expect(ready.state).toBe("READY");
    expect(ready.unknownInputs).toEqual(["other"]);
    expect(ready.accepted).not.toHaveProperty("other");

    const located = await proofTask("task-locate-mac");
    const locatedContract = discoverTaskInputContract(located.knowledge.knowledge, located.task);
    const partial = validateTaskInputs(locatedContract, { interface: "GigabitEthernet1/0/10" });
    expect(partial.state).toBe("NEEDS_INPUT");
    expect(partial.missing.map((item) => item.inputKey).sort()).toEqual(["mac", "vlan_id"]);
  });

  it("rejects a non-scalar value and does not treat command-only tasks as workflow forms", async () => {
    const { knowledge, task } = await proofTask("task-interface-drops");
    const discovery = discoverTaskInputContract(knowledge.knowledge, task);
    const invalid = validateTaskInputs(discovery, { interface: { name: "GigabitEthernet1/0/10" } });
    expect(invalid.state).toBe("INVALID_INPUT");
    expect(invalid.accepted).toEqual({});

    const catalog = buildTaskCatalog(knowledge.knowledge);
    expect(catalog.ok).toBe(true);
    if (!catalog.ok) {
      return;
    }
    const commandOnly = resolveTask(catalog.catalog, "task-command-reload");
    expect(commandOnly.state).toBe("RESOLVED");
    if (commandOnly.state !== "RESOLVED") {
      return;
    }
    const unsupported = discoverTaskInputContract(knowledge.knowledge, commandOnly.task);
    expect(unsupported).toMatchObject({
      ok: false,
      state: "UNSUPPORTED_VALIDATION",
      reason: "input_contract_not_established",
    });
  });

  it("does not certify an excluded software context", async () => {
    const { knowledge, task } = await proofTask("task-lacp-check");
    const discovery = discoverTaskInputContract(knowledge.knowledge, task);
    const result = validateTaskInputs(discovery, { group: 1 }, { software: "nx-os" });
    expect(result.state).toBe("UNSUPPORTED_VALIDATION");
    expect(result.deviceExecutionAuthorized).toBe(false);
  });

  it("keeps DHCP address parameters separate and high optional", async () => {
    const { knowledge, task } = await proofTask("task-dhcp-server");
    const discovery = discoverTaskInputContract(knowledge.knowledge, task);
    expect(discovery.ok).toBe(true);
    if (!discovery.ok) {
      return;
    }
    const keys = discovery.contract.inputs.map((input) => input.inputKey);
    expect(keys).toContain("dhcp-router.address");
    expect(keys).toContain("dhcp-dns.address");
    expect(keys).not.toContain("address");
    const high = discovery.contract.inputs.find((input) => input.parameterName === "high");
    expect(high?.requirement).toBe("optional");
    const required = Object.fromEntries(
      discovery.contract.inputs.filter((input) => input.requirement === "required").map((input) => [input.inputKey, input.exampleValue]),
    );
    expect(validateTaskInputs(discovery, required).state).toBe("READY");
    expect(discovery.contract.platformBoundaries[0]).toContain("IOS 12.4");
  });
});

describe("input contract failure fixtures", () => {
  it("returns DATA_ERROR for a broken workflow binding", async () => {
    const { knowledge, task } = await proofTask("task-lacp-check");
    const workflow = knowledge.knowledge.indexes.workflowsById.get("lacp-check");
    expect(workflow).toBeDefined();
    if (!workflow) {
      return;
    }
    workflow.phases.verification[1].parameter_values.not_a_parameter = 1;
    const discovery = discoverTaskInputContract(knowledge.knowledge, task);
    expect(discovery.ok).toBe(false);
    if (discovery.ok || discovery.state !== "DATA_ERROR") {
      return;
    }
    expect(discovery.errors.some((item) => item.code === "BROKEN_BINDING")).toBe(true);
  });

  it("returns DATA_ERROR when a workflow step names a missing command", async () => {
    const { knowledge, task } = await proofTask("task-lacp-check");
    const workflow = knowledge.knowledge.indexes.workflowsById.get("lacp-check");
    expect(workflow).toBeDefined();
    if (!workflow) {
      return;
    }
    workflow.phases.verification[1].command_id = "missing-command";
    const discovery = discoverTaskInputContract(knowledge.knowledge, task);
    expect(discovery.ok).toBe(false);
    if (discovery.ok || discovery.state !== "DATA_ERROR") {
      return;
    }
    expect(discovery.errors.some((item) => item.code === "MISSING_COMMAND")).toBe(true);
  });

  it("does not treat a declared but unevaluable range as a passing or failing value check", async () => {
    const { knowledge, task } = await proofTask("task-lacp-check");
    const command = knowledge.knowledge.indexes.commandsById.get("ether-detail");
    expect(command).toBeDefined();
    if (!command) {
      return;
    }
    command.syntax_elements[0].range = "declared-without-grammar";
    const discovery = discoverTaskInputContract(knowledge.knowledge, task);
    expect(discovery.ok).toBe(true);
    if (!discovery.ok) {
      return;
    }
    expect(discovery.contract.inputs[0].validation.range).toBe("declared_unevaluable");
    const result = validateTaskInputs(discovery, { group: 1 });
    expect(result.state).toBe("UNSUPPORTED_VALIDATION");
    expect(result.invalid).toEqual([]);
    expect(result.unsupported.some((item) => item.constraint === "range")).toBe(true);
  });

  it("returns DATA_ERROR when the same parameter description has conflicting range metadata", async () => {
    const { knowledge, task } = await proofTask("task-interface-drops");
    const command = knowledge.knowledge.indexes.commandsById.get("show-errors");
    expect(command).toBeDefined();
    if (!command) {
      return;
    }
    command.syntax_elements[0].range = "1-10";
    const discovery = discoverTaskInputContract(knowledge.knowledge, task);
    expect(discovery.ok).toBe(false);
    if (discovery.ok || discovery.state !== "DATA_ERROR") {
      return;
    }
    expect(discovery.errors.some((item) => item.code === "INCOMPATIBLE_PARAMETER")).toBe(true);
  });
});
