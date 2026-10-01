# TAIG Command Portal

Cisco-only, guidance-only portal foundation. Capability 1 loads the Cisco research package. Capability 2 resolves task identity. Capability 3 derives workflow input requirements and checks supplied values only against rules the package actually supports. Capability 4 resolves the workflow, ordered phases, and command references after input readiness.

Engineering knowledge stays in `cisco_command_results/Results`. The page does not read those files directly and does not render commands.

- Knowledge contract: `docs/cisco-knowledge-contract.md`
- Task resolution: `docs/task-resolution.md`
- Input validation: `docs/input-validation.md`
- Workflow resolution: `docs/workflow-resolution.md`
- Initial task candidates: `docs/candidate-initial-tasks.md`
- Tests: `npm test`
