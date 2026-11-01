namespace LeadDynamic.Core.Tests;

public class ScaffoldSmokeTests
{
    [Fact]
    public void CoreProjectReferenceLoadsExpectedAssembly()
    {
        Assert.Equal("LeadDynamic.Core", typeof(Class1).Assembly.GetName().Name);
    }
}
