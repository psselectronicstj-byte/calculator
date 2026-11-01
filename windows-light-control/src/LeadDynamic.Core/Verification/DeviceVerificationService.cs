using LeadDynamic.Core.Configuration;
using LeadDynamic.Core.Networking;
using LeadDynamic.Core.Protocol;

namespace LeadDynamic.Core.Verification;

public sealed class DeviceVerificationService
{
    private readonly ILightDeviceClient _client;
    private readonly SettingsStore _settingsStore;
    private readonly SemaphoreSlim _confirmationGate = new(1, 1);
    private LightControlSettings _settings;
    private PendingTest? _pendingTest;

    public DeviceVerificationService(
        ILightDeviceClient client,
        SettingsStore settingsStore,
        LightControlSettings initialSettings)
    {
        ArgumentNullException.ThrowIfNull(client);
        ArgumentNullException.ThrowIfNull(settingsStore);
        ArgumentNullException.ThrowIfNull(initialSettings);

        _client = client;
        _settingsStore = settingsStore;
        _settings = initialSettings;
    }

    public LightControlSettings Settings => _settings;

    public void UpdateSettings(LightControlSettings settings)
    {
        ArgumentNullException.ThrowIfNull(settings);
        _settings = settings;
    }

    public bool IsVerified(string host, int port, string lightIdentifier) =>
        !string.IsNullOrWhiteSpace(host) &&
        port is >= 1 and <= 65535 &&
        !string.IsNullOrWhiteSpace(lightIdentifier) &&
        string.Equals(_settings.VerifiedHost, host, StringComparison.OrdinalIgnoreCase) &&
        _settings.VerifiedPort == port &&
        string.Equals(
            _settings.VerifiedLightIdentifier,
            lightIdentifier,
            StringComparison.OrdinalIgnoreCase);

    public Task TestConnectionAsync(
        string host,
        int port,
        CancellationToken cancellationToken) =>
        _client.TestConnectionAsync(host, port, cancellationToken);

    public async Task SendUserInitiatedTestCommandAsync(
        string host,
        int port,
        string lightIdentifier,
        CancellationToken cancellationToken)
    {
        await _confirmationGate.WaitAsync(cancellationToken).ConfigureAwait(false);
        try
        {
            await _client.SendCommandAsync(
                host,
                port,
                lightIdentifier,
                LightCommand.TurnOn,
                cancellationToken: cancellationToken).ConfigureAwait(false);
            _pendingTest = new PendingTest(host, port, lightIdentifier);
        }
        finally
        {
            _confirmationGate.Release();
        }
    }

    public async Task ConfirmPhysicalResponseAsync(
        string host,
        int port,
        string lightIdentifier,
        CancellationToken cancellationToken)
    {
        await _confirmationGate.WaitAsync(cancellationToken).ConfigureAwait(false);
        try
        {
            if (_pendingTest is not { } pending ||
                !pending.Matches(host, port, lightIdentifier))
            {
                throw new InvalidOperationException(
                    "A matching user-initiated test command is required before confirming the device.");
            }

            var verifiedSettings = _settings with
            {
                VerifiedHost = pending.Host,
                VerifiedPort = pending.Port,
                VerifiedLightIdentifier = pending.LightIdentifier
            };

            await _settingsStore.SaveAsync(verifiedSettings, cancellationToken)
                .ConfigureAwait(false);
            _settings = verifiedSettings;
            _pendingTest = null;
        }
        finally
        {
            _confirmationGate.Release();
        }
    }

    public void CancelPendingTestCommand(string host, int port, string lightIdentifier)
    {
        if (_pendingTest is { } pending && pending.Matches(host, port, lightIdentifier))
        {
            _pendingTest = null;
        }
    }

    private sealed record PendingTest(string Host, int Port, string LightIdentifier)
    {
        public bool Matches(string host, int port, string lightIdentifier) =>
            string.Equals(Host, host, StringComparison.OrdinalIgnoreCase) &&
            Port == port &&
            string.Equals(LightIdentifier, lightIdentifier, StringComparison.OrdinalIgnoreCase);
    }
}
