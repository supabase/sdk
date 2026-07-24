import Foundation
import Testing
@testable import SupabaseRuntime

private struct Bucket: Codable, Equatable, Sendable { let id: String }
private struct CreateBody: Codable, Equatable, Sendable { let name: String }

@Suite struct MockTransportTests {
  @Test func sendDecodesBody() async throws {
    let mock = MockTransport { _, _ in (200, #"{"id":"abc"}"#.data(using: .utf8)!) }
    let bucket: Bucket = try await mock.send(HTTPRequest(method: .get, path: "/bucket/abc"))
    #expect(bucket == Bucket(id: "abc"))
  }

  @Test func sendBodyForwardsEncodedBody() async throws {
    let box = DataBox()
    let mock = MockTransport { _, body in box.set(body); return (200, #"{"id":"x"}"#.data(using: .utf8)!) }
    let _: Bucket = try await mock.send(HTTPRequest(method: .post, path: "/bucket/"), body: CreateBody(name: "n"))
    let captured = try #require(box.get())
    #expect(try JSONDecoder().decode(CreateBody.self, from: captured) == CreateBody(name: "n"))
  }

  @Test func uploadReturnsValue() async throws {
    let mock = MockTransport { _, _ in (200, #"{"id":"up"}"#.data(using: .utf8)!) }
    let task: TransferTask<Bucket> = mock.upload(HTTPRequest(method: .post, path: "/object/b/k"), from: .data(Data()))
    let bucket = try await task.value()
    #expect(bucket == Bucket(id: "up"))
  }

  @Test func downloadWritesBodyToFile() async throws {
    let mock = MockTransport { _, _ in (200, Data([7, 8, 9])) }
    let dest = FileManager.default.temporaryDirectory.appendingPathComponent("mock-\(UUID().uuidString).bin")
    defer { try? FileManager.default.removeItem(at: dest) }
    try await mock.download(HTTPRequest(method: .get, path: "/object/b/k"), toFile: dest).value()
    #expect(try Data(contentsOf: dest) == Data([7, 8, 9]))
  }

  @Test func streamYieldsBody() async throws {
    let mock = MockTransport { _, _ in (200, Data([1, 2, 3])) }
    let response = try await mock.stream(HTTPRequest(method: .get, path: "/events"))
    #expect(response.head.status == 200)
    var bytes: [UInt8] = []
    for try await chunk in response.body { bytes.append(contentsOf: chunk) }
    #expect(bytes == [1, 2, 3])
  }
}

// Lock-backed box for capturing the body from a @Sendable closure (test-only).
private final class DataBox: @unchecked Sendable {
  private let lock = NSLock(); private var value: Data?
  func set(_ d: Data?) { lock.lock(); value = d; lock.unlock() }
  func get() -> Data? { lock.lock(); defer { lock.unlock() }; return value }
}
