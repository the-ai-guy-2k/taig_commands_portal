# TAIG Command Portal

Cisco-only, guidance-only portal foundation. Capability 1 loads and validates the local Cisco command research package in `cisco_command_results/Results`. Capability 2 catalogs those tasks and resolves task identity.

Engineering knowledge stays in that package. The loader lives in `lib/knowledge`. Task catalog and resolution live in `lib/tasks` and call the loader. The home page reports load status, catalog counts, and the initial proof set. It does not generate procedures.

- Knowledge contract: `docs/cisco-knowledge-contract.md`
- Task resolution: `docs/task-resolution.md`
- Initial task candidates: `docs/candidate-initial-tasks.md`
- Tests: `npm test`
