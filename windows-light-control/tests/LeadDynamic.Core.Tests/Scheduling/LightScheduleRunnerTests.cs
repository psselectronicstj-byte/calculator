using LeadDynamic.Core.Configuration;
using LeadDynamic.Core.Networking;
using LeadDynamic.Core.Protocol;
using LeadDynamic.Core.Scheduling;

namespace LeadDynamic.Core.Tests.Scheduling;

public sealed class LightScheduleRunnerTests
{
    private const string Host = "192.168.1.25";
    private const int Port = 8899;
    private const string Identifier = "A1B2C3D4E5F6";

    [Fact]
    public async Task RunAsync_RejectsUnverifiedEndpoint()
    {
        var timeProvider = new AdvancingTimeProvider();
        var client = new RecordingLightDeviceClient(timeProvider);
        var runner = new LightScheduleRunner(client, timeProvider);

        await Assert.ThrowsAsync<InvalidOperationException>(
            () => runner.RunAsync(Settings(verifiedHost: null), CancellationToken.None));

        Assert.Empty(client.Commands);

        await Assert.ThrowsAsync<InvalidOperationException>(
            () => runner.RunAsync(Settings(verifiedHost: "192.168.1.26"), CancellationToken.None));

        Assert.Empty(client.Commands);

        await Assert.ThrowsAsync<InvalidOperationException>(
            () => runner.RunAsync(Settings(verifiedPort: 8890), CancellationToken.None));

        Assert.Empty(client.Commands);

        await Assert.ThrowsAsync<InvalidOperationException>(
            () => runner.RunAsync(Settings(verifiedIdentifier: "A1B2C3D4E5F7"), CancellationToken.None));

        Assert.Empty(client.Commands);
    }

    [Fact]
    public async Task RunAsync_UsesAtMost64StepsPerInterval()
    {
        var timeProvider = new AdvancingTimeProvider();
        using var cancellation = new CancellationTokenSource();
        RecordingLightDeviceClient client = null!;
        client = new RecordingLightDeviceClient(timeProvider, onSend: (_, _) =>
        {
            if (client!.Commands.Count >= 4)
            {
                cancellation.Cancel();
            }

            return Task.CompletedTask;
        });
        var runner = new LightScheduleRunner(client, timeProvider);

        await Assert.ThrowsAnyAsync<OperationCanceledException>(
            () => runner.RunAsync(Settings(), cancellation.Token));

        Assert.Contains(TimeSpan.FromSeconds(3.75), timeProvider.Delays);
    }

    [Fact]
    public async Task RunAsync_SpacesFramesBy500Milliseconds()
    {
        var timeProvider = new AdvancingTimeProvider();
        using var cancellation = new CancellationTokenSource();
        RecordingLightDeviceClient client = null!;
        client = new RecordingLightDeviceClient(timeProvider, onSend: (command, _) =>
        {
            if (client!.Commands.Count >= 5)
            {
                cancellation.Cancel();
            }

            return Task.CompletedTask;
        });
        var runner = new LightScheduleRunner(client, timeProvider);

        await Assert.ThrowsAnyAsync<OperationCanceledException>(
            () => runner.RunAsync(Settings(), cancellation.Token));

        Assert.True(client.Commands.Count >= 2);
        Assert.All(
            client.Commands.Zip(client.Commands.Skip(1)),
            pair => Assert.True(pair.Second.At - pair.First.At >= TimeSpan.FromMilliseconds(500)));
    }

    [Fact]
    public async Task RunAsync_DoesNotOverlapWrites()
    {
        var timeProvider = new AdvancingTimeProvider();
        using var cancellation = new CancellationTokenSource();
        RecordingLightDeviceClient client = null!;
        client = new RecordingLightDeviceClient(timeProvider, onSend: async (_, _) =>
        {
            await Task.Yield();
            if (client!.Commands.Count >= 5)
            {
                cancellation.Cancel();
            }
        }, delayWrites: true);
        var runner = new LightScheduleRunner(client, timeProvider);

        await Assert.ThrowsAnyAsync<OperationCanceledException>(
            () => runner.RunAsync(Settings(), cancellation.Token));

        Assert.Equal(1, client.MaximumConcurrentWrites);
    }

