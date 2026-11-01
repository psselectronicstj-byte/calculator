using LeadDynamic.Core.Configuration;
using LeadDynamic.Core.Networking;
using LeadDynamic.Core.Protocol;
using LeadDynamic.Core.Scheduling;
using LeadDynamic.Core.Verification;

namespace LeadDynamic.Core.Tests.Verification;

public sealed class DeviceVerificationServiceTests
{
    [Fact]
    public async Task TestConnectionAsync_DoesNotVerifyDevice()
    {
        await WithStoreAsync(async store =>
        {
            var client = new FakeLightDeviceClient();
            var service = new DeviceVerificationService(client, store, Settings());

            await service.TestConnectionAsync(Host, Port, CancellationToken.None);

            Assert.Equal(1, client.ConnectionTests);
            Assert.Empty(client.Commands);
            Assert.False(service.IsVerified(Host, Port, Identifier));
            Assert.Null(store.Load().VerifiedHost);
        });
    }

    [Fact]
    public async Task SendUserInitiatedTestCommandAsync_AwaitsPhysicalConfirmation()
    {
        await WithStoreAsync(async store =>
        {
            var client = new FakeLightDeviceClient();
            var service = new DeviceVerificationService(client, store, Settings());

            await service.SendUserInitiatedTestCommandAsync(
                Host, Port, Identifier, CancellationToken.None);

            Assert.Equal(
                [(Host, Port, Identifier, LightCommand.TurnOn, (int?)null)],
                client.Commands);
            Assert.False(service.IsVerified(Host, Port, Identifier));
            Assert.Null(store.Load().VerifiedHost);
        });
    }

    [Fact]
    public async Task ConfirmPhysicalResponseAsync_RequiresMatchingPendingTest()
    {
        await WithStoreAsync(async store =>
        {
            var service = new DeviceVerificationService(
                new FakeLightDeviceClient(), store, Settings());

            await Assert.ThrowsAsync<InvalidOperationException>(
                () => service.ConfirmPhysicalResponseAsync(
                    Host, Port, Identifier, CancellationToken.None));

            await service.SendUserInitiatedTestCommandAsync(
                Host, Port, Identifier, CancellationToken.None);

            await Assert.ThrowsAsync<InvalidOperationException>(
                () => service.ConfirmPhysicalResponseAsync(
                    "192.168.1.27", Port, Identifier, CancellationToken.None));

            Assert.Null(store.Load().VerifiedHost);
        });
    }

    [Fact]
    public async Task ConfirmPhysicalResponseAsync_PersistsMatchingDevice()
    {
        await WithStoreAsync(async store =>
        {
            var service = new DeviceVerificationService(
                new FakeLightDeviceClient(), store, Settings());
            await service.SendUserInitiatedTestCommandAsync(
                Host, Port, Identifier, CancellationToken.None);

            await service.ConfirmPhysicalResponseAsync(
                Host, Port, Identifier, CancellationToken.None);

            var saved = store.Load();
            Assert.Equal(Host, saved.VerifiedHost);
            Assert.Equal(Port, saved.VerifiedPort);
            Assert.Equal(Identifier, saved.VerifiedLightIdentifier);
            Assert.True(service.IsVerified(Host, Port, Identifier));
        });
    }

    [Fact]
    public async Task IsVerified_RejectsChangedEndpointOrIdentifier()
    {
        await WithStoreAsync(async store =>
        {
            var service = new DeviceVerificationService(
                new FakeLightDeviceClient(), store, Settings());
            await service.SendUserInitiatedTestCommandAsync(
                Host, Port, Identifier, CancellationToken.None);
            await service.ConfirmPhysicalResponseAsync(
                Host, Port, Identifier, CancellationToken.None);

            Assert.False(service.IsVerified("192.168.1.27", Port, Identifier));
            Assert.False(service.IsVerified(Host, 8890, Identifier));
            Assert.False(service.IsVerified(Host, Port, "A1B2C3D4E5F7"));
            Assert.True(service.IsVerified(Host.ToUpperInvariant(), Port, Identifier));
        });
    }

    private const string Host = "192.168.1.26";
    private const int Port = 8899;
    private const string Identifier = "A1B2C3D4E5F6";

    private static LightControlSettings Settings() => new(
        Host, Port, Identifier, Array.Empty<SchedulePoint>(), null, null, null);

    private static async Task WithStoreAsync(Func<SettingsStore, Task> action)
    {
        var directory = Path.Combine(
            Environment.CurrentDirectory, "device-verification-test-data", Guid.NewGuid().ToString("N"));
        try
        {
            await action(new SettingsStore(directory));
        }
        finally
        {
            if (Directory.Exists(directory))
            {
                Directory.Delete(directory, recursive: true);
            }
        }
    }

    private sealed class FakeLightDeviceClient : ILightDeviceClient
    {
        public int ConnectionTests { get; private set; }
        public List<(string Host, int Port, string Identifier, LightCommand Command, int? Value)> Commands { get; } = [];

        public Task TestConnectionAsync(string host, int port, CancellationToken cancellationToken)
        {
            cancellationToken.ThrowIfCancellationRequested();
            ConnectionTests++;
            return Task.CompletedTask;
        }

        public Task SendCommandAsync(
            string host,
            int port,
            string lightIdentifier,
            LightCommand command,
            int? value = null,
            CancellationToken cancellationToken = default)
        {
            cancellationToken.ThrowIfCancellationRequested();
            Commands.Add((host, port, lightIdentifier, command, value));
            return Task.CompletedTask;
        }
    }
}
