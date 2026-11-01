using System.Net;
using System.Net.Sockets;
using LeadDynamic.Core.Networking;
using LeadDynamic.Core.Protocol;

namespace LeadDynamic.Core.Tests.Networking;

public class TcpCommandClientTests
{
    [Fact]
    public async Task TestConnectionAsync_ConnectsToLoopbackWithoutSendingData()
    {
        using var listener = StartListener(out var port);
        var acceptTask = listener.AcceptTcpClientAsync();
        var client = new TcpCommandClient();

        await client.TestConnectionAsync(IPAddress.Loopback.ToString(), port, CancellationToken.None);

        using var accepted = await acceptTask.WaitAsync(TimeSpan.FromSeconds(2));
        var buffer = new byte[1];
        Assert.Equal(0, await accepted.GetStream().ReadAsync(buffer).AsTask().WaitAsync(TimeSpan.FromSeconds(2)));
    }

    [Fact]
    public async Task SendAsync_SendsExactlyOneCompleteTwelveByteFrame()
    {
        using var listener = StartListener(out var port);
        var acceptTask = listener.AcceptTcpClientAsync();
        var client = new TcpCommandClient();
        byte[] expected = [0x55, 0x31, 0x32, 0x33, 0x01, 0x00, 0x02, 0x12, 0xAB, 0xC0, 0xAA, 0xAA];

        var sendTask = client.SendAsync(
            IPAddress.Loopback.ToString(),
            port,
            expected,
            CancellationToken.None);

        using var accepted = await acceptTask.WaitAsync(TimeSpan.FromSeconds(2));
        var received = new byte[expected.Length];
        await accepted.GetStream().ReadExactlyAsync(received).AsTask().WaitAsync(TimeSpan.FromSeconds(2));
        await sendTask.WaitAsync(TimeSpan.FromSeconds(2));
        var extra = new byte[1];

        Assert.Equal(expected, received);
        Assert.Equal(0, await accepted.GetStream().ReadAsync(extra).AsTask().WaitAsync(TimeSpan.FromSeconds(2)));
    }

    [Fact]
    public async Task SendAsync_ExposesWriteTimeout()
    {
        using var listener = StartListener(out var port);
        var acceptTask = listener.AcceptTcpClientAsync();
        var client = new TcpCommandClient(writeTimeout: TimeSpan.Zero);
        byte[] frame = new byte[12];

        await Assert.ThrowsAsync<TimeoutException>(() => client.SendAsync(
            IPAddress.Loopback.ToString(),
            port,
            frame,
            CancellationToken.None));

        using var accepted = await acceptTask.WaitAsync(TimeSpan.FromSeconds(2));
    }

    [Fact]
    public async Task TestConnectionAsync_ExposesConnectionRefusal()
    {
        using var listener = StartListener(out var port);
        listener.Stop();
        var client = new TcpCommandClient();

        await Assert.ThrowsAnyAsync<SocketException>(() => client.TestConnectionAsync(
            IPAddress.Loopback.ToString(),
            port,
            CancellationToken.None));
    }

    [Fact]
    public async Task TestConnectionAsync_ExposesCallerCancellation()
    {
        using var listener = StartListener(out var port);
        using var cancellation = new CancellationTokenSource();
        cancellation.Cancel();
        var client = new TcpCommandClient();

        await Assert.ThrowsAnyAsync<OperationCanceledException>(() => client.TestConnectionAsync(
            IPAddress.Loopback.ToString(),
            port,
            cancellation.Token));
    }

    [Fact]
    public async Task SendAsync_RejectsFramesThatAreNotTwelveBytes()
    {
        var client = new TcpCommandClient();

        await Assert.ThrowsAsync<ArgumentException>(() => client.SendAsync(
            IPAddress.Loopback.ToString(),
            1,
            new byte[11],
            CancellationToken.None));
    }

    [Fact]
    public async Task PdcCommandClient_TestConnectionAsyncIsReadOnly()
    {
        var transport = new RecordingCommandTransport();
        var client = new PdcCommandClient(transport);

        await client.TestConnectionAsync("127.0.0.1", 8899, CancellationToken.None);

        Assert.Equal(("127.0.0.1", 8899), transport.TestedEndpoint);
        Assert.Null(transport.SentFrame);
    }

    [Fact]
    public async Task PdcCommandClient_SendCommandAsyncEncodesAndSendsOnlyRequestedFrame()
    {
        var transport = new RecordingCommandTransport();
        var client = new PdcCommandClient(transport);

        await client.SendCommandAsync(
            "127.0.0.1",
            8899,
            "A1B2C3D4E5F6",
            LightCommand.TurnOff,
            cancellationToken: CancellationToken.None);

        Assert.Equal(
            new byte[] { 0x55, 0x35, 0x46, 0x36, 0x01, 0x00, 0x02, 0x12, 0xA9, 0xBE, 0xAA, 0xAA },
            transport.SentFrame);
    }

    [Fact]
    public async Task PdcCommandClient_RejectsInvalidEndpointBeforeCallingTransport()
    {
        var transport = new RecordingCommandTransport();
        var client = new PdcCommandClient(transport);

        await Assert.ThrowsAsync<ArgumentException>(() =>
            client.TestConnectionAsync(" ", 8899, CancellationToken.None));

        Assert.Null(transport.TestedEndpoint);
    }

    private static TcpListener StartListener(out int port)
    {
        var listener = new TcpListener(IPAddress.Loopback, 0);
        listener.Start();
        port = ((IPEndPoint)listener.LocalEndpoint).Port;
        return listener;
    }

    private sealed class RecordingCommandTransport : ICommandTransport
    {
        public (string Host, int Port)? TestedEndpoint { get; private set; }

        public byte[]? SentFrame { get; private set; }

        public Task TestConnectionAsync(string host, int port, CancellationToken cancellationToken)
        {
            TestedEndpoint = (host, port);
            return Task.CompletedTask;
        }

        public Task SendAsync(
            string host,
            int port,
            ReadOnlyMemory<byte> frame,
            CancellationToken cancellationToken)
        {
            SentFrame = frame.ToArray();
            return Task.CompletedTask;
        }
    }
}
