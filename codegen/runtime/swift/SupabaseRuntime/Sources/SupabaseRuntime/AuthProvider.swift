import Foundation

/// Supplies auth headers per request; async so token refresh fits.
public struct AuthProvider: Sendable {
  private let provider: @Sendable () async throws -> [String: String]
  public init(_ provider: @escaping @Sendable () async throws -> [String: String]) { self.provider = provider }
  public func headers() async throws -> [String: String] { try await provider() }

  /// No auth headers.
  public static let none = AuthProvider { [:] }
}
