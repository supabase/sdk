export class AuthClient {
  public signUp(email: string, password: string): Promise<void> {
    return Promise.resolve();
  }

  public signIn(email: string): Promise<void> {
    return Promise.resolve();
  }

  get session(): string | null {
    return null;
  }

  private _token: string | null = null;

  protected _refresh(): void {}

  #privateField = "hidden";
}

export class StorageClient {
  public upload(path: string): Promise<void> {
    return Promise.resolve();
  }
}

export function createClient(url: string, key: string): AuthClient {
  return new AuthClient();
}

export const version = "1.0.0";

// Not exported — must not appear in output
class InternalHelper {
  public doSomething(): void {}
}

function internalUtil(): void {}
