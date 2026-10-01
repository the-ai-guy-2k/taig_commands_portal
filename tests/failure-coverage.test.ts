import { describe, expect, it } from "vitest";
import {
  fieldIssue,
  packageCoverageFacts,
  presentLoaderFailure,
  presentProcedureRun,
  presentSearchMiss,
  presentTaskResolution,
  presentValidation,
  sourceBoundaryNote,
} from "../lib/coverage/present";
import { validateTaskInputs } from "../lib/inputs";
import type { InputDiscoveryResult } from "../lib/inputs/types";
import type { ProcedureRun, ValidationView } from "../lib/portal/types";
import type { TaskResolution } from "../lib/tasks/types";

const rangeContract: InputDiscoveryResult = {
  ok: true,
  contract: {
    taskId: "fixture-range",
    workflowIds: ["fixture"],
    workflowAvailability: "present",
    platformBoundaries: ["Catalyst 9300 / IOS XE 17.15.x"],
    excludedSoftware: ["NX-OS", "ASA", "IOS XR"],
    deviceExecutionAuthorized: false,
    inputs: [
      {
        inputKey: "vlan_id",
        parameterName: "vlan_id",
        requirement: "required",
        description: "VLAN identifier",
        range: "source declared a range",
        exampleValue: 20,
        uses: [],
        validation: {
          presence: "supported",
          valueShape: "string_or_finite_number",
          range: "declared_unevaluable",
          format: "not_established",
          enumeration: "not_established",
          crossField: "not_established",
        },
      },
    ],
  },
};

function validationView(overrides: Partial<ValidationView> & Pick<ValidationView, "state">): ValidationView {
  return {
    taskId: "task-locate-mac",
    missing: [],
    invalid: [],
    conflicts: [],
    unknownInputs: [],
    unsupported: [],
    deviceExecutionAuthorized: false,
    ...overrides,
  };
}

