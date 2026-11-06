import {
  type BearerTokenCredential,
  type Client,
  type ClientOptions,
  getClient,
} from "@typespec/ts-http-runtime";

export interface RelationsClientContext extends Client {

}export interface RelationsClientOptions extends ClientOptions {
  endpoint?: string;
}export function createRelationsClientContext(
  credential: BearerTokenCredential,
  options?: RelationsClientOptions,
): RelationsClientContext {
  const params: Record<string, any> = {
    endpoint: options?.endpoint ?? "http://localhost:3000"
  };
  const resolvedEndpoint = "{endpoint}".replace(/{([^}]+)}/g, (_, key) =>
    key in params ? String(params[key]) : (() => { throw new Error(`Missing parameter: ${key}`); })()
  );;return getClient(resolvedEndpoint,{
    ...options,credential,authSchemes: [{
      kind: "http",
      scheme: "bearer"
    }]
  })
}
