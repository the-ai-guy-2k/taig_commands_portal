import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { loadKnowledgePackage, traceTask, type KnowledgeErrorCode } from "../lib/knowledge";
import { refreshManifest, writeKnowledgeFixture, type FixtureDraft } from "./fixture-package";

const tempDirs: string[] = [];

async function tempFixture(mutate?: (draft: FixtureDraft) => void): Promise<string> {
  const directory = await mkdtemp(path.join(tmpdir(), "taig-knowledge-"));
  tempDirs.push(directory);
  await writeKnowledgeFixture(directory, mutate);
  return directory;
}

function expectCode(errors: { code: string }[], code: KnowledgeErrorCode): void {
  expect(errors.map((error) => error.code)).toContain(code);
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe("real Cisco command research package", () => {
  it("loads and validates the authoritative local package", async () => {
    const result = await loadKnowledgePackage();
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.knowledge.directory.replaceAll("\\", "/")).toMatch(/cisco_command_results\/Results$/);
    expect(result.knowledge.dataset.metadata).toMatchObject({
      aci: "ACI-TAIG2K-CISCO-COMMAND-KNOWLEDGE-RESEARCH-001",
      schema_version: "1.0.0",
      dataset_version: "0.1.0",
      status: "PARTIAL",
      completeness_claim: false,
      lab_validation: false,
      command_count: 100,
      workflow_count: 12,
      taxonomy_feature_group_count: 55,
      source_count: 29,
    });
    expect(result.knowledge.indexes.commandsById.size).toBe(100);
    expect(result.knowledge.indexes.workflowsById.size).toBe(12);
    expect(result.knowledge.indexes.tasksById.size).toBe(48);
    expect(result.knowledge.indexes.sourcesById.size).toBe(29);
    expect(result.knowledge.indexes.coverageByCategoryId.size).toBe(55);
    expect(result.knowledge.schema.$id).toBe("urn:taig:cisco-command-dataset:1.0.0");
  });

  it("traverses task to workflow to command, source, and coverage without rendering syntax", async () => {
    const result = await loadKnowledgePackage();
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    const traced = traceTask(result.knowledge, "task-locate-mac");
    expect(traced.ok).toBe(true);
    if (!traced.ok) {
      return;
    }
    expect(traced.trace.task.task_id).toBe("task-locate-mac");
    expect(traced.trace.coverage).toMatchObject({
      category_id: "mac",
      status: "seed_partial",
    });
    expect(traced.trace.workflows).toHaveLength(1);
    const workflow = traced.trace.workflows[0];
    expect(workflow.workflow.workflow_id).toBe("locate-mac");
    const verification = workflow.phases.find((phase) => phase.phase === "verification");
    expect(verification?.relationshipType).toBe("uses_in_verification");
    expect(verification?.steps.map((step) => step.command.command_id)).toEqual([
      "mac-address",
      "mac-interface",
      "show-status",
    ]);
    const macStep = verification?.steps[0];
    expect(macStep?.command.syntax).toBe("show mac address-table address <mac>");
    expect(macStep?.parameter_values).toEqual({ mac: "0011.2233.4455" });
    expect(macStep?.command.example).toBe("show mac address-table address 0011.2233.4455");
    expect(macStep && "renderedCommand" in macStep).toBe(false);
    expect(macStep?.sources.length).toBeGreaterThan(0);
    expect(macStep?.sources[0].source_id).toBe(macStep?.command.source_ids[0]);
    const configuration = workflow.phases.find((phase) => phase.phase === "configuration");
    expect(configuration?.steps).toEqual([]);
  });

  it("does not resolve aliases as task identifiers", async () => {
    const result = await loadKnowledgePackage();
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    const traced = traceTask(result.knowledge, "which switch port is a MAC on");
    expect(traced.ok).toBe(false);
    if (traced.ok) {
      return;
    }
    expect(traced.error.code).toBe("UNRESOLVED_REFERENCE");
  });
});

