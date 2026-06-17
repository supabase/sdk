import Foundation

public enum TransportError: Error, Sendable {
  case http(status: Int, body: Data, head: HTTPResponseHead)
  case transport(any Error)
  case decoding(any Error)
  case cancelled
  case backgroundRequiresFile
}