describe("failure and coverage presentation", () => {
  it("explains package limits without calling them load failures", () => {
    const facts = packageCoverageFacts({
      status: "PARTIAL",
      completenessClaim: false,
      labValidation: false,
      validationStatus: "documentation_reviewed_not_device_tested",
      platform: "Catalyst 9300",
      software: "IOS XE",
      release: "17.15.x",
      excludedSoftware: ["NX-OS", "ASA", "IOS XR"],
    });
    const byLabel = Object.fromEntries(facts.map((fact) => [fact.label, fact]));
    expect(byLabel.Status.value).toBe("PARTIAL");
    expect(byLabel["Completeness claim"].value).toBe("false");
    expect(byLabel["Completeness claim"].meaning).toContain("not a load failure");
    expect(byLabel["Lab validation"].value).toBe("false");
    expect(byLabel["Lab validation"].meaning).toContain("not been lab validated");
    expect(byLabel["Validation status"].value).toBe("documentation_reviewed_not_device_tested");
    expect(byLabel["Excluded software"].value).toContain("NX-OS");
  });

  it("names missing fields for NEEDS_INPUT and does not invent a VLAN range", () => {
    const notice = presentValidation(
      validationView({
        state: "NEEDS_INPUT",
        missing: [
          { inputKey: "mac", parameterName: "mac" },
          { inputKey: "interface", parameterName: "interface" },
        ],
      }),
    );
    expect(notice.headline).toBe("Required information is missing");
    expect(notice.explanation).toContain("task-locate-mac");
    expect(notice.explanation).toContain("mac, interface");
    expect(notice.procedureVisible).toBe(false);
    expect(notice.explanation).not.toContain("1–4094");
    expect(fieldIssue(validationView({
      state: "NEEDS_INPUT",
      missing: [{ inputKey: "mac", parameterName: "mac" }],
    }), "mac")?.message).toContain("NEEDS_INPUT");
  });

  it("keeps INVALID_INPUT to the backend reason", () => {
    const notice = presentValidation(
      validationView({
        state: "INVALID_INPUT",
        invalid: [{ inputKey: "vlan_id", message: "vlan_id must be a non-empty string or a finite number. No further Cisco format rule is established." }],
      }),
    );
    expect(notice.headline).toContain("established rule");
    expect(notice.explanation).toContain("No further Cisco format rule is established.");
    expect(notice.explanation).not.toMatch(/1–4094|must be 1/);
    expect(notice.procedureVisible).toBe(false);
  });

  it("does not label an unevaluable constraint as invalid", () => {
    const validated = validateTaskInputs(rangeContract, { vlan_id: "30" });
    expect(validated.state).toBe("UNSUPPORTED_VALIDATION");
    const notice = presentValidation({
      state: validated.state,
      taskId: validated.taskId,
      missing: validated.missing,
      invalid: validated.invalid,
      conflicts: validated.conflicts,
      unknownInputs: validated.unknownInputs,
      unsupported: validated.unsupported,
      deviceExecutionAuthorized: false,
    });
    expect(notice.headline).toBe("Validation is not established");
    expect(notice.explanation).toContain("not marked invalid");
    expect(notice.explanation).toContain("vlan_id range");
    expect(notice.explanation.toLowerCase()).not.toContain("violates");
    expect(fieldIssue({
      state: validated.state,
      taskId: validated.taskId,
      missing: validated.missing,
      invalid: [{ inputKey: "vlan_id", message: "should not be shown" }],
      conflicts: [],
      unknownInputs: [],
      unsupported: validated.unsupported,
      deviceExecutionAuthorized: false,
    }, "vlan_id")).toBeNull();
  });

  it("lists ambiguous candidates and does not choose one", () => {
    const resolution: TaskResolution = {
      state: "AMBIGUOUS",
      normalizedInput: "show",
      match: "alias",
      candidates: [
        { taskId: "task-a", title: "Alpha" },
        { taskId: "task-b", title: "Beta" },
      ],
    };
    const notice = presentTaskResolution(resolution);
    expect(notice.explanation).toContain("task-a");
    expect(notice.explanation).toContain("task-b");
    expect(notice.nextAction).toContain("Select one specific task");
    expect(notice.procedureVisible).toBe(false);
    expect(notice.technicalDetail).not.toContain("RESOLVED");
  });

  it("separates a missing task from excluded software", () => {
    const missing = presentTaskResolution({
      state: "UNSUPPORTED",
      normalizedInput: "no-such-task",
      reason: "no_match",
      matchedExclusion: null,
    });
    const excluded = presentTaskResolution({
      state: "UNSUPPORTED",
      normalizedInput: "nx-os",
      reason: "excluded_software",
      matchedExclusion: "NX-OS",
    });
    expect(missing.headline).toBe("No matching catalog task");
    expect(excluded.headline).toBe("This software context is excluded");
    expect(excluded.explanation).toContain("NX-OS");
    expect(missing.headline).not.toBe(excluded.headline);
  });

  it("blocks DATA_ERROR and incomplete procedures without showing a procedure", () => {
    const dataError: ProcedureRun = {
      kind: "DATA_ERROR",
      errors: [{ code: "PACKAGE_UNREADABLE", message: "The knowledge package could not be read." }],
      procedure: null,
      deviceExecutionAuthorized: false,
    };
    const incomplete: ProcedureRun = {
      kind: "BLOCKED",
      state: "INCOMPLETE_PROCEDURE",
      reason: "incomplete",
      messages: ["A required source is missing."],
      candidates: [],
      matchedExclusion: null,
      procedure: null,
      deviceExecutionAuthorized: false,
    };
    const dataNotice = presentProcedureRun(dataError);
    const incompleteNotice = presentProcedureRun(incomplete);
    expect(dataNotice.category).toBe("blocking");
    expect(dataNotice.procedureVisible).toBe(false);
    expect(dataNotice.explanation).toContain("PACKAGE_UNREADABLE");
    expect(incompleteNotice.headline).toBe("The procedure failed completeness checks");
    expect(incompleteNotice.procedureVisible).toBe(false);
    expect(incompleteNotice.explanation).toContain("A required source is missing.");
    expect(incompleteNotice.nextAction).toContain("Device execution remains unauthorized");
  });

  it("translates upstream states without hiding the earlier cause", () => {
    const notice = presentProcedureRun({
      kind: "BLOCKED",
      state: "UPSTREAM_NOT_READY",
      reason: "input_not_ready",
      messages: ["Validation was not READY."],
      candidates: [],
      matchedExclusion: null,
      procedure: null,
      deviceExecutionAuthorized: false,
    });
    expect(notice.headline).toBe("An earlier step was not ready");
    expect(notice.explanation).toContain("inputs were not ready");
    expect(notice.procedureVisible).toBe(false);
  });

  it("keeps a search miss distinct from a loader failure", () => {
    const search = presentSearchMiss("locate mac");
    const loader = presentLoaderFailure([{ code: "PACKAGE_UNREADABLE", message: "missing" }]);
    expect(search.explanation).toContain("locate mac");
    expect(search.explanation).toContain("no close match");
    expect(search.headline).toBe("No matching catalog task");
    expect(loader.headline).toBe("The knowledge base did not load safely");
    expect(loader.explanation).toContain("not the same as a search");
    expect(loader.category).toBe("blocking");
  });

  it("leaves a source on its own release when it is not the primary boundary", () => {
    const note = sourceBoundaryNote(
      { platformBoundary: "Legacy IOS", releaseBoundary: "12.2" },
      { platform: "Catalyst 9300", software: "IOS XE", release: "17.15.x" },
    );
    expect(note).toContain("not rewritten");
    expect(
      sourceBoundaryNote(
        { platformBoundary: "Catalyst 9300", releaseBoundary: "IOS XE 17.15.x" },
        { platform: "Catalyst 9300", software: "IOS XE", release: "17.15.x" },
      ),
    ).toBeNull();
  });
});
