using System.Text.Json;
using System.Text.Json.Serialization;

namespace RetroBat.Core.Contracts;

/// <summary>Shared JSON options so client serialization matches the backend
/// wire format: camelCase property names, snake_case enum values.</summary>
public static class ApiJson
{
    /// <summary>Must equal @retrobat/shared API_VERSION.</summary>
    public const string ApiVersion = "0.2.0";

    /// <summary>Header carrying <see cref="ApiVersion"/>.</summary>
    public const string ApiVersionHeader = "X-Api-Version";

    public static readonly JsonSerializerOptions Options = Create();

    private static JsonSerializerOptions Create()
    {
        var o = new JsonSerializerOptions
        {
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
            PropertyNameCaseInsensitive = true,
            DefaultIgnoreCondition = JsonIgnoreCondition.Never,
        };
        o.Converters.Add(new JsonStringEnumConverter(JsonNamingPolicy.SnakeCaseLower));
        return o;
    }
}
