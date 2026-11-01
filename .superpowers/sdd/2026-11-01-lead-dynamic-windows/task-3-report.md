# Task 3 Report: Source-Compatible PDC Command Transport

## Result

Implemented command-frame encoding and TCP transport in `windows-light-control/`, with focused tests. No TypeScript app files were changed, and no connection or command was sent to the controller.

## Implementation

- Added `LightCommand` and `LightCommandEncoder` for the specified 12-byte frame, identifier validation, command codes, brightness/warmth bounds, argument-shape validation, and checksum over bytes 4–8.
- Added `ICommandTransport`, `TcpCommandClient`, and `PdcCommandClient`.
- The TCP client opens one connection for each operation, connects without sending data for the connection test, and writes the full frame before closing the command connection. Connection/write timeouts are surfaced as `TimeoutException`; caller cancellation and socket failures are not converted into success results.
- The PDC facade validates endpoint arguments and encodes only the explicitly requested command. The encoder validates the light identifier before transport is called.
- No command pacing is implemented here; the 500 ms interval remains the runner's responsibility.

## Test evidence

TDD RED run before production implementation:

```text
dotnet test windows-light-control\LeadDynamic.sln --filter "FullyQualifiedName~Protocol"
```

Failed during compilation because `LeadDynamic.Core.Protocol` and `LightCommand` did not yet exist, as expected for the new encoder tests.

Focused GREEN run:

```text
dotnet test windows-light-control\LeadDynamic.sln --filter "FullyQualifiedName~Protocol|FullyQualifiedName~TcpCommandClientTests"
```

Passed: 27 tests, 0 failed. Coverage includes exact source-frame arrays, checksum, identifier/value/argument validation, loopback-only connection and 12-byte transmission, immediate write-timeout reporting, refused connections, caller cancellation, read-only connection testing, and facade forwarding.

Full test suite:

```text
dotnet test windows-light-control\LeadDynamic.sln
```

Passed: 39 tests, 0 failed.

Solution build:

```text
dotnet build windows-light-control\LeadDynamic.sln --no-restore
```

Passed: 0 warnings, 0 errors. The installed .NET 11 RC SDK emitted its `NETSDK1057` preview notice during test/build invocations.

## Scope and concerns

- All network tests use an ephemeral `TcpListener` bound to `IPAddress.Loopback`; the controller address was never accessed.
- The authorized source commit `27160d2a74525f143face02d89ac4f9799e26455` was not present in the local Git object database (`git show` reported “bad object”). The exact frame semantics in the task brief were used as the source specification.
- No third-party runtime dependency was added.
