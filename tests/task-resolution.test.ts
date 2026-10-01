import { describe, expect, it } from "vitest";
import { loadKnowledgePackage, type LoadedKnowledge } from "../lib/knowledge";
import type { TaskCategory, TaskRecord, TaskWorkflow } from "../lib/knowledge/types";
import {
  buildTaskCatalog,
  getTaskById,
  loadTaskCatalog,
  resolveTask,
} from "../lib/tasks";

const PROOF_TASKS = [
  "task-locate-mac",
  "task-interface-drops",
  "task-lacp-check",
  "task-add-trunk-vlan",
] as const;

function category(categoryId = "vlan"): TaskCategory {
  return {
    category_id: categoryId,
    parent_id: "core",
    label: "VLANs and access ports",
    type: "feature_task_group",
    coverage_status: "seed_partial",
  };
}

function task(partial: Partial<TaskRecord> & Pick<TaskRecord, "task_id" | "title">): TaskRecord {
  return {
    category_id: "vlan",
    aliases: [],
    workflow_ids: [],
    coverage_status: "command_only",
    ...partial,
  };
}

function knowledgeFor(tasks: TaskRecord[], workflows: TaskWorkflow[] = [], categories = [category()]): LoadedKnowledge {
  return {
    directory: "fixture",
    manifest: {} as LoadedKnowledge["manifest"],
    dataset: {
      metadata: {
        aci: "FIXTURE",
        schema_version: "1.0.0",
        dataset_version: "fixture",
        generated_at: "2026-10-01",
        status: "PARTIAL",
        completeness_claim: false,
        coverage_boundary: "fixture",
        command_count: 0,
        workflow_count: workflows.length,
        taxonomy_feature_group_count: categories.length,
        source_count: 0,
        lab_validation: false,
      },
      task_categories: categories,
      tasks,
      command_families: [],
      commands: [],
      task_workflows: workflows,
      relationships: [],
      sources: [],
      platform_version_metadata: {
        primary_boundary: { platform: "Catalyst 9300", software: "IOS XE", release: "17.15.x" },
        excluded_software: ["NX-OS", "ASA", "IOS XR"],
        selection_rule: "Exact source boundary first.",
        null_policy: "Unknown or not established; null is not false.",
      },
    },
    taxonomy: {} as LoadedKnowledge["taxonomy"],
    workflows: {} as LoadedKnowledge["workflows"],
    sourceIndex: {} as LoadedKnowledge["sourceIndex"],
    coverage: {} as LoadedKnowledge["coverage"],
    schema: {},
    indexes: {
      categoriesById: new Map(categories.map((item) => [item.category_id, item])),
      tasksById: new Map(tasks.map((item) => [item.task_id, item])),
      workflowsById: new Map(workflows.map((item) => [item.workflow_id, item])),
      commandsById: new Map(),
      sourcesById: new Map(),
      familiesById: new Map(),
      coverageByCategoryId: new Map(),
      commandsCitingTask: new Map(),
    },
  };
}

