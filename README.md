# TAIG Command Portal

Cisco-only, guidance-only portal foundation. Capability 1 loads and validates the local Cisco command research package in `cisco_command_results/Results`.

Engineering knowledge stays in that package. Loader, schema, and integrity code live in `lib/knowledge`. The home page reports load status and package version only.

- Knowledge contract: `docs/cisco-knowledge-contract.md`
- Initial task candidates: `docs/candidate-initial-tasks.md`
- Tests: `npm test`
