using System.Text;

namespace LeadDynamic.Core.Protocol;

public static class LightCommandEncoder
{
    public const int FrameLength = 12;

    public static byte[] Encode(string lightIdentifier, LightCommand command, int? value = null)
    {
        ValidateIdentifier(lightIdentifier);
        var (command0, command1, command2) = GetCommandBytes(command, value);

        var frame = new byte[FrameLength];
        var identifierBytes = Encoding.ASCII.GetBytes(lightIdentifier.Substring(9, 3));
        frame[0] = 0x55;
        identifierBytes.CopyTo(frame, 1);
        frame[4] = 0x01;
        frame[6] = command0;
        frame[7] = command1;
        frame[8] = command2;
        frame[9] = unchecked((byte)frame.Skip(4).Take(5).Sum(field => field));
        frame[10] = 0xAA;
        frame[11] = 0xAA;
        return frame;
    }

    private static void ValidateIdentifier(string lightIdentifier)
    {
        ArgumentNullException.ThrowIfNull(lightIdentifier);
        if (lightIdentifier.Length != 12 || !lightIdentifier.All(Uri.IsHexDigit))
        {
            throw new ArgumentException(
                "The light identifier must contain exactly 12 hexadecimal characters.",
                nameof(lightIdentifier));
        }
    }

    private static (byte First, byte Second, byte Third) GetCommandBytes(
        LightCommand command,
        int? value)
    {
        switch (command)
        {
            case LightCommand.TurnOn:
                EnsureValueIsAbsent(value, command);
                return (0x02, 0x12, 0xAB);
            case LightCommand.TurnOff:
                EnsureValueIsAbsent(value, command);
                return (0x02, 0x12, 0xA9);
            case LightCommand.Brightness:
                return (0x08, 0x33, ValidateValue(value, 0, 64, command));
            case LightCommand.Warmth:
                return (0x08, 0x36, ValidateValue(value, 0, 32, command));
            default:
                throw new ArgumentOutOfRangeException(nameof(command), command, "Unknown light command.");
        }
    }

    private static void EnsureValueIsAbsent(int? value, LightCommand command)
    {
        if (value is not null)
        {
            throw new ArgumentException($"The {command} command does not accept a value.", nameof(value));
        }
    }

    private static byte ValidateValue(int? value, int minimum, int maximum, LightCommand command)
    {
        if (value is null)
        {
            throw new ArgumentException($"The {command} command requires a value.", nameof(value));
        }

        if (value < minimum || value > maximum)
        {
            throw new ArgumentOutOfRangeException(
                nameof(value), value, $"The {command} value must be between {minimum} and {maximum}.");
        }

        return (byte)value.Value;
    }
}
