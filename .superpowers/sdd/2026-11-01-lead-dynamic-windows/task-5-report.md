# Task 5 — Implementation Report

## Result

Implemented the explicit device-verification flow and the Russian WPF schedule editor for Task 5. Changes are committed as:

`a5a66cc feat: add polished Windows schedule editor`

The approved specification, plan, README, and TypeScript application were not changed.

## Delivered

- Added `DeviceVerificationService`, backed by `ILightDeviceClient` and `SettingsStore`.
  - TCP reachability never marks a device verified.
  - Only an explicit user-initiated test sends `LightCommand.TurnOn`.
  - Verification stays pending until an explicit physical-response confirmation.
  - Confirmation is saved asynchronously only for the matching pending host, port, and identifier.
  - Changed endpoint/device identifiers do not match the stored verification.
- Added Russian-language, aquarium-inspired WPF resources and schedule-editor layout.
  - Connection status and read-only TCP check are distinct from the physical test command.
  - The command UI warns that TCP writes have no device acknowledgement and asks the user to confirm the visible lamp response.
  - Editable, sorted daily points support `HH:mm`, on/off, brightness `0..64`, warmth `0..32`, add/remove, and Russian validation errors.
  - Schedule status and next point are shown; local save and explicit start/stop controls are provided.
  - Start is disabled unless the endpoint/device pair is verified and the schedule is valid; the Core runner retains its independent gate.
  - Startup only loads settings. Closing/stopping cancels the schedule loop.
  - Corrupt settings remain visibly reported while the store's safe defaults are used.
- Added a Windows app test project and verification/view-model tests using fake clients and local test settings only.

## TDD evidence

- **Verification RED:** Ran `dotnet test windows-light-control\LeadDynamic.sln --filter "FullyQualifiedName~DeviceVerificationServiceTests"` before adding the service. It failed at compile time because `LeadDynamic.Core.Verification` did not exist.
- **Verification GREEN:** Re-ran the focused filter after implementation; all 5 `DeviceVerificationServiceTests` passed.
- **View-model RED:** Ran `dotnet test windows-light-control\LeadDynamic.sln --filter "FullyQualifiedName~MainViewModelTests"` before implementing the view models. It failed at compile time because the `Models` and `ViewModels` namespaces did not exist.
- **View-model GREEN:** Re-ran after implementation; all 3 requested named tests passed. Expanded app coverage passed 7 tests, including no startup writes, manual confirmation gating, local schedule editing, and visible corrupt-settings handling.

## Final validation

- `dotnet test windows-light-control\LeadDynamic.sln` — **passed**, 63 total tests (56 Core, 7 App).
- `dotnet build windows-light-control\LeadDynamic.sln -c Release` — **passed**, 0 warnings and 0 errors.
- Manually launched the Release WPF executable. The window remained open and showed title `Аквариумный свет · Расписание`; it was closed without connecting to or commanding the controller.
- No live hardware or application network requests were used by tests.

## Concerns / limitations

- The installed SDK reports `NETSDK1057` informational notices because the environment uses a .NET 11 release-candidate SDK while the projects target .NET 10. Tests and Release build completed successfully.
- Physical controller response and actual schedule timing were not tested on hardware; that remains an explicit user-run verification step.
- The manual launch confirmed process/window startup only; UI interactions were covered by view-model tests rather than manual clicking.

## Fix round 1

### Changes

- Added `LightCommandEncoder.IsValidIdentifier` as the shared exact 12-hex-character check. The verification service uses it for verification and rejects invalid IDs before sending the manual test command; the view model uses the same predicate for Start gating; the Core runner rejects malformed stored IDs before sending any command.
- Normalized loaded and edited hosts by trimming them at the view-model boundary. TCP tests, manual test/confirmation, saved settings, and the Start verification match now use the same normalized host.
- Kept a corrupt-settings warning separate from transient action errors. Successful TCP tests no longer clear it; a successful `SaveAsync` recovery does.

### Regression tests

- `LightScheduleRunnerTests.RunAsync_RejectsMalformedIdentifierBeforeWriting`
- `DeviceVerificationServiceTests.IsVerified_RejectsMalformedIdentifier`
- `MainViewModelTests.MainViewModel_MalformedPersistedIdentifierCannotEnableStart`
- `MainViewModelTests.MainViewModel_NormalizesHostThroughTestConfirmationAndStartGate`
- `MainViewModelTests.MainViewModel_SuccessfulTcpTestPreservesCorruptSettingsWarningUntilSave`

### Validation

- `dotnet test windows-light-control\LeadDynamic.sln --filter "FullyQualifiedName~DeviceVerificationServiceTests|FullyQualifiedName~LightScheduleRunnerTests|FullyQualifiedName~MainViewModelTests"` — passed, 26 tests.
- `dotnet test windows-light-control\LeadDynamic.sln` — passed, 68 tests (58 Core, 10 App).
- `git diff --check` — passed.

### Self-review

The runner's identifier check occurs in its verification gate before schedule evaluation, locking, or client writes. Invalid persisted IDs therefore cannot rely on a matching but malformed stored verification. Host normalization is applied both on load and on property assignment, so the tested endpoint and saved pending confirmation use the same value as the Start gate. Corrupt-settings status remains visible across network tests and transient actions, and only the successful settings save clears the recovery warning. All new behavior was tested with fake clients and local settings; no hardware or external network was used. The design spec was not edited.
