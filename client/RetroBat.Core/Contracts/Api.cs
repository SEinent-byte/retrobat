namespace RetroBat.Core.Contracts;

/// <summary>Request/response contracts mirroring @retrobat/shared/api for the
/// endpoints the client calls. Success bodies only; failures use
/// <see cref="ApiError"/>.</summary>

public sealed record AuthExchangeRequest(
    string Code,
    string CodeVerifier,
    string RedirectUri,
    DeviceIdentity Device);

public sealed record AuthExchangeResponse(Session Session, UserDto User);

public sealed record AuthRefreshRequest(string RefreshToken);

public sealed record AuthLogoutRequest(string RefreshToken);

public sealed record ActivateTrialRequest(DeviceIdentity Device);

public sealed record ActivateTrialResponse(LicenseStatus Status, long ExpiresAt);

public sealed record CatalogResponse(
    IReadOnlyList<SystemDto> Systems,
    IReadOnlyList<GameDto> Games);

public sealed record DownloadUrlRequest(string GameId);

public sealed record DownloadUrlResponse(
    string Url,
    long ExpiresAt,
    string RomFilename,
    long SizeBytes,
    string? Sha256,
    string RetrobatFolder,
    string? DefaultCore);

public sealed record PlayEventRequest(
    string GameId,
    PlayAction Action,
    int? DurationSec);

public sealed record PlayEventResponse(bool Ok, string EventId);

/// <summary>GET /client/version — public. Latest client build for auto-update.</summary>
public sealed record ClientVersionResponse(
    string LatestVersion,
    string MinVersion,
    string DownloadUrl,
    string? Notes);
