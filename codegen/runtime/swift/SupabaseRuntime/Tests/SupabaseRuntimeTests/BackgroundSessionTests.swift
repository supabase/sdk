import Foundation
import Testing
@testable import SupabaseRuntime

private struct R: Codable, Sendable { let ok: Bool }

@Suite struct BackgroundSessionTests {
  // Inject a stub session so no real background URLSession is created; the guard keys off sessionKind.
  func backgroundTransport(id: String) -> URLSessionTransport {
    let (session, _) = StubURLProtocol.makeSession(stub: .init())
    let config = ClientConfiguration(baseURL: URL(string: "https://x.test/v1")!, sessionKind: .background(identifier: id))
    return URLSessionTransport(configuration: config, urlSession: session)
  }

  @Test func backgroundUploadFromDataThrowsRequiresFile() async {
    let transport = backgroundTransport(id: "test.bg")
    let task: TransferTask<R> = transport.upload(HTTPRequest(method: .post, path: "/object/b/k"), from: .data(Data([1])))
    await #expect(throws: TransportError.self) { _ = try await task.value() }
  }

  @Test func handleBackgroundEventsStoresAndConsumesCompletion() async {
    let transport = backgroundTransport(id: "test.bg2")
    let box = CompletionBox()
    await transport.handleBackgroundEvents(identifier: "test.bg2") { box.fire() }
    let stored = await transport.consumeBackgroundCompletion(identifier: "test.bg2")
    stored?()
    #expect(box.fired == true)
    // consumed once: second consume is nil
    let again = await transport.consumeBackgroundCompletion(identifier: "test.bg2")
    #expect(again == nil)
  }
}

private final class CompletionBox: @unchecked Sendable {
  private let lock = NSLock(); private var value = false
  func fire() { lock.withLock { value = true } }
  var fired: Bool { lock.withLock { value } }
}
