# Lead Dynamic Windows Light Control Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a polished Russian-language Windows x64 desktop app for editing and running smooth daily schedules on the user's Lead Dynamic PDC aquarium light.

**Architecture:** Keep the new WPF app isolated under `windows-light-control/` from the existing TypeScript application. Put schedule calculation, protocol encoding, TCP writes, persistence, and schedule orchestration in a testable .NET core library; use WPF for the Russian schedule editor and explicit safety/connection workflow.

**Tech Stack:** C#, .NET 10 LTS, WPF, `TcpClient`/`NetworkStream`, `System.Text.Json`, xUnit; self-contained Windows x64 publish; no third-party UI or runtime dependencies.

**Spec:** [2026-11-01-lead-dynamic-windows-design.md](../specs/2026-11-01-lead-dynamic-windows-design.md)

## Global Constraints
- Keep all new product files inside `windows-light-control/`; do not modify the existing TypeScript app.
- Target .NET 10 LTS and Windows x64; publish self-contained so Java and a separately installed .NET runtime are not required.
- Use the authorized source repository at commit `27160d2a74525f143face02d89ac4f9799e26455` as the protocol/schedule reference; do not include its Linux JNI layer.
- Default to `10.10.100.254:8899`, but let the user edit the endpoint.
- Preserve brightness `0..64`, warmth `0..32`, the source's 12-byte TCP frame, command codes, checksum, and 500 ms minimum between frames.
- A TCP connection test is not device verification. Only an explicit user-initiated test write followed by physical-response confirmation enables automation for that endpoint and device ID.
- Enforce device verification in the scheduling service/core workflow, not only by disabling a user-interface button; verification must match the configured endpoint and device ID.
- Do not send live-device commands automatically during startup, tests, or development; do not claim a write was physically acknowledged.
- Store app settings and schedule locally. Surface failures; never silently report a successful connection or command.
- Use a calm, polished aquarium-inspired design with Russian labels, clear typography, deep-blue/teal accents, and readable contrast.
- Any Git commit must include `Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>`.

## Review Focus
- **Bad device IDs, values, malformed schedules, and duplicate point times** must be rejected before any network write; pin in validation and frame-encoder tests (Tasks 2–3).
- **Connection success versus actual device response** must remain distinct, and schedule start must stay locked until explicit physical confirmation; pin command gating in workflow tests (Tasks 4–5).
- **Midnight wraparound and exact target boundaries** must choose the correct daily interval and interpolated values; pin in evaluator tests (Task 2).
- **Slow or failed TCP writes and cancellation** must not overlap, queue stale interpolation steps, or leave the UI claiming the schedule is running; pin in runner tests (Task 4).
- **Corrupt, missing, or stale local settings** must not crash startup or silently enable a schedule; pin in persistence tests (Task 4).

---

## File Structure

