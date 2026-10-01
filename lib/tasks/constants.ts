export const INITIAL_VERTICAL_SLICE_TASK_IDS = [
  "task-locate-mac",
  "task-interface-drops",
  "task-lacp-check",
  "task-add-trunk-vlan",
] as const;

export const READ_ONLY_ROLLBACK_STRATEGY = "none_read_only";

export const TASK_COVERAGE_WORKFLOW_BACKED = "seed_partial";
export const TASK_COVERAGE_COMMAND_ONLY = "command_only";
