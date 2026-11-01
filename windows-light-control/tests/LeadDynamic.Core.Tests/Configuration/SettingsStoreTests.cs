using System.Text.Json;
using LeadDynamic.Core.Configuration;
using LeadDynamic.Core.Scheduling;

namespace LeadDynamic.Core.Tests.Configuration;

public sealed class SettingsStoreTests
{
    [Fact]
    public void Load_MissingFileReturnsSafeDefaults()
    {
        WithDirectory(directory =>
        {
            var settings = new SettingsStore(directory).Load();

            Assert.Equal("10.10.100.254", settings.Host);
            Assert.Equal(8899, settings.Port);
            Assert.Equal(string.Empty, settings.LightIdentifier);
            Assert.Empty(settings.Schedule);
            Assert.Null(settings.VerifiedHost);
            Assert.Null(settings.VerifiedPort);
            Assert.Null(settings.VerifiedLightIdentifier);
        });
    }

    [Fact]
    public async Task SaveAndLoad_RoundTripsSettingsAndVerification()
    {
        await WithDirectoryAsync(async directory =>
        {
            var expected = new LightControlSettings(
                "192.168.1.25",
                8899,
                "A1B2C3D4E5F6",
                [
                    new SchedulePoint(new TimeOnly(6, 0), LightPower.On, 32, 16),
                    new SchedulePoint(new TimeOnly(20, 0), LightPower.Off, 0, 0)
                ],
                "192.168.1.25",
                8899,
                "A1B2C3D4E5F6");
            var store = new SettingsStore(directory);

            await store.SaveAsync(expected, CancellationToken.None);

            var actual = store.Load();
            Assert.Equal(expected.Host, actual.Host);
            Assert.Equal(expected.Port, actual.Port);
            Assert.Equal(expected.LightIdentifier, actual.LightIdentifier);
            Assert.Equal(expected.Schedule, actual.Schedule);
            Assert.Equal(expected.VerifiedHost, actual.VerifiedHost);
            Assert.Equal(expected.VerifiedPort, actual.VerifiedPort);
            Assert.Equal(expected.VerifiedLightIdentifier, actual.VerifiedLightIdentifier);
            Assert.True(File.Exists(Path.Combine(directory, "settings.json")));
        });
    }

    [Fact]
    public void Load_CorruptJsonReturnsExplicitError()
    {
        WithDirectory(directory =>
        {
            Directory.CreateDirectory(directory);
            File.WriteAllText(Path.Combine(directory, "settings.json"), "{ not valid json");

            var exception = Assert.Throws<SettingsLoadException>(
                () => new SettingsStore(directory).Load());

            Assert.Contains("settings.json", exception.Message, StringComparison.OrdinalIgnoreCase);
            Assert.Equal("10.10.100.254", exception.SafeDefaults.Host);
            Assert.Empty(exception.SafeDefaults.Schedule);
            Assert.Null(exception.SafeDefaults.VerifiedHost);
            Assert.Null(exception.SafeDefaults.VerifiedPort);
            Assert.Null(exception.SafeDefaults.VerifiedLightIdentifier);
        });
    }

    [Fact]
    public void Load_NullScheduleEntryReturnsExplicitError()
    {
        WithDirectory(directory =>
        {
            Directory.CreateDirectory(directory);
            File.WriteAllText(
                Path.Combine(directory, "settings.json"),
                """
                {
                  "Host": "192.168.1.25",
                  "Port": 8899,
                  "LightIdentifier": "A1B2C3D4E5F6",
                  "Schedule": [
                    null,
                    { "Time": "18:00:00", "Power": 1, "Brightness": 0, "Warmth": 0 }
                  ],
                  "VerifiedHost": null,
                  "VerifiedPort": null,
                  "VerifiedLightIdentifier": null
                }
                """);

            var exception = Assert.Throws<SettingsLoadException>(
                () => new SettingsStore(directory).Load());

            Assert.IsType<JsonException>(exception.InnerException);
            Assert.Empty(exception.SafeDefaults.Schedule);
        });
    }

    private static void WithDirectory(Action<string> test)
    {
        var directory = CreateTestDirectory();
        try
        {
            test(directory);
        }
        finally
        {
            Directory.Delete(directory, recursive: true);
        }
    }

    private static async Task WithDirectoryAsync(Func<string, Task> test)
    {
        var directory = CreateTestDirectory();
        try
        {
            await test(directory);
        }
        finally
        {
            Directory.Delete(directory, recursive: true);
        }
    }

    private static string CreateTestDirectory()
    {
        var directory = Path.Combine(
            Environment.CurrentDirectory,
            "settings-store-test-data",
            Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(directory);
        return directory;
    }
}