- `windows-light-control/LeadDynamic.sln` — standalone solution.
- `windows-light-control/src/LeadDynamic.Core/LeadDynamic.Core.csproj` — testable domain and hardware-independent services.
- `windows-light-control/src/LeadDynamic.Core/Scheduling/SchedulePoint.cs` — target-point and light-state types.
- `windows-light-control/src/LeadDynamic.Core/Scheduling/ScheduleEvaluator.cs` — validation, daily interval lookup, and interpolation.
- `windows-light-control/src/LeadDynamic.Core/Protocol/LightCommand.cs` — command definitions and value ranges.
- `windows-light-control/src/LeadDynamic.Core/Protocol/LightCommandEncoder.cs` — source-compatible 12-byte frames and checksum.
- `windows-light-control/src/LeadDynamic.Core/Networking/TcpCommandClient.cs` — one TCP write per command frame with timeout and cancellation.
- `windows-light-control/src/LeadDynamic.Core/Networking/PdcCommandClient.cs` — endpoint-aware connection test and command-send facade.
- `windows-light-control/src/LeadDynamic.Core/Networking/ILightDeviceClient.cs` — injectable PDC client interface for scheduling and device-verification services.
- `windows-light-control/src/LeadDynamic.Core/Scheduling/LightScheduleRunner.cs` — serialized scheduled writes, step pacing, and cancellation.
- `windows-light-control/src/LeadDynamic.Core/Verification/DeviceVerificationService.cs` — explicit test-command and physical-confirmation gate.
- `windows-light-control/src/LeadDynamic.Core/Configuration/LightControlSettings.cs` — endpoint, device ID, schedule, and verification state.
- `windows-light-control/src/LeadDynamic.Core/Configuration/SettingsStore.cs` — local JSON persistence.
- `windows-light-control/src/LeadDynamic.App/LeadDynamic.App.csproj` — WPF `net10.0-windows` app referencing Core.
- `windows-light-control/src/LeadDynamic.App/App.xaml` — global colors, typography, and shared WPF styles.
- `windows-light-control/src/LeadDynamic.App/MainWindow.xaml` — Russian schedule-editor layout.
- `windows-light-control/src/LeadDynamic.App/MainWindow.xaml.cs` — WPF startup, window lifecycle, and composition root only.
- `windows-light-control/src/LeadDynamic.App/ViewModels/MainViewModel.cs` — editable rows, connection/test/start/stop actions, status, and errors.
- `windows-light-control/src/LeadDynamic.App/Models/SchedulePointViewModel.cs` — UI validation and presentation for one schedule point.
- `windows-light-control/tests/LeadDynamic.Core.Tests/LeadDynamic.Core.Tests.csproj` — xUnit test project.
- `windows-light-control/tests/LeadDynamic.Core.Tests/Scheduling/ScheduleEvaluatorTests.cs` — schedule validation and interpolation coverage.
- `windows-light-control/tests/LeadDynamic.Core.Tests/Protocol/LightCommandEncoderTests.cs` — exact protocol-byte and checksum assertions.
- `windows-light-control/tests/LeadDynamic.Core.Tests/Networking/TcpCommandClientTests.cs` — local loopback TCP success, timeout, and failure coverage without contacting the lamp.
- `windows-light-control/tests/LeadDynamic.Core.Tests/Scheduling/LightScheduleRunnerTests.cs` — gated starts, pacing, cancellation, and write failures using fakes.
- `windows-light-control/tests/LeadDynamic.Core.Tests/Verification/DeviceVerificationServiceTests.cs` — connection-vs-physical-verification workflow tests.
- `windows-light-control/tests/LeadDynamic.App.Tests/LeadDynamic.App.Tests.csproj` — WPF view-model test project.
- `windows-light-control/tests/LeadDynamic.App.Tests/MainViewModelTests.cs` — verification gating, editing, and visible status tests.
- `windows-light-control/tests/LeadDynamic.Core.Tests/Configuration/SettingsStoreTests.cs` — isolated temporary-directory persistence tests.
- `windows-light-control/README.md` — setup, safe first-use verification, scheduling, build, and publish instructions.
- `windows-light-control/.gitignore` — .NET/WPF build outputs local to this project.

## Interfaces

