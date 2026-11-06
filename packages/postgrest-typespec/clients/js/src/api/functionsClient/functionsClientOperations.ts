import { parse } from "uri-template";
import { FunctionsClientContext } from "./functionsClientContext.js";
import { createRestError } from "../../helpers/error.js";
import type { OperationOptions } from "../../helpers/interfaces.js";
import {
  jsonAcceptMediaTypeToTransportTransform,
  jsonArrayElementToTransportTransform_6 as jsonArrayElementToTransportTransform,
  jsonArrayRecordToApplicationTransform,
  jsonArrayRowToApplicationTransform,
  jsonGeoJsonFeatureCollectionToApplicationTransform,
  jsonRecordStringToTransportTransform,
  jsonRecordUnknownToApplicationTransform,
  jsonRecordUnknownToTransportTransform_2,
} from "../../models/internal/serializers.js";
import type {
  AcceptMediaType,
  CountPreference,
  GeoJsonFeatureCollection,
  HandlingPreference,
  TxPreference,
} from "../../models/models.js";

export interface CallOptions extends OperationOptions {
  select?: string
  order?: string
  limit?: number
  offset?: number
  or?: string
  and?: string
  notOr?: string
  notAnd?: string
  arguments?: Record<string, string>
  accept?: AcceptMediaType
  acceptProfile?: string
  range?: string
  rangeUnit?: "items"
  prefer?: Array<HandlingPreference | string | TxPreference | CountPreference | string>
}
/**
 * Calls a STABLE or IMMUTABLE function with GET. The query string carries the
 * arguments, plus filters, ordering and pagination for a table-valued result.
 *
 * @param {FunctionsClientContext} client
 * @param {string} functionName
 * @param {CallOptions} [options]
 */
