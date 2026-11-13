using RetroBat.Core.Contracts;

namespace RetroBat.Services.Api;

/// <summary>Thrown when the API returns a non-2xx response. Carries the
/// stable <see cref="ApiErrorCode"/> so callers switch on it, not on text.</summary>
public sealed class ApiException(
    ApiErrorCode code,
    string message,
    int httpStatus,
    IReadOnlyDictionary<string, string>? details = null)
    : Exception(message)
{
    public ApiErrorCode Code { get; } = code;
    public int HttpStatus { get; } = httpStatus;
    public IReadOnlyDictionary<string, string>? Details { get; } = details;
}
