using System.Text.Json;

namespace LeadDynamic.Core.Configuration;

public sealed class SettingsStore
{
    private const string SettingsFileName = "settings.json";
    private static readonly JsonSerializerOptions SerializerOptions = new()
    {
        WriteIndented = true,
        PropertyNameCaseInsensitive = true
    };

    private readonly string _directory;
    private readonly string _settingsPath;

    public SettingsStore(string? directory = null)
    {
        _directory = directory ?? Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
            "LeadDynamicLightControl");
        _settingsPath = Path.Combine(_directory, SettingsFileName);
    }

    public LightControlSettings Load()
    {
        if (!File.Exists(_settingsPath))
        {
            return LightControlSettings.SafeDefaults;
        }

        try
        {
            var settings = JsonSerializer.Deserialize<LightControlSettings>(
                File.ReadAllText(_settingsPath),
                SerializerOptions);
            if (settings is null ||
                settings.Host is null ||
                settings.LightIdentifier is null ||
                settings.Schedule is null ||
                settings.Schedule.Any(point => point is null))
            {
                throw new JsonException("The settings document is missing required values or contains a null schedule point.");
            }

            return settings;
        }
        catch (Exception exception) when (
            exception is JsonException or IOException or UnauthorizedAccessException)
        {
            throw new SettingsLoadException(
                $"Could not load settings from '{_settingsPath}'. Safe defaults are available.",
                LightControlSettings.SafeDefaults,
                exception);
        }
    }

    public async Task SaveAsync(
        LightControlSettings settings,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(settings);
        ArgumentNullException.ThrowIfNull(settings.Schedule);
        cancellationToken.ThrowIfCancellationRequested();

        Directory.CreateDirectory(_directory);
        await using var stream = new FileStream(
            _settingsPath,
            FileMode.Create,
            FileAccess.Write,
            FileShare.None,
            bufferSize: 4096,
            useAsync: true);
        await JsonSerializer.SerializeAsync(
            stream,
            settings,
            SerializerOptions,
            cancellationToken).ConfigureAwait(false);
    }
}

public sealed class SettingsLoadException : Exception
{
    public SettingsLoadException(
        string message,
        LightControlSettings safeDefaults,
        Exception innerException)
        : base(message, innerException)
    {
        SafeDefaults = safeDefaults;
    }

    public LightControlSettings SafeDefaults { get; }
}