```csharp
public enum LightPower { On, Off }
public sealed record SchedulePoint(TimeOnly Time, LightPower Power, byte Brightness, byte Warmth);
public sealed record LightState(LightPower Power, byte Brightness, byte Warmth);
public sealed record LightControlSettings(
    string Host, int Port, string LightIdentifier,
    IReadOnlyList<SchedulePoint> Schedule,
    string? VerifiedHost, int? VerifiedPort, string? VerifiedLightIdentifier);

public static class ScheduleEvaluator
{
    public static IReadOnlyList<SchedulePoint> ValidateAndSort(
        IReadOnlyList<SchedulePoint> points);
    public static LightState EvaluateAt(
        IReadOnlyList<SchedulePoint> sortedPoints, TimeOnly time);
    public static SchedulePoint GetNextPoint(
        IReadOnlyList<SchedulePoint> sortedPoints, TimeOnly time);
}

public enum LightCommand { TurnOn, TurnOff, Brightness, Warmth }
public static class LightCommandEncoder
{
    public static byte[] Encode(string lightIdentifier, LightCommand command, int? value = null);
}

public interface ICommandTransport
{
    Task TestConnectionAsync(string host, int port, CancellationToken cancellationToken);
    Task SendAsync(string host, int port, ReadOnlyMemory<byte> frame,
                   CancellationToken cancellationToken);
}

public interface ILightDeviceClient
{
    Task TestConnectionAsync(string host, int port, CancellationToken cancellationToken);
    Task SendCommandAsync(string host, int port, string lightIdentifier,
        LightCommand command, int? value = null, CancellationToken cancellationToken = default);
}

public sealed class PdcCommandClient : ILightDeviceClient
{
    public PdcCommandClient(ICommandTransport transport);
    public Task TestConnectionAsync(string host, int port, CancellationToken cancellationToken);
    public Task SendCommandAsync(string host, int port, string lightIdentifier,
        LightCommand command, int? value = null, CancellationToken cancellationToken = default);
}

public sealed class DeviceVerificationService
{
    public DeviceVerificationService(ILightDeviceClient client, SettingsStore settingsStore);
    public Task TestConnectionAsync(string host, int port, CancellationToken cancellationToken);
    public Task SendUserInitiatedTestCommandAsync(string host, int port, string lightIdentifier,
        CancellationToken cancellationToken);
    public Task ConfirmPhysicalResponseAsync(
        string host, int port, string lightIdentifier, CancellationToken cancellationToken);
    public bool IsVerified(string host, int port, string lightIdentifier);
}

public sealed class LightScheduleRunner
{
    public LightScheduleRunner(ILightDeviceClient client, TimeProvider? timeProvider = null);
    public Task RunAsync(LightControlSettings settings, CancellationToken cancellationToken);
}

public sealed class SettingsStore
{
    public SettingsStore(string? directory = null);
    public LightControlSettings Load();
    public Task SaveAsync(LightControlSettings settings, CancellationToken cancellationToken);
}
```

`Encode` accepts the source-format 12-character hexadecimal light identifier (the controller System page shows a MAC address candidate, which must be confirmed against the light), derives the three identifier bytes using the source's `lightIdentifier.Substring(9, 3)` rule, emits 12 bytes, and calculates checksum as the low byte of the sum of indices 4 through 8. The byte codes are turn-on `02 12 AB`, turn-off `02 12 A9`, warmth `08 36 <value>`, and brightness `08 33 <value>`; unused fields and suffix remain as in the source frame. `RunAsync` samples local wall-clock time through `TimeProvider`, uses at most 64 interpolation steps per target interval, serializes writes, spaces command frames by at least 500 ms, and recalculates current state after delayed writes instead of replaying missed steps. For an OFF interval, preserve source behavior: apply the following point's brightness/warmth and turn the output off; an ON interval interpolates from its own point toward the next point, including over midnight. Interpolated positive values truncate toward zero, matching the source's float-to-integer conversion.

---

### Task 1: Scaffold the isolated Windows solution

**Files:**
- Create the solution, Core class library, WPF app, and Core xUnit project at the paths in File Structure.
- Create `windows-light-control/.gitignore`.

**Interfaces:**
- Produces `LeadDynamic.Core` and `LeadDynamic.App` projects, with App referencing Core and tests referencing Core.
- App targets `net10.0-windows` with WPF enabled; Core and tests target `net10.0`.

- [ ] **Step 1: Create the solution and projects** using `dotnet new sln --format sln`, `dotnet new classlib`, `dotnet new wpf`, and `dotnet new xunit`; add projects and references.
- [ ] **Step 2: Run the initial test/build check** with `dotnet test windows-light-control\LeadDynamic.sln`; expected: test project discovered and all baseline tests pass.
- [ ] **Step 3: Commit the isolated scaffold** with message `feat: scaffold Lead Dynamic Windows app`.

### Task 2: Implement schedule validation and evaluation

**Files:**
- Create `Scheduling\SchedulePoint.cs`, `Scheduling\ScheduleEvaluator.cs`.
- Create `Scheduling\ScheduleEvaluatorTests.cs`.

