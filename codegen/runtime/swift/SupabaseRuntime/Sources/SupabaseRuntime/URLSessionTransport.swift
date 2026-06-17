import Foundation

public actor URLSessionTransport: Transport {
  let configuration: ClientConfiguration
  let urlSession: URLSession

  public init(configuration: ClientConfiguration, urlSession: URLSession? = nil) {
    self.configuration = configuration
    if let urlSession {
      self.urlSession = urlSession
    } else {
      switch configuration.sessionKind {
      case .foreground:
        self.urlSession = URLSession(configuration: .default)
      case .background(let identifier):
        self.urlSession = URLSession(configuration: .background(withIdentifier: identifier))
      }
    }
  }

  func makeURLRequest(_ request: HTTPRequest) async throws -> URLRequest {
    var components = URLComponents(url: configuration.baseURL, resolvingAgainstBaseURL: false)!
    components.path += request.path
    if !request.query.isEmpty { components.queryItems = request.query }
    var urlRequest = URLRequest(url: components.url!)
    urlRequest.httpMethod = request.method.rawValue
    for (k, v) in configuration.defaultHeaders { urlRequest.setValue(v, forHTTPHeaderField: k) }
    for (k, v) in try await configuration.auth.headers() { urlRequest.setValue(v, forHTTPHeaderField: k) }
    for (k, v) in request.headers { urlRequest.setValue(v, forHTTPHeaderField: k) }
    return urlRequest
  }

  nonisolated func head(from response: URLResponse) -> HTTPResponseHead {
    let http = response as? HTTPURLResponse
    let headers = (http?.allHeaderFields as? [String: String]) ?? [:]
    return HTTPResponseHead(status: http?.statusCode ?? 0, headers: headers)
  }

  func validate(_ data: Data, _ response: URLResponse) throws -> Data {
    let responseHead = head(from: response)
    guard (200..<300).contains(responseHead.status) else {
      if let mapped = configuration.errorMapper(data, responseHead) { throw mapped }
      throw TransportError.http(status: responseHead.status, body: data, head: responseHead)
    }
    return data
  }

  public func send<R: Decodable & Sendable>(_ request: HTTPRequest) async throws -> R {
    let urlRequest = try await makeURLRequest(request)
    let (data, response) = try await urlSession.data(for: urlRequest)
    let body = try validate(data, response)
    do { return try configuration.decoder.decode(R.self, from: body) }
    catch { throw TransportError.decoding(error) }
  }

  public func send<B: Encodable & Sendable, R: Decodable & Sendable>(_ request: HTTPRequest, body: B) async throws -> R {
    var urlRequest = try await makeURLRequest(request)
    urlRequest.httpBody = try configuration.encoder.encode(body)
    if urlRequest.value(forHTTPHeaderField: "Content-Type") == nil {
      urlRequest.setValue("application/json", forHTTPHeaderField: "Content-Type")
    }
    let (data, response) = try await urlSession.data(for: urlRequest)
    let validated = try validate(data, response)
    do { return try configuration.decoder.decode(R.self, from: validated) }
    catch { throw TransportError.decoding(error) }
  }

  public func send(_ request: HTTPRequest) async throws {
    let urlRequest = try await makeURLRequest(request)
    let (data, response) = try await urlSession.data(for: urlRequest)
    _ = try validate(data, response)
  }

  // Streaming — implemented in Tasks 6-7.
  public nonisolated func upload<R: Decodable & Sendable>(_ request: HTTPRequest, from source: UploadSource) -> TransferTask<R> {
    fatalError("implemented in Task 6")
  }
  public nonisolated func download(_ request: HTTPRequest, toFile destination: URL) -> TransferTask<Void> {
    fatalError("implemented in Task 6")
  }
  public func stream(_ request: HTTPRequest) async throws -> ResponseStream {
    fatalError("implemented in Task 7")
  }
}
