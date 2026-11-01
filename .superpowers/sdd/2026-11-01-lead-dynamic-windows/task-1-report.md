# Task 1 Report: Standalone Windows App Scaffold

## Status
Completed Task 1 only. The standalone .NET solution and three requested projects were created under `windows-light-control/`. No application logic, controller networking, or live device commands were added or sent.

## Delivered
- `windows-light-control/LeadDynamic.sln`
- `windows-light-control/src/LeadDynamic.Core/LeadDynamic.Core.csproj` targeting `net10.0`
- `windows-light-control/src/LeadDynamic.App/LeadDynamic.App.csproj` targeting `net10.0-windows` with WPF enabled and a project reference to Core
- `windows-light-control/tests/LeadDynamic.Core.Tests/LeadDynamic.Core.Tests.csproj` targeting `net10.0` with a project reference to Core
- `windows-light-control/.gitignore`

The existing TypeScript application and the approved plan/spec were not modified. The two plan/spec files were already untracked before this task and remain untouched.

## Validation
- `dotnet test windows-light-control\LeadDynamic.sln` — passed; 1 test passed, 0 failed, 0 skipped.
- `dotnet build windows-light-control\LeadDynamic.sln` — succeeded; Core, tests, and WPF app built with 0 warnings and 0 errors.
- Confirmed the installed SDK is `11.0.100-rc.3.26522.148`, with .NET 10 and Windows Desktop 10 runtimes available.
- The WPF template does not accept `--framework net10.0-windows`; using its supported `--framework net10.0` option generated the required `net10.0-windows` target and `UseWPF` property. No target framework was substituted.
- Build/test were local only; no connection to the controller or live light commands were attempted.

## Self-review
Only `windows-light-control/` was staged and committed. `git diff --check` reported no whitespace errors. Generated `bin` and `obj` outputs are ignored by the project-local `.gitignore`.

## Commit
- SHA: `10fe0b1b55efaf8fc0e709ccebd45ce52b9cdad5`
- Subject: `feat: scaffold Lead Dynamic Windows app`
- Trailer: `Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>`

## Concerns
The installed .NET SDK is a prerelease 11.0.100-rc.3; builds emitted the expected `NETSDK1057` prerelease SDK informational message during testing, but completed successfully. No framework or target-pack blocker remains.

## Report path
`.superpowers\sdd\2026-11-01-lead-dynamic-windows\task-1-report.md`

## Fix Round 1

### Findings addressed
- **Self-contained publishing:** configured the WPF app for `win-x64` and `SelfContained=true`; a publish now includes the Windows x64 apphost and .NET/Windows Desktop runtimes.
- **x64 solution configuration:** mapped the app's Debug and Release x64 solution configurations to its x64 platform and set `PlatformTarget=x64` for that platform. Core and tests remain Any CPU.
- **Vacuous test:** replaced the generated empty test with a smoke test asserting that the Core project reference loads the expected `LeadDynamic.Core` assembly.

### Changed files
- `windows-light-control/src/LeadDynamic.App/LeadDynamic.App.csproj` — added `win-x64`, self-contained publishing, and explicit x64 platform support.
- `windows-light-control/LeadDynamic.sln` — mapped the app's Debug/Release x64 configurations to x64.
- `windows-light-control/tests/LeadDynamic.Core.Tests/UnitTest1.cs` — removed the empty template test.
- `windows-light-control/tests/LeadDynamic.Core.Tests/ScaffoldSmokeTests.cs` — added the assembly-reference smoke test.
- `.superpowers/sdd/2026-11-01-lead-dynamic-windows/task-1-report.md` — appended this fix-round record.

### Validation
- `dotnet test windows-light-control\LeadDynamic.sln --configuration Debug -p:Platform=x64` — passed; 1 test passed, 0 failed, 0 skipped; 1 test file discovered.
- `dotnet build windows-light-control\LeadDynamic.sln --configuration Release -p:Platform=x64` — succeeded; 0 warnings, 0 errors. The app output was under `bin\x64\Release\net10.0-windows\win-x64`.
- `dotnet publish windows-light-control\src\LeadDynamic.App\LeadDynamic.App.csproj --configuration Release -p:Platform=x64 --runtime win-x64 --self-contained true` — succeeded; published to `src\LeadDynamic.App\bin\x64\Release\net10.0-windows\win-x64\publish\`.
- `dotnet sln windows-light-control\LeadDynamic.sln list` — succeeded; discovered the App, Core, and Core.Tests projects.
- `git diff --check` — passed; no whitespace errors.
- Verified the publish directory contains `LeadDynamic.App.exe` (162,304 bytes), `coreclr.dll`, `hostfxr.dll`, and `hostpolicy.dll`; its runtime configuration lists bundled `Microsoft.NETCore.App` and `Microsoft.WindowsDesktop.App` 10.0.14 frameworks.
- No controller writes or live hardware access were performed. Build output included the existing `NETSDK1057` informational message because the installed SDK is .NET 11.0.100-rc.3; commands completed successfully.

### Self-review
The test now validates runtime loading of the referenced Core assembly and its expected identity. The x64 solution build and publish both produced x64 outputs, and the self-contained publish includes runtime components. The app's other solution configurations and Core/test platform behavior remain unchanged. No unrelated files were staged or modified.
