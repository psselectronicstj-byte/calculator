using LeadDynamic.Core.Configuration;
using LeadDynamic.Core.Networking;
using LeadDynamic.Core.Protocol;

namespace LeadDynamic.Core.Scheduling;

public sealed class LightScheduleRunner
{
    private static readonly TimeSpan MinimumFrameInterval = TimeSpan.FromMilliseconds(500);
    private static readonly TimeSpan MinimumPollInterval = TimeSpan.FromSeconds(1);

    private readonly ILightDeviceClient _client;
    private readonly TimeProvider _timeProvider;
    private readonly SemaphoreSlim _runGate = new(1, 1);
    private long? _lastFrameTimestamp;

    public LightScheduleRunner(ILightDeviceClient client, TimeProvider? timeProvider = null)
    {
        ArgumentNullException.ThrowIfNull(client);
        _client = client;
        _timeProvider = timeProvider ?? TimeProvider.System;
    }

    public async Task RunAsync(
        LightControlSettings settings,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(settings);
        cancellationToken.ThrowIfCancellationRequested();
        EnsureVerified(settings);

        var schedule = ScheduleEvaluator.ValidateAndSort(settings.Schedule);
        await _runGate.WaitAsync(cancellationToken).ConfigureAwait(false);
        try
        {
            LightPower? appliedPower = null;
            byte? appliedBrightness = null;
            byte? appliedWarmth = null;
            TimeSpan? pollInterval = null;
            long lastEvaluationTimestamp = 0;

            while (true)
            {
                cancellationToken.ThrowIfCancellationRequested();
                if (pollInterval is TimeSpan previousPollInterval)
                {
                    var elapsed = _timeProvider.GetElapsedTime(
                        lastEvaluationTimestamp,
                        _timeProvider.GetTimestamp());
                    var remaining = previousPollInterval - elapsed;
                    if (remaining > TimeSpan.Zero)
                    {
                        await Task.Delay(remaining, _timeProvider, cancellationToken)
                            .ConfigureAwait(false);
                    }
                }

                cancellationToken.ThrowIfCancellationRequested();
                var now = _timeProvider.GetLocalNow();
                var desired = Evaluate(schedule, now);
                lastEvaluationTimestamp = _timeProvider.GetTimestamp();
                pollInterval = GetPollInterval(schedule, now.TimeOfDay);

                while (true)
                {
                    cancellationToken.ThrowIfCancellationRequested();
                    var command = GetNextCommand(
                        desired,
                        appliedPower,
                        appliedBrightness,
                        appliedWarmth);
                    if (command is null)
                    {
                        break;
                    }

                    await WaitForFrameSpacingAsync(_lastFrameTimestamp, cancellationToken)
                        .ConfigureAwait(false);
                    cancellationToken.ThrowIfCancellationRequested();
                    if (_timeProvider.GetElapsedTime(
                            lastEvaluationTimestamp,
                            _timeProvider.GetTimestamp()) >= pollInterval.Value)
                    {
                        break;
                    }

                    await _client.SendCommandAsync(
                        settings.Host,
                        settings.Port,
                        settings.LightIdentifier,
                        command.Value.Command,
                        command.Value.Value,
                        cancellationToken).ConfigureAwait(false);

                    switch (command.Value.Command)
                    {
                        case LightCommand.TurnOn:
                            appliedPower = LightPower.On;
                            break;
                        case LightCommand.TurnOff:
                            appliedPower = LightPower.Off;
                            break;
                        case LightCommand.Brightness:
                            appliedBrightness = (byte)command.Value.Value!.Value;
                            break;
                        case LightCommand.Warmth:
                            appliedWarmth = (byte)command.Value.Value!.Value;
                            break;
                        default:
                            throw new InvalidOperationException("Unsupported light command.");
                    }

                    _lastFrameTimestamp = _timeProvider.GetTimestamp();
                }
            }
        }
        finally
        {
            _runGate.Release();
        }
    }

    private async Task WaitForFrameSpacingAsync(
        long? lastFrameTimestamp,
        CancellationToken cancellationToken)
    {
        if (lastFrameTimestamp is not long previousTimestamp)
        {
            return;
        }

        var elapsed = _timeProvider.GetElapsedTime(
            previousTimestamp,
            _timeProvider.GetTimestamp());
        var remaining = MinimumFrameInterval - elapsed;
        if (remaining > TimeSpan.Zero)
        {
            await Task.Delay(remaining, _timeProvider, cancellationToken)
                .ConfigureAwait(false);
        }
    }

    private static LightState Evaluate(
        IReadOnlyList<SchedulePoint> schedule,
        DateTimeOffset localNow) =>
        ScheduleEvaluator.EvaluateAt(schedule, TimeOnly.FromDateTime(localNow.DateTime));

    private static (LightCommand Command, int? Value)? GetNextCommand(
        LightState desired,
        LightPower? appliedPower,
        byte? appliedBrightness,
        byte? appliedWarmth)
    {
        if (desired.Power == LightPower.On && appliedPower != LightPower.On)
        {
            return (LightCommand.TurnOn, null);
        }

        if (desired.Power == LightPower.Off && appliedPower != LightPower.Off)
        {
            return (LightCommand.TurnOff, null);
        }

        if (appliedBrightness != desired.Brightness)
        {
            return (LightCommand.Brightness, desired.Brightness);
        }

        if (appliedWarmth != desired.Warmth)
        {
            return (LightCommand.Warmth, desired.Warmth);
        }

        return null;
    }

    private static TimeSpan GetPollInterval(
        IReadOnlyList<SchedulePoint> schedule,
        TimeSpan timeOfDay)
    {
        var currentTime = TimeOnly.FromTimeSpan(timeOfDay);
        var startIndex = schedule.Count - 1;
        for (var index = 0; index < schedule.Count; index++)
        {
            if (schedule[index].Time > currentTime)
            {
                break;
            }

            startIndex = index;
        }

        var start = schedule[startIndex].Time;
        var next = schedule[(startIndex + 1) % schedule.Count].Time;
        var intervalTicks = next.Ticks - start.Ticks;
        if (intervalTicks <= 0)
        {
            intervalTicks += TimeSpan.TicksPerDay;
        }

        var ticksPerPoll = (intervalTicks + 63) / 64;
        return TimeSpan.FromTicks(Math.Max(MinimumPollInterval.Ticks, ticksPerPoll));
    }

    private static void EnsureVerified(LightControlSettings settings)
    {
        if (string.IsNullOrWhiteSpace(settings.Host) ||
            settings.Port is < 1 or > 65535 ||
            !LightCommandEncoder.IsValidIdentifier(settings.LightIdentifier) ||
            string.IsNullOrWhiteSpace(settings.VerifiedHost) ||
            settings.VerifiedPort is null ||
            string.IsNullOrWhiteSpace(settings.VerifiedLightIdentifier) ||
            !string.Equals(settings.VerifiedHost, settings.Host, StringComparison.OrdinalIgnoreCase) ||
            settings.VerifiedPort != settings.Port ||
            !string.Equals(
                settings.VerifiedLightIdentifier,
                settings.LightIdentifier,
                StringComparison.OrdinalIgnoreCase))
        {
            throw new InvalidOperationException(
                "The configured endpoint and light identifier must be verified before scheduling.");
        }
    }
}
