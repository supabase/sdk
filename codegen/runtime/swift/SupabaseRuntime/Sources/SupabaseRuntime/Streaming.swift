import Foundation

public struct TransferProgress: Sendable {
  public let completed: Int64
  public let total: Int64?
  public init(completed: Int64, total: Int64?) {
    self.completed = completed
    self.total = total
  }
  public var fraction: Double? {
    guard let total, total > 0 else { return nil }
    return Double(completed) / Double(total)
  }
}

/// Handle for an in-flight upload/download: live progress + the awaitable result.
public struct TransferTask<Value: Sendable>: Sendable {
  public let progress: AsyncStream<TransferProgress>
  private let _value: @Sendable () async throws -> Value
  private let _cancel: @Sendable () -> Void

  public init(
    progress: AsyncStream<TransferProgress>,
    value: @escaping @Sendable () async throws -> Value,
    cancel: @escaping @Sendable () -> Void
  ) {
    self.progress = progress
    self._value = value
    self._cancel = cancel
  }

  public func value() async throws -> Value { try await _value() }
  public func cancel() { _cancel() }
}

/// A streamed response body (event streams / SSE / incremental reads).
public struct ResponseStream: Sendable {
  public let head: HTTPResponseHead
  public let body: AsyncThrowingStream<ArraySlice<UInt8>, any Error>
  public init(head: HTTPResponseHead, body: AsyncThrowingStream<ArraySlice<UInt8>, any Error>) {
    self.head = head
    self.body = body
  }
}
