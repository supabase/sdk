import Foundation

public struct RequestPath: Sendable, ExpressibleByStringInterpolation {
  public let value: String

  public init(stringLiteral value: String) { self.value = value }
  public init(stringInterpolation: StringInterpolation) { self.value = stringInterpolation.text }
  public init(_ path: RequestPath) { self.value = path.value }

  public struct StringInterpolation: StringInterpolationProtocol {
    var text = ""
    public init(literalCapacity: Int, interpolationCount: Int) { text.reserveCapacity(literalCapacity) }
    public mutating func appendLiteral(_ literal: String) { text += literal }
    public mutating func appendInterpolation(param value: String) {
      var allowed = CharacterSet.urlPathAllowed
      allowed.remove("/")
      text += value.addingPercentEncoding(withAllowedCharacters: allowed) ?? value
    }
  }
}
