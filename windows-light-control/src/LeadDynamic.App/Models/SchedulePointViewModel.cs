using System.Collections;
using System.ComponentModel;
using System.Globalization;
using System.Runtime.CompilerServices;
using LeadDynamic.Core.Scheduling;

namespace LeadDynamic.App.Models;

public sealed class SchedulePointViewModel : INotifyPropertyChanged, INotifyDataErrorInfo
{
    private readonly Dictionary<string, string> _errors = [];
    private string _timeText;
    private LightPower? _power;
    private int _brightness;
    private int _warmth;

    public SchedulePointViewModel(SchedulePoint point)
    {
        ArgumentNullException.ThrowIfNull(point);
        _timeText = point.Time.ToString("HH:mm", CultureInfo.InvariantCulture);
        _power = point.Power;
        _brightness = point.Brightness;
        _warmth = point.Warmth;
        ValidateAll();
    }

    public event PropertyChangedEventHandler? PropertyChanged;
    public event EventHandler<DataErrorsChangedEventArgs>? ErrorsChanged;

    public string TimeText
    {
        get => _timeText;
        set
        {
            if (SetProperty(ref _timeText, value ?? string.Empty))
            {
                ValidateTime();
            }
        }
    }

    public LightPower? Power
    {
        get => _power;
        set
        {
            if (SetProperty(ref _power, value))
            {
                ValidatePower();
            }
        }
    }

    public int Brightness
    {
        get => _brightness;
        set
        {
            if (SetProperty(ref _brightness, value))
            {
                ValidateBrightness();
            }
        }
    }

    public int Warmth
    {
        get => _warmth;
        set
        {
            if (SetProperty(ref _warmth, value))
            {
                ValidateWarmth();
            }
        }
    }

    public bool HasErrors => _errors.Count > 0;
    public string TimeError => GetError(nameof(TimeText));
    public string PowerError => GetError(nameof(Power));
    public string BrightnessError => GetError(nameof(Brightness));
    public string WarmthError => GetError(nameof(Warmth));
    public string ValidationSummary => string.Join(" · ", new[]
    {
        TimeError,
        PowerError,
        BrightnessError,
        WarmthError
    }.Where(error => !string.IsNullOrEmpty(error)));

    public IEnumerable GetErrors(string? propertyName) =>
        string.IsNullOrEmpty(propertyName)
            ? _errors.Values.ToArray()
            : _errors.TryGetValue(propertyName, out var error) ? [error] : [];

    public bool TryGetSchedulePoint(out SchedulePoint? point)
    {
        point = null;
        if (HasErrors ||
            !TimeOnly.TryParseExact(TimeText, "HH:mm", CultureInfo.InvariantCulture,
                DateTimeStyles.None, out var time) ||
            Power is not LightPower power)
        {
            return false;
        }

        point = new SchedulePoint(time, power, (byte)Brightness, (byte)Warmth);
        return true;
    }

    private void ValidateAll()
    {
        ValidateTime();
        ValidatePower();
        ValidateBrightness();
        ValidateWarmth();
    }

    private void ValidateTime() =>
        SetError(nameof(TimeText),
            TimeOnly.TryParseExact(TimeText, "HH:mm", CultureInfo.InvariantCulture,
                DateTimeStyles.None, out var time) && time.Ticks % TimeSpan.TicksPerMinute == 0
                ? null
                : "Введите время в формате ЧЧ:ММ, например 08:30.");

    private void ValidatePower() =>
        SetError(nameof(Power), Power is null ? "Выберите включение или выключение." : null);

    private void ValidateBrightness() =>
        SetError(nameof(Brightness), Brightness is < 0 or > 64
            ? "Яркость должна быть в диапазоне 0–64."
            : null);

    private void ValidateWarmth() =>
        SetError(nameof(Warmth), Warmth is < 0 or > 32
            ? "Теплота должна быть в диапазоне 0–32."
            : null);

    private string GetError(string propertyName) =>
        _errors.TryGetValue(propertyName, out var error) ? error : string.Empty;

    private void SetError(string propertyName, string? error)
    {
        if (error is null)
        {
            if (!_errors.Remove(propertyName))
            {
                return;
            }
        }
        else if (_errors.TryGetValue(propertyName, out var current) && current == error)
        {
            return;
        }
        else
        {
            _errors[propertyName] = error;
        }

        ErrorsChanged?.Invoke(this, new DataErrorsChangedEventArgs(propertyName));
        OnPropertyChanged(nameof(HasErrors));
        OnPropertyChanged($"{propertyName}Error");
        OnPropertyChanged(nameof(ValidationSummary));
    }

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
