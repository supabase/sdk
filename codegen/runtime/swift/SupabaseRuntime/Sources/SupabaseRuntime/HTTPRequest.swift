import Foundation

public enum HTTPMethod: String, Sendable {
  case get = "GET"
  case post = "POST"
  case put = "PUT"
  case delete = "DELETE"
  case patch = "PATCH"
  case head = "HEAD"
}

public struct HTTPRequest: Sendable {
  public var method: HTTPMethod
  public var path: String
  public var query: [URLQueryItem]
  public var headers: [String: String]

  public init(method: HTTPMethod, path: String, query: [URLQueryItem] = [], headers: [String: String] = [:]) {
    self.method = method
    self.path = path
    self.query = query
    self.headers = headers
  }

  public init(method: HTTPMethod, path: RequestPath, query: [URLQueryItem] = [], headers: [String: String] = [:]) {
    self.init(method: method, path: path.value, query: query, headers: headers)
  }
}

public struct HTTPResponseHead: Sendable {
  public let status: Int
  public let headers: [String: String]
  public init(status: Int, headers: [String: String]) {
    self.status = status
    self.headers = headers
  }
}

public enum UploadSource: Sendable {
  case file(URL)
  case data(Data)
}