describe("real task catalog", () => {
  it("catalogs the accepted package without treating command-only tasks as workflow-backed", async () => {
    const result = await loadTaskCatalog();
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.catalog.counts).toMatchObject({
      tasks: 48,
      workflowBacked: 12,
      commandOnly: 36,
      aliasStrings: 56,
      normalizedAliasKeys: 56,
    });
    expect(result.catalog.package).toMatchObject({
      schemaVersion: "1.0.0",
      datasetVersion: "0.1.0",
      completenessClaim: false,
      labValidation: false,
      primaryBoundary: { platform: "Catalyst 9300", software: "IOS XE", release: "17.15.x" },
    });
    expect(result.catalog.package.excludedSoftware).toEqual(["NX-OS", "ASA", "IOS XR"]);
    const workflowTasks = result.catalog.tasks.filter((item) => item.workflowAvailability === "present");
    const commandOnly = result.catalog.tasks.filter((item) => item.workflowAvailability === "absent");
    expect(workflowTasks.every((item) => item.coverageStatus === "seed_partial")).toBe(true);
    expect(commandOnly.every((item) => item.coverageStatus === "command_only")).toBe(true);
  });

  it("resolves the four initial candidates by id, title, and alias", async () => {
    const result = await loadTaskCatalog();
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    const expected = {
      "task-locate-mac": {
        title: "Locate an endpoint MAC address",
        alias: "which switch port is a MAC on",
        activity: "read_only",
        workflowId: "locate-mac",
      },
      "task-interface-drops": {
        title: "Investigate interface errors and drops",
        alias: "find increasing CRC errors",
        activity: "read_only",
        workflowId: "interface-drops",
      },
      "task-lacp-check": {
        title: "Verify an existing LACP EtherChannel",
        alias: "check port channel members",
        activity: "read_only",
        workflowId: "lacp-check",
      },
      "task-add-trunk-vlan": {
        title: "Add VLAN 20 to a trunk",
        alias: "allow vlan 20 on an existing uplink",
        activity: "configuration_changing",
        workflowId: "add-trunk-vlan",
      },
    } as const;

    for (const taskId of PROOF_TASKS) {
      const spec = expected[taskId];
      const byId = resolveTask(result.catalog, `  ${taskId.toUpperCase()}  `);
      const byTitle = resolveTask(result.catalog, `  ${spec.title.toUpperCase().replace(" ", "   ")} `);
      const byAlias = resolveTask(result.catalog, spec.alias);
      for (const resolved of [byId, byTitle, byAlias]) {
        expect(resolved.state).toBe("RESOLVED");
        if (resolved.state !== "RESOLVED") {
          continue;
        }
        expect(resolved.task.taskId).toBe(taskId);
        expect(resolved.task.workflowAvailability).toBe("present");
        expect(resolved.task.coverageStatus).toBe("seed_partial");
        expect(resolved.task.activityEvidence).toBe(spec.activity);
        expect(resolved.task.workflows.map((workflow) => workflow.workflowId)).toEqual([spec.workflowId]);
        expect(resolved.task.inInitialVerticalSlice).toBe(true);
        expect(resolved.task.workflows[0].platformBoundary).toContain("Catalyst 9300");
        expect(resolved.task.workflows[0].platformBoundary).toContain("IOS XE 17.15.x");
        expect(resolved.task.validationStatus).toBe("documentation_reviewed_not_device_tested");
        expect(JSON.stringify(resolved.task)).not.toMatch(/syntax|parameter_values|command_id/i);
      }
      expect(byId.state === "RESOLVED" && byId.match).toBe("task_id");
      expect(byTitle.state === "RESOLVED" && byTitle.match).toBe("task_name");
      expect(byAlias.state === "RESOLVED" && byAlias.match).toBe("alias");
      expect(byAlias.state === "RESOLVED" && byAlias.matchedAlias).toBe(spec.alias);
    }
  });

  it("keeps a command-only task resolved but not workflow-supported", async () => {
    const result = await loadTaskCatalog();
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    const resolved = resolveTask(result.catalog, "Restart the device");
    expect(resolved.state).toBe("RESOLVED");
    if (resolved.state !== "RESOLVED") {
      return;
    }
    expect(resolved.task.taskId).toBe("task-command-reload");
    expect(resolved.match).toBe("task_name");
    expect(resolved.task.workflowAvailability).toBe("absent");
    expect(resolved.task.coverageStatus).toBe("command_only");
    expect(resolved.task.workflows).toEqual([]);
    expect(resolved.task.activityEvidence).toBe("not_established");
    expect(resolved.task.inInitialVerticalSlice).toBe(false);
  });

  it("preserves the legacy DHCP workflow boundary", async () => {
    const result = await loadTaskCatalog();
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    const resolved = resolveTask(result.catalog, "task-dhcp-server");
    expect(resolved.state).toBe("RESOLVED");
    if (resolved.state !== "RESOLVED") {
      return;
    }
    expect(resolved.task.workflows[0].platformBoundary).toContain("IOS 12.4");
    expect(resolved.task.activityEvidence).toBe("configuration_changing");
    expect(result.catalog.package.primaryBoundary).toEqual({
      platform: "Catalyst 9300",
      software: "IOS XE",
      release: "17.15.x",
    });
  });

  it("returns unsupported for unknown text and does not fuzzy-match", async () => {
    const result = await loadTaskCatalog();
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    for (const input of ["task-does-not-exist", "locate mac", "not a real alias"]) {
      const resolved = resolveTask(result.catalog, input);
      expect(resolved).toMatchObject({ state: "UNSUPPORTED", reason: "no_match" });
    }
  });

  it("rejects blank input and excluded software without selecting a task", async () => {
    const result = await loadTaskCatalog();
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(resolveTask(result.catalog, "   ")).toEqual({ state: "INVALID_INPUT", reason: "empty" });
    expect(resolveTask(result.catalog, "")).toEqual({ state: "INVALID_INPUT", reason: "empty" });
    const excluded = resolveTask(result.catalog, "task-locate-mac", { software: "nx-os" });
    expect(excluded).toMatchObject({
      state: "UNSUPPORTED",
      reason: "excluded_software",
      matchedExclusion: "NX-OS",
    });
    expect(excluded).not.toHaveProperty("task");
  });

  it("returns data error when the knowledge package cannot load", async () => {
    const result = await loadTaskCatalog({ packageRoot: "C:\\missing-taig-knowledge-package" });
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.state).toBe("DATA_ERROR");
    expect(result.errors[0].code).toBe("KNOWLEDGE_DATA_ERROR");
  });

  it("keeps the ACI-001 loader operational", async () => {
    const loaded = await loadKnowledgePackage();
    expect(loaded.ok).toBe(true);
  });
});

