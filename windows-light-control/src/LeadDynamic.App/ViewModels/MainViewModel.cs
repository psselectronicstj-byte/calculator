using System.Collections.ObjectModel;
using System.Collections.Specialized;
using System.ComponentModel;
using System.IO;
using System.Runtime.CompilerServices;
using LeadDynamic.App.Models;
using LeadDynamic.Core.Configuration;
using LeadDynamic.Core.Networking;
using LeadDynamic.Core.Protocol;
using LeadDynamic.Core.Scheduling;
using LeadDynamic.Core.Verification;

namespace LeadDynamic.App.ViewModels;

public sealed class MainViewModel : INotifyPropertyChanged, IDisposable
{
    private static readonly TimeOnly[] PreferredPointTimes =
    [
        new(6, 0), new(20, 0), new(8, 0), new(12, 0), new(16, 0), new(22, 0),
        new(0, 0), new(4, 0), new(10, 0), new(14, 0), new(18, 0)
    ];

    private readonly SettingsStore _settingsStore;
    private readonly ILightDeviceClient _client;
    private readonly DeviceVerificationService _verification;
    private readonly LightScheduleRunner _runner;
    private LightControlSettings _settings;
    private string _host;
    private int _port;
    private string _lightIdentifier;
    private string _connectionStatus = "Настройки загружены. Подключение не проверялось.";
    private string _scheduleStatus = string.Empty;
    private string _nextPointText = "Добавьте минимум две точки расписания.";
    private string? _errorMessage;
    private bool _isRunning;
    private bool _isBusy;
    private CancellationTokenSource? _runCancellation;

    public MainViewModel(SettingsStore? settingsStore = null, ILightDeviceClient? client = null)
    {
        _settingsStore = settingsStore ?? new SettingsStore();
        _client = client ?? new PdcCommandClient(new TcpCommandClient());

        try
        {
            _settings = _settingsStore.Load();
        }
        catch (SettingsLoadException exception)
        {
            _settings = exception.SafeDefaults;
            ErrorMessage = $"Файл настроек повреждён или недоступен. Используются безопасные значения. {exception.Message}";
        }

        _host = _settings.Host;
        _port = _settings.Port;
        _lightIdentifier = _settings.LightIdentifier;
        _verification = new DeviceVerificationService(_client, _settingsStore, _settings);
        _runner = new LightScheduleRunner(_client);
        SchedulePoints = new ObservableCollection<SchedulePointViewModel>(
            _settings.Schedule.Select(point => new SchedulePointViewModel(point)));
        SchedulePoints.CollectionChanged += OnScheduleCollectionChanged;
        foreach (var point in SchedulePoints)
        {
            point.PropertyChanged += OnPointPropertyChanged;
        }

        SortSchedule();
        RefreshScheduleState();
    }

    public event PropertyChangedEventHandler? PropertyChanged;

    public ObservableCollection<SchedulePointViewModel> SchedulePoints { get; }

    public IReadOnlyList<PowerOption> PowerOptions { get; } =
    [
        new(LightPower.On, "Включено"),
        new(LightPower.Off, "Выключено")
    ];

    public string Host
    {
        get => _host;
        set
        {
            if (SetProperty(ref _host, value ?? string.Empty))
            {
                RefreshScheduleState();
            }
        }
    }

    public int Port
    {
        get => _port;
        set
        {
            if (SetProperty(ref _port, value))
            {
                RefreshScheduleState();
            }
        }
    }

    public string LightIdentifier
    {
        get => _lightIdentifier;
        set
        {
            if (SetProperty(ref _lightIdentifier, value ?? string.Empty))
            {
                RefreshScheduleState();
            }
        }
    }

    public string ConnectionStatus
    {
        get => _connectionStatus;
        private set => SetProperty(ref _connectionStatus, value);
    }

    public string ScheduleStatus
    {
        get => _scheduleStatus;
        private set => SetProperty(ref _scheduleStatus, value);
    }

    public string NextPointText
    {
        get => _nextPointText;
        private set => SetProperty(ref _nextPointText, value);
    }

    public string? ErrorMessage
    {
        get => _errorMessage;
        private set
        {
            if (SetProperty(ref _errorMessage, value))
            {
                OnPropertyChanged(nameof(HasError));
            }
        }
    }

