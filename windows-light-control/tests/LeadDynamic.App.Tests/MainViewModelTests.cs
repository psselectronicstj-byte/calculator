using System.IO;
using LeadDynamic.App.Models;
using LeadDynamic.App.ViewModels;
using LeadDynamic.Core.Configuration;
using LeadDynamic.Core.Networking;
using LeadDynamic.Core.Protocol;
using LeadDynamic.Core.Scheduling;

namespace LeadDynamic.App.Tests;

public sealed class MainViewModelTests
{
    [Fact]
    public void MainViewModel_StartScheduleRequiresDeviceVerification()
    {
        WithStore(store =>
        {
            var viewModel = new MainViewModel(store, new FakeLightDeviceClient());
            viewModel.AddPoint();
            viewModel.AddPoint();

            Assert.False(viewModel.CanStartSchedule);
        });
    }

    [Fact]
    public void MainViewModel_ChangingIdentifierInvalidatesVerification()
    {
        WithStore(store =>
        {
            var points = ValidSchedule();
            store.SaveAsync(new LightControlSettings(
                Host, Port, Identifier, points, Host, Port, Identifier),
                CancellationToken.None).GetAwaiter().GetResult();
            var viewModel = new MainViewModel(store, new FakeLightDeviceClient());

            Assert.True(viewModel.CanStartSchedule);

            viewModel.LightIdentifier = "A1B2C3D4E5F7";

            Assert.False(viewModel.CanStartSchedule);
        });
    }

    [Fact]
    public async Task MainViewModel_NormalizesHostThroughTestConfirmationAndStartGate()
    {
        await WithStoreAsync(async store =>
        {
            var client = new FakeLightDeviceClient();
            var viewModel = new MainViewModel(store, client);
            viewModel.AddPoint();
            viewModel.AddPoint();
            viewModel.Host = $"  {Host}  ";
            viewModel.LightIdentifier = Identifier;

            await viewModel.TestConnectionAsync();
            Assert.Equal((Host, Port), Assert.Single(client.TestedEndpoints));

            await viewModel.SendUserInitiatedTestCommandAsync();
            await viewModel.ConfirmPhysicalResponseAsync();

            var saved = store.Load();
            Assert.Equal(Host, viewModel.Host);
            Assert.Equal(Host, saved.Host);
            Assert.Equal(Host, saved.VerifiedHost);
            Assert.True(viewModel.CanStartSchedule);
        });
    }

    [Fact]
    public async Task MainViewModel_MalformedPersistedIdentifierCannotEnableStart()
    {
        await WithStoreAsync(async store =>
        {
            const string invalidIdentifier = "invalid-id";
            await store.SaveAsync(
                new LightControlSettings(
                    Host,
                    Port,
                    invalidIdentifier,
                    ValidSchedule(),
                    Host,
                    Port,
                    invalidIdentifier),
                CancellationToken.None);

            var viewModel = new MainViewModel(store, new FakeLightDeviceClient());

            Assert.False(viewModel.CanStartSchedule);
            Assert.False(viewModel.IsDeviceVerified);
        });
    }

