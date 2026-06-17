import Foundation

/// A URLProtocol that returns a canned response, so transport tests need no network.
final class StubURLProtocol: URLProtocol, @unchecked Sendable {
  struct Stub: Sendable { var status: Int; var headers: [String: String]; var body: Data }
  nonisolated(unsafe) static var stub: Stub = .init(status: 200, headers: [:], body: Data())
  nonisolated(unsafe) static var lastRequest: URLRequest?

  static func session() -> URLSession {
    let config = URLSessionConfiguration.ephemeral
    config.protocolClasses = [StubURLProtocol.self]
    return URLSession(configuration: config)
  }

  override class func canInit(with request: URLRequest) -> Bool { true }
  override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }
  override func startLoading() {
    StubURLProtocol.lastRequest = request
    let stub = StubURLProtocol.stub
    let response = HTTPURLResponse(url: request.url!, statusCode: stub.status, httpVersion: "HTTP/1.1", headerFields: stub.headers)!
    client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)
    client?.urlProtocol(self, didLoad: stub.body)
    client?.urlProtocolDidFinishLoading(self)
  }
  override func stopLoading() {}
}
