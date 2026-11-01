using LeadDynamic.Core.Scheduling;

namespace LeadDynamic.Core.Configuration;

public sealed record LightControlSettings(
    string Host,
    int Port,
    string LightIdentifier,
    IReadOnlyList<SchedulePoint> Schedule,
    string? VerifiedHost,
    int? VerifiedPort,
    string? VerifiedLightIdentifier)
{
    public static LightControlSettings SafeDefaults { get; } = new(
        "10.10.100.254",
        8899,
        string.Empty,
        Array.Empty<SchedulePoint>(),
        null,
        null,
        null);
}
