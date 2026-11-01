namespace LeadDynamic.Core.Scheduling;

public static class ScheduleEvaluator
{
    private const byte MaximumBrightness = 64;
    private const byte MaximumWarmth = 32;

    public static IReadOnlyList<SchedulePoint> ValidateAndSort(
        IReadOnlyList<SchedulePoint> points)
    {
        ArgumentNullException.ThrowIfNull(points);

        if (points.Count < 2)
        {
            throw new ArgumentException("A schedule must contain at least two points.", nameof(points));
        }

        foreach (var point in points)
        {
            ArgumentNullException.ThrowIfNull(point);

            if (point.Time.Ticks % TimeSpan.TicksPerMinute != 0)
            {
                throw new ArgumentException("Schedule point times must have minute precision.", nameof(points));
            }

            if (point.Brightness > MaximumBrightness)
            {
                throw new ArgumentOutOfRangeException(
                    nameof(points), point.Brightness, $"Brightness must be between 0 and {MaximumBrightness}.");
            }

            if (point.Warmth > MaximumWarmth)
            {
                throw new ArgumentOutOfRangeException(
                    nameof(points), point.Warmth, $"Warmth must be between 0 and {MaximumWarmth}.");
            }
        }

        var sorted = points.OrderBy(point => point.Time).ToArray();
        for (var index = 1; index < sorted.Length; index++)
        {
            if (sorted[index - 1].Time == sorted[index].Time)
            {
                throw new ArgumentException("Schedule point times must be unique.", nameof(points));
            }
        }

        return sorted;
    }

    public static LightState EvaluateAt(
        IReadOnlyList<SchedulePoint> sortedPoints,
        TimeOnly time)
    {
        ArgumentNullException.ThrowIfNull(sortedPoints);
        if (sortedPoints.Count < 2)
        {
            throw new ArgumentException("A schedule must contain at least two points.", nameof(sortedPoints));
        }

        var startIndex = FindIntervalStartIndex(sortedPoints, time);
        var start = sortedPoints[startIndex];
        var next = sortedPoints[(startIndex + 1) % sortedPoints.Count];

        if (start.Power == LightPower.Off)
        {
            return new LightState(LightPower.Off, next.Brightness, next.Warmth);
        }

        var elapsedTicks = time.Ticks - start.Time.Ticks;
        if (elapsedTicks < 0)
        {
            elapsedTicks += TimeSpan.TicksPerDay;
        }

        var intervalTicks = next.Time.Ticks - start.Time.Ticks;
        if (intervalTicks <= 0)
        {
            intervalTicks += TimeSpan.TicksPerDay;
        }

        return new LightState(
            LightPower.On,
            Interpolate(start.Brightness, next.Brightness, elapsedTicks, intervalTicks),
            Interpolate(start.Warmth, next.Warmth, elapsedTicks, intervalTicks));
    }

    public static SchedulePoint GetNextPoint(
        IReadOnlyList<SchedulePoint> sortedPoints,
        TimeOnly time)
    {
        ArgumentNullException.ThrowIfNull(sortedPoints);
        if (sortedPoints.Count < 2)
        {
            throw new ArgumentException("A schedule must contain at least two points.", nameof(sortedPoints));
        }

        for (var index = 0; index < sortedPoints.Count; index++)
        {
            if (sortedPoints[index].Time > time)
            {
                return sortedPoints[index];
            }
        }

        return sortedPoints[0];
    }

    private static int FindIntervalStartIndex(
        IReadOnlyList<SchedulePoint> sortedPoints,
        TimeOnly time)
    {
        var latestIndex = sortedPoints.Count - 1;
        for (var index = 0; index < sortedPoints.Count; index++)
        {
            if (sortedPoints[index].Time > time)
            {
                break;
            }

            latestIndex = index;
        }

        return latestIndex;
    }

    private static byte Interpolate(
        byte start,
        byte target,
        long elapsedTicks,
        long intervalTicks)
    {
        var fraction = (double)elapsedTicks / intervalTicks;
        var value = start + (target - start) * fraction;
        return (byte)Math.Truncate(value);
    }
}
