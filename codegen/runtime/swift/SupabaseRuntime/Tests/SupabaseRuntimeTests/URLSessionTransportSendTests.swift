import Foundation
import Testing
@testable import SupabaseRuntime

private struct Bucket: Codable, Equatable, Sendable { let id: String }
private struct StorageError: Error, Equatable { let message: String }

@Suite(.serialized) struct URLSessionTransportSendTests {
  func makeTransport(errorMapper: (@Sendable (Data, HTTPResponseHead) -> (any Error)?)? = nil) -> URLSessionTransport {
    var config = ClientConfiguration(baseURL: URL(string: "https://x.test/storage/v1")!)
    if let errorMapper { config.errorMapper = errorMapper }
    config.auth = AuthProvider { ["apikey": "k"] }
    return URLSessionTransport(configuration: config, urlSession: StubURLProtocol.session())
  }

  @Test func sendDecodes2xx() async throws {
    StubURLProtocol.stub = .init(status: 200, headers: ["Content-Type": "application/json"], body: #"{"id":"abc"}"#.data(using: .utf8)!)
    let bucket: Bucket = try await makeTransport().send(HTTPRequest(method: .get, path: "/bucket/abc"))
    #expect(bucket == Bucket(id: "abc"))
  }

  @Test func sendBuildsURLWithBaseAndAuthHeader() async throws {
    StubURLProtocol.stub = .init(status: 200, headers: [:], body: #"{"id":"x"}"#.data(using: .utf8)!)
    let _: Bucket = try await makeTransport().send(HTTPRequest(method: .get, path: "/bucket/x", query: [URLQueryItem(name: "limit", value: "10")]))
    let req = try #require(StubURLProtocol.lastRequest)
    #expect(req.url?.absoluteString == "https://x.test/storage/v1/bucket/x?limit=10")
    #expect(req.value(forHTTPHeaderField: "apikey") == "k")
  }

  @Test func sendMapsNon2xxToTypedError() async {
    StubURLProtocol.stub = .init(status: 400, headers: [:], body: #"{"message":"bad"}"#.data(using: .utf8)!)
    let transport = makeTransport { data, _ in
      (try? JSONDecoder().decode([String: String].self, from: data)["message"]).map { StorageError(message: $0) } ?? nil
    }
    await #expect(throws: StorageError(message: "bad")) {
      let _: Bucket = try await transport.send(HTTPRequest(method: .get, path: "/bucket/x"))
    }
  }
}
