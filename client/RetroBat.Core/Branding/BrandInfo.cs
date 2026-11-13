namespace RetroBat.Core.Branding;

/// <summary>
/// Single source of product branding. Change the product name here (and the
/// installer's brand config) rather than editing scattered UI strings.
/// Internal namespaces / assembly names keep the historical "RetroBat" prefix;
/// they are never shown to the user and renaming them is pure churn.
/// </summary>
public static class BrandInfo
{
    /// <summary>Short product name shown in window titles and dialogs.</summary>
    public const string Name = "RGS";

    /// <summary>Full product name for about/installer text.</summary>
    public const string FullName = "Retro Games Saviour";

    /// <summary>
    /// HKCU registry key holding the DPAPI-protected session and clock
    /// high-water mark. Bumping the brand starts a fresh key, so an existing
    /// install's persisted session is dropped and the user signs in again.
    /// </summary>
    public const string RegistryKeyPath = @"Software\RGS";
}
