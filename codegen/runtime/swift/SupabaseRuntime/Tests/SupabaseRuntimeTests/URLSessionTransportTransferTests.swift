import Foundation
import Testing
@testable import SupabaseRuntime

private struct UploadResult: Codable, Equatable, Sendable { let key: String }

@Suite(.serialized) struct URLSessionTransportTransferTests {
  func makeTransport() -> URLSessionTransport {
    var config = ClientConfiguration(baseURL: URL(string: "https://x.test/storage/v1")!)
    config.auth = AuthProvider { ["apikey": "k"] }
    return URLSessionTransport(configuration: config, urlSession: StubURLProtocol.session())
  }

  @Test func uploadFromDataReturnsDecodedValue() async throws {
    StubURLProtocol.stub = .init(status: 200, headers: [:], body: #"{"key":"folder/cat.png"}"#.data(using: .utf8)!)
    let task: TransferTask<UploadResult> = makeTransport()
      .upload(HTTPRequest(method: .post, path: "/object/avatars/cat.png"), from: .data(Data([0x1, 0x2])))
    for await _ in task.progress {}   // drain (may be empty under the stub)
    let result = try await task.value()
    #expect(result == UploadResult(key: "folder/cat.png"))
  }

  @Test func uploadProgressStreamTerminates() async throws {
    StubURLProtocol.stub = .init(status: 200, headers: [:], body: #"{"key":"k"}"#.data(using: .utf8)!)
    let task: TransferTask<UploadResult> = makeTransport().upload(HTTPRequest(method: .post, path: "/object/b/k"), from: .data(Data([1])))
    var count = 0
    for await _ in task.progress { count += 1 }   // must terminate (count may be 0 under the stub)
    _ = try await task.value()
    #expect(count >= 0)
  }

  @Test func downloadWritesToFile() async throws {
    StubURLProtocol.stub = .init(status: 200, headers: [:], body: Data([0xA, 0xB, 0xC]))
    let dest = FileManager.default.temporaryDirectory.appendingPathComponent("dl-\(UUID().uuidString).bin")
    defer { try? FileManager.default.removeItem(at: dest) }
    let task = makeTransport().download(HTTPRequest(method: .get, path: "/object/avatars/cat.png"), toFile: dest)
    for await _ in task.progress {}
    try await task.value()
    #expect((try? Data(contentsOf: dest)) == Data([0xA, 0xB, 0xC]))
  }
}