**Interfaces:**
- Consumes the project/test scaffold from Task 1.
- Produces `ScheduleEvaluator.ValidateAndSort`, `EvaluateAt`, and `GetNextPoint` as defined in Interfaces.

- [ ] **Step 1: Write failing tests** named `ValidateAndSort_RejectsOutOfRangeValues`, `ValidateAndSort_RequiresTwoPoints`, `ValidateAndSort_RejectsDuplicateTimes`, `ValidateAndSort_SortsByTime`, `EvaluateAt_UsesNewIntervalAtExactBoundary`, `EvaluateAt_InterpolatesOnIntervalWithTruncation`, `EvaluateAt_UsesNextTargetWhenOff`, and `EvaluateAt_InterpolatesAcrossMidnight`; assert the exact state/value at each boundary.
- [ ] **Step 2: Run `dotnet test windows-light-control\LeadDynamic.sln --filter FullyQualifiedName~ScheduleEvaluatorTests`**; expected: tests fail because evaluator methods are not implemented.
- [ ] **Step 3: Implement typed schedule models and validation**; reject out-of-range values, fewer than two points, and duplicate times with explicit argument errors.
- [ ] **Step 4: Implement daily evaluation**; use the interval beginning at the latest point not later than the current time, wrapping last-to-first across midnight; linearly interpolate ON intervals and use following-point values for OFF intervals.
- [ ] **Step 5: Rerun the focused test command**; expected: all schedule evaluator tests pass.
- [ ] **Step 6: Commit schedule domain and tests** with message `feat: add daily light schedule evaluator`.

### Task 3: Implement source-compatible protocol and TCP transport

**Files:**
- Create `Protocol\LightCommand.cs`, `Protocol\LightCommandEncoder.cs`, `Networking\TcpCommandClient.cs`.
- Create `Networking\PdcCommandClient.cs`.
- Create `Protocol\LightCommandEncoderTests.cs`, `Networking\TcpCommandClientTests.cs`.

**Interfaces:**
- Consumes the Core library from Task 1.
- Produces `LightCommandEncoder.Encode`, `ICommandTransport.TestConnectionAsync`/`SendAsync`, and `PdcCommandClient.TestConnectionAsync`/`SendCommandAsync` exactly as defined above.

- [ ] **Step 1: Write failing encoder tests** named `Encode_TurnOnMatchesSourceFrame`, `Encode_TurnOffMatchesSourceFrame`, `Encode_BrightnessMatchesSourceFrame`, `Encode_WarmthMatchesSourceFrame`, `Encode_UsesLastThreeIdentifierCharacters`, `Encode_ChecksumIsLowByteOfFrameFields`, `Encode_RejectsInvalidIdentifier`, and `Encode_RejectsInvalidValue`; assert the exact 12-byte arrays.
- [ ] **Step 2: Run the encoder test filter**; expected: tests fail because the encoder is not implemented.
- [ ] **Step 3: Implement the command enum and encoder** with the exact source byte codes, 12-byte layout, 500 ms pacing owned by the runner (not the encoder), and explicit validation before frame creation.
- [ ] **Step 4: Rerun the encoder filter**; expected: every expected byte and checksum matches exactly.
- [ ] **Step 5: Write loopback transport tests** using a local `TcpListener` for connectivity and one complete 12-byte payload; verify timeout, refused-connection, and cancellation errors surface to the caller.
- [ ] **Step 6: Implement `TcpCommandClient.TestConnectionAsync` and `SendAsync`** with TCP connect/write timeouts, cancellation, one connection per frame, and no success-shaped fallback.
- [ ] **Step 7: Implement `PdcCommandClient`** to validate endpoint/identifier, perform a read-only TCP connectivity check, and send only explicit user-requested encoded frames.
- [ ] **Step 8: Run `dotnet test windows-light-control\LeadDynamic.sln --filter "FullyQualifiedName~Protocol|FullyQualifiedName~TcpCommandClientTests"`**; expected: protocol and loopback tests pass without accessing `10.10.100.254`.
- [ ] **Step 9: Commit protocol and transport** with message `feat: add PDC TCP command transport`.

