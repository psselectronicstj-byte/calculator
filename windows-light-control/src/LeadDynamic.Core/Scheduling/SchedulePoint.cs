namespace LeadDynamic.Core.Scheduling;

public enum LightPower
{
    On,
    Off
}

public sealed record SchedulePoint(
    TimeOnly Time,
    LightPower Power,
    byte Brightness,
    byte Warmth);

public sealed record LightState(
    LightPower Power,
    byte Brightness,
    byte Warmth);