    public bool HasError => !string.IsNullOrEmpty(ErrorMessage);
    public string VerificationStatus => IsDeviceVerified
        ? "Светильник подтверждён"
        : "Светильник не подтверждён";
    public bool IsRunning
    {
        get => _isRunning;
        private set
        {
            if (SetProperty(ref _isRunning, value))
            {
                OnPropertyChanged(nameof(CanStartSchedule));
                OnPropertyChanged(nameof(CanStopSchedule));
            }
        }
    }

    public bool IsBusy
    {
        get => _isBusy;
        private set
        {
            if (SetProperty(ref _isBusy, value))
            {
                OnPropertyChanged(nameof(CanStartSchedule));
                OnPropertyChanged(nameof(CanTestConnection));
                OnPropertyChanged(nameof(CanSendTestCommand));
            }
        }
    }

    public bool IsDeviceVerified => _verification.IsVerified(Host, Port, LightIdentifier);
    public bool CanStartSchedule => !IsRunning && !IsBusy && IsDeviceVerified && TryBuildValidSchedule(out _);
    public bool CanStopSchedule => IsRunning;
    public bool CanTestConnection => !IsBusy && HasValidEndpoint;
    public bool CanSendTestCommand => !IsBusy && HasValidDevice;
    public bool HasValidEndpoint => !string.IsNullOrWhiteSpace(Host) && Port is >= 1 and <= 65535;
    public bool HasValidDevice => HasValidEndpoint && IsValidIdentifier(LightIdentifier);

    public void AddPoint()
    {
        var occupied = SchedulePoints
            .Select(point => point.TryGetSchedulePoint(out var value) ? value!.Time : (TimeOnly?)null)
            .Where(time => time.HasValue)
            .Select(time => time!.Value)
            .ToHashSet();
        var availablePreferredTime = PreferredPointTimes
            .Where(time => !occupied.Contains(time))
            .Select(time => (TimeOnly?)time)
            .FirstOrDefault();
        var candidate = availablePreferredTime ?? new TimeOnly(6, 0);
        var found = availablePreferredTime is not null;
        if (!found)
        {
            for (var index = 0; index < 1440; index++)
            {
                if (!occupied.Contains(candidate))
                {
                    found = true;
                    break;
                }

                candidate = candidate.AddMinutes(1);
            }
        }

        if (!found)
        {
            ErrorMessage = "Все минуты суток уже заняты точками расписания.";
            return;
        }

        var point = new SchedulePointViewModel(
            new SchedulePoint(
                candidate,
                SchedulePoints.Count == 1 ? LightPower.Off : LightPower.On,
                32,
                16));
        SchedulePoints.Add(point);
        SortSchedule();
        RefreshScheduleState();
    }

    public void RemovePoint(SchedulePointViewModel? point)
    {
        if (point is null)
        {
            return;
        }

        SchedulePoints.Remove(point);
        RefreshScheduleState();
    }

    public void SortSchedule()
    {
        var sorted = SchedulePoints
            .OrderBy(point => TimeOnly.TryParseExact(
                point.TimeText, "HH:mm", System.Globalization.CultureInfo.InvariantCulture,
                System.Globalization.DateTimeStyles.None, out var time) ? time : TimeOnly.MaxValue)
            .ToArray();
        for (var index = 0; index < sorted.Length; index++)
        {
            var currentIndex = SchedulePoints.IndexOf(sorted[index]);
            if (currentIndex != index)
            {
                SchedulePoints.Move(currentIndex, index);
            }
        }
    }

    public async Task SaveAsync(CancellationToken cancellationToken = default)
    {
        ErrorMessage = null;
        if (!TryBuildValidSchedule(out var schedule))
        {
            ErrorMessage = "Сначала исправьте расписание: нужны минимум две точки, уникальное время и корректные значения.";
            return;
        }

        IsBusy = true;
        try
        {
            var settings = BuildSettings(schedule);
            await _settingsStore.SaveAsync(settings, cancellationToken);
            _settings = settings;
            _verification.UpdateSettings(settings);
            ConnectionStatus = "Настройки сохранены на этом устройстве.";
        }
        catch (Exception exception) when (exception is IOException or UnauthorizedAccessException)
        {
            ErrorMessage = $"Не удалось сохранить настройки: {exception.Message}";
        }
        finally
        {
            IsBusy = false;
            RefreshScheduleState();
        }
    }

