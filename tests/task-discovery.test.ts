import { describe, expect, it } from "vitest";
import { discoveryPageModel, toDiscoveryCatalog } from "../lib/discovery/view";
import { filterDiscoveryTasks } from "../lib/discovery/filter";
import { selectedTaskHandoff, selectionNotice } from "../lib/discovery/support";
import type { DiscoveryTask } from "../lib/discovery/types";
import { loadTaskCatalog } from "../lib/tasks";
import { normalizeTaskInput } from "../lib/tasks/normalize";

const PROOF_TASKS = [
  {
    taskId: "task-locate-mac",
    title: "Locate an endpoint MAC address",
    activityEvidence: "read_only",
  },
  {
    taskId: "task-interface-drops",
    title: "Investigate interface errors and drops",
    activityEvidence: "read_only",
  },
  {
    taskId: "task-lacp-check",
    title: "Verify an existing LACP EtherChannel",
    activityEvidence: "read_only",
  },
  {
    taskId: "task-add-trunk-vlan",
    title: "Add VLAN 20 to a trunk",
    activityEvidence: "configuration_changing",
  },
] as const;

function task(partial: Partial<DiscoveryTask> & Pick<DiscoveryTask, "taskId" | "title">): DiscoveryTask {
  return {
    aliases: [],
    categoryId: "vlan",
    categoryLabel: "VLANs and access ports",
    coverageStatus: "command_only",
    workflowAvailability: "absent",
    activityEvidence: "not_established",
    platformBoundary: null,
    validationStatus: null,
    inInitialVerticalSlice: false,
    ...partial,
  };
}

