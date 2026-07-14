import Foundation

/// A URLProtocol returning a per-session canned response — parallel-safe (no shared mutable stub).
/// Each session is tagged with a unique id header; the protocol resolves that session's stub.
final class StubURLProtocol: URLProtocol, @unchecked Sendable {
  struct Stub: Sendable {
    var status: Int
    var headers: [String: String]
    var body: Data
    init(status: Int = 200, headers: [String: String] = [:], body: Data = Data()) {
      self.status = status; self.headers = headers; self.body = body
    }
  }

  private static let lock = NSLock()
  nonisolated(unsafe) private static var stubs: [String: Stub] = [:]
  nonisolated(unsafe) private static var lastRequests: [String: URLRequest] = [:]

  /// Builds a URLSession whose requests resolve to `stub`. Returns the session and an id for `lastRequest(id:)`.
  static func makeSession(stub: Stub) -> (session: URLSession, id: String) {
    let id = UUID().uuidString
    lock.withLock { stubs[id] = stub }
    let config = URLSessionConfiguration.ephemeral
    config.protocolClasses = [StubURLProtocol.self]
    config.httpAdditionalHeaders = ["X-Stub-Id": id]
    return (URLSession(configuration: config), id)
  }

  static func lastRequest(id: String) -> URLRequest? { lock.withLock { lastRequests[id] } }

  override class func canInit(with request: URLRequest) -> Bool { true }
  override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }
  override func stopLoading() {}
  override func startLoading() {
    let id = request.value(forHTTPHeaderField: "X-Stub-Id") ?? ""
    let stub: Stub = StubURLProtocol.lock.withLock {
      StubURLProtocol.lastRequests[id] = request
      return StubURLProtocol.stubs[id] ?? Stub()
    }
    let response = HTTPURLResponse(url: request.url!, statusCode: stub.status, httpVersion: "HTTP/1.1", headerFields: stub.headers)!
    client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)
    client?.urlProtocol(self, didLoad: stub.body)
    client?.urlProtocolDidFinishLoading(self)
  }
}
