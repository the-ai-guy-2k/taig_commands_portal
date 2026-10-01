import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const REAL_SCHEMA = path.join(
  process.cwd(),
  "cisco_command_results",
  "Results",
  "Cisco_Command_Dataset.schema.json",
);

export interface FixtureDraft {
  dataset: Record<string, unknown>;
  coverage: Record<string, unknown>;
}

export function createValidFixtureDraft(): FixtureDraft {
  const metadata = {
    aci: "FIXTURE",
    schema_version: "1.0.0",
    dataset_version: "0.0.1-fixture",
    generated_at: "2026-10-01",
    status: "PARTIAL",
    completeness_claim: false,
    coverage_boundary: "fixture",
    command_count: 1,
    workflow_count: 1,
    taxonomy_feature_group_count: 1,
    source_count: 1,
    lab_validation: false,
  };

  const dataset = {
    metadata,
    task_categories: [
      {
        category_id: "core",
        parent_id: null,
        label: "Operate and inspect a device",
        type: "task_partition",
        coverage_status: "design_only",
      },
      {
        category_id: "vlan",
        parent_id: "core",
        label: "VLANs and access ports",
        type: "feature_task_group",
        coverage_status: "seed_partial",
      },
    ],
    tasks: [
      {
        task_id: "task-access",
        title: "Configure an access VLAN",
        category_id: "vlan",
        aliases: ["access vlan"],
        workflow_ids: ["wf-access"],
        coverage_status: "seed_partial",
      },
    ],
    command_families: [
      {
        family_id: "VLAN",
        label: "VLAN",
        command_ids: ["vlan"],
        source_ids: ["S01"],
        coverage_status: "seed_partial",
      },
    ],
    commands: [
      {
        command_id: "vlan",
        command: "vlan <vlan_id>",
        canonical_family: "VLAN",
        task_ids: ["task-access"],
        task_category_id: "vlan",
        technology: "VLAN",
        intent: "Create a VLAN",
        platform_family: ["Catalyst 9300"],
        software_family: "Cisco IOS XE",
        version_notes: "fixture",
        device_feature_context: "fixture",
        cli_modes: ["Global Configuration"],
        entry_context: null,
        syntax: "vlan <vlan_id>",
        syntax_scope: "Bounded fixture form",
        syntax_elements: [
          {
            name: "vlan_id",
            description: "VLAN id",
            required: true,
            range: null,
          },
        ],
        description: "Create a VLAN",
        when_to_use: "Create a VLAN",
        prerequisites: [],
        example: "vlan 20",
        example_type: "fixture",
        verification_command_ids: [],
        expected_output: ["VLAN is present"],
        troubleshooting_command_ids: [],
        related_command_ids: [],
        negation_removal: null,
        rollback_notes: "No generic rollback asserted.",
        operational_risk: {
          effect: "persistent_configuration",
          level: "high",
          caution: null,
        },
        source_ids: ["S01"],
        source_evidence: [
          {
            source_id: "S01",
            section: "vlan",
            evidence_level: "documented_task_form",
          },
        ],
        source_version: "fixture",
        aliases: [],
        deprecated_status: "not_established",
        support_status: "documented_in_source_boundary_only",
        validation_status: "documentation_reviewed_not_device_tested",
        last_reviewed: "2026-10-01",
        notes: [],
      },
    ],
    task_workflows: [
      {
        workflow_id: "wf-access",
        task_id: "task-access",
        title: "Configure an access VLAN",
        task_category_id: "vlan",
        intent_aliases: ["access vlan"],
        platform_boundary: "Catalyst 9300 / IOS XE 17.15.x",
        prerequisites: ["Port is an endpoint port."],
        phases: {
          pre_check: [],
          configuration: [
            {
              command_id: "vlan",
              parameter_values: { vlan_id: 20 },
              note: null,
            },
          ],
          verification: [],
          troubleshooting: [],
        },
        expected_results: ["VLAN exists."],
        decision_branches: [],
        rollback: {
          strategy: "restore_prior_values",
          instructions: ["Restore the prior VLAN state."],
        },
        source_ids: ["S01"],
        authorship: "Fixture synthesis",
        validation_status: "documentation_reviewed_not_device_tested",
      },
    ],
    relationships: [
      {
        from_id: "task-access",
        to_id: "vlan",
        type: "uses_in_configuration",
        workflow_id: "wf-access",
      },
    ],
    sources: [
      {
        source_id: "S01",
        title: "Fixture command reference",
        url: "https://www.cisco.com/c/en/us/td/docs/example.html",
        publisher: "Cisco",
        source_type: "command_reference",
        platform_boundary: "Catalyst 9300",
        release_boundary: "IOS XE 17.15.x",
        retrieved_at: "2026-10-01",
        evidence_ref: "fixture",
        review_scope: "Fixture only",
        notes: "",
      },
    ],
    platform_version_metadata: {
      primary_boundary: {
        platform: "Catalyst 9300",
        software: "IOS XE",
        release: "17.15.x",
      },
      excluded_software: ["NX-OS", "ASA", "IOS XR"],
      selection_rule: "Exact source boundary first.",
      null_policy: "Unknown or not established; null is not false.",
    },
  };

  const coverage = {
    metadata,
    coverage: [
      {
        category_id: "vlan",
        label: "VLANs and access ports",
        status: "seed_partial",
        command_count: 1,
        workflow_count: 1,
        command_ids: ["vlan"],
      },
    ],
    next_partition: {
      priority: 1,
      name: "Fixture partition",
      acceptance_criteria: ["Remain a fixture."],
    },
    unresolved: ["Fixture gap remains unresolved."],
  };

  return { dataset, coverage };
}

