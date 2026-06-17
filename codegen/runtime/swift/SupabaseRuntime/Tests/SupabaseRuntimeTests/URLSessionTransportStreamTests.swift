import Foundation
import Testing
@testable import SupabaseRuntime

@Suite struct URLSessionTransportStreamTests {
  @Test func streamYieldsBodyBytesAndHead() async throws {
    var config = ClientConfiguration(baseURL: URL(string: "https://x.test/functions/v1")!)
    config.auth = AuthProvider { ["apikey": "k"] }
    let (session, _) = StubURLProtocol.makeSession(stub: .init(status: 200, headers: ["Content-Type": "text/event-stream"], body: Data([0x64, 0x61, 0x74, 0x61])))
    let transport = URLSessionTransport(configuration: config, urlSession: session)
    let response = try await transport.stream(HTTPRequest(method: .get, path: "/events"))
    #expect(response.head.status == 200)
    var bytes: [UInt8] = []
    for try await chunk in response.body { bytes.append(contentsOf: chunk) }
    #expect(bytes == [0x64, 0x61, 0x74, 0x61])
  }

  @Test func streamMapsNon2xxToError() async {
    var config = ClientConfiguration(baseURL: URL(string: "https://x.test/functions/v1")!)
    let (session, _) = StubURLProtocol.makeSession(stub: .init(status: 500, headers: [:], body: Data([0x65])))
    let transport = URLSessionTransport(configuration: config, urlSession: session)
    await #expect(throws: TransportError.self) {
      _ = try await transport.stream(HTTPRequest(method: .get, path: "/events"))
    }
  }

  @Test func streamRunsErrorMapperOnNon2xx() async {
    struct StreamError: Error, Equatable { let code: Int }
    var config = ClientConfiguration(baseURL: URL(string: "https://x.test/functions/v1")!)
    config.errorMapper = { _, head in StreamError(code: head.status) }
    let (session, _) = StubURLProtocol.makeSession(stub: .init(status: 503, headers: [:], body: Data()))
    let transport = URLSessionTransport(configuration: config, urlSession: session)
    await #expect(throws: StreamError(code: 503)) {
      _ = try await transport.stream(HTTPRequest(method: .get, path: "/events"))
    }
  }
}
