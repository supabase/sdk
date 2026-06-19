class SupabaseClient {
  SupabaseClient(String supabaseUrl, String supabaseKey);

  GoTrueClient get auth => _auth;

  StorageClient get storage => _storage;

  set accessToken(String value) {}

  Future<void> initialize() async {}

  PostgrestQueryBuilder from(String table) {}

  static SupabaseClient create(String url, String key) {}

  void dispose() {}

  // Private members — must not appear in output
  GoTrueClient _auth = GoTrueClient();
  void _refresh() {}
}

class StorageClient {
  Future<void> upload(String path, dynamic data) async {}
}

// Private class — must not appear in output
class _InternalCache {}

mixin LoggingMixin {
  void log(String message) {}
}

typedef AuthCallback = void Function(String event);