describe("task resolution fixtures", () => {
  it("returns ambiguous when one alias matches two tasks", () => {
    const catalog = buildTaskCatalog(
      knowledgeFor([
        task({ task_id: "task-a", title: "Alpha", aliases: ["check the link"] }),
        task({ task_id: "task-b", title: "Beta", aliases: ["check the link"] }),
      ]),
    );
    expect(catalog.ok).toBe(true);
    if (!catalog.ok) {
      return;
    }
    const resolved = resolveTask(catalog.catalog, "Check   the LINK");
    expect(resolved).toEqual({
      state: "AMBIGUOUS",
      normalizedInput: "check the link",
      match: "alias",
      candidates: [
        { taskId: "task-a", title: "Alpha" },
        { taskId: "task-b", title: "Beta" },
      ],
    });
  });

  it("prefers an exact task id over another task alias", () => {
    const catalog = buildTaskCatalog(
      knowledgeFor([
        task({ task_id: "task-alpha", title: "Alpha task", aliases: [] }),
        task({ task_id: "task-beta", title: "Beta task", aliases: ["task-alpha"] }),
      ]),
    );
    expect(catalog.ok).toBe(true);
    if (!catalog.ok) {
      return;
    }
    const resolved = resolveTask(catalog.catalog, "TASK-ALPHA");
    expect(resolved.state).toBe("RESOLVED");
    if (resolved.state !== "RESOLVED") {
      return;
    }
    expect(resolved.match).toBe("task_id");
    expect(resolved.task.taskId).toBe("task-alpha");
  });

  it("reports a missing workflow reference as a data error", () => {
    const catalog = buildTaskCatalog(
      knowledgeFor([
        task({
          task_id: "task-broken",
          title: "Broken",
          aliases: [],
          workflow_ids: ["missing-workflow"],
          coverage_status: "seed_partial",
        }),
      ]),
    );
    expect(catalog).toMatchObject({
      ok: false,
      state: "DATA_ERROR",
      errors: [expect.objectContaining({ code: "MISSING_WORKFLOW", taskId: "task-broken" })],
    });
  });

  it("reports a missing category as a data error", () => {
    const catalog = buildTaskCatalog(
      knowledgeFor([task({ task_id: "task-orphan", title: "Orphan", category_id: "missing-category" })]),
    );
    expect(catalog).toMatchObject({
      ok: false,
      state: "DATA_ERROR",
      errors: [expect.objectContaining({ code: "MISSING_CATEGORY", taskId: "task-orphan" })],
    });
  });

  it("reports a malformed task record as a data error", () => {
    const catalog = buildTaskCatalog(knowledgeFor([task({ task_id: "task-bad", title: "   " })]));
    expect(catalog).toMatchObject({
      ok: false,
      state: "DATA_ERROR",
      errors: [expect.objectContaining({ code: "MALFORMED_TASK" })],
    });
  });

  it("looks up a task only by its stable id", () => {
    const catalog = buildTaskCatalog(
      knowledgeFor([task({ task_id: "task-alpha", title: "Alpha task", aliases: ["alpha alias"] })]),
    );
    expect(catalog.ok).toBe(true);
    if (!catalog.ok) {
      return;
    }
    const found = getTaskById(catalog.catalog, " task-alpha ");
    expect(found.state).toBe("RESOLVED");
    expect(getTaskById(catalog.catalog, "alpha alias")).toMatchObject({ state: "UNSUPPORTED", reason: "no_match" });
    expect(getTaskById(catalog.catalog, " ")).toEqual({ state: "INVALID_INPUT", reason: "empty" });
  });
});
