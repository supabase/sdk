import Foundation

private let pathParamAllowedCharacters: CharacterSet = {
  var cs = CharacterSet.urlPathAllowed
  cs.remove("/")
  return cs
}()

public struct RequestPath: Sendable, ExpressibleByStringInterpolation {
  public let value: String

  public init(stringLiteral value: String) { self.value = value }
  public init(stringInterpolation: StringInterpolation) { self.value = stringInterpolation.text }
  public init(_ path: RequestPath) { self.value = path.value }

  public struct StringInterpolation: StringInterpolationProtocol {
    var text = ""
    public init(literalCapacity: Int, interpolationCount: Int) { text.reserveCapacity(literalCapacity) }
    public mutating func appendLiteral(_ literal: String) { text += literal }
    /// Percent-encodes a raw path-segment value (slashes become %2F). Pass the raw, unencoded value — do not pre-encode.
    public mutating func appendInterpolation(param value: String) {
      text += value.addingPercentEncoding(withAllowedCharacters: pathParamAllowedCharacters) ?? value
    }
  }
}