### Task 4: Add local settings and safe schedule runner

**Files:**
- Create `Configuration\LightControlSettings.cs`, `Configuration\SettingsStore.cs`, `Scheduling\LightScheduleRunner.cs`, and `Networking\ILightDeviceClient.cs`.
- Modify `Networking\PdcCommandClient.cs` to implement the new injectable interface without changing its existing command behavior.
- Create `Configuration\SettingsStoreTests.cs`, `Scheduling\LightScheduleRunnerTests.cs`.

**Interfaces:**
- Consumes `ScheduleEvaluator`, `ICommandTransport`, and `LightCommandEncoder` from Tasks 2–3.
- Produces `ILightDeviceClient` to make the existing PDC facade injectable into the runner and verification service.
- Produces settings storage under `%LocalAppData%\LeadDynamicLightControl\settings.json` and the `LightScheduleRunner.RunAsync` interface above.

- [ ] **Step 1: Write failing store tests** named `Load_MissingFileReturnsSafeDefaults`, `SaveAndLoad_RoundTripsSettingsAndVerification`, and `Load_CorruptJsonReturnsExplicitError`; assert default endpoint `10.10.100.254:8899` and that corrupt settings do not enable automation.
- [ ] **Step 2: Write failing runner tests** named `RunAsync_RejectsUnverifiedEndpoint`, `RunAsync_UsesAtMost64StepsPerInterval`, `RunAsync_SpacesFramesBy500Milliseconds`, `RunAsync_DoesNotOverlapWrites`, `RunAsync_RecalculatesAfterDelayedWrite`, `RunAsync_StopsOnCancellation`, and `RunAsync_PropagatesWriteFailure`; assert that no fake transport call occurs when verification is absent or for a different endpoint/device ID.
- [ ] **Step 3: Run the focused persistence and runner test filters**; expected: failures expose the missing services.
- [ ] **Step 4: Implement `SettingsStore`** using `System.Text.Json`, create its directory on save, preserve explicit parse/load errors, and isolate tests to temporary directories.
- [ ] **Step 5: Implement runner verification, serialization, and cancellation**; accept a complete `LightControlSettings`, require its verified endpoint and device ID to match the active settings before any write, set each interval's poll cadence to `max(1 second, interval duration / 64)`, apply changed power/brightness/warmth using `ILightDeviceClient`, wait at least 500 ms between frames, stop on a write failure, and never replay stale samples.
- [ ] **Step 6: Rerun all Core tests** with `dotnet test windows-light-control\LeadDynamic.sln`; expected: schedule, protocol, transport, persistence, and runner suites pass.
- [ ] **Step 7: Commit persistence and runner** with message `feat: add safe local schedule automation`.

### Task 5: Build the Russian schedule editor and explicit verification flow

**Files:**
- Create/modify `App.xaml`, `MainWindow.xaml`, `MainWindow.xaml.cs`, `ViewModels\MainViewModel.cs`, and `Models\SchedulePointViewModel.cs`.
- Create `Verification\DeviceVerificationService.cs` and `Verification\DeviceVerificationServiceTests.cs` as part of Core so verification gating is unit-tested independently of WPF.
- Add `tests\LeadDynamic.App.Tests\LeadDynamic.App.Tests.csproj` to the solution and create `MainViewModelTests.cs`.

**Interfaces:**
- Consumes the Core interfaces from Tasks 2–4.
- Produces Russian-language connection controls, editable target-point table, visible schedule status, explicit test/write confirmation, and start/stop actions.