describe("engineer task discovery", () => {
  it("loads every catalog task without inventing identities", async () => {
    const model = discoveryPageModel(await loadTaskCatalog());
    expect(model.state).toBe("READY");
    if (model.state !== "READY") {
      return;
    }
    expect(model.catalog.counts).toEqual({ tasks: 48, workflowBacked: 12, commandOnly: 36 });
    expect(model.catalog.tasks).toHaveLength(48);
    expect(new Set(model.catalog.tasks.map((item) => item.taskId)).size).toBe(48);
    expect(model.catalog.status).toBe("PARTIAL");
    expect(model.catalog.completenessClaim).toBe(false);
    expect(model.catalog.labValidation).toBe(false);
    expect(model.catalog.primaryBoundary).toMatchObject({
      platform: "Catalyst 9300",
      software: "IOS XE",
      release: "17.15.x",
    });
    expect(model.catalog.categories.every((category) => category.taskCount > 0)).toBe(true);
    expect(model.catalog.categories.every((category) => category.label.length > 0)).toBe(true);
  });

  it("keeps proof-task support state and selection identity", async () => {
    const model = discoveryPageModel(await loadTaskCatalog());
    expect(model.state).toBe("READY");
    if (model.state !== "READY") {
      return;
    }
    for (const proof of PROOF_TASKS) {
      const matches = filterDiscoveryTasks(model.catalog.tasks, { text: proof.taskId, categoryId: null });
      expect(matches.map((item) => item.taskId)).toEqual([proof.taskId]);
      const found = matches[0];
      expect(found.title).toBe(proof.title);
      expect(found.workflowAvailability).toBe("present");
      expect(found.coverageStatus).toBe("seed_partial");
      expect(found.activityEvidence).toBe(proof.activityEvidence);
      expect(found.validationStatus).toBe("documentation_reviewed_not_device_tested");
      expect(found.platformBoundary).toContain("Catalyst 9300");
      expect(found.inInitialVerticalSlice).toBe(true);
      const handoff = selectedTaskHandoff(found);
      expect(handoff.taskId).toBe(proof.taskId);
      expect(handoff.title).toBe(proof.title);
      expect(handoff.categoryId).toBe(found.categoryId);
      expect(handoff.categoryLabel).toBe(found.categoryLabel);
      expect(selectionNotice(found)).toContain("seed_partial");
      expect(selectionNotice(found)).not.toContain("Procedure not available");
    }
  });

  it("keeps a command-only task from claiming a procedure", async () => {
    const model = discoveryPageModel(await loadTaskCatalog());
    expect(model.state).toBe("READY");
    if (model.state !== "READY") {
      return;
    }
    const matches = filterDiscoveryTasks(model.catalog.tasks, {
      text: "task-command-reload",
      categoryId: null,
    });
    expect(matches).toHaveLength(1);
    const found = matches[0];
    expect(found.title).toBe("Restart the device");
    expect(found.workflowAvailability).toBe("absent");
    expect(found.coverageStatus).toBe("command_only");
    expect(found.activityEvidence).toBe("not_established");
    expect(found.platformBoundary).toBeNull();
    expect(selectedTaskHandoff(found).taskId).toBe("task-command-reload");
    expect(selectionNotice(found)).toBe(
      "Command guidance only. Workflow not established. Procedure not available.",
    );
  });

  it("filters by category and text without choosing a winner", async () => {
    const model = discoveryPageModel(await loadTaskCatalog());
    expect(model.state).toBe("READY");
    if (model.state !== "READY") {
      return;
    }
    const lacp = model.catalog.tasks.find((item) => item.taskId === "task-lacp-check");
    expect(lacp).toBeDefined();
    if (!lacp) {
      return;
    }
    const byCategory = filterDiscoveryTasks(model.catalog.tasks, { text: "", categoryId: lacp.categoryId });
    expect(byCategory.every((item) => item.categoryId === lacp.categoryId)).toBe(true);
    expect(byCategory.some((item) => item.taskId === "task-lacp-check")).toBe(true);
    expect(byCategory.some((item) => item.taskId === "task-locate-mac")).toBe(false);

    const byAlias = filterDiscoveryTasks(model.catalog.tasks, {
      text: "check port channel members",
      categoryId: null,
    });
    expect(byAlias.map((item) => item.taskId)).toContain("task-lacp-check");

    const noMatches = filterDiscoveryTasks(model.catalog.tasks, {
      text: "zzzz-no-such-task",
      categoryId: null,
    });
    expect(noMatches).toEqual([]);

    const nearMiss = filterDiscoveryTasks(model.catalog.tasks, { text: "locate mac", categoryId: null });
    for (const item of nearMiss) {
      const fields = [item.taskId, item.title, item.categoryLabel, ...item.aliases].map(normalizeTaskInput);
      expect(fields.some((field) => field.includes("locate mac"))).toBe(true);
    }
  });

  it("does not collapse shared alias text into one task", () => {
    const tasks = [
      task({ taskId: "task-a", title: "Alpha", aliases: ["check the link"] }),
      task({ taskId: "task-b", title: "Beta", aliases: ["check the link"] }),
    ];
    const matches = filterDiscoveryTasks(tasks, { text: "check the link", categoryId: null });
    expect(matches.map((item) => item.taskId)).toEqual(["task-a", "task-b"]);
  });

  it("fails closed when the catalog cannot load", async () => {
    const model = discoveryPageModel(await loadTaskCatalog({ packageRoot: "C:\\missing-knowledge-aci-007" }));
    expect(model.state).toBe("DATA_ERROR");
    if (model.state !== "DATA_ERROR") {
      return;
    }
    expect(model.errors.length).toBeGreaterThan(0);
    expect(JSON.stringify(model)).not.toContain("task-locate-mac");
  });

  it("copies catalog counts instead of rebuilding support rules", async () => {
    const loaded = await loadTaskCatalog();
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) {
      return;
    }
    const discovery = toDiscoveryCatalog(loaded.catalog);
    expect(discovery.counts.workflowBacked).toBe(loaded.catalog.counts.workflowBacked);
    expect(discovery.counts.commandOnly).toBe(loaded.catalog.counts.commandOnly);
    expect(discovery.tasks.filter((item) => item.workflowAvailability === "present")).toHaveLength(12);
    expect(discovery.tasks.filter((item) => item.workflowAvailability === "absent")).toHaveLength(36);
  });
});
