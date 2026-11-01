using LeadDynamic.Core.Protocol;

namespace LeadDynamic.Core.Networking;

public sealed class PdcCommandClient : ILightDeviceClient
{
    private readonly ICommandTransport _transport;

    public PdcCommandClient(ICommandTransport transport)
    {
        ArgumentNullException.ThrowIfNull(transport);
        _transport = transport;
    }

    public Task TestConnectionAsync(
        string host,
        int port,
        CancellationToken cancellationToken)
    {
        TcpCommandClient.ValidateEndpoint(host, port);
        return _transport.TestConnectionAsync(host, port, cancellationToken);
    }

    public Task SendCommandAsync(
        string host,
        int port,
        string lightIdentifier,
        LightCommand command,
        int? value = null,
        CancellationToken cancellationToken = default)
    {
        TcpCommandClient.ValidateEndpoint(host, port);
        var frame = LightCommandEncoder.Encode(lightIdentifier, command, value);
        return _transport.SendAsync(host, port, frame, cancellationToken);
    }
}