    [Fact]
    public async Task RunAsync_RecalculatesAfterDelayedWrite()
    {
        var timeProvider = new AdvancingTimeProvider();
        using var cancellation = new CancellationTokenSource();
        RecordingLightDeviceClient client = null!;
        var firstWrite = true;
        client = new RecordingLightDeviceClient(timeProvider, onSend: (_, _) =>
        {
            if (firstWrite)
            {
                firstWrite = false;
                timeProvider.Advance(TimeSpan.FromMinutes(1));
            }

            if (client!.Commands.Count >= 3)
            {
                cancellation.Cancel();
            }

            return Task.CompletedTask;
        });
        var runner = new LightScheduleRunner(client, timeProvider);

        await Assert.ThrowsAnyAsync<OperationCanceledException>(
            () => runner.RunAsync(Settings(), cancellation.Token));

        var firstBrightness = Assert.Single(
            client.Commands,
            command => command.Command == LightCommand.Brightness);
        Assert.Equal(16, firstBrightness.Value);
    }

    [Fact]
    public async Task RunAsync_OffIntervalAppliesNextPointAndTurnsOff()
    {
        var timeProvider = new AdvancingTimeProvider(
            new DateTimeOffset(2026, 11, 1, 12, 0, 0, TimeSpan.Zero));
        using var cancellation = new CancellationTokenSource();
        RecordingLightDeviceClient client = null!;
        client = new RecordingLightDeviceClient(timeProvider, onSend: (_, _) =>
        {
            if (client.Commands.Count >= 3)
            {
                cancellation.Cancel();
            }

            return Task.CompletedTask;
        });
        var settings = new LightControlSettings(
            Host,
            Port,
            Identifier,
            [
                new SchedulePoint(new TimeOnly(6, 0), LightPower.On, 8, 4),
                new SchedulePoint(new TimeOnly(12, 0), LightPower.Off, 64, 32)
            ],
            Host,
            Port,
            Identifier);
        var runner = new LightScheduleRunner(client, timeProvider);

        await Assert.ThrowsAnyAsync<OperationCanceledException>(
            () => runner.RunAsync(settings, cancellation.Token));

        Assert.Equal(
            [
                (LightCommand.Brightness, (int?)8),
                (LightCommand.Warmth, (int?)4),
                (LightCommand.TurnOff, (int?)null)
            ],
            client.Commands.Select(command => (command.Command, command.Value)));
    }

    [Fact]
    public async Task RunAsync_StopsOnCancellation()
    {
        var timeProvider = new AdvancingTimeProvider();
        using var cancellation = new CancellationTokenSource();
        RecordingLightDeviceClient? client = null;
        client = new RecordingLightDeviceClient(timeProvider, onSend: (_, _) =>
        {
            cancellation.Cancel();
            return Task.CompletedTask;
        });
        var runner = new LightScheduleRunner(client, timeProvider);

        await Assert.ThrowsAnyAsync<OperationCanceledException>(
            () => runner.RunAsync(Settings(), cancellation.Token));

        Assert.Single(client.Commands);
    }

    [Fact]
    public async Task RunAsync_PropagatesWriteFailure()
    {
        var timeProvider = new AdvancingTimeProvider();
        var failure = new IOException("test write failure");
        var client = new RecordingLightDeviceClient(
            timeProvider,
            onSend: (_, _) => Task.FromException(failure));
        var runner = new LightScheduleRunner(client, timeProvider);

        var exception = await Assert.ThrowsAsync<IOException>(
            () => runner.RunAsync(Settings(), CancellationToken.None));

        Assert.Same(failure, exception);
        Assert.Single(client.Commands);
    }

    private static LightControlSettings Settings(
        string? verifiedHost = Host,
        string? verifiedIdentifier = Identifier,
        int? verifiedPort = Port) =>
        new(
            Host,
            Port,
            Identifier,
            [
                new SchedulePoint(new TimeOnly(6, 0), LightPower.On, 0, 0),
                new SchedulePoint(new TimeOnly(6, 4), LightPower.On, 64, 32)
            ],
            verifiedHost,
            verifiedPort,
            verifiedIdentifier);

    private static async Task WaitUntilAsync(Func<bool> condition)
    {
        var deadline = DateTime.UtcNow + TimeSpan.FromSeconds(2);
        while (!condition() && DateTime.UtcNow < deadline)
        {
            await Task.Yield();
        }

        Assert.True(condition(), "The schedule runner did not reach the expected polling delay.");
    }