export async function call(
  client: FunctionsClientContext,
  functionName: string,
  options?: CallOptions,
): Promise<unknown | Array<Record<string, unknown>> | Record<string, unknown> | string | GeoJsonFeatureCollection | Array<Record<string, unknown>> | Uint8Array | void> {
  const path = parse("/rpc/{functionName}{?select,order,limit,offset,or,and,not.or,not.and,arguments*}").expand({
    functionName: functionName,
    ...(options?.select && {select: options.select}),
    ...(options?.order && {order: options.order}),
    ...(options?.limit && {limit: options.limit}),
    ...(options?.offset && {offset: options.offset}),
    ...(options?.or && {or: options.or}),
    ...(options?.and && {and: options.and}),
    ...(options?.notOr && {"not.or": options.notOr}),
    ...(options?.notAnd && {"not.and": options.notAnd}),
    ...(options?.arguments && {arguments: jsonRecordStringToTransportTransform(options.arguments)})
  });
  const httpRequestOptions = {
    headers: {
      ...(options?.accept && {accept: jsonAcceptMediaTypeToTransportTransform(options.accept)}),
      ...(options?.acceptProfile && {"accept-profile": options.acceptProfile}),
      ...(options?.range && {range: options.range}),
      "range-unit": options?.rangeUnit ?? "items",
      ...(options?.prefer && {prefer: jsonArrayElementToTransportTransform(options.prefer)})
    },
  };
  const response = await client.pathUnchecked(path).get(httpRequestOptions);


  if (typeof options?.operationOptions?.onResponse === "function") {
    options?.operationOptions?.onResponse(response);
  }
  if (+response.status === 200 && response.headers["content-type"]?.includes("application/json")) {
    return response.body!;
  }
  if (+response.status === 200 && response.headers["content-type"]?.includes("application/vnd.pgrst.array+json")) {
    return jsonArrayRowToApplicationTransform(response.body)!;
  }
  if (+response.status === 200 && response.headers["content-type"]?.includes("application/vnd.pgrst.object+json")) {
    return jsonRecordUnknownToApplicationTransform(response.body)!;
  }
  if (+response.status === 200 && response.headers["content-type"]?.includes("text/csv")) {
    return response.body!;
  }
  if (+response.status === 200 && response.headers["content-type"]?.includes("application/geo+json")) {
    return jsonGeoJsonFeatureCollectionToApplicationTransform(response.body)!;
  }
  if (+response.status === 200 && response.headers["content-type"]?.includes("application/vnd.pgrst.plan+text")) {
    return response.body!;
  }
  if (+response.status === 200 && response.headers["content-type"]?.includes("application/vnd.pgrst.plan+json")) {
    return jsonArrayRecordToApplicationTransform(response.body)!;
  }
  if (+response.status === 200 && response.headers["content-type"]?.includes("*/*")) {
    return response.body!;
  }
  if (+response.status === 206 && response.headers["content-type"]?.includes("application/json")) {
    return response.body!;
  }
  if (+response.status === 206 && response.headers["content-type"]?.includes("application/vnd.pgrst.array+json")) {
    return jsonArrayRowToApplicationTransform(response.body)!;
  }
  if (+response.status === 206 && response.headers["content-type"]?.includes("application/vnd.pgrst.object+json")) {
    return jsonRecordUnknownToApplicationTransform(response.body)!;
  }
  if (+response.status === 206 && response.headers["content-type"]?.includes("text/csv")) {
    return response.body!;
  }
  if (+response.status === 206 && response.headers["content-type"]?.includes("application/geo+json")) {
    return jsonGeoJsonFeatureCollectionToApplicationTransform(response.body)!;
  }
  if (+response.status === 206 && response.headers["content-type"]?.includes("application/vnd.pgrst.plan+text")) {
    return response.body!;
  }
  if (+response.status === 206 && response.headers["content-type"]?.includes("application/vnd.pgrst.plan+json")) {
    return jsonArrayRecordToApplicationTransform(response.body)!;
  }
  if (+response.status === 206 && response.headers["content-type"]?.includes("*/*")) {
    return response.body!;
  }
  if (+response.status === 204 && !response.body) {
    return;
  }
  throw createRestError(response);
}
;
export interface CallHeadOptions extends OperationOptions {
  select?: string
  order?: string
  limit?: number
  offset?: number
  or?: string
  and?: string
  notOr?: string
  notAnd?: string
  arguments?: Record<string, string>
  accept?: AcceptMediaType
  acceptProfile?: string
  range?: string
  rangeUnit?: "items"
  prefer?: Array<HandlingPreference | string | TxPreference | CountPreference | string>
}
/**
 * Same as `call`, without a response body.
 *
 * @param {FunctionsClientContext} client
 * @param {string} functionName
 * @param {CallHeadOptions} [options]
 */
export async function callHead(
  client: FunctionsClientContext,
  functionName: string,
  options?: CallHeadOptions,
): Promise<void> {
  const path = parse("/rpc/{functionName}{?select,order,limit,offset,or,and,not.or,not.and,arguments*}").expand({
    functionName: functionName,
    ...(options?.select && {select: options.select}),
    ...(options?.order && {order: options.order}),
    ...(options?.limit && {limit: options.limit}),
    ...(options?.offset && {offset: options.offset}),
    ...(options?.or && {or: options.or}),
    ...(options?.and && {and: options.and}),
    ...(options?.notOr && {"not.or": options.notOr}),
    ...(options?.notAnd && {"not.and": options.notAnd}),
    ...(options?.arguments && {arguments: jsonRecordStringToTransportTransform(options.arguments)})
  });
  const httpRequestOptions = {
    headers: {
      ...(options?.accept && {accept: jsonAcceptMediaTypeToTransportTransform(options.accept)}),
      ...(options?.acceptProfile && {"accept-profile": options.acceptProfile}),
      ...(options?.range && {range: options.range}),
      "range-unit": options?.rangeUnit ?? "items",
      ...(options?.prefer && {prefer: jsonArrayElementToTransportTransform(options.prefer)})
    },
  };
  const response = await client.pathUnchecked(path).head(httpRequestOptions);


  if (typeof options?.operationOptions?.onResponse === "function") {
    options?.operationOptions?.onResponse(response);
  }
  if (+response.status === 200 && !response.body) {
    return;
  }
  if (+response.status === 206 && !response.body) {
    return;
  }
  if (+response.status === 204 && !response.body) {
    return;
  }
  throw createRestError(response);
}
;
export interface InvokeOptions extends OperationOptions {
  select?: string
  order?: string
  limit?: number
  offset?: number
  or?: string
  and?: string
  notOr?: string
  notAnd?: string
  filters?: Record<string, string>
  accept?: AcceptMediaType
  contentProfile?: string
  range?: string
  rangeUnit?: "items"
  prefer?: Array<HandlingPreference | string | TxPreference | CountPreference | string>
  contentType?: "application/json"
}
/**
 * Calls a function with POST. Every function accepts POST, whatever its
 * volatility. Filters, ordering and pagination in the query string apply to a
 * table-valued result.
 *
 * @param {FunctionsClientContext} client
 * @param {string} functionName
 * @param {Record<string, unknown>} body
 * @param {InvokeOptions} [options]
 */
