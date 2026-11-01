# Lead Dynamic Windows Light Control — Design

## Intent

Create a standalone Windows desktop application for the user's Lead Dynamic PDC aquarium light. The primary goal is a daily schedule with smooth changes in light level, controlled over the controller's TCP interface.

## Goals

- Let the user configure and save time-based light target points.
- Gradually interpolate brightness and warmth between daily target points while the light is on.
- Connect to the controller at `10.10.100.254:8899` by default, with editable connection settings.
- Clearly show connection/schedule state and surface network or command errors.
- Provide a connection test before enabling a schedule.
- Use the authorized Kotlin repository as the source for existing schedule and command behavior, adapted for Windows.
- Package a Windows x64 executable that does not require the user to install Java.

## Non-goals

- Updating or flashing controller firmware.
- Changing the controller's Wi-Fi or network settings.
- Cloud access, mobile support, or controlling unrelated lighting devices.
- Running as a Windows service or automatically starting with Windows in the first version.

## Constraints and safety

- The existing workspace is a separate TypeScript project. Put this as a standalone project in `windows-light-control/` and leave existing application files untouched.
- The user confirmed they own or have permission to port [Minding000/lead-dynamic-light-control-system](https://github.com/Minding000/lead-dynamic-light-control-system), inspected at commit `27160d2a74525f143face02d89ac4f9799e26455`.
- The PDC web settings show TCP Server port `8899`; the user's successful `Test-NetConnection` confirms that this port is reachable from their PC. This does not by itself validate command compatibility.
- Preserve the source command ranges: brightness `0..64`, warmth `0..32`, and its 12-byte TCP command frame and checksum. The source's identification bytes are derived from the configured 12-character light identifier. Verify that identifier and command behavior against the user's actual PDC before enabling scheduled writes.
- Keep the app running while automation is active. Failed connections or writes must be visible and must not be reported as successful.
- Enforce device verification in the scheduling service/core workflow, not only by disabling a user-interface button; verification must match the configured endpoint and device ID.
- A TCP connection test proves reachability only. On first setup, require the user to explicitly initiate a test command and confirm that the physical light responded before enabling scheduled automation. Never send test commands to the live lamp automatically.

## Approaches

1. **Windows desktop GUI (selected):** A native Windows app presents connection settings, a daily schedule editor, and schedule controls. It is the most practical for everyday aquarium use, but needs a desktop UI and Windows-specific networking.
2. **Windows console port:** Replace the Linux JNI/network binding and preserve the original console workflow. It is a smaller port but less convenient for setting and inspecting a daily light schedule.

## User-facing behavior

- The schedule consists of daily target points with minute-precision local time, on/off state, brightness, and warmth. Require at least two valid points, reject duplicate times and out-of-range values, and sort them by time.
- A point's on/off state governs the interval starting at that point. For an on interval, interpolate brightness and warmth from its starting point toward the next point, including across midnight. An off point switches the light off for its interval; the next on point starts a new transition.
- Persist settings and schedule locally. Start automation only after an explicit user action; stopping it cancels future writes.
- Use the schedule editor layout selected by the user: a connection/status section and an editable table of daily points, with explicit start/stop controls.
- Use a polished, calm aquarium-inspired Windows interface with Russian labels, clear typography, restrained deep-blue/teal accents, and readable contrast; avoid a generic unstyled form.
- Display the next target point and current automation state. Connection/test failures remain visible and do not silently fall back to another address or port.

## Implementation calls for the builder

- Use C# and WPF for a self-contained Windows x64 desktop project, targeting .NET 10 LTS.
- Implement the authorized source protocol in managed C# TCP code; do not retain the Linux JNI dependency.
- Keep protocol encoding, schedule interpolation, persistence, and UI concerns separated enough to test schedule calculations without connecting to hardware.
- Keep interpolation to at most 64 steps per interval, truncate interpolated values toward zero as in the source, and honor the source's minimum 500 ms between command frames; serialize writes and recalculate from the current local time rather than queuing stale steps.
- Add unit tests for range validation, schedule ordering, midnight wraparound, interpolation, and command-frame construction/checksum. Hardware verification remains a user-run step on the actual PDC.

## Approval

Approved by the user on 2026-11-01. The user selected the schedule-editor layout and requested a polished visual design.

## Implementation status

The standalone Windows application, usage documentation, and self-contained Windows x64 publish are implemented. The full solution test suite passes (68 tests), the Release build succeeds, and the self-contained publish includes the app executable and bundled .NET/Windows Desktop runtime. Software validation sent no live light commands. First-time physical response confirmation and real aquarium schedule timing still require the user's explicit hardware test.
