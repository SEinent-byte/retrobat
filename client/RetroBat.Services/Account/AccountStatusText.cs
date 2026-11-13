using RetroBat.Core.Contracts;

namespace RetroBat.Services.Account;

/// <summary>
/// Formats the license/trial state into end-user text for the in-RetroBat
/// "Mi Cuenta" entry and its action menu. Strings are Spanish (end-user
/// facing; the product and theme are Spanish). The short label rides the
/// EmulationStation game name; the full block is the detail description.
/// </summary>
public static class AccountStatusText
{
    /// <summary>Compact label for the ES entry name (one line).</summary>
    public static string Short(LicenseState? s) => s?.Status switch
    {
        LicenseStatus.TrialActive => $"Prueba: {Remaining(s.ServerTime, s.ExpiresAt)}",
        LicenseStatus.TrialExpired => "Prueba terminada",
        LicenseStatus.Subscribed => "Suscripcion activa",
        LicenseStatus.None => "Activa tu prueba",
        _ => "Sin sesion",
    };

    /// <summary>Full status block for the ES detail description.</summary>
    public static string Full(LicenseState? s, string? email = null)
    {
        if (s is null)
            return "No has iniciado sesion. Pulsa para entrar con Google.";

        var line = s.Status switch
        {
            LicenseStatus.TrialActive =>
                $"Prueba activa. Te quedan {Remaining(s.ServerTime, s.ExpiresAt)}.",
            LicenseStatus.TrialExpired =>
                "Tu prueba termino. Suscribete para seguir jugando.",
            LicenseStatus.Subscribed =>
                "Suscripcion activa." + PeriodEnd(s.CurrentPeriodEnd),
            LicenseStatus.None =>
                "Aun no tienes prueba. Activa tu prueba gratis de 7 dias.",
            _ => "Estado desconocido.",
        };
        return email is { Length: > 0 } ? $"{email}\n{line}" : line;
    }

    public static string Remaining(long serverTime, long? expiresAt)
    {
        if (expiresAt is not { } end)
            return "0h";
        var span = TimeSpan.FromMilliseconds(Math.Max(0, end - serverTime));
        return span.TotalHours >= 24
            ? $"{(int)span.TotalDays}d {span.Hours}h"
            : $"{(int)span.TotalHours}h {span.Minutes}m";
    }

    private static string PeriodEnd(long? end) =>
        end is { } ms
            ? $" Se renueva el {DateTimeOffset.FromUnixTimeMilliseconds(ms).LocalDateTime:d}."
            : "";
}
