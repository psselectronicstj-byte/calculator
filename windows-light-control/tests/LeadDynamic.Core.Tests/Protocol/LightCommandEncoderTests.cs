using LeadDynamic.Core.Protocol;

namespace LeadDynamic.Core.Tests.Protocol;

public class LightCommandEncoderTests
{
    private const string Identifier = "A1B2C3D4E5F6";

    [Fact]
    public void Encode_TurnOnMatchesSourceFrame()
    {
        Assert.Equal(
            new byte[] { 0x55, 0x35, 0x46, 0x36, 0x01, 0x00, 0x02, 0x12, 0xAB, 0xC0, 0xAA, 0xAA },
            LightCommandEncoder.Encode(Identifier, LightCommand.TurnOn));
    }

    [Fact]
    public void Encode_TurnOffMatchesSourceFrame()
    {
        Assert.Equal(
            new byte[] { 0x55, 0x35, 0x46, 0x36, 0x01, 0x00, 0x02, 0x12, 0xA9, 0xBE, 0xAA, 0xAA },
            LightCommandEncoder.Encode(Identifier, LightCommand.TurnOff));
    }

    [Fact]
    public void Encode_BrightnessMatchesSourceFrame()
    {
        Assert.Equal(
            new byte[] { 0x55, 0x35, 0x46, 0x36, 0x01, 0x00, 0x08, 0x33, 0x40, 0x7C, 0xAA, 0xAA },
            LightCommandEncoder.Encode(Identifier, LightCommand.Brightness, 64));
    }

    [Fact]
    public void Encode_WarmthMatchesSourceFrame()
    {
        Assert.Equal(
            new byte[] { 0x55, 0x35, 0x46, 0x36, 0x01, 0x00, 0x08, 0x36, 0x20, 0x5F, 0xAA, 0xAA },
            LightCommandEncoder.Encode(Identifier, LightCommand.Warmth, 32));
    }

    [Fact]
    public void Encode_UsesLastThreeIdentifierCharacters()
    {
        var frame = LightCommandEncoder.Encode(Identifier, LightCommand.TurnOn);

        Assert.Equal(new byte[] { 0x35, 0x46, 0x36 }, frame[1..4]);
    }

    [Fact]
    public void Encode_ChecksumIsLowByteOfFrameFields()
    {
        var frame = LightCommandEncoder.Encode(Identifier, LightCommand.Brightness, 17);
        var sum = frame.Skip(4).Take(5).Sum(value => value);

        Assert.Equal(unchecked((byte)sum), frame[9]);
    }

    [Theory]
    [InlineData("")]
    [InlineData("A1B2C3D4E5F")]
    [InlineData("A1B2C3D4E5F66")]
    [InlineData("A1B2C3D4E5FG")]
    public void Encode_RejectsInvalidIdentifier(string identifier)
    {
        Assert.Throws<ArgumentException>(
            () => LightCommandEncoder.Encode(identifier, LightCommand.TurnOn));
    }

    [Theory]
    [InlineData(LightCommand.Brightness, -1)]
    [InlineData(LightCommand.Brightness, 65)]
    [InlineData(LightCommand.Warmth, -1)]
    [InlineData(LightCommand.Warmth, 33)]
    public void Encode_RejectsInvalidValue(LightCommand command, int value)
    {
        Assert.Throws<ArgumentOutOfRangeException>(
            () => LightCommandEncoder.Encode(Identifier, command, value));
    }

    [Theory]
    [InlineData(LightCommand.TurnOn, 1)]
    [InlineData(LightCommand.TurnOff, 1)]
    [InlineData(LightCommand.Brightness, null)]
    [InlineData(LightCommand.Warmth, null)]
    public void Encode_RejectsWrongArgumentShape(LightCommand command, int? value)
    {
        Assert.Throws<ArgumentException>(
            () => LightCommandEncoder.Encode(Identifier, command, value));
    }
}
