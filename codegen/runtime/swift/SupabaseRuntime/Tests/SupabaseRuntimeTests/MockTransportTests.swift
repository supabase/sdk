import Foundation
import Testing
@testable import SupabaseRuntime

private struct Bucket: Codable, Equatable, Sendable { let id: String }

@Suite struct MockTransportTests {
  @Test func sendDecodesBody() async throws {
    let mock = MockTransport { _ in (200, #"{"id":"abc"}"#.data(using: .utf8)!) }
    let bucket: Bucket = try await mock.send(HTTPRequest(method: .get, path: "/bucket/abc"))
    #expect(bucket == Bucket(id: "abc"))
  }

  @Test func uploadReturnsValue() async throws {
    let mock = MockTransport { _ in (200, #"{"id":"up"}"#.data(using: .utf8)!) }
    let task: TransferTask<Bucket> = mock.upload(HTTPRequest(method: .post, path: "/object/b/k"), from: .data(Data()))
    let bucket = try await task.value()
    #expect(bucket == Bucket(id: "up"))
  }

  @Test func streamYieldsBody() async throws {
    let mock = MockTransport { _ in (200, Data([1, 2, 3])) }
    let response = try await mock.stream(HTTPRequest(method: .get, path: "/events"))
    #expect(response.head.status == 200)
    var bytes: [UInt8] = []
    for try await chunk in response.body { bytes.append(contentsOf: chunk) }
    #expect(bytes == [1, 2, 3])
  }
}
