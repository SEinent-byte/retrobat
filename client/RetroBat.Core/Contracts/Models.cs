namespace RetroBat.Core.Contracts;

/// <summary>Entity DTOs mirroring @retrobat/shared/models. Timestamps are
/// epoch milliseconds (UTC, server authority).</summary>

public sealed record UserDto(string Id, string Email, long CreatedAt);

/// <summary>Multilayer hardware/OS signals (SPEC §8.1). Any field may be
/// null when the client cannot read it.</summary>
public sealed record DeviceSignals(
    string? MachineGuid,
    string? CpuModel,
    int? CpuCores,
    long? RamTotalBytes,
    string? DiskSerial,
    string? BaseboardSerial,
    string? MacAddress,
    string? ScreenResolution);

/// <summary>fingerprint = SHA-256(machineGuid + stable combo); signals is the
/// raw package the server scores.</summary>
public sealed record DeviceIdentity(string Fingerprint, DeviceSignals Signals);

public sealed record Session(
    string SessionToken,
    string RefreshToken,
    long ExpiresAt);

/// <summary>Effective license snapshot from GET /license/status (SPEC §5).
/// ServerTime is the client anti-tamper anchor (SPEC §6).</summary>
public sealed record LicenseState(
    LicenseStatus Status,
    long? ExpiresAt,
    long? CurrentPeriodEnd,
    long ServerTime,
    AbuseState AbuseState);

/// <summary>A console/system (SPEC §7.1). Extensions are the allowed ROM
/// extensions for this system.</summary>
public sealed record SystemDto(
    string Id,
    string Name,
    string RetrobatFolder,
    string? DefaultCore,
    IReadOnlyList<string> Extensions,
    int SortOrder);

/// <summary>A catalog game. r2Key is never exposed; downloads go through a
/// presigned URL.</summary>
public sealed record GameDto(
    string Id,
    string SystemId,
    string Title,
    string RomFilename,
    long SizeBytes,
    bool TrialEligible,
    long? FreeFrom,
    long? FreeUntil);