    private sealed class RecordingLightDeviceClient : ILightDeviceClient
    {
        private readonly AdvancingTimeProvider _timeProvider;
        private readonly Func<LightCommand, int?, Task>? _onSend;
        private readonly bool _delayWrites;
        private int _activeWrites;

        public RecordingLightDeviceClient(
            AdvancingTimeProvider timeProvider,
            Func<LightCommand, int?, Task>? onSend = null,
            bool delayWrites = false)
        {
            _timeProvider = timeProvider;
            _onSend = onSend;
            _delayWrites = delayWrites;
        }

        public List<RecordedCommand> Commands { get; } = [];

        public int MaximumConcurrentWrites { get; private set; }

        public Task TestConnectionAsync(string host, int port, CancellationToken cancellationToken) =>
            Task.CompletedTask;

        public async Task SendCommandAsync(
            string host,
            int port,
            string lightIdentifier,
            LightCommand command,
            int? value = null,
            CancellationToken cancellationToken = default)
        {
            var active = Interlocked.Increment(ref _activeWrites);
            MaximumConcurrentWrites = Math.Max(MaximumConcurrentWrites, active);
            Commands.Add(new RecordedCommand(command, value, _timeProvider.GetUtcNow()));
            try
            {
                if (_delayWrites)
                {
                    await Task.Delay(1, cancellationToken);
                }

                if (_onSend is not null)
                {
                    await _onSend(command, value);
                }

                cancellationToken.ThrowIfCancellationRequested();
            }
            finally
            {
                Interlocked.Decrement(ref _activeWrites);
            }
        }
    }

    private sealed record RecordedCommand(LightCommand Command, int? Value, DateTimeOffset At);

    private sealed class AdvancingTimeProvider : TimeProvider
    {
        private readonly object _sync = new();
        private DateTimeOffset _utcNow;
        private readonly List<TimeSpan> _delays = [];

        public AdvancingTimeProvider(DateTimeOffset? utcNow = null)
        {
            _utcNow = utcNow ?? new DateTimeOffset(2026, 11, 1, 6, 0, 0, TimeSpan.Zero);
        }

        public IReadOnlyList<TimeSpan> Delays
        {
            get
            {
                lock (_sync)
                {
                    return _delays.ToArray();
                }
            }
        }

        public override TimeZoneInfo LocalTimeZone => TimeZoneInfo.Utc;

        public override long TimestampFrequency => TimeSpan.TicksPerSecond;

        public override DateTimeOffset GetUtcNow()
        {
            lock (_sync)
            {
                return _utcNow;
            }
        }

        public override long GetTimestamp()
        {
            lock (_sync)
            {
                return _utcNow.UtcTicks;
            }
        }

        public void Advance(TimeSpan amount)
        {
            lock (_sync)
            {
                _utcNow += amount;
            }
        }

        public override ITimer CreateTimer(
            TimerCallback callback,
            object? state,
            TimeSpan dueTime,
            TimeSpan period)
        {
            var timer = new AdvancingTimer(this, callback, state);
            timer.Change(dueTime, period);
            return timer;
        }

        private void Schedule(AdvancingTimer timer, TimeSpan dueTime)
        {
            if (dueTime == Timeout.InfiniteTimeSpan)
            {
                return;
            }

            lock (_sync)
            {
                _delays.Add(dueTime);
                _utcNow += dueTime;
            }

            ThreadPool.QueueUserWorkItem(
                static state =>
                {
                    var scheduledTimer = (AdvancingTimer)state!;
                    scheduledTimer.Fire();
                },
                timer);
        }

        private sealed class AdvancingTimer(
            AdvancingTimeProvider owner,
            TimerCallback callback,
            object? state) : ITimer
        {
            private int _disposed;

            public bool Change(TimeSpan dueTime, TimeSpan period)
            {
                if (Volatile.Read(ref _disposed) != 0)
                {
                    return false;
                }

                owner.Schedule(this, dueTime);
                return true;
            }

            public void Dispose() => Interlocked.Exchange(ref _disposed, 1);

            public ValueTask DisposeAsync()
            {
                Dispose();
                return ValueTask.CompletedTask;
            }

            public void Fire()
            {
                if (Volatile.Read(ref _disposed) == 0)
                {
                    callback(state);
                }
            }
        }
    }
}
