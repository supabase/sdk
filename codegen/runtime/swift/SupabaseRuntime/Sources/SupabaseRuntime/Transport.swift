import Foundation

public protocol Transport: Sendable {
  func send<R: Decodable & Sendable>(_ request: HTTPRequest) async throws -> R
  func send<B: Encodable & Sendable, R: Decodable & Sendable>(_ request: HTTPRequest, body: B) async throws -> R
  func send(_ request: HTTPRequest) async throws
  func upload<R: Decodable & Sendable>(_ request: HTTPRequest, from source: UploadSource) -> TransferTask<R>
  func download(_ request: HTTPRequest, toFile destination: URL) -> TransferTask<Void>
  func stream(_ request: HTTPRequest) async throws -> ResponseStream
}
