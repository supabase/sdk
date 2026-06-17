import Foundation

/// In-memory `Transport` for tests: `responder` maps a request to a (status, body) pair.
public struct MockTransport: Transport {
  public typealias Responder = @Sendable (HTTPRequest) async throws -> (Int, Data)
  let responder: Responder
  let decoder: JSONDecoder

  public init(decoder: JSONDecoder = JSONDecoder(), _ responder: @escaping Responder) {
    self.responder = responder
    self.decoder = decoder
  }

  public func send<R: Decodable & Sendable>(_ request: HTTPRequest) async throws -> R {
    let (_, data) = try await responder(request)
    return try decoder.decode(R.self, from: data)
  }

  public func send<B: Encodable & Sendable, R: Decodable & Sendable>(_ request: HTTPRequest, body: B) async throws -> R {
    try await send(request)
  }

  public func send(_ request: HTTPRequest) async throws {
    _ = try await responder(request)
  }

  public func upload<R: Decodable & Sendable>(_ request: HTTPRequest, from source: UploadSource) -> TransferTask<R> {
    let responder = self.responder
    let decoder = self.decoder
    let (stream, cont) = AsyncStream<TransferProgress>.makeStream()
    cont.finish()
    return TransferTask(
      progress: stream,
      value: { let (_, data) = try await responder(request); return try decoder.decode(R.self, from: data) },
      cancel: {}
    )
  }

  public func download(_ request: HTTPRequest, toFile destination: URL) -> TransferTask<Void> {
    let responder = self.responder
    let (stream, cont) = AsyncStream<TransferProgress>.makeStream()
    cont.finish()
    return TransferTask(
      progress: stream,
      value: { let (_, data) = try await responder(request); try data.write(to: destination) },
      cancel: {}
    )
  }

  public func stream(_ request: HTTPRequest) async throws -> ResponseStream {
    let (status, data) = try await responder(request)
    let body = AsyncThrowingStream<ArraySlice<UInt8>, any Error> { cont in
      cont.yield(ArraySlice(data))
      cont.finish()
    }
    return ResponseStream(head: HTTPResponseHead(status: status, headers: [:]), body: body)
  }
}
