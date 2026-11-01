using System.Net.Sockets;
using LeadDynamic.Core.Protocol;

namespace LeadDynamic.Core.Networking;

public interface ICommandTransport
{
    Task TestConnectionAsync(string host, int port, CancellationToken cancellationToken);

    Task SendAsync(
        string host,
        int port,
        ReadOnlyMemory<byte> frame,
        CancellationToken cancellationToken);
}

public sealed class TcpCommandClient : ICommandTransport
{
    private static readonly TimeSpan DefaultTimeout = TimeSpan.FromSeconds(5);
    private readonly TimeSpan _connectTimeout;
    private readonly TimeSpan _writeTimeout;

    public TcpCommandClient(TimeSpan? connectTimeout = null, TimeSpan? writeTimeout = null)
    {
        _connectTimeout = ValidateTimeout(connectTimeout ?? DefaultTimeout, nameof(connectTimeout));
        _writeTimeout = ValidateTimeout(writeTimeout ?? DefaultTimeout, nameof(writeTimeout));
    }

    public async Task TestConnectionAsync(
        string host,
        int port,
        CancellationToken cancellationToken)
    {
        ValidateEndpoint(host, port);
        cancellationToken.ThrowIfCancellationRequested();

        using var client = new TcpClient();
        await ConnectAsync(client, host, port, cancellationToken).ConfigureAwait(false);
    }

    public async Task SendAsync(
        string host,
        int port,
        ReadOnlyMemory<byte> frame,
        CancellationToken cancellationToken)
    {
        ValidateEndpoint(host, port);
        if (frame.Length != LightCommandEncoder.FrameLength)
        {
            throw new ArgumentException(
                $"A command frame must be exactly {LightCommandEncoder.FrameLength} bytes.",
                nameof(frame));
        }

        cancellationToken.ThrowIfCancellationRequested();
        using var client = new TcpClient();
        await ConnectAsync(client, host, port, cancellationToken).ConfigureAwait(false);
        await WriteFrameAsync(client, frame, cancellationToken).ConfigureAwait(false);
    }

    private async Task ConnectAsync(
        TcpClient client,
        string host,
        int port,
        CancellationToken cancellationToken)
    {
        if (_connectTimeout == TimeSpan.Zero)
        {
            throw new TimeoutException("The TCP connection timed out before it started.");
        }

        using var timeoutSource = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
        timeoutSource.CancelAfter(_connectTimeout);
        try
        {
            await client.ConnectAsync(host, port, timeoutSource.Token).ConfigureAwait(false);
        }
        catch (OperationCanceledException exception) when (!cancellationToken.IsCancellationRequested)
        {
            throw new TimeoutException(
                $"The TCP connection to {host}:{port} timed out after {_connectTimeout}.",
                exception);
        }
    }

    private async Task WriteFrameAsync(
        TcpClient client,
        ReadOnlyMemory<byte> frame,
        CancellationToken cancellationToken)
    {
        if (_writeTimeout == TimeSpan.Zero)
        {
            throw new TimeoutException("The TCP frame write timed out before it started.");
        }

        using var timeoutSource = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
        timeoutSource.CancelAfter(_writeTimeout);
        try
        {
            var socket = client.Client;
            var offset = 0;
            while (offset < frame.Length)
            {
                var bytesSent = await socket.SendAsync(
                    frame[offset..],
                    SocketFlags.None,
                    timeoutSource.Token).ConfigureAwait(false);
                if (bytesSent == 0)
                {
                    throw new IOException("The TCP connection closed before the full frame was sent.");
                }

                offset += bytesSent;
            }
        }
        catch (OperationCanceledException exception) when (!cancellationToken.IsCancellationRequested)
        {
            throw new TimeoutException(
                $"The TCP frame write timed out after {_writeTimeout}.",
                exception);
        }
    }

    private static TimeSpan ValidateTimeout(TimeSpan timeout, string parameterName)
    {
        if (timeout < TimeSpan.Zero)
        {
            throw new ArgumentOutOfRangeException(parameterName, "Timeout cannot be negative.");
        }

        return timeout;
    }

    internal static void ValidateEndpoint(string host, int port)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(host);
        if (port is < 1 or > 65535)
        {
            throw new ArgumentOutOfRangeException(nameof(port), "Port must be between 1 and 65535.");
        }
    }
}
