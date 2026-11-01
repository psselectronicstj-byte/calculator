using LeadDynamic.Core.Scheduling;

namespace LeadDynamic.Core.Tests.Scheduling;

public class ScheduleEvaluatorTests
{
    [Theory]
    [InlineData(65, 0)]
    [InlineData(0, 33)]
    public void ValidateAndSort_RejectsOutOfRangeValues(int brightness, int warmth)
    {
        var points = new[]
        {
            Point(6, 0, LightPower.On, (byte)brightness, (byte)warmth),
            Point(18, 0, LightPower.Off, 0, 0)
        };

        Assert.Throws<ArgumentOutOfRangeException>(
            () => ScheduleEvaluator.ValidateAndSort(points));
    }

    [Fact]
    public void ValidateAndSort_RequiresTwoPoints()
    {
        Assert.Throws<ArgumentException>(
            () => ScheduleEvaluator.ValidateAndSort([Point(6, 0, LightPower.On, 10, 5)]));
    }

    [Fact]
    public void ValidateAndSort_RejectsDuplicateTimes()
    {
        var points = new[]
        {
            Point(6, 0, LightPower.On, 10, 5),
            Point(6, 0, LightPower.Off, 0, 0)
        };

        Assert.Throws<ArgumentException>(
            () => ScheduleEvaluator.ValidateAndSort(points));
    }

    [Fact]
    public void ValidateAndSort_RejectsSubminuteTimes()
    {
        var points = new[]
        {
            new SchedulePoint(new TimeOnly(6, 0, 1), LightPower.On, 10, 5),
            Point(18, 0, LightPower.Off, 0, 0)
        };

        Assert.Throws<ArgumentException>(
            () => ScheduleEvaluator.ValidateAndSort(points));
    }

    [Fact]
    public void ValidateAndSort_RejectsInvalidPower()
    {
        var points = new[]
        {
            Point(6, 0, (LightPower)99, 10, 5),
            Point(18, 0, LightPower.Off, 0, 0)
        };

        Assert.Throws<ArgumentOutOfRangeException>(
            () => ScheduleEvaluator.ValidateAndSort(points));
    }

    [Fact]
    public void ValidateAndSort_SortsByTime()
    {
        var late = Point(18, 0, LightPower.Off, 0, 0);
        var early = Point(6, 0, LightPower.On, 10, 5);

        var sorted = ScheduleEvaluator.ValidateAndSort([late, early]);

        Assert.Equal([early, late], sorted);
    }

    [Fact]
    public void EvaluateAt_UsesNewIntervalAtExactBoundary()
    {
        var schedule = ScheduleEvaluator.ValidateAndSort(
        [
            Point(6, 0, LightPower.On, 10, 4),
            Point(12, 0, LightPower.Off, 20, 8),
            Point(18, 0, LightPower.On, 30, 12)
        ]);

        Assert.Equal(
            new LightState(LightPower.Off, 30, 12),
            ScheduleEvaluator.EvaluateAt(schedule, new TimeOnly(12, 0)));
        Assert.Equal(
            new LightState(LightPower.On, 30, 12),
            ScheduleEvaluator.EvaluateAt(schedule, new TimeOnly(18, 0)));
    }

    [Fact]
    public void EvaluateAt_InterpolatesOnIntervalWithTruncation()
    {
        var schedule = ScheduleEvaluator.ValidateAndSort(
        [
            Point(10, 0, LightPower.On, 10, 4),
            Point(10, 4, LightPower.On, 5, 0)
        ]);

        Assert.Equal(
            new LightState(LightPower.On, 8, 3),
            ScheduleEvaluator.EvaluateAt(schedule, new TimeOnly(10, 1)));
        Assert.Equal(
            new LightState(LightPower.On, 6, 1),
            ScheduleEvaluator.EvaluateAt(schedule, new TimeOnly(10, 3)));
    }

    [Fact]
    public void EvaluateAt_UsesNextTargetWhenOff()
    {
        var schedule = ScheduleEvaluator.ValidateAndSort(
        [
            Point(6, 0, LightPower.On, 10, 4),
            Point(12, 0, LightPower.Off, 20, 8),
            Point(18, 0, LightPower.On, 30, 12)
        ]);

        Assert.Equal(
            new LightState(LightPower.Off, 30, 12),
            ScheduleEvaluator.EvaluateAt(schedule, new TimeOnly(15, 30)));
    }

    [Fact]
    public void EvaluateAt_InterpolatesAcrossMidnight()
    {
        var schedule = ScheduleEvaluator.ValidateAndSort(
        [
            Point(1, 0, LightPower.On, 20, 0),
            Point(23, 0, LightPower.On, 10, 20)
        ]);

        Assert.Equal(
            new LightState(LightPower.On, 15, 10),
            ScheduleEvaluator.EvaluateAt(schedule, new TimeOnly(0, 0)));
    }

    [Fact]
    public void GetNextPoint_ReturnsFirstPointAfterTimeAndWrapsAtMidnight()
    {
        var schedule = ScheduleEvaluator.ValidateAndSort(
        [
            Point(6, 0, LightPower.On, 10, 4),
            Point(18, 0, LightPower.Off, 0, 0)
        ]);

        Assert.Equal(Point(18, 0, LightPower.Off, 0, 0),
            ScheduleEvaluator.GetNextPoint(schedule, new TimeOnly(6, 0)));
        Assert.Equal(Point(6, 0, LightPower.On, 10, 4),
            ScheduleEvaluator.GetNextPoint(schedule, new TimeOnly(23, 59)));
    }

    private static SchedulePoint Point(
        int hour, int minute, LightPower power, byte brightness, byte warmth) =>
        new(new TimeOnly(hour, minute), power, brightness, warmth);
}
