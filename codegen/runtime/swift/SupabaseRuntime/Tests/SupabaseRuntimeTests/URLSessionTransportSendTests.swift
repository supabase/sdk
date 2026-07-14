import Foundation
import Testing
@testable import SupabaseRuntime

private struct Bucket: Codable, Equatable, Sendable { let id: String }
private struct StorageError: Error, Equatable { let message: String }

@Suite struct URLSessionTransportSendTests {
  func makeTransport(stub: StubURLProtocol.Stub, errorMapper: (@Sendable (Data, HTTPResponseHead) -> (any Error)?)? = nil) -> (URLSessionTransport, String) {
    var config = ClientConfiguration(baseURL: URL(string: "https://x.test/storage/v1")!)
    if let errorMapper { config.errorMapper = errorMapper }
    config.auth = AuthProvider { ["apikey": "k"] }
    let (session, id) = StubURLProtocol.makeSession(stub: stub)
    return (URLSessionTransport(configuration: config, urlSession: session), id)
  }

  @Test func sendDecodes2xx() async throws {
    let (transport, _) = makeTransport(stub: .init(status: 200, headers: ["Content-Type": "application/json"], body: #"{"id":"abc"}"#.data(using: .utf8)!))
    let bucket: Bucket = try await transport.send(HTTPRequest(method: .get, path: "/bucket/abc"))
    #expect(bucket == Bucket(id: "abc"))
  }

  @Test func sendBuildsURLWithBaseAndAuthHeader() async throws {
    let (transport, id) = makeTransport(stub: .init(body: #"{"id":"x"}"#.data(using: .utf8)!))
    let _: Bucket = try await transport.send(HTTPRequest(method: .get, path: "/bucket/x", query: [URLQueryItem(name: "limit", value: "10")]))
    let req = try #require(StubURLProtocol.lastRequest(id: id))
    #expect(req.url?.absoluteString == "https://x.test/storage/v1/bucket/x?limit=10")
    #expect(req.value(forHTTPHeaderField: "apikey") == "k")
  }

  @Test func sendMapsNon2xxToTypedError() async {
    let (transport, _) = makeTransport(stub: .init(status: 400, body: #"{"message":"bad"}"#.data(using: .utf8)!)) { data, _ in
      (try? JSONDecoder().decode([String: String].self, from: data)["message"]).map { StorageError(message: $0) } ?? nil
    }
    await #expect(throws: StorageError(message: "bad")) {
      let _: Bucket = try await transport.send(HTTPRequest(method: .get, path: "/bucket/x"))
    }
  }

  @Test func sendBodySetsJSONContentTypeAndDecodes() async throws {
    struct CreateBody: Encodable, Sendable { let name: String }
    let (transport, id) = makeTransport(stub: .init(body: #"{"id":"made"}"#.data(using: .utf8)!))
    let bucket: Bucket = try await transport.send(HTTPRequest(method: .post, path: "/bucket/"), body: CreateBody(name: "n"))
    #expect(bucket == Bucket(id: "made"))
    #expect(StubURLProtocol.lastRequest(id: id)?.value(forHTTPHeaderField: "Content-Type") == "application/json")
  }

  @Test func noContentSendSucceedsOn2xxAndThrowsOnError() async throws {
    let (ok, _) = makeTransport(stub: .init(status: 204))
    try await ok.send(HTTPRequest(method: .delete, path: "/bucket/x"))
    let (bad, _) = makeTransport(stub: .init(status: 500))
    await #expect(throws: (any Error).self) { try await bad.send(HTTPRequest(method: .delete, path: "/bucket/x")) }
  }

  @Test func trailingSlashBaseURLDoesNotDoubleSlash() async throws {
    var config = ClientConfiguration(baseURL: URL(string: "https://x.test/storage/v1/")!)
    config.auth = AuthProvider { [:] }
    let (session, id) = StubURLProtocol.makeSession(stub: .init(body: #"{"id":"x"}"#.data(using: .utf8)!))
    let transport = URLSessionTransport(configuration: config, urlSession: session)
    let _: Bucket = try await transport.send(HTTPRequest(method: .get, path: "/bucket/x"))
    #expect(StubURLProtocol.lastRequest(id: id)?.url?.absoluteString == "https://x.test/storage/v1/bucket/x")
  }
}
