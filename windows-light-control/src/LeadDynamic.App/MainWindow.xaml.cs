using System.Windows;
using System.Windows.Controls;
using System.Windows.Threading;
using LeadDynamic.App.Models;
using LeadDynamic.App.ViewModels;

namespace LeadDynamic.App;

public partial class MainWindow : Window
{
    private readonly DispatcherTimer _clockRefresh;

    public MainWindow()
    {
        InitializeComponent();
        DataContext = new MainViewModel();
        _clockRefresh = new DispatcherTimer { Interval = TimeSpan.FromMinutes(1) };
        _clockRefresh.Tick += (_, _) => ViewModel.RefreshNextPoint();
        _clockRefresh.Start();
        Closed += (_, _) =>
        {
            _clockRefresh.Stop();
            ViewModel.Dispose();
        };
    }

    private MainViewModel ViewModel => (MainViewModel)DataContext;

    private void AddPoint_Click(object sender, RoutedEventArgs e) =>
        ViewModel.AddPoint();

    private void RemovePoint_Click(object sender, RoutedEventArgs e)
    {
        if (sender is FrameworkElement { DataContext: SchedulePointViewModel point })
        {
            ViewModel.RemovePoint(point);
        }
    }

    private void ScheduleGrid_CellEditEnding(
        object sender,
        DataGridCellEditEndingEventArgs e)
    {
        if (e.EditAction == DataGridEditAction.Commit)
        {
            Dispatcher.BeginInvoke(
                DispatcherPriority.Background,
                new Action(ViewModel.SortSchedule));
        }
    }

    private async void TestConnection_Click(object sender, RoutedEventArgs e) =>
        await ViewModel.TestConnectionAsync();

    private async void SendTestCommand_Click(object sender, RoutedEventArgs e)
    {
        await ViewModel.SendUserInitiatedTestCommandAsync();
        if (ViewModel.ErrorMessage is not null)
        {
            return;
        }

        var response = MessageBox.Show(
            "Команда отправлена через TCP, но устройство не подтверждает её получение.\n\nВы лично увидели, что светильник включился?",
            "Подтверждение физического отклика",
            MessageBoxButton.YesNo,
            MessageBoxImage.Question,
            MessageBoxResult.No);
        if (response == MessageBoxResult.Yes)
        {
            await ViewModel.ConfirmPhysicalResponseAsync();
        }
        else
        {
            ViewModel.CancelPendingTestCommand();
        }
    }

    private async void Save_Click(object sender, RoutedEventArgs e)
    {
        ViewModel.SortSchedule();
        await ViewModel.SaveAsync();
    }

    private void Start_Click(object sender, RoutedEventArgs e)
    {
        ViewModel.SortSchedule();
        ViewModel.StartSchedule();
    }

    private void Stop_Click(object sender, RoutedEventArgs e) =>
        ViewModel.StopSchedule();

    private void Window_Closing(object? sender, System.ComponentModel.CancelEventArgs e) =>
        ViewModel.StopSchedule();
}
