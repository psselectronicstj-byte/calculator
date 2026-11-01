using LeadDynamic.Core.Protocol;

namespace LeadDynamic.Core.Networking;

public interface ILightDeviceClient
{
    Task TestConnectionAsync(
        string host,
        int port,
        CancellationToken cancellationToken);

    Task SendCommandAsync(
        string host,
        int port,
        string lightIdentifier,
        LightCommand command,
        int? value = null,
        CancellationToken cancellationToken = default);
}
