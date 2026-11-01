# Task 4 Report

**Status:** Complete. Added safe local JSON settings, injectable `ILightDeviceClient`, and a verified, cancellable schedule runner. The runner validates verification before writes, serializes and spaces frames by at least 500 ms, polls at no more than 64 steps per interval, recalculates after slow writes, and preserves OFF-interval behavior.

**TDD evidence**
- **RED:** The focused persistence/runner filter initially failed to compile because the Task 4 settings, runner, and client interface did not exist.
- **GREEN:** The focused suites passed; final `dotnet test windows-light-control\LeadDynamic.sln` passed **50/50 tests**. Tests use fakes only and make no live hardware writes.

**Commit:** `b21bf1e` — `feat: add safe local schedule automation`

**Concerns:** No known implementation concerns. The installed .NET SDK emitted its existing preview-support notice; no hardware verification was attempted.

**Report:** `.superpowers\sdd\2026-11-01-lead-dynamic-windows\task-4-report.md`

## Fix round 1

**Findings addressed**
- Moved the last successful frame timestamp to runner-instance state, preserving the 500 ms minimum when the same runner is cancelled and restarted.
- Strengthened `RunAsync_UsesAtMost64StepsPerInterval` to count polling steps within a complete 64-minute interval (64 one-minute steps) and verify that the next schedule point is applied.

**Tests and commands**
- `RunAsync_PreservesFrameSpacingAfterCancellationAndRestart` — RED before the production fix: expected the restarted frame to be at least 500 ms later, but it was immediate (`Assert.True()` failed). GREEN in the runner suite.
- `RunAsync_UsesAtMost64StepsPerInterval` — verifies exactly 64 interval polling steps and the schedule-point change.
- `dotnet test windows-light-control\tests\LeadDynamic.Core.Tests\LeadDynamic.Core.Tests.csproj --filter "FullyQualifiedName~LightScheduleRunnerTests" --no-restore --logger "console;verbosity=minimal"` — **9 passed, 0 failed**.
- `dotnet test windows-light-control\LeadDynamic.sln --no-restore --logger "console;verbosity=minimal"` — **51 passed, 0 failed, 0 skipped** (2 seconds).
- `git diff --check` — passed with no whitespace errors.

**Self-review:** Timestamp access remains serialized by the existing run gate; it is updated only after a successful send. The strengthened bound test uses the fake time provider and fake device client; no live hardware commands were sent.

**Concerns:** No known logic concerns. The installed .NET SDK printed its existing preview-support notice.
