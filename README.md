# TAIG Command Portal

Cisco-only, guidance-only portal foundation. Capability 1 loads the Cisco research package. Capability 2 resolves task identity. Capability 3 derives workflow input requirements and checks supplied values only against rules the package actually supports. Capability 4 resolves the workflow, ordered phases, and command references after input readiness. Capability 5 renders each command template with the validated engineer value. Capability 6 assembles the rendered workflow into a procedure without adding commands. Capability 7 gives the engineer a shell for discovering and selecting catalog tasks. Capability 8 adds a dynamic input form and procedure view for a selected workflow-backed task. The form is driven by the input contract. The procedure is produced by the accepted backend pipeline. Command-only tasks do not get a generation form. Capability 9 presents package, task, and failure states in engineer language without changing those backend states.

Engineering knowledge stays in `cisco_command_results/Results`. The page does not read those files directly.

- Knowledge contract: `docs/cisco-knowledge-contract.md`
- Task resolution: `docs/task-resolution.md`
- Input validation: `docs/input-validation.md`
- Workflow resolution: `docs/workflow-resolution.md`
- Command rendering: `docs/command-rendering.md`
- Procedure generation: `docs/procedure-generation.md`
- Engineer UI shell: `docs/engineer-ui-shell.md`
- Task form and procedure view: `docs/task-form-procedure-view.md`
- Failure and coverage UX: `docs/failure-coverage-ux.md`
- Initial task candidates: `docs/candidate-initial-tasks.md`
- Tests: `npm test`