    [Fact]
    public void SchedulePointViewModel_ShowsRussianRangeErrors()
    {
        var point = new SchedulePointViewModel(
            new SchedulePoint(new TimeOnly(12, 0), LightPower.On, 32, 16));

        point.TimeText = "25:10";
        point.Power = null;
        point.Brightness = 65;
        point.Warmth = 33;

        Assert.Contains("ЧЧ:ММ", point.TimeError, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("Выберите", point.PowerError, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("0–64", point.BrightnessError, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("0–32", point.WarmthError, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public void MainViewModel_StartupLoadsSettingsWithoutSendingCommands()
    {
        WithStore(store =>
        {
            var client = new FakeLightDeviceClient();

            var viewModel = new MainViewModel(store, client);

            Assert.Equal(0, client.ConnectionTests);
            Assert.Empty(client.Commands);
        });
    }

    [Fact]
    public async Task MainViewModel_ManualConfirmationUnlocksOnlyAfterUserConfirms()
    {
        await WithStoreAsync(async store =>
        {
            var client = new FakeLightDeviceClient();
            var viewModel = new MainViewModel(store, client);
            viewModel.AddPoint();
            viewModel.AddPoint();
            viewModel.Host = Host;
            viewModel.LightIdentifier = Identifier;

            await viewModel.SendUserInitiatedTestCommandAsync();

            Assert.Single(client.Commands);
            Assert.Equal(LightCommand.TurnOn, client.Commands[0].Command);
            Assert.False(viewModel.CanStartSchedule);
            Assert.Null(store.Load().VerifiedHost);

            await viewModel.ConfirmPhysicalResponseAsync();

            Assert.True(viewModel.CanStartSchedule);
            Assert.Equal(Host, store.Load().VerifiedHost);
            Assert.Equal(Identifier, store.Load().VerifiedLightIdentifier);
        });
    }

    [Fact]
    public async Task MainViewModel_ScheduleEditorCanSortRemoveAndSaveLocally()
    {
        await WithStoreAsync(async store =>
        {
            var viewModel = new MainViewModel(store, new FakeLightDeviceClient());
            viewModel.AddPoint();
            viewModel.AddPoint();
            viewModel.SchedulePoints[0].TimeText = "20:00";
            viewModel.SchedulePoints[1].TimeText = "06:00";

            viewModel.SortSchedule();
            await viewModel.SaveAsync();

            Assert.Equal("06:00", viewModel.SchedulePoints[0].TimeText);
            Assert.Equal(new TimeOnly(6, 0), store.Load().Schedule[0].Time);
            viewModel.RemovePoint(viewModel.SchedulePoints[1]);
            Assert.Single(viewModel.SchedulePoints);
        });
    }

    [Fact]
    public void MainViewModel_CorruptSettingsRemainVisibleAndUseSafeDefaults()
    {
        var directory = Path.Combine(
            Environment.CurrentDirectory, "main-view-model-test-data", Guid.NewGuid().ToString("N"));
        try
        {
            Directory.CreateDirectory(directory);
            File.WriteAllText(
                Path.Combine(directory, "settings.json"), "{ broken json");
            var client = new FakeLightDeviceClient();

            var viewModel = new MainViewModel(new SettingsStore(directory), client);

            Assert.True(viewModel.HasError);
            Assert.Contains("повреждён", viewModel.ErrorMessage, StringComparison.OrdinalIgnoreCase);
            Assert.Equal(LightControlSettings.SafeDefaults.Host, viewModel.Host);
            Assert.Empty(client.Commands);
        }
        finally
        {
            if (Directory.Exists(directory))
            {
                Directory.Delete(directory, recursive: true);
            }
        }
    }

    [Fact]
    public async Task MainViewModel_SuccessfulTcpTestPreservesCorruptSettingsWarningUntilSave()
    {
        var directory = Path.Combine(
            Environment.CurrentDirectory, "main-view-model-test-data", Guid.NewGuid().ToString("N"));
        try
        {
            Directory.CreateDirectory(directory);
            File.WriteAllText(
                Path.Combine(directory, "settings.json"), "{ broken json");
            var client = new FakeLightDeviceClient();
            var viewModel = new MainViewModel(new SettingsStore(directory), client);
            var warning = viewModel.ErrorMessage;

            await viewModel.TestConnectionAsync();

            Assert.Equal(1, client.ConnectionTests);
            Assert.Contains("повреждён", viewModel.ErrorMessage, StringComparison.OrdinalIgnoreCase);
            Assert.Equal(warning, viewModel.ErrorMessage);

            viewModel.AddPoint();
            viewModel.AddPoint();
            await viewModel.SaveAsync();

            Assert.Null(viewModel.ErrorMessage);
            Assert.False(viewModel.HasError);
            Assert.NotEmpty(new SettingsStore(directory).Load().Schedule);
        }
        finally
        {
            if (Directory.Exists(directory))
            {
                Directory.Delete(directory, recursive: true);
            }
        }
    }

    private const string Host = "192.168.1.26";
    private const int Port = 8899;
    private const string Identifier = "A1B2C3D4E5F6";

    private static IReadOnlyList<SchedulePoint> ValidSchedule() =>
    [
        new SchedulePoint(new TimeOnly(6, 0), LightPower.On, 32, 16),
        new SchedulePoint(new TimeOnly(20, 0), LightPower.Off, 0, 0)
    ];

    private static void WithStore(Action<SettingsStore> action)
    {
        var directory = Path.Combine(
            Environment.CurrentDirectory, "main-view-model-test-data", Guid.NewGuid().ToString("N"));
        try
        {
            action(new SettingsStore(directory));
        }
        finally
        {
            if (Directory.Exists(directory))
            {
                Directory.Delete(directory, recursive: true);
            }
        }
    }

    private static async Task WithStoreAsync(Func<SettingsStore, Task> action)
    {
        var directory = Path.Combine(
            Environment.CurrentDirectory, "main-view-model-test-data", Guid.NewGuid().ToString("N"));
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
        public List<(string Host, int Port)> TestedEndpoints { get; } = [];
        public List<(string Host, int Port, string Identifier, LightCommand Command, int? Value)> Commands { get; } = [];

        public Task TestConnectionAsync(string host, int port, CancellationToken cancellationToken)
        {
            cancellationToken.ThrowIfCancellationRequested();
            ConnectionTests++;
            TestedEndpoints.Add((host, port));
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
            Commands.Add((host, port, lightIdentifier, command, value));
            return Task.CompletedTask;
        }
    }
}
