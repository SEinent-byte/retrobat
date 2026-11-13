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