describe("negative knowledge fixtures", () => {
  it("accepts a minimal valid fixture", async () => {
    const directory = await tempFixture();
    const result = await loadKnowledgePackage({ packageRoot: directory });
    expect(result.ok).toBe(true);
  });

  it("reports a missing required file", async () => {
    const directory = await tempFixture();
    await rm(path.join(directory, "Cisco_Command_Dataset.json"));
    const result = await loadKnowledgePackage({ packageRoot: directory });
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expectCode(result.errors, "MISSING_FILE");
  });

  it("reports invalid JSON", async () => {
    const directory = await tempFixture();
    await writeFile(path.join(directory, "Cisco_Task_Workflows.json"), "{", "utf8");
    await refreshManifest(directory);
    const result = await loadKnowledgePackage({ packageRoot: directory });
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expectCode(result.errors, "INVALID_JSON");
  });

  it("reports schema mismatch", async () => {
    const directory = await tempFixture((draft) => {
      const command = (draft.dataset.commands as Array<Record<string, unknown>>)[0];
      delete command.syntax;
    });
    const result = await loadKnowledgePackage({ packageRoot: directory });
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expectCode(result.errors, "SCHEMA_MISMATCH");
  });

  it("reports a duplicate identifier", async () => {
    const directory = await tempFixture((draft) => {
      const commands = draft.dataset.commands as unknown[];
      commands.push(structuredClone(commands[0]));
    });
    const result = await loadKnowledgePackage({ packageRoot: directory });
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expectCode(result.errors, "DUPLICATE_IDENTIFIER");
  });

  it("reports a missing referenced task", async () => {
    const directory = await tempFixture((draft) => {
      const command = (draft.dataset.commands as Array<Record<string, unknown>>)[0];
      command.task_ids = ["task-missing"];
    });
    const result = await loadKnowledgePackage({ packageRoot: directory });
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expectCode(result.errors, "MISSING_REFERENCED_TASK");
  });

  it("reports a missing referenced workflow", async () => {
    const directory = await tempFixture((draft) => {
      const task = (draft.dataset.tasks as Array<Record<string, unknown>>)[0];
      task.workflow_ids = ["wf-missing"];
    });
    const result = await loadKnowledgePackage({ packageRoot: directory });
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expectCode(result.errors, "MISSING_REFERENCED_WORKFLOW");
  });

  it("reports a missing referenced command", async () => {
    const directory = await tempFixture((draft) => {
      const workflow = (draft.dataset.task_workflows as Array<Record<string, unknown>>)[0];
      const phases = workflow.phases as Record<string, Array<Record<string, unknown>>>;
      phases.configuration[0].command_id = "missing-command";
      const relationship = (draft.dataset.relationships as Array<Record<string, unknown>>)[0];
      relationship.to_id = "missing-command";
    });
    const result = await loadKnowledgePackage({ packageRoot: directory });
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expectCode(result.errors, "MISSING_REFERENCED_COMMAND");
  });

  it("reports a malformed command", async () => {
    const directory = await tempFixture((draft) => {
      const command = (draft.dataset.commands as Array<Record<string, unknown>>)[0];
      command.verification_command_ids = "show-vlan";
    });
    const result = await loadKnowledgePackage({ packageRoot: directory });
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expectCode(result.errors, "MALFORMED_COMMAND");
  });

  it("reports an unresolved category reference", async () => {
    const directory = await tempFixture((draft) => {
      const task = (draft.dataset.tasks as Array<Record<string, unknown>>)[0];
      task.category_id = "missing-category";
      const workflow = (draft.dataset.task_workflows as Array<Record<string, unknown>>)[0];
      workflow.task_category_id = "missing-category";
    });
    const result = await loadKnowledgePackage({ packageRoot: directory });
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expectCode(result.errors, "UNRESOLVED_REFERENCE");
  });

  it("reports invalid template metadata", async () => {
    const directory = await tempFixture((draft) => {
      const workflow = (draft.dataset.task_workflows as Array<Record<string, unknown>>)[0];
      const phases = workflow.phases as Record<string, Array<Record<string, unknown>>>;
      phases.configuration[0].parameter_values = { vlan_name: "users" };
    });
    const result = await loadKnowledgePackage({ packageRoot: directory });
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expectCode(result.errors, "INVALID_TEMPLATE_METADATA");
  });

  it("reports a missing source reference", async () => {
    const directory = await tempFixture((draft) => {
      const command = (draft.dataset.commands as Array<Record<string, unknown>>)[0];
      command.source_ids = ["S99"];
      command.source_evidence = [
        { source_id: "S99", section: "vlan", evidence_level: "documented_task_form" },
      ];
    });
    const result = await loadKnowledgePackage({ packageRoot: directory });
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expectCode(result.errors, "MISSING_SOURCE_REFERENCE");
  });

  it("reports malformed coverage", async () => {
    const directory = await tempFixture((draft) => {
      const item = (draft.coverage.coverage as Array<Record<string, unknown>>)[0];
      item.command_ids = ["not-a-command"];
      item.command_count = 1;
    });
    const result = await loadKnowledgePackage({ packageRoot: directory });
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expectCode(result.errors, "MALFORMED_COVERAGE");
  });

  it("reports malformed known-gap data", async () => {
    const directory = await tempFixture((draft) => {
      draft.coverage.unresolved = { gap: true };
    });
    const result = await loadKnowledgePackage({ packageRoot: directory });
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expectCode(result.errors, "MALFORMED_KNOWN_GAP");
  });

  it("reports an inconsistent manifest hash", async () => {
    const directory = await tempFixture();
    const manifestPath = path.join(directory, "MANIFEST.json");
    const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as {
      files: Array<{ sha256: string }>;
    };
    manifest.files[0].sha256 = "0".repeat(64);
    await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
    const result = await loadKnowledgePackage({ packageRoot: directory });
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expectCode(result.errors, "INCONSISTENT_MANIFEST");
  });

  it("reports projection drift as an internal inconsistency", async () => {
    const directory = await tempFixture();
    const taxonomyPath = path.join(directory, "Cisco_Task_Intent_Taxonomy.json");
    const taxonomy = JSON.parse(await readFile(taxonomyPath, "utf8")) as {
      tasks: Array<{ title: string }>;
    };
    taxonomy.tasks[0].title = "Changed outside the canonical dataset";
    await writeFile(taxonomyPath, `${JSON.stringify(taxonomy, null, 2)}\n`, "utf8");
    await refreshManifest(directory);
    const result = await loadKnowledgePackage({ packageRoot: directory });
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expectCode(result.errors, "INTERNAL_INCONSISTENCY");
  });
});
