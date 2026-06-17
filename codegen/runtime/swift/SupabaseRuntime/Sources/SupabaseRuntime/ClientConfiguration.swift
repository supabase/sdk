import Foundation

public enum SessionKind: Sendable, Equatable {
  case foreground
  case background(identifier: String)
}

public struct ClientConfiguration: Sendable {
  public var baseURL: URL
  public var defaultHeaders: [String: String]
  public var auth: AuthProvider
  public var encoder: JSONEncoder
  public var decoder: JSONDecoder
  public var sessionKind: SessionKind
  /// Maps a non-2xx (body, head) to a typed error; returns nil to fall back to `TransportError.http`.
  public var errorMapper: @Sendable (Data, HTTPResponseHead) -> (any Error)?

  public init(
    baseURL: URL,
    defaultHeaders: [String: String] = [:],
    auth: AuthProvider = .none,
    encoder: JSONEncoder = JSONEncoder(),
    decoder: JSONDecoder = JSONDecoder(),
    sessionKind: SessionKind = .foreground,
    errorMapper: @escaping @Sendable (Data, HTTPResponseHead) -> (any Error)? = { _, _ in nil }
  ) {
    self.baseURL = baseURL
    self.defaultHeaders = defaultHeaders
    self.auth = auth
    self.encoder = encoder
    self.decoder = decoder
    self.sessionKind = sessionKind
    self.errorMapper = errorMapper
  }
}
