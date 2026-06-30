import Foundation

/// In-memory `Transport` for tests. The `responder` receives the request and the
/// encoded request body (nil for body-less sends/downloads), so tests can assert both.
public struct MockTransport: Transport {
  public typealias Responder = @Sendable (HTTPRequest, Data?) async throws -> (Int, Data)
  public let responder: Responder
  public let encoder: JSONEncoder
  public let decoder: JSONDecoder

  public init(encoder: JSONEncoder = JSONEncoder(), decoder: JSONDecoder = JSONDecoder(), _ responder: @escaping Responder) {
    self.responder = responder
    self.encoder = encoder
    self.decoder = decoder
  }

  public func send<R: Decodable & Sendable>(_ request: HTTPRequest) async throws -> R {
    let (_, data) = try await responder(request, nil)
    return try decoder.decode(R.self, from: data)
  }

  public func send<B: Encodable & Sendable, R: Decodable & Sendable>(_ request: HTTPRequest, body: B) async throws -> R {
    let bodyData = try encoder.encode(body)
    let (_, data) = try await responder(request, bodyData)
    return try decoder.decode(R.self, from: data)
  }

  public func send(_ request: HTTPRequest) async throws {
    _ = try await responder(request, nil)
  }

  public func upload<R: Decodable & Sendable>(_ request: HTTPRequest, from source: UploadSource) -> TransferTask<R> {
    let responder = self.responder
    let decoder = self.decoder
    let (stream, cont) = AsyncStream<TransferProgress>.makeStream()
    cont.finish()
    return TransferTask(
      progress: stream,
      value: {
        let bodyData: Data?
        switch source {
        case .data(let d): bodyData = d
        case .file(let url): bodyData = try Data(contentsOf: url)
        }
        let (_, data) = try await responder(request, bodyData)
        return try decoder.decode(R.self, from: data)
      },
      cancel: {}
    )
  }

  public func download(_ request: HTTPRequest, toFile destination: URL) -> TransferTask<Void> {
    let responder = self.responder
    let (stream, cont) = AsyncStream<TransferProgress>.makeStream()
    cont.finish()
    return TransferTask(
      progress: stream,
      value: { let (_, data) = try await responder(request, nil); try data.write(to: destination) },
      cancel: {}
    )
  }

  public func stream(_ request: HTTPRequest) async throws -> ResponseStream {
    let (status, data) = try await responder(request, nil)
    let body = AsyncThrowingStream<ArraySlice<UInt8>, any Error> { cont in
      cont.yield(ArraySlice(data))
      cont.finish()
    }
    return ResponseStream(head: HTTPResponseHead(status: status, headers: [:]), body: body)
  }
}
