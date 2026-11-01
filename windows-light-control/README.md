# Lead Dynamic Windows Light Control

A standalone Windows desktop app for setting a daily schedule for a Lead Dynamic PDC aquarium light. The app sends commands over the controller's TCP interface; it does not update firmware.

## What you need

- A Windows x64 PC.
- The PC connected to the aquarium light controller's Wi-Fi network.
- Access to the controller's PDC System page so you can identify the aquarium light's 12-character hexadecimal identifier.

The default controller endpoint is `10.10.100.254:8899`. Use this app only with the intended aquarium controller. Do not substitute unrelated or arbitrary network targets.

## First use and physical verification

Follow these steps in order. A TCP check alone does not verify that commands control the correct physical light.

1. Connect the PC to the controller's Wi-Fi network. Keep the PC on that network while using the app.
2. Open `LeadDynamic.App.exe` from the published folder.
3. In **Идентификатор светильника · 12 символов**, enter the 12-hex-character identifier shown on the PDC **System** page. Confirm on that page that this is the identifier for the aquarium light you intend to control. Do not guess or copy an identifier for another device.
4. Leave the controller address and port at `10.10.100.254` and `8899` unless the intended controller's documented PDC settings specify otherwise.
5. Select **Проверить TCP**. This performs a read-only TCP reachability check; it sends no light command and does not prove that the correct light responds.
6. Only after confirming the identifier and controller endpoint, explicitly select **Отправить тест «Включить»**. This sends a `TurnOn` test command. The device does not acknowledge TCP writes, so a successful write is not proof of physical action.
7. Observe the aquarium light yourself. Confirm only if the intended light physically turns on when asked; if it does not, choose **No** in the confirmation prompt. The schedule remains blocked until you have a matching successful test and confirm the physical response. This confirmation is tied to the current endpoint and identifier.
8. Add or edit at least two schedule rows. Each row has a unique 24-hour `HH:mm` time, an **on/off** state, brightness from `0` to `64`, and warmth from `0` to `32`. Rows define daily target points; on intervals transition gradually toward the next point, including across midnight. Invalid ranges, duplicate times, or fewer than two rows prevent saving and starting.
9. Select **Сохранить настройки** and check for the saved status. Settings are stored locally on this PC.
10. Select **Запустить расписание** explicitly. The schedule runs only while the app remains open; it does not run as a service or start automatically with Windows. Keep the PC connected to the controller Wi-Fi.
11. Select **Остановить** to cancel future scheduled writes. Closing the app also stops the schedule. Neither action can undo a command already sent or guarantee the light's current state; inspect the physical light if needed.

The app does not update or flash controller firmware. There is no automatic test command on startup. A TCP write has no device acknowledgement, so the app cannot independently verify that a command reached or changed the light.

## Troubleshooting

- **TCP check fails:** Confirm the PC is connected to the controller's Wi-Fi, the controller is powered on, and its PDC System page shows the expected TCP server port. Keep the intended controller endpoint at `10.10.100.254:8899` unless its documented settings say otherwise. Check that local network/firewall policy is not blocking the connection.
- **TCP check succeeds but the light does not respond:** Reachability only proves that a TCP connection can be opened. Recheck that the 12-character hexadecimal identifier is the aquarium light's identifier on the PDC System page, then perform the explicit `TurnOn` test again and observe the light. Do not confirm a response you did not observe.
- **Schedule cannot start:** The app requires a confirmed physical test for the current endpoint and light identifier, plus at least two valid rows with unique `HH:mm` times and in-range values. Review visible validation messages, save, and explicitly start.
- **Schedule stops unexpectedly:** The app must stay open. Closing it or an application/process exit cancels scheduled work. Start it again manually; do not assume the light's state from the app status alone.
- **Settings cannot be saved or loaded:** Check that the current Windows user can write to its local application data folder. If settings are corrupt, the app reports an error and does not silently treat the device as verified.
- **A command or network error appears:** Read the in-app error, verify the intended controller Wi-Fi and endpoint, and retry only after checking the device identifier. TCP write success is not a device acknowledgement.

## Developer: test, build, and publish

Run these commands from the repository root in PowerShell with the .NET 10 SDK installed:

```powershell
dotnet test windows-light-control\LeadDynamic.sln
dotnet build windows-light-control\LeadDynamic.sln -c Release
dotnet publish windows-light-control\src\LeadDynamic.App\LeadDynamic.App.csproj -c Release -r win-x64 --self-contained true
```

The self-contained Windows x64 publish is written to:

```text
windows-light-control\src\LeadDynamic.App\bin\Release\net10.0-windows\win-x64\publish\
```

Run `LeadDynamic.App.exe` from that folder on Windows x64. Keep the published files together. The output includes the app executable and the .NET and Windows Desktop runtime components, so Java or a separately installed .NET runtime is not required on the target PC. Publishing and software tests do not contact or send commands to a live light.