function syncDeclaredCounts(draft: FixtureDraft): void {
  const dataset = draft.dataset;
  const metadata = dataset.metadata as Record<string, unknown>;
  const commands = dataset.commands as unknown[];
  const workflows = dataset.task_workflows as unknown[];
  const sources = dataset.sources as unknown[];
  const categories = dataset.task_categories as Array<Record<string, unknown>>;
  const featureCount = categories.filter((category) => category.type === "feature_task_group").length;
  metadata.command_count = commands.length;
  metadata.workflow_count = workflows.length;
  metadata.source_count = sources.length;
  metadata.taxonomy_feature_group_count = featureCount;
  draft.coverage.metadata = metadata;
}

async function writeJson(directory: string, filename: string, value: unknown): Promise<void> {
  await writeFile(path.join(directory, filename), `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

export async function writeKnowledgeFixture(directory: string, mutate?: (draft: FixtureDraft) => void): Promise<void> {
  const draft = createValidFixtureDraft();
  mutate?.(draft);
  syncDeclaredCounts(draft);
  await mkdir(directory, { recursive: true });
  const schema = await readFile(REAL_SCHEMA, "utf8");
  await writeFile(path.join(directory, "Cisco_Command_Dataset.schema.json"), schema, "utf8");
  await writeJson(directory, "Cisco_Command_Dataset.json", draft.dataset);
  await writeJson(directory, "Cisco_Task_Intent_Taxonomy.json", {
    metadata: draft.dataset.metadata,
    task_categories: draft.dataset.task_categories,
    tasks: draft.dataset.tasks,
  });
  await writeJson(directory, "Cisco_Task_Workflows.json", {
    metadata: draft.dataset.metadata,
    task_workflows: draft.dataset.task_workflows,
    relationships: draft.dataset.relationships,
  });
  await writeJson(directory, "Cisco_Source_Index.json", {
    metadata: draft.dataset.metadata,
    sources: draft.dataset.sources,
  });
  await writeJson(directory, "Cisco_Coverage_Known_Gaps.json", draft.coverage);
  await refreshManifest(directory);
}

export async function refreshManifest(directory: string): Promise<void> {
  const dataset = JSON.parse(await readFile(path.join(directory, "Cisco_Command_Dataset.json"), "utf8")) as {
    metadata: Record<string, unknown>;
  };
  const filenames = [
    "Cisco_Command_Dataset.json",
    "Cisco_Command_Dataset.schema.json",
    "Cisco_Task_Intent_Taxonomy.json",
    "Cisco_Task_Workflows.json",
    "Cisco_Source_Index.json",
    "Cisco_Coverage_Known_Gaps.json",
  ];
  const files = [];
  for (const filename of filenames) {
    const bytes = await readFile(path.join(directory, filename));
    files.push({
      filename,
      size_bytes: bytes.length,
      sha256: createHash("sha256").update(bytes).digest("hex"),
    });
  }
  await writeJson(directory, "MANIFEST.json", {
    metadata: dataset.metadata,
    validation: {
      json_parse: "fixture",
      json_schema_contract: "fixture",
    },
    files,
  });
}