    public async Task TestConnectionAsync(CancellationToken cancellationToken = default)
    {
        ErrorMessage = null;
        if (!CanTestConnection)
        {
            ErrorMessage = "Проверьте адрес и порт (1–65535).";
            return;
        }

        IsBusy = true;
        ConnectionStatus = "Проверяем TCP-доступность…";
        try
        {
            SyncSettings();
            await _verification.TestConnectionAsync(Host, Port, cancellationToken);
            ConnectionStatus = "TCP доступен. Это не подтверждает отклик светильника.";
        }
        catch (Exception exception) when (exception is not OperationCanceledException)
        {
            ConnectionStatus = "TCP-подключение не удалось.";
            ErrorMessage = $"Ошибка подключения: {exception.Message}";
        }
        finally
        {
            IsBusy = false;
            RefreshScheduleState();
        }
    }

    public async Task SendUserInitiatedTestCommandAsync(
        CancellationToken cancellationToken = default)
    {
        ErrorMessage = null;
        if (!CanSendTestCommand)
        {
            ErrorMessage = "Укажите адрес, порт и корректный 12-значный идентификатор светильника.";
            return;
        }

        IsBusy = true;
        ConnectionStatus = "Отправляем тестовую команду включения…";
        try
        {
            SyncSettings();
            await _verification.SendUserInitiatedTestCommandAsync(
                Host, Port, LightIdentifier, cancellationToken);
            ConnectionStatus = "Команда отправлена по TCP. Устройство не подтверждает её получение.";
        }
        catch (Exception exception) when (exception is not OperationCanceledException)
        {
            ConnectionStatus = "Тестовая команда не отправлена.";
            ErrorMessage = $"Ошибка команды: {exception.Message}";
        }
        finally
        {
            IsBusy = false;
            RefreshScheduleState();
        }
    }

    public async Task ConfirmPhysicalResponseAsync(CancellationToken cancellationToken = default)
    {
        ErrorMessage = null;
        IsBusy = true;
        try
        {
            SyncSettings();
            await _verification.ConfirmPhysicalResponseAsync(
                Host, Port, LightIdentifier, cancellationToken);
            _settings = _verification.Settings;
            ConnectionStatus = "Светильник подтверждён вручную для этого адреса и ID.";
        }
        catch (Exception exception) when (exception is not OperationCanceledException)
        {
            ErrorMessage = $"Не удалось сохранить подтверждение: {exception.Message}";
        }
        finally
        {
            IsBusy = false;
            RefreshScheduleState();
        }
    }

    public void CancelPendingTestCommand()
    {
        _verification.CancelPendingTestCommand(Host, Port, LightIdentifier);
        ConnectionStatus = "Отклик не подтверждён. Автоматизация остаётся заблокированной.";
    }

    public void StartSchedule()
    {
        ErrorMessage = null;
        if (!CanStartSchedule || !TryBuildValidSchedule(out var schedule))
        {
            ErrorMessage = "Запуск закрыт: подтвердите светильник и исправьте расписание.";
            return;
        }

        SyncSettings(schedule);
        _runCancellation = new CancellationTokenSource();
        IsRunning = true;
        ConnectionStatus = "Расписание выполняется. Окно должно оставаться открытым.";
        _ = RunScheduleAsync(_settings, _runCancellation.Token);
    }

    public void StopSchedule()
    {
        _runCancellation?.Cancel();
        if (IsRunning)
        {
            ConnectionStatus = "Остановка расписания…";
        }
    }

    public void RefreshNextPoint() => RefreshScheduleState();

    public void Dispose()
    {
        StopSchedule();
        _runCancellation?.Dispose();
    }

