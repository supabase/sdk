import Foundation
import Testing
@testable import SupabaseRuntime

private struct UploadResult: Codable, Equatable, Sendable { let key: String }

@Suite struct URLSessionTransportTransferTests {
  func makeTransport(stub: StubURLProtocol.Stub) -> URLSessionTransport {
    var config = ClientConfiguration(baseURL: URL(string: "https://x.test/storage/v1")!)
    config.auth = AuthProvider { ["apikey": "k"] }
    let (session, _) = StubURLProtocol.makeSession(stub: stub)
    return URLSessionTransport(configuration: config, urlSession: session)
  }

  @Test func uploadFromDataReturnsDecodedValue() async throws {
    let task: TransferTask<UploadResult> = makeTransport(stub: .init(body: #"{"key":"folder/cat.png"}"#.data(using: .utf8)!))
      .upload(HTTPRequest(method: .post, path: "/object/avatars/cat.png"), from: .data(Data([0x1, 0x2])))
    for await _ in task.progress {}
    #expect(try await task.value() == UploadResult(key: "folder/cat.png"))
  }

  @Test func uploadProgressStreamTerminates() async throws {
    let task: TransferTask<UploadResult> = makeTransport(stub: .init(body: #"{"key":"k"}"#.data(using: .utf8)!))
      .upload(HTTPRequest(method: .post, path: "/object/b/k"), from: .data(Data([1])))
    var count = 0
    for await _ in task.progress { count += 1 }   // must terminate (count may be 0 under the stub)
    _ = try await task.value()
    #expect(count >= 0)
  }

  @Test func downloadWritesToFile() async throws {
    let dest = FileManager.default.temporaryDirectory.appendingPathComponent("dl-\(UUID().uuidString).bin")
    defer { try? FileManager.default.removeItem(at: dest) }
    let task = makeTransport(stub: .init(body: Data([0xA, 0xB, 0xC])))
      .download(HTTPRequest(method: .get, path: "/object/avatars/cat.png"), toFile: dest)
    for await _ in task.progress {}
    try await task.value()
    #expect((try? Data(contentsOf: dest)) == Data([0xA, 0xB, 0xC]))
  }
}
