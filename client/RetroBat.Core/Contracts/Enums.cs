namespace RetroBat.Core.Contracts;

/// <summary>
/// C# mirror of @retrobat/shared enums. Wire values are snake_case; the
/// shared <see cref="ApiJson"/> options serialize these via
/// JsonStringEnumConverter(SnakeCaseLower), so CLR PascalCase maps 1:1
/// (TrialActive -> "trial_active"). Keep in sync with API_VERSION.
/// </summary>
public enum LicenseStatus
{
    TrialActive,
    TrialExpired,
    Subscribed,
    None,
}

public enum SubscriptionStatus
{
    Active,
    Canceled,
    Expired,
}

public enum PlayAction
{
    Start,
    End,
}

public enum AbuseState
{
    Clear,
    UnderReview,
}