    private async Task RunScheduleAsync(
        LightControlSettings settings,
        CancellationToken cancellationToken)
    {
        try
        {
            await _runner.RunAsync(settings, cancellationToken);
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
            ConnectionStatus = "Расписание остановлено.";
        }
        catch (Exception exception)
        {
            ErrorMessage = $"Ошибка расписания: {exception.Message}";
            ConnectionStatus = "Расписание остановлено из-за ошибки.";
        }
        finally
        {
            IsRunning = false;
            _runCancellation?.Dispose();
            _runCancellation = null;
            RefreshScheduleState();
        }
    }

    private void OnScheduleCollectionChanged(object? sender, NotifyCollectionChangedEventArgs args)
    {
        if (args.OldItems is not null)
        {
            foreach (SchedulePointViewModel point in args.OldItems)
            {
                point.PropertyChanged -= OnPointPropertyChanged;
            }
        }

        if (args.NewItems is not null)
        {
            foreach (SchedulePointViewModel point in args.NewItems)
            {
                point.PropertyChanged += OnPointPropertyChanged;
            }
        }

        RefreshScheduleState();
    }

    private void OnPointPropertyChanged(object? sender, PropertyChangedEventArgs args) =>
        RefreshScheduleState();

    private void RefreshScheduleState()
    {
        var valid = TryBuildValidSchedule(out var schedule);
        var verification = IsDeviceVerified;
        var count = SchedulePoints.Count;
        ScheduleStatus = valid
            ? $"{count} точки · расписание корректно"
            : count < 2
                ? $"Добавьте ещё {2 - count} точки (минимум две)."
                : "Проверьте время, диапазоны и отсутствие повторов.";

        if (valid)
        {
            var next = ScheduleEvaluator.GetNextPoint(schedule, TimeOnly.FromDateTime(DateTime.Now));
            NextPointText = $"Следующая точка: {next.Time:HH\\:mm} · {(next.Power == LightPower.On ? "включено" : "выключено")}";
        }
        else
        {
            NextPointText = "Следующая точка появится после заполнения расписания.";
        }

        OnPropertyChanged(nameof(IsDeviceVerified));
        OnPropertyChanged(nameof(VerificationStatus));
        OnPropertyChanged(nameof(CanStartSchedule));
        OnPropertyChanged(nameof(CanTestConnection));
        OnPropertyChanged(nameof(CanSendTestCommand));
        OnPropertyChanged(nameof(HasValidEndpoint));
        OnPropertyChanged(nameof(HasValidDevice));
    }

    private bool TryBuildValidSchedule(out IReadOnlyList<SchedulePoint> schedule)
    {
        schedule = Array.Empty<SchedulePoint>();
        if (SchedulePoints.Count < 2 ||
            SchedulePoints.Any(point => !point.TryGetSchedulePoint(out _)))
        {
            return false;
        }

        try
        {
            schedule = ScheduleEvaluator.ValidateAndSort(
                SchedulePoints.Select(point =>
                {
                    point.TryGetSchedulePoint(out var value);
                    return value!;
                }).ToArray());
            return true;
        }
        catch (ArgumentException)
        {
            return false;
        }
    }

    private LightControlSettings BuildSettings(IReadOnlyList<SchedulePoint>? schedule = null) =>
        _settings with
        {
            Host = Host.Trim(),
            Port = Port,
            LightIdentifier = LightIdentifier.Trim(),
            Schedule = schedule ?? _settings.Schedule
        };

    private void SyncSettings(IReadOnlyList<SchedulePoint>? schedule = null)
    {
        if (schedule is null && TryBuildValidSchedule(out var currentSchedule))
        {
            schedule = currentSchedule;
        }

        _settings = BuildSettings(schedule);
        _verification.UpdateSettings(_settings);
    }

    private static bool IsValidIdentifier(string identifier) =>
        identifier.Length == 12 && identifier.All(Uri.IsHexDigit);

    private bool SetProperty<T>(
        ref T field,
        T value,
        [CallerMemberName] string? propertyName = null)
    {
        if (EqualityComparer<T>.Default.Equals(field, value))
        {
            return false;
        }

        field = value;
        OnPropertyChanged(propertyName);
        return true;
    }

    private void OnPropertyChanged([CallerMemberName] string? propertyName = null) =>
        PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(propertyName));
}

public sealed record PowerOption(LightPower Value, string Label);
