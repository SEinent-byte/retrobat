using System.Text.Json.Serialization;

namespace RetroBat.Core.Contracts;

/// <summary>Stable error codes mirroring @retrobat/shared/errors. Wire values
/// are snake_case via SnakeCaseLower naming policy.</summary>
public enum ApiErrorCode
{
    BadRequest,
    Unauthorized,
    Forbidden,
    NotFound,
    Blocked,
    TrialAlreadyUsed,
    LicenseRequired,
    VersionMismatch,
    AuthExchangeFailed,
    Internal,
}

public sealed record ApiErrorBody(
    ApiErrorCode Code,
    string Message,
    [property: JsonPropertyName("details")] IReadOnlyDictionary<string, string>? Details);

/// <summary>Envelope of any non-2xx response: { "error": { ... } }.</summary>
public sealed record ApiError(
    [property: JsonPropertyName("error")] ApiErrorBody Error);