export async function invoke(
  client: FunctionsClientContext,
  functionName: string,
  body: Record<string, unknown>,
  options?: InvokeOptions,
): Promise<unknown | Array<Record<string, unknown>> | Record<string, unknown> | string | GeoJsonFeatureCollection | Array<Record<string, unknown>> | Uint8Array | void> {
  const path = parse("/rpc/{functionName}{?select,order,limit,offset,or,and,not.or,not.and,filters*}").expand({
    functionName: functionName,
    ...(options?.select && {select: options.select}),
    ...(options?.order && {order: options.order}),
    ...(options?.limit && {limit: options.limit}),
    ...(options?.offset && {offset: options.offset}),
    ...(options?.or && {or: options.or}),
    ...(options?.and && {and: options.and}),
    ...(options?.notOr && {"not.or": options.notOr}),
    ...(options?.notAnd && {"not.and": options.notAnd}),
    ...(options?.filters && {filters: jsonRecordStringToTransportTransform(options.filters)})
  });
  const httpRequestOptions = {
    headers: {
      ...(options?.accept && {accept: jsonAcceptMediaTypeToTransportTransform(options.accept)}),
      ...(options?.contentProfile && {"content-profile": options.contentProfile}),
      ...(options?.range && {range: options.range}),
      "range-unit": options?.rangeUnit ?? "items",
      ...(options?.prefer && {prefer: jsonArrayElementToTransportTransform(options.prefer)}),
      "content-type": options?.contentType ?? "application/json"
    },body: jsonRecordUnknownToTransportTransform_2(body),
  };
  const response = await client.pathUnchecked(path).post(httpRequestOptions);


  if (typeof options?.operationOptions?.onResponse === "function") {
    options?.operationOptions?.onResponse(response);
  }
  if (+response.status === 200 && response.headers["content-type"]?.includes("application/json")) {
    return response.body!;
  }
  if (+response.status === 200 && response.headers["content-type"]?.includes("application/vnd.pgrst.array+json")) {
    return jsonArrayRowToApplicationTransform(response.body)!;
  }
  if (+response.status === 200 && response.headers["content-type"]?.includes("application/vnd.pgrst.object+json")) {
    return jsonRecordUnknownToApplicationTransform(response.body)!;
  }
  if (+response.status === 200 && response.headers["content-type"]?.includes("text/csv")) {
    return response.body!;
  }
  if (+response.status === 200 && response.headers["content-type"]?.includes("application/geo+json")) {
    return jsonGeoJsonFeatureCollectionToApplicationTransform(response.body)!;
  }
  if (+response.status === 200 && response.headers["content-type"]?.includes("application/vnd.pgrst.plan+text")) {
    return response.body!;
  }
  if (+response.status === 200 && response.headers["content-type"]?.includes("application/vnd.pgrst.plan+json")) {
    return jsonArrayRecordToApplicationTransform(response.body)!;
  }
  if (+response.status === 200 && response.headers["content-type"]?.includes("*/*")) {
    return response.body!;
  }
  if (+response.status === 206 && response.headers["content-type"]?.includes("application/json")) {
    return response.body!;
  }
  if (+response.status === 206 && response.headers["content-type"]?.includes("application/vnd.pgrst.array+json")) {
    return jsonArrayRowToApplicationTransform(response.body)!;
  }
  if (+response.status === 206 && response.headers["content-type"]?.includes("application/vnd.pgrst.object+json")) {
    return jsonRecordUnknownToApplicationTransform(response.body)!;
  }
  if (+response.status === 206 && response.headers["content-type"]?.includes("text/csv")) {
    return response.body!;
  }
  if (+response.status === 206 && response.headers["content-type"]?.includes("application/geo+json")) {
    return jsonGeoJsonFeatureCollectionToApplicationTransform(response.body)!;
  }
  if (+response.status === 206 && response.headers["content-type"]?.includes("application/vnd.pgrst.plan+text")) {
    return response.body!;
  }
  if (+response.status === 206 && response.headers["content-type"]?.includes("application/vnd.pgrst.plan+json")) {
    return jsonArrayRecordToApplicationTransform(response.body)!;
  }
  if (+response.status === 206 && response.headers["content-type"]?.includes("*/*")) {
    return response.body!;
  }
  if (+response.status === 204 && !response.body) {
    return;
  }
  throw createRestError(response);
}
;
export interface InvokeFormOptions extends OperationOptions {
  select?: string
  order?: string
  limit?: number
  offset?: number
  or?: string
  and?: string
  notOr?: string
  notAnd?: string
  filters?: Record<string, string>
  accept?: AcceptMediaType
  contentProfile?: string
  range?: string
  rangeUnit?: "items"
  prefer?: Array<HandlingPreference | string | TxPreference | CountPreference | string>
  contentType?: "application/x-www-form-urlencoded"
}
export async function invokeForm(
  client: FunctionsClientContext,
  functionName: string,
  body: Record<string, string>,
  options?: InvokeFormOptions,
): Promise<unknown | Array<Record<string, unknown>> | Record<string, unknown> | string | GeoJsonFeatureCollection | Array<Record<string, unknown>> | Uint8Array | void> {
  const path = parse("/rpc/{functionName}{?select,order,limit,offset,or,and,not.or,not.and,filters*}").expand({
    functionName: functionName,
    ...(options?.select && {select: options.select}),
    ...(options?.order && {order: options.order}),
    ...(options?.limit && {limit: options.limit}),
    ...(options?.offset && {offset: options.offset}),
    ...(options?.or && {or: options.or}),
    ...(options?.and && {and: options.and}),
    ...(options?.notOr && {"not.or": options.notOr}),
    ...(options?.notAnd && {"not.and": options.notAnd}),
    ...(options?.filters && {filters: jsonRecordStringToTransportTransform(options.filters)})
  });
  const httpRequestOptions = {
    headers: {
      ...(options?.accept && {accept: jsonAcceptMediaTypeToTransportTransform(options.accept)}),
      ...(options?.contentProfile && {"content-profile": options.contentProfile}),
      ...(options?.range && {range: options.range}),
      "range-unit": options?.rangeUnit ?? "items",
      ...(options?.prefer && {prefer: jsonArrayElementToTransportTransform(options.prefer)}),
      "content-type": options?.contentType ?? "application/x-www-form-urlencoded"
    },body: jsonRecordStringToTransportTransform(body),
  };
  const response = await client.pathUnchecked(path).post(httpRequestOptions);


  if (typeof options?.operationOptions?.onResponse === "function") {
    options?.operationOptions?.onResponse(response);
  }
  if (+response.status === 200 && response.headers["content-type"]?.includes("application/json")) {
    return response.body!;
  }
  if (+response.status === 200 && response.headers["content-type"]?.includes("application/vnd.pgrst.array+json")) {
    return jsonArrayRowToApplicationTransform(response.body)!;
  }
  if (+response.status === 200 && response.headers["content-type"]?.includes("application/vnd.pgrst.object+json")) {
    return jsonRecordUnknownToApplicationTransform(response.body)!;
  }
  if (+response.status === 200 && response.headers["content-type"]?.includes("text/csv")) {
    return response.body!;
  }
  if (+response.status === 200 && response.headers["content-type"]?.includes("application/geo+json")) {
    return jsonGeoJsonFeatureCollectionToApplicationTransform(response.body)!;
  }
  if (+response.status === 200 && response.headers["content-type"]?.includes("application/vnd.pgrst.plan+text")) {
    return response.body!;
  }
  if (+response.status === 200 && response.headers["content-type"]?.includes("application/vnd.pgrst.plan+json")) {
    return jsonArrayRecordToApplicationTransform(response.body)!;
  }
  if (+response.status === 200 && response.headers["content-type"]?.includes("*/*")) {
    return response.body!;
  }
  if (+response.status === 206 && response.headers["content-type"]?.includes("application/json")) {
    return response.body!;
  }
  if (+response.status === 206 && response.headers["content-type"]?.includes("application/vnd.pgrst.array+json")) {
    return jsonArrayRowToApplicationTransform(response.body)!;
  }
  if (+response.status === 206 && response.headers["content-type"]?.includes("application/vnd.pgrst.object+json")) {
    return jsonRecordUnknownToApplicationTransform(response.body)!;
  }
  if (+response.status === 206 && response.headers["content-type"]?.includes("text/csv")) {
    return response.body!;
  }
  if (+response.status === 206 && response.headers["content-type"]?.includes("application/geo+json")) {
    return jsonGeoJsonFeatureCollectionToApplicationTransform(response.body)!;
  }
  if (+response.status === 206 && response.headers["content-type"]?.includes("application/vnd.pgrst.plan+text")) {
    return response.body!;
  }
  if (+response.status === 206 && response.headers["content-type"]?.includes("application/vnd.pgrst.plan+json")) {
    return jsonArrayRecordToApplicationTransform(response.body)!;
  }
  if (+response.status === 206 && response.headers["content-type"]?.includes("*/*")) {
    return response.body!;
  }
  if (+response.status === 204 && !response.body) {
    return;
  }
  throw createRestError(response);
}
;
export interface InvokeBinaryOptions extends OperationOptions {
  select?: string
  order?: string
  limit?: number
  offset?: number
  or?: string
  and?: string
  notOr?: string
  notAnd?: string
  filters?: Record<string, string>
  accept?: AcceptMediaType
  contentProfile?: string
  range?: string
  rangeUnit?: "items"
  prefer?: Array<HandlingPreference | string | TxPreference | CountPreference | string>
  contentType?: "application/octet-stream"
}
export async function invokeBinary(
  client: FunctionsClientContext,
  functionName: string,
  body: Uint8Array,
  options?: InvokeBinaryOptions,
): Promise<unknown | Array<Record<string, unknown>> | Record<string, unknown> | string | GeoJsonFeatureCollection | Array<Record<string, unknown>> | Uint8Array | void> {
  const path = parse("/rpc/{functionName}{?select,order,limit,offset,or,and,not.or,not.and,filters*}").expand({
    functionName: functionName,
    ...(options?.select && {select: options.select}),
    ...(options?.order && {order: options.order}),
    ...(options?.limit && {limit: options.limit}),
    ...(options?.offset && {offset: options.offset}),
    ...(options?.or && {or: options.or}),
    ...(options?.and && {and: options.and}),
    ...(options?.notOr && {"not.or": options.notOr}),
    ...(options?.notAnd && {"not.and": options.notAnd}),
    ...(options?.filters && {filters: jsonRecordStringToTransportTransform(options.filters)})
  });
  const httpRequestOptions = {
    headers: {
      ...(options?.accept && {accept: jsonAcceptMediaTypeToTransportTransform(options.accept)}),
      ...(options?.contentProfile && {"content-profile": options.contentProfile}),
      ...(options?.range && {range: options.range}),
      "range-unit": options?.rangeUnit ?? "items",
      ...(options?.prefer && {prefer: jsonArrayElementToTransportTransform(options.prefer)}),
      "content-type": options?.contentType ?? "application/octet-stream"
    },body: body,
  };
  const response = await client.pathUnchecked(path).post(httpRequestOptions);


  if (typeof options?.operationOptions?.onResponse === "function") {
    options?.operationOptions?.onResponse(response);
  }
  if (+response.status === 200 && response.headers["content-type"]?.includes("application/json")) {
    return response.body!;
  }
  if (+response.status === 200 && response.headers["content-type"]?.includes("application/vnd.pgrst.array+json")) {
    return jsonArrayRowToApplicationTransform(response.body)!;
  }
  if (+response.status === 200 && response.headers["content-type"]?.includes("application/vnd.pgrst.object+json")) {
    return jsonRecordUnknownToApplicationTransform(response.body)!;
  }
  if (+response.status === 200 && response.headers["content-type"]?.includes("text/csv")) {
    return response.body!;
  }
  if (+response.status === 200 && response.headers["content-type"]?.includes("application/geo+json")) {
    return jsonGeoJsonFeatureCollectionToApplicationTransform(response.body)!;
  }
  if (+response.status === 200 && response.headers["content-type"]?.includes("application/vnd.pgrst.plan+text")) {
    return response.body!;
  }
  if (+response.status === 200 && response.headers["content-type"]?.includes("application/vnd.pgrst.plan+json")) {
    return jsonArrayRecordToApplicationTransform(response.body)!;
  }
  if (+response.status === 200 && response.headers["content-type"]?.includes("*/*")) {
    return response.body!;
  }
  if (+response.status === 206 && response.headers["content-type"]?.includes("application/json")) {
    return response.body!;
  }
  if (+response.status === 206 && response.headers["content-type"]?.includes("application/vnd.pgrst.array+json")) {
    return jsonArrayRowToApplicationTransform(response.body)!;
  }
  if (+response.status === 206 && response.headers["content-type"]?.includes("application/vnd.pgrst.object+json")) {
    return jsonRecordUnknownToApplicationTransform(response.body)!;
  }
  if (+response.status === 206 && response.headers["content-type"]?.includes("text/csv")) {
    return response.body!;
  }
  if (+response.status === 206 && response.headers["content-type"]?.includes("application/geo+json")) {
    return jsonGeoJsonFeatureCollectionToApplicationTransform(response.body)!;
  }
  if (+response.status === 206 && response.headers["content-type"]?.includes("application/vnd.pgrst.plan+text")) {
    return response.body!;
  }
  if (+response.status === 206 && response.headers["content-type"]?.includes("application/vnd.pgrst.plan+json")) {
    return jsonArrayRecordToApplicationTransform(response.body)!;
  }
  if (+response.status === 206 && response.headers["content-type"]?.includes("*/*")) {
    return response.body!;
  }
  if (+response.status === 204 && !response.body) {
    return;
  }
  throw createRestError(response);
}
;
export interface InvokeTextOptions extends OperationOptions {
  select?: string
  order?: string
  limit?: number
  offset?: number
  or?: string
  and?: string
  notOr?: string
  notAnd?: string
  filters?: Record<string, string>
  accept?: AcceptMediaType
  contentProfile?: string
  range?: string
  rangeUnit?: "items"
  prefer?: Array<HandlingPreference | string | TxPreference | CountPreference | string>
  contentType?: "text/plain"
}
export async function invokeText(
  client: FunctionsClientContext,
  functionName: string,
  body: string,
  options?: InvokeTextOptions,
): Promise<unknown | Array<Record<string, unknown>> | Record<string, unknown> | string | GeoJsonFeatureCollection | Array<Record<string, unknown>> | Uint8Array | void> {
  const path = parse("/rpc/{functionName}{?select,order,limit,offset,or,and,not.or,not.and,filters*}").expand({
    functionName: functionName,
    ...(options?.select && {select: options.select}),
    ...(options?.order && {order: options.order}),
    ...(options?.limit && {limit: options.limit}),
    ...(options?.offset && {offset: options.offset}),
    ...(options?.or && {or: options.or}),
    ...(options?.and && {and: options.and}),
    ...(options?.notOr && {"not.or": options.notOr}),
    ...(options?.notAnd && {"not.and": options.notAnd}),
    ...(options?.filters && {filters: jsonRecordStringToTransportTransform(options.filters)})
  });
  const httpRequestOptions = {
    headers: {
      ...(options?.accept && {accept: jsonAcceptMediaTypeToTransportTransform(options.accept)}),
      ...(options?.contentProfile && {"content-profile": options.contentProfile}),
      ...(options?.range && {range: options.range}),
      "range-unit": options?.rangeUnit ?? "items",
      ...(options?.prefer && {prefer: jsonArrayElementToTransportTransform(options.prefer)}),
      "content-type": options?.contentType ?? "text/plain"
    },body: body,
  };
  const response = await client.pathUnchecked(path).post(httpRequestOptions);


  if (typeof options?.operationOptions?.onResponse === "function") {
    options?.operationOptions?.onResponse(response);
  }
  if (+response.status === 200 && response.headers["content-type"]?.includes("application/json")) {
    return response.body!;
  }
  if (+response.status === 200 && response.headers["content-type"]?.includes("application/vnd.pgrst.array+json")) {
    return jsonArrayRowToApplicationTransform(response.body)!;
  }
  if (+response.status === 200 && response.headers["content-type"]?.includes("application/vnd.pgrst.object+json")) {
    return jsonRecordUnknownToApplicationTransform(response.body)!;
  }
  if (+response.status === 200 && response.headers["content-type"]?.includes("text/csv")) {
    return response.body!;
  }
  if (+response.status === 200 && response.headers["content-type"]?.includes("application/geo+json")) {
    return jsonGeoJsonFeatureCollectionToApplicationTransform(response.body)!;
  }
  if (+response.status === 200 && response.headers["content-type"]?.includes("application/vnd.pgrst.plan+text")) {
    return response.body!;
  }
  if (+response.status === 200 && response.headers["content-type"]?.includes("application/vnd.pgrst.plan+json")) {
    return jsonArrayRecordToApplicationTransform(response.body)!;
  }
  if (+response.status === 200 && response.headers["content-type"]?.includes("*/*")) {
    return response.body!;
  }
  if (+response.status === 206 && response.headers["content-type"]?.includes("application/json")) {
    return response.body!;
  }
  if (+response.status === 206 && response.headers["content-type"]?.includes("application/vnd.pgrst.array+json")) {
    return jsonArrayRowToApplicationTransform(response.body)!;
  }
  if (+response.status === 206 && response.headers["content-type"]?.includes("application/vnd.pgrst.object+json")) {
    return jsonRecordUnknownToApplicationTransform(response.body)!;
  }
  if (+response.status === 206 && response.headers["content-type"]?.includes("text/csv")) {
    return response.body!;
  }
  if (+response.status === 206 && response.headers["content-type"]?.includes("application/geo+json")) {
    return jsonGeoJsonFeatureCollectionToApplicationTransform(response.body)!;
  }
  if (+response.status === 206 && response.headers["content-type"]?.includes("application/vnd.pgrst.plan+text")) {
    return response.body!;
  }
  if (+response.status === 206 && response.headers["content-type"]?.includes("application/vnd.pgrst.plan+json")) {
    return jsonArrayRecordToApplicationTransform(response.body)!;
  }
  if (+response.status === 206 && response.headers["content-type"]?.includes("*/*")) {
    return response.body!;
  }
  if (+response.status === 204 && !response.body) {
    return;
  }
  throw createRestError(response);
}
;
export interface InvokeXmlOptions extends OperationOptions {
  select?: string
  order?: string
  limit?: number
  offset?: number
  or?: string
  and?: string
  notOr?: string
  notAnd?: string
  filters?: Record<string, string>
  accept?: AcceptMediaType
  contentProfile?: string
  range?: string
  rangeUnit?: "items"
  prefer?: Array<HandlingPreference | string | TxPreference | CountPreference | string>
  contentType?: "text/xml"
}
export async function invokeXml(
  client: FunctionsClientContext,
  functionName: string,
  body: string,
  options?: InvokeXmlOptions,
): Promise<unknown | Array<Record<string, unknown>> | Record<string, unknown> | string | GeoJsonFeatureCollection | Array<Record<string, unknown>> | Uint8Array | void> {
  const path = parse("/rpc/{functionName}{?select,order,limit,offset,or,and,not.or,not.and,filters*}").expand({
    functionName: functionName,
    ...(options?.select && {select: options.select}),
    ...(options?.order && {order: options.order}),
    ...(options?.limit && {limit: options.limit}),
    ...(options?.offset && {offset: options.offset}),
    ...(options?.or && {or: options.or}),
    ...(options?.and && {and: options.and}),
    ...(options?.notOr && {"not.or": options.notOr}),
    ...(options?.notAnd && {"not.and": options.notAnd}),
    ...(options?.filters && {filters: jsonRecordStringToTransportTransform(options.filters)})
  });
  const httpRequestOptions = {
    headers: {
      ...(options?.accept && {accept: jsonAcceptMediaTypeToTransportTransform(options.accept)}),
      ...(options?.contentProfile && {"content-profile": options.contentProfile}),
      ...(options?.range && {range: options.range}),
      "range-unit": options?.rangeUnit ?? "items",
      ...(options?.prefer && {prefer: jsonArrayElementToTransportTransform(options.prefer)}),
      "content-type": options?.contentType ?? "text/xml"
    },body: body,
  };
  const response = await client.pathUnchecked(path).post(httpRequestOptions);


  if (typeof options?.operationOptions?.onResponse === "function") {
    options?.operationOptions?.onResponse(response);
  }
  if (+response.status === 200 && response.headers["content-type"]?.includes("application/json")) {
    return response.body!;
  }
  if (+response.status === 200 && response.headers["content-type"]?.includes("application/vnd.pgrst.array+json")) {
    return jsonArrayRowToApplicationTransform(response.body)!;
  }
  if (+response.status === 200 && response.headers["content-type"]?.includes("application/vnd.pgrst.object+json")) {
    return jsonRecordUnknownToApplicationTransform(response.body)!;
  }
  if (+response.status === 200 && response.headers["content-type"]?.includes("text/csv")) {
    return response.body!;
  }
  if (+response.status === 200 && response.headers["content-type"]?.includes("application/geo+json")) {
    return jsonGeoJsonFeatureCollectionToApplicationTransform(response.body)!;
  }
  if (+response.status === 200 && response.headers["content-type"]?.includes("application/vnd.pgrst.plan+text")) {
    return response.body!;
  }
  if (+response.status === 200 && response.headers["content-type"]?.includes("application/vnd.pgrst.plan+json")) {
    return jsonArrayRecordToApplicationTransform(response.body)!;
  }
  if (+response.status === 200 && response.headers["content-type"]?.includes("*/*")) {
    return response.body!;
  }
  if (+response.status === 206 && response.headers["content-type"]?.includes("application/json")) {
    return response.body!;
  }
  if (+response.status === 206 && response.headers["content-type"]?.includes("application/vnd.pgrst.array+json")) {
    return jsonArrayRowToApplicationTransform(response.body)!;
  }
  if (+response.status === 206 && response.headers["content-type"]?.includes("application/vnd.pgrst.object+json")) {
    return jsonRecordUnknownToApplicationTransform(response.body)!;
  }
  if (+response.status === 206 && response.headers["content-type"]?.includes("text/csv")) {
    return response.body!;
  }
  if (+response.status === 206 && response.headers["content-type"]?.includes("application/geo+json")) {
    return jsonGeoJsonFeatureCollectionToApplicationTransform(response.body)!;
  }
  if (+response.status === 206 && response.headers["content-type"]?.includes("application/vnd.pgrst.plan+text")) {
    return response.body!;
  }
  if (+response.status === 206 && response.headers["content-type"]?.includes("application/vnd.pgrst.plan+json")) {
    return jsonArrayRecordToApplicationTransform(response.body)!;
  }
  if (+response.status === 206 && response.headers["content-type"]?.includes("*/*")) {
    return response.body!;
  }
  if (+response.status === 204 && !response.body) {
    return;
  }
  throw createRestError(response);
}
;
