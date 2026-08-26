class AuthClient {
  AuthClient(this.url);
  final String url;
  Future<void> signOut() async {}
}

class _PrivateHelper {
  void noop() {}
}

void configureAuth() {}