- [ ] **Step 1: Write failing verification tests** named `TestConnectionAsync_DoesNotVerifyDevice`, `SendUserInitiatedTestCommandAsync_AwaitsPhysicalConfirmation`, `ConfirmPhysicalResponseAsync_RequiresMatchingPendingTest`, `ConfirmPhysicalResponseAsync_PersistsMatchingDevice`, and `IsVerified_RejectsChangedEndpointOrIdentifier`; assert that TCP reachability alone never unlocks automation and confirmation is saved asynchronously only for the pending endpoint/device.
- [ ] **Step 2: Run `dotnet test windows-light-control\LeadDynamic.sln --filter "FullyQualifiedName~DeviceVerificationServiceTests"`**; expected: tests fail because the service does not exist.
- [ ] **Step 3: Implement `DeviceVerificationService`** using `PdcCommandClient`; the user must explicitly click a test command (turn on) and separately confirm the physical response; persist the verified endpoint and identifier asynchronously in `LightControlSettings` so the Core runner can independently enforce the gate. Reject confirmation unless a matching user-initiated test command is pending.
- [ ] **Step 4: Create the WPF app test project and write failing tests** named `MainViewModel_StartScheduleRequiresDeviceVerification`, `MainViewModel_ChangingIdentifierInvalidatesVerification`, and `SchedulePointViewModel_ShowsRussianRangeErrors`; expected assertions cover the locked start state and actionable field errors.
- [ ] **Step 5: Implement `SchedulePointViewModel`** with minute-precision `HH:mm` display, exact validation, and Russian error text for time, power, brightness, and warmth.
- [ ] **Step 6: Implement `MainViewModel`** for editable/sorted schedule rows, add/remove, endpoint and device ID editing, settings load/save, TCP test, explicit test command/confirmation, next point, visible errors, verification-gated schedule start, and cancellable stop.
- [ ] **Step 7: Add WPF resources and layout** with the selected schedule-editor design, polished aquarium-inspired styling, Russian labels, clear connection/schedule status, and high-contrast accessible controls.
- [ ] **Step 8: Manually run the Windows app without connecting to hardware**; verify Russian UI, table editing, range errors, settings persistence, start lock before verification, and visible failed TCP connection.
- [ ] **Step 9: Run `dotnet test windows-light-control\LeadDynamic.sln` and `dotnet build windows-light-control\LeadDynamic.sln -c Release`**; expected: Core and App tests pass and WPF Release build succeeds.
- [ ] **Step 10: Commit the app workflow and UI** with message `feat: add polished Windows schedule editor`.

### Task 6: Document safe operation and publish a self-contained Windows build

**Files:**
- Create `windows-light-control/README.md`.
- Modify project publish properties only if needed for a reproducible self-contained x64 artifact.
- Update the approved design and plan documents with final implementation status and the remaining user-run hardware verification step.

**Interfaces:**
- Consumes the completed app and test suite from Tasks 1–5.
- Produces user-facing setup, first-use verification, schedule editing, troubleshooting, and publish instructions.

- [x] **Step 1: Document first-use setup** including joining the controller Wi-Fi, default IP/port, editable device identifier, the difference between TCP reachability and a physical test, explicit verification, running schedule, stop behavior, and no firmware update.
- [x] **Step 2: Document developer verification** with exact `dotnet test`, Release build, and `dotnet publish windows-light-control\src\LeadDynamic.App\LeadDynamic.App.csproj -c Release -r win-x64 --self-contained true` commands.
- [x] **Step 3: Run the full test suite and self-contained publish**; expected: successful build creates a runnable Windows x64 output without requiring Java or an installed .NET runtime.
- [x] **Step 4: Review all outputs and confirm no live light commands were sent during software validation**; physical verification remains an explicit user action.
- [x] **Step 5: Update the approved design/plan status** to record implementation completion while making clear that physical controller confirmation and schedule timing remain to be tested by the user.
- [x] **Step 6: Commit README, approved design/plan, and any publish configuration** with message `docs: document Windows light controller setup`.

Task 6 verification: `dotnet test windows-light-control\LeadDynamic.sln` passed all 68 tests; `dotnet build windows-light-control\LeadDynamic.sln -c Release` succeeded with zero warnings and errors; the specified self-contained publish succeeded. The publish directory contains `LeadDynamic.App.exe`, `coreclr.dll`, `hostfxr.dll`, `hostpolicy.dll`, `PresentationFramework.dll`, and `WindowsBase.dll`. No live light commands were sent. Physical response and schedule timing remain untested pending the user's explicit hardware verification.
