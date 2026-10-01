import { describe, expect, it } from "vitest";
import { loadEngineerPortal } from "../lib/portal/load";
import { runTaskProcedure } from "../lib/portal/run";
import { applyRun, beginGeneration, changeInput, emptyFormSession, selectTask } from "../lib/portal/session";
import type { ProcedureRun } from "../lib/portal/types";

const PROOF_FIELDS = {
  "task-locate-mac": ["mac", "interface", "vlan_id"],
  "task-interface-drops": ["interface"],
  "task-lacp-check": ["group"],
  "task-add-trunk-vlan": ["interface", "vlan_list", "vlan_id"],
} as const;

function commands(run: ProcedureRun, phase: string): string[] {
  expect(run.kind).toBe("GENERATED");
  if (run.kind !== "GENERATED") {
    return [];
  }
  return run.procedure.sections.find((section) => section.phase === phase)?.steps.map((step) => step.renderedCommand) ?? [];
}

describe("dynamic task form and procedure generation", () => {
  it("derives proof-task fields from the input contract", async () => {
    const portal = await loadEngineerPortal();
    expect(portal.state).toBe("READY");
    if (portal.state !== "READY") {
      return;
    }
    expect(Object.keys(portal.forms)).toHaveLength(12);
    expect(portal.forms["task-command-reload"]).toBeUndefined();
    for (const [taskId, keys] of Object.entries(PROOF_FIELDS)) {
      const form = portal.forms[taskId];
      expect(form?.state).toBe("FORM");
      expect(form?.fields.map((field) => field.inputKey)).toEqual(keys);
      expect(form?.fields.every((field) => field.description.length > 0)).toBe(true);
      expect(form?.fields.every((field) => field.requirement === "required")).toBe(true);
      expect(form?.deviceExecutionAuthorized).toBe(false);
    }
  });

  it("blocks generation until required inputs are present", async () => {
    const run = await runTaskProcedure("task-locate-mac", { mac: "aabb.ccdd.eeff" });
    expect(run.kind).toBe("VALIDATION");
    expect(run.procedure).toBeNull();
    if (run.kind !== "VALIDATION") {
      return;
    }
    expect(run.validation.state).toBe("NEEDS_INPUT");
    expect(run.validation.missing.map((item) => item.inputKey)).toEqual(["interface", "vlan_id"]);
    expect(run.validation.deviceExecutionAuthorized).toBe(false);
    expect(JSON.stringify(run)).not.toContain("show mac address-table");
  });

  it("generates the four proof procedures from engineer strings", async () => {
    const locate = await runTaskProcedure("task-locate-mac", {
      mac: "aabb.ccdd.eeff",
      interface: "Gi1/0/24",
      vlan_id: "30",
    });
    expect(locate.kind).toBe("GENERATED");
    if (locate.kind !== "GENERATED") {
      return;
    }
    expect(locate.validation.state).toBe("READY");
    expect(locate.procedure.deviceExecutionAuthorized).toBe(false);
    expect(locate.procedure.sections.map((section) => section.phase)).toEqual([
      "pre_check",
      "configuration",
      "verification",
      "troubleshooting",
    ]);
    expect(locate.procedure.configurationRequired).toBe(false);
    expect(commands(locate, "configuration")).toEqual([]);
    const locateCommands = locate.procedure.sections.flatMap((section) => section.steps.map((step) => step.renderedCommand));
    expect(locateCommands.join("\n")).toContain("aabb.ccdd.eeff");
    expect(locateCommands.join("\n")).toContain("Gi1/0/24");
    expect(locateCommands.join("\n")).toContain("30");
    expect(locateCommands.join("\n")).not.toContain("GigabitEthernet1/0/10");
    expect(locate.procedure.support.taskCoverageStatus).toBe("seed_partial");
    expect(locate.procedure.support.completenessClaim).toBe(false);
    expect(locate.procedure.support.labValidation).toBe(false);
    expect(locate.procedure.validationStatus).toBe("documentation_reviewed_not_device_tested");
    expect(locate.procedure.engineerInputs.map((input) => input.acceptedValue)).toEqual([
      "aabb.ccdd.eeff",
      "Gi1/0/24",
      "30",
    ]);
    expect(locate.procedure.sections.find((section) => section.phase === "troubleshooting")?.steps.every((step) => step.normalPath === false)).toBe(true);
    expect(locate.procedure.sources.length).toBeGreaterThan(0);

    const drops = await runTaskProcedure("task-interface-drops", { interface: "Gi1/0/24" });
    const dropCommands = commands(drops, "verification").concat(commands(drops, "troubleshooting"));
    expect(dropCommands.filter((command) => command.includes("Gi1/0/24")).length).toBeGreaterThan(1);
    expect(commands(drops, "configuration")).toEqual([]);

    const lacp = await runTaskProcedure("task-lacp-check", { group: "5" });
    expect(commands(lacp, "verification")).toContain("show etherchannel 5 detail");

    const trunk = await runTaskProcedure("task-add-trunk-vlan", {
      interface: "Gi1/0/48",
      vlan_list: "30,40",
      vlan_id: "30",
    });
    expect(trunk.kind).toBe("GENERATED");
    if (trunk.kind !== "GENERATED") {
      return;
    }
    expect(trunk.procedure.activityEvidence).toBe("configuration_changing");
    expect(trunk.procedure.configurationRequired).toBe(true);
    expect(commands(trunk, "configuration")).toEqual([
      "configure terminal",
      "interface Gi1/0/48",
      "switchport trunk allowed vlan add 30,40",
      "end",
    ]);
    expect(trunk.procedure.rollback.strategy).toBe("remove_only_new_addition");
    expect(trunk.procedure.rollback.instructions.join("\n")).not.toContain("no switchport");
    expect(trunk.procedure.deviceExecutionAuthorized).toBe(false);
  });

  it("does not open procedure generation for a command-only task", async () => {
    const run = await runTaskProcedure("task-command-reload", {});
    expect(run.kind).toBe("VALIDATION");
    expect(run.procedure).toBeNull();
    if (run.kind !== "VALIDATION") {
      return;
    }
    expect(run.validation.state).toBe("UNSUPPORTED_VALIDATION");
  });

  it("fails closed when the knowledge package cannot load", async () => {
    const run = await runTaskProcedure("task-locate-mac", { mac: "aabb.ccdd.eeff", interface: "Gi1/0/24", vlan_id: "30" }, {
      packageRoot: "C:\\missing-knowledge-aci-008",
    });
    expect(run.kind).toBe("DATA_ERROR");
    expect(run.procedure).toBeNull();
    if (run.kind !== "DATA_ERROR") {
      return;
    }
    expect(run.errors.length).toBeGreaterThan(0);
    expect(JSON.stringify(run)).not.toContain("show mac address-table");
  });

  it("resets form values on task change and drops a stale procedure", () => {
    let session = selectTask(emptyFormSession(), "task-locate-mac");
    session = changeInput(session, "mac", "aabb.ccdd.eeff");
    const generated: ProcedureRun = {
      kind: "GENERATED",
      validation: {
        state: "READY",
        taskId: "task-locate-mac",
        missing: [],
        invalid: [],
        conflicts: [],
        unknownInputs: [],
        unsupported: [],
        deviceExecutionAuthorized: false,
      },
      procedure: {
        taskId: "task-locate-mac",
        taskTitle: "Locate an endpoint MAC address",
        activityEvidence: "read_only",
        configurationRequired: false,
        deviceExecutionAuthorized: false,
        procedureGenerated: true,
        workflowId: "locate-mac",
        workflowTitle: "Locate MAC",
        platformBoundary: "boundary",
        validationStatus: "documentation_reviewed_not_device_tested",
        rollback: { strategy: "none_read_only", instructions: [] },
        engineerInputs: [],
        sections: [],
        warnings: [],
        sources: [],
        environment: {
          primaryBoundary: { platform: "Catalyst 9300", software: "IOS XE", release: "17.15.x" },
          workflowPlatformBoundaries: [],
          excludedSoftware: [],
        },
        support: {
          packageStatus: "PARTIAL",
          completenessClaim: false,
          labValidation: false,
          taskCoverageStatus: "seed_partial",
          validationStatus: "documentation_reviewed_not_device_tested",
          knownGaps: [],
        },
      },
    };
    const started = beginGeneration(session);
    session = applyRun(started.session, generated, started.generationId);
    expect(session.status).toBe("GENERATED");

    const edited = changeInput(session, "mac", "0011.2233.4455");
    expect(edited.result).toBeNull();
    expect(edited.status).toBe("FORM_READY");
    expect(edited.values.mac).toBe("0011.2233.4455");

    const stale = applyRun(edited, generated, started.generationId);
    expect(stale.result).toBeNull();

    const replaced = applyRun(
      session,
      {
        kind: "DATA_ERROR",
        errors: [{ code: "PACKAGE_UNREADABLE", message: "The knowledge package could not be read." }],
        procedure: null,
        deviceExecutionAuthorized: false,
      },
      session.generationId,
    );
    expect(replaced.status).toBe("DATA_ERROR");
    expect(replaced.result?.kind).toBe("DATA_ERROR");
    expect(replaced.result?.procedure).toBeNull();

    const switched = selectTask(edited, "task-interface-drops");
    expect(switched.taskId).toBe("task-interface-drops");
    expect(switched.values).toEqual({});
    expect(switched.result).toBeNull();
  });
});
