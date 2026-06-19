class SupabaseClient:
    def __init__(self, url: str, key: str):
        self._auth = None
        self._storage = None

    @property
    def auth(self):
        return self._auth

    @auth.setter
    def auth(self, value):
        self._auth = value

    @property
    def storage(self):
        return self._storage

    async def rpc(self, fn: str, params: dict = None):
        pass

    def from_(self, table: str):
        pass

    @staticmethod
    def create(url: str, key: str) -> "SupabaseClient":
        pass

    @classmethod
    def from_url(cls, url: str) -> "SupabaseClient":
        pass

    def _private_helper(self):
        pass

    def __repr__(self) -> str:
        return f"SupabaseClient({self})"


class StorageClient:
    async def upload(self, path: str, data: bytes) -> None:
        pass

    def download(self, path: str) -> bytes:
        pass


# Private class — must not appear in output
class _InternalCache:
    def method(self):
        pass


def create_client(url: str, key: str) -> SupabaseClient:
    return SupabaseClient(url, key)


def _private_function():
    pass
