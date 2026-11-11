import type { BearerTokenCredential } from "@typespec/ts-http-runtime";
import {
  createFunctionsClientContext,
  type FunctionsClientContext,
  type FunctionsClientOptions,
} from "./api/functionsClient/functionsClientContext.js";
import {
  call,
  callHead,
  type CallHeadOptions,
  type CallOptions,
  invoke,
  invokeBinary,
  type InvokeBinaryOptions,
  invokeForm,
  type InvokeFormOptions,
  type InvokeOptions,
  invokeText,
  type InvokeTextOptions,
  invokeXml,
  type InvokeXmlOptions,
} from "./api/functionsClient/functionsClientOperations.js";
import {
  createPostgRestClientContext,
  type PostgRestClientContext,
  type PostgRestClientOptions,
} from "./api/postgRestClientContext.js";
import {
  createRelationsClientContext,
  type RelationsClientContext,
  type RelationsClientOptions,
} from "./api/relationsClient/relationsClientContext.js";
import {
  delete_,
  type DeleteOptions,
  insert,
  insertCsv,
  type InsertCsvOptions,
  insertForm,
  type InsertFormOptions,
  type InsertOptions,
  read,
  readHead,
  type ReadHeadOptions,
  type ReadOptions,
  update,
  updateCsv,
  type UpdateCsvOptions,
  updateForm,
  type UpdateFormOptions,
  type UpdateOptions,
  upsert,
  upsertCsv,
  type UpsertCsvOptions,
  upsertForm,
  type UpsertFormOptions,
  type UpsertOptions,
} from "./api/relationsClient/relationsClientOperations.js";
import {
  createRootClientContext,
  type RootClientContext,
  type RootClientOptions,
} from "./api/rootClient/rootClientContext.js";
import {
  describe,
  describeHead,
  type DescribeHeadOptions,
  type DescribeOptions,
} from "./api/rootClient/rootClientOperations.js";

export class PostgRestClient {
  #context: PostgRestClientContext
  relationsClient: RelationsClient;
  functionsClient: FunctionsClient;
  rootClient: RootClient
  constructor(
    credential: BearerTokenCredential,
    options?: PostgRestClientOptions,
  ) {
    this.#context = createPostgRestClientContext(credential, options);
    this.relationsClient = new RelationsClient(credential, options);;this
      .functionsClient = new FunctionsClient(credential, options);;this
      .rootClient = new RootClient(credential, options);
  }
}
export class RootClient {
  #context: RootClientContext
  constructor(credential: BearerTokenCredential, options?: RootClientOptions) {
    this.#context = createRootClientContext(credential, options);

  }
  async describe(options?: DescribeOptions) {
    return describe(this.#context, options);
  };
  async describeHead(options?: DescribeHeadOptions) {
    return describeHead(this.#context, options);
  }
}
export class FunctionsClient {
  #context: FunctionsClientContext
  constructor(
    credential: BearerTokenCredential,
    options?: FunctionsClientOptions,
  ) {
    this.#context = createFunctionsClientContext(credential, options);

  }
  async call(functionName: string, options?: CallOptions) {
    return call(this.#context, functionName, options);
  };
  async callHead(functionName: string, options?: CallHeadOptions) {
    return callHead(this.#context, functionName, options);
  };
  async invoke(
    functionName: string,
    body: Record<string, unknown>,
    options?: InvokeOptions,
  ) {
    return invoke(this.#context, functionName, body, options);
  };
  async invokeForm(
    functionName: string,
    body: Record<string, string>,
    options?: InvokeFormOptions,
  ) {
    return invokeForm(this.#context, functionName, body, options);
  };
  async invokeBinary(
    functionName: string,
    body: Uint8Array,
    options?: InvokeBinaryOptions,
  ) {
    return invokeBinary(this.#context, functionName, body, options);
  };
  async invokeText(
    functionName: string,
    body: string,
    options?: InvokeTextOptions,
  ) {
    return invokeText(this.#context, functionName, body, options);
  };
  async invokeXml(
    functionName: string,
    body: string,
    options?: InvokeXmlOptions,
  ) {
    return invokeXml(this.#context, functionName, body, options);
  }
}
export class RelationsClient {
  #context: RelationsClientContext
  constructor(
    credential: BearerTokenCredential,
    options?: RelationsClientOptions,
  ) {
    this.#context = createRelationsClientContext(credential, options);

  }
  async read(relation: string, options?: ReadOptions) {
    return read(this.#context, relation, options);
  };
  async readHead(relation: string, options?: ReadHeadOptions) {
    return readHead(this.#context, relation, options);
  };
  async insert(
    relation: string,
    body: Record<string, unknown> | Array<Record<string, unknown>>,
    options?: InsertOptions,
  ) {
    return insert(this.#context, relation, body, options);
  };
  async insertForm(
    relation: string,
    body: Record<string, string>,
    options?: InsertFormOptions,
  ) {
    return insertForm(this.#context, relation, body, options);
  };
  async insertCsv(relation: string, body: string, options?: InsertCsvOptions) {
    return insertCsv(this.#context, relation, body, options);
  };
  async upsert(
    relation: string,
    body: Record<string, unknown>,
    options?: UpsertOptions,
  ) {
    return upsert(this.#context, relation, body, options);
  };
  async upsertForm(
    relation: string,
    body: Record<string, string>,
    options?: UpsertFormOptions,
  ) {
    return upsertForm(this.#context, relation, body, options);
  };
  async upsertCsv(relation: string, body: string, options?: UpsertCsvOptions) {
    return upsertCsv(this.#context, relation, body, options);
  };
  async update(
    relation: string,
    body: Record<string, unknown>,
    options?: UpdateOptions,
  ) {
    return update(this.#context, relation, body, options);
  };
  async updateForm(
    relation: string,
    body: Record<string, string>,
    options?: UpdateFormOptions,
  ) {
    return updateForm(this.#context, relation, body, options);
  };
  async updateCsv(relation: string, body: string, options?: UpdateCsvOptions) {
    return updateCsv(this.#context, relation, body, options);
  };
  async delete_(relation: string, options?: DeleteOptions) {
    return delete_(this.#context, relation, options);
  }
}
