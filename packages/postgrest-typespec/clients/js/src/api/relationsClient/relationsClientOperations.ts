import { parse } from "uri-template";
import { RelationsClientContext } from "./relationsClientContext.js";
import { createRestError } from "../../helpers/error.js";
import type { OperationOptions } from "../../helpers/interfaces.js";
import {
  jsonAcceptMediaTypeToTransportTransform,
  jsonArrayElementToTransportTransform,
  jsonArrayElementToTransportTransform_2,
  jsonArrayElementToTransportTransform_3,
  jsonArrayElementToTransportTransform_4,
  jsonArrayElementToTransportTransform_5,
  jsonArrayRecordToApplicationTransform,
  jsonArrayRowToApplicationTransform,
  jsonGeoJsonFeatureCollectionToApplicationTransform,
  jsonRecordStringToTransportTransform,
  jsonRecordUnknownToApplicationTransform,
  jsonRecordUnknownToTransportTransform,
} from "../../models/internal/serializers.js";
import type {
  AcceptMediaType,
  CountPreference,
  GeoJsonFeatureCollection,
  HandlingPreference,
  MissingPreference,
  ResolutionPreference,
  ReturnPreference,
  TxPreference,
} from "../../models/models.js";

export interface ReadOptions extends OperationOptions {
  select?: string
  filters?: Record<string, string>
  or?: string
  and?: string
  notOr?: string
  notAnd?: string
  order?: string
  limit?: number
  offset?: number
  accept?: AcceptMediaType
  acceptProfile?: string
  range?: string
  rangeUnit?: "items"
  prefer?: Array<HandlingPreference | string | TxPreference | CountPreference>
}
/**
 * Reads rows. Supports vertical filtering (`select`), horizontal filtering,
 * ordering, pagination, resource embedding and aggregates. The response is 206
 * Partial Content when it does not contain every row of the count.
 *
 * @param {RelationsClientContext} client
 * @param {string} relation
 * @param {ReadOptions} [options]
 */
export async function read(
  client: RelationsClientContext,
  relation: string,
  options?: ReadOptions,
): Promise<Array<Record<string, unknown>> | Record<string, unknown> | string | GeoJsonFeatureCollection | Array<Record<string, unknown>> | Uint8Array> {
  const path = parse("/{relation}{?select,filters*,or,and,not.or,not.and,order,limit,offset}").expand({
    relation: relation,
    ...(options?.select && {select: options.select}),
    ...(options?.filters && {filters: jsonRecordStringToTransportTransform(options.filters)}),
    ...(options?.or && {or: options.or}),
    ...(options?.and && {and: options.and}),
    ...(options?.notOr && {"not.or": options.notOr}),
    ...(options?.notAnd && {"not.and": options.notAnd}),
    ...(options?.order && {order: options.order}),
    ...(options?.limit && {limit: options.limit}),
    ...(options?.offset && {offset: options.offset})
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
    return jsonArrayRowToApplicationTransform(response.body)!;
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
    return jsonArrayRowToApplicationTransform(response.body)!;
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
  throw createRestError(response);
}
;
export interface ReadHeadOptions extends OperationOptions {
  select?: string
  filters?: Record<string, string>
  or?: string
  and?: string
  notOr?: string
  notAnd?: string
  order?: string
  limit?: number
  offset?: number
  accept?: AcceptMediaType
  acceptProfile?: string
  range?: string
  rangeUnit?: "items"
  prefer?: Array<HandlingPreference | string | TxPreference | CountPreference>
}
/**
 * Same as `read`, without a response body.
 *
 * @param {RelationsClientContext} client
 * @param {string} relation
 * @param {ReadHeadOptions} [options]
 */
export async function readHead(
  client: RelationsClientContext,
  relation: string,
  options?: ReadHeadOptions,
): Promise<void> {
  const path = parse("/{relation}{?select,filters*,or,and,not.or,not.and,order,limit,offset}").expand({
    relation: relation,
    ...(options?.select && {select: options.select}),
    ...(options?.filters && {filters: jsonRecordStringToTransportTransform(options.filters)}),
    ...(options?.or && {or: options.or}),
    ...(options?.and && {and: options.and}),
    ...(options?.notOr && {"not.or": options.notOr}),
    ...(options?.notAnd && {"not.and": options.notAnd}),
    ...(options?.order && {order: options.order}),
    ...(options?.limit && {limit: options.limit}),
    ...(options?.offset && {offset: options.offset})
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
  throw createRestError(response);
}
;
export interface InsertOptions extends OperationOptions {
  select?: string
  columns?: string
  onConflict?: string
  accept?: AcceptMediaType
  contentProfile?: string
  prefer?: Array<HandlingPreference | string | TxPreference | CountPreference | ReturnPreference | ResolutionPreference | MissingPreference>
  contentType?: "application/json"
}
/**
 * Creates one row from a JSON object, or many rows from a JSON array of objects
 * with uniform keys or from CSV, in a single INSERT. Missing keys get NULL, or
 * the column DEFAULT with `Prefer: missing=default`. With `Prefer:
 * resolution=merge-duplicates` or `resolution=ignore-duplicates` the insert
 * becomes an upsert on the primary key, or on the `on_conflict` columns.
 *
 * @param {RelationsClientContext} client
 * @param {string} relation
 * @param {Record<string, unknown> | Array<Record<string, unknown>>} body
 * @param {InsertOptions} [options]
 */
export async function insert(
  client: RelationsClientContext,
  relation: string,
  body: Record<string, unknown> | Array<Record<string, unknown>>,
  options?: InsertOptions,
): Promise<void | Array<Record<string, unknown>> | Record<string, unknown> | string | GeoJsonFeatureCollection | Array<Record<string, unknown>> | Uint8Array> {
  const path = parse("/{relation}{?select,columns,on_conflict}").expand({
    relation: relation,
    ...(options?.select && {select: options.select}),
    ...(options?.columns && {columns: options.columns}),
    ...(options?.onConflict && {on_conflict: options.onConflict})
  });
  const httpRequestOptions = {
    headers: {
      ...(options?.accept && {accept: jsonAcceptMediaTypeToTransportTransform(options.accept)}),
      ...(options?.contentProfile && {"content-profile": options.contentProfile}),
      ...(options?.prefer && {prefer: jsonArrayElementToTransportTransform_2(options.prefer)}),
      "content-type": options?.contentType ?? "application/json"
    },body: body,
  };
  const response = await client.pathUnchecked(path).post(httpRequestOptions);


  if (typeof options?.operationOptions?.onResponse === "function") {
    options?.operationOptions?.onResponse(response);
  }
  if (+response.status === 201 && !response.body) {
    return;
  }
  if (+response.status === 201 && response.headers["content-type"]?.includes("application/json")) {
    return jsonArrayRowToApplicationTransform(response.body)!;
  }
  if (+response.status === 201 && response.headers["content-type"]?.includes("application/vnd.pgrst.array+json")) {
    return jsonArrayRowToApplicationTransform(response.body)!;
  }
  if (+response.status === 201 && response.headers["content-type"]?.includes("application/vnd.pgrst.object+json")) {
    return jsonRecordUnknownToApplicationTransform(response.body)!;
  }
  if (+response.status === 201 && response.headers["content-type"]?.includes("text/csv")) {
    return response.body!;
  }
  if (+response.status === 201 && response.headers["content-type"]?.includes("application/geo+json")) {
    return jsonGeoJsonFeatureCollectionToApplicationTransform(response.body)!;
  }
  if (+response.status === 201 && response.headers["content-type"]?.includes("application/vnd.pgrst.plan+text")) {
    return response.body!;
  }
  if (+response.status === 201 && response.headers["content-type"]?.includes("application/vnd.pgrst.plan+json")) {
    return jsonArrayRecordToApplicationTransform(response.body)!;
  }
  if (+response.status === 201 && response.headers["content-type"]?.includes("*/*")) {
    return response.body!;
  }
  if (+response.status === 200 && !response.body) {
    return;
  }
  if (+response.status === 200 && response.headers["content-type"]?.includes("application/json")) {
    return jsonArrayRowToApplicationTransform(response.body)!;
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
  throw createRestError(response);
}
;
export interface InsertFormOptions extends OperationOptions {
  select?: string
  columns?: string
  onConflict?: string
  accept?: AcceptMediaType
  contentProfile?: string
  prefer?: Array<HandlingPreference | string | TxPreference | CountPreference | ReturnPreference | ResolutionPreference | MissingPreference>
  contentType?: "application/x-www-form-urlencoded"
}
export async function insertForm(
  client: RelationsClientContext,
  relation: string,
  body: Record<string, string>,
  options?: InsertFormOptions,
): Promise<void | Array<Record<string, unknown>> | Record<string, unknown> | string | GeoJsonFeatureCollection | Array<Record<string, unknown>> | Uint8Array> {
  const path = parse("/{relation}{?select,columns,on_conflict}").expand({
    relation: relation,
    ...(options?.select && {select: options.select}),
    ...(options?.columns && {columns: options.columns}),
    ...(options?.onConflict && {on_conflict: options.onConflict})
  });
  const httpRequestOptions = {
    headers: {
      ...(options?.accept && {accept: jsonAcceptMediaTypeToTransportTransform(options.accept)}),
      ...(options?.contentProfile && {"content-profile": options.contentProfile}),
      ...(options?.prefer && {prefer: jsonArrayElementToTransportTransform_2(options.prefer)}),
      "content-type": options?.contentType ?? "application/x-www-form-urlencoded"
    },body: jsonRecordStringToTransportTransform(body),
  };
  const response = await client.pathUnchecked(path).post(httpRequestOptions);


  if (typeof options?.operationOptions?.onResponse === "function") {
    options?.operationOptions?.onResponse(response);
  }
  if (+response.status === 201 && !response.body) {
    return;
  }
  if (+response.status === 201 && response.headers["content-type"]?.includes("application/json")) {
    return jsonArrayRowToApplicationTransform(response.body)!;
  }
  if (+response.status === 201 && response.headers["content-type"]?.includes("application/vnd.pgrst.array+json")) {
    return jsonArrayRowToApplicationTransform(response.body)!;
  }
  if (+response.status === 201 && response.headers["content-type"]?.includes("application/vnd.pgrst.object+json")) {
    return jsonRecordUnknownToApplicationTransform(response.body)!;
  }
  if (+response.status === 201 && response.headers["content-type"]?.includes("text/csv")) {
    return response.body!;
  }
  if (+response.status === 201 && response.headers["content-type"]?.includes("application/geo+json")) {
    return jsonGeoJsonFeatureCollectionToApplicationTransform(response.body)!;
  }
  if (+response.status === 201 && response.headers["content-type"]?.includes("application/vnd.pgrst.plan+text")) {
    return response.body!;
  }
  if (+response.status === 201 && response.headers["content-type"]?.includes("application/vnd.pgrst.plan+json")) {
    return jsonArrayRecordToApplicationTransform(response.body)!;
  }
  if (+response.status === 201 && response.headers["content-type"]?.includes("*/*")) {
    return response.body!;
  }
  if (+response.status === 200 && !response.body) {
    return;
  }
  if (+response.status === 200 && response.headers["content-type"]?.includes("application/json")) {
    return jsonArrayRowToApplicationTransform(response.body)!;
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
  throw createRestError(response);
}
;
export interface InsertCsvOptions extends OperationOptions {
  select?: string
  columns?: string
  onConflict?: string
  accept?: AcceptMediaType
  contentProfile?: string
  prefer?: Array<HandlingPreference | string | TxPreference | CountPreference | ReturnPreference | ResolutionPreference | MissingPreference>
  contentType?: "text/csv"
}
export async function insertCsv(
  client: RelationsClientContext,
  relation: string,
  body: string,
  options?: InsertCsvOptions,
): Promise<void | Array<Record<string, unknown>> | Record<string, unknown> | string | GeoJsonFeatureCollection | Array<Record<string, unknown>> | Uint8Array> {
  const path = parse("/{relation}{?select,columns,on_conflict}").expand({
    relation: relation,
    ...(options?.select && {select: options.select}),
    ...(options?.columns && {columns: options.columns}),
    ...(options?.onConflict && {on_conflict: options.onConflict})
  });
  const httpRequestOptions = {
    headers: {
      ...(options?.accept && {accept: jsonAcceptMediaTypeToTransportTransform(options.accept)}),
      ...(options?.contentProfile && {"content-profile": options.contentProfile}),
      ...(options?.prefer && {prefer: jsonArrayElementToTransportTransform_2(options.prefer)}),
      "content-type": options?.contentType ?? "text/csv"
    },body: body,
  };
  const response = await client.pathUnchecked(path).post(httpRequestOptions);


  if (typeof options?.operationOptions?.onResponse === "function") {
    options?.operationOptions?.onResponse(response);
  }
  if (+response.status === 201 && !response.body) {
    return;
  }
  if (+response.status === 201 && response.headers["content-type"]?.includes("application/json")) {
    return jsonArrayRowToApplicationTransform(response.body)!;
  }
  if (+response.status === 201 && response.headers["content-type"]?.includes("application/vnd.pgrst.array+json")) {
    return jsonArrayRowToApplicationTransform(response.body)!;
  }
  if (+response.status === 201 && response.headers["content-type"]?.includes("application/vnd.pgrst.object+json")) {
    return jsonRecordUnknownToApplicationTransform(response.body)!;
  }
  if (+response.status === 201 && response.headers["content-type"]?.includes("text/csv")) {
    return response.body!;
  }
  if (+response.status === 201 && response.headers["content-type"]?.includes("application/geo+json")) {
    return jsonGeoJsonFeatureCollectionToApplicationTransform(response.body)!;
  }
  if (+response.status === 201 && response.headers["content-type"]?.includes("application/vnd.pgrst.plan+text")) {
    return response.body!;
  }
  if (+response.status === 201 && response.headers["content-type"]?.includes("application/vnd.pgrst.plan+json")) {
    return jsonArrayRecordToApplicationTransform(response.body)!;
  }
  if (+response.status === 201 && response.headers["content-type"]?.includes("*/*")) {
    return response.body!;
  }
  if (+response.status === 200 && !response.body) {
    return;
  }
  if (+response.status === 200 && response.headers["content-type"]?.includes("application/json")) {
    return jsonArrayRowToApplicationTransform(response.body)!;
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
  throw createRestError(response);
}
;
export interface UpsertOptions extends OperationOptions {
  filters?: Record<string, string>
  or?: string
  and?: string
  notOr?: string
  notAnd?: string
  select?: string
  columns?: string
  accept?: AcceptMediaType
  contentProfile?: string
  prefer?: Array<HandlingPreference | string | TxPreference | ReturnPreference>
  contentType?: "application/json"
}
/**
 * Inserts the row, or replaces it when it exists. The query string filters
 * every primary key column with `eq`, and the body repeats those values and
 * gives every column. Limits and offsets are not allowed (PGRST114). A body key
 * that differs from the filter fails with PGRST115.
 *
 * @param {RelationsClientContext} client
 * @param {string} relation
 * @param {Record<string, unknown>} body
 * @param {UpsertOptions} [options]
 */
export async function upsert(
  client: RelationsClientContext,
  relation: string,
  body: Record<string, unknown>,
  options?: UpsertOptions,
): Promise<void | Array<Record<string, unknown>> | Record<string, unknown> | string | GeoJsonFeatureCollection | Array<Record<string, unknown>> | Uint8Array> {
  const path = parse("/{relation}{?filters*,or,and,not.or,not.and,select,columns}").expand({
    relation: relation,
    ...(options?.filters && {filters: jsonRecordStringToTransportTransform(options.filters)}),
    ...(options?.or && {or: options.or}),
    ...(options?.and && {and: options.and}),
    ...(options?.notOr && {"not.or": options.notOr}),
    ...(options?.notAnd && {"not.and": options.notAnd}),
    ...(options?.select && {select: options.select}),
    ...(options?.columns && {columns: options.columns})
  });
  const httpRequestOptions = {
    headers: {
      ...(options?.accept && {accept: jsonAcceptMediaTypeToTransportTransform(options.accept)}),
      ...(options?.contentProfile && {"content-profile": options.contentProfile}),
      ...(options?.prefer && {prefer: jsonArrayElementToTransportTransform_3(options.prefer)}),
      "content-type": options?.contentType ?? "application/json"
    },body: jsonRecordUnknownToTransportTransform(body),
  };
  const response = await client.pathUnchecked(path).put(httpRequestOptions);


  if (typeof options?.operationOptions?.onResponse === "function") {
    options?.operationOptions?.onResponse(response);
  }
  if (+response.status === 204 && !response.body) {
    return;
  }
  if (+response.status === 200 && response.headers["content-type"]?.includes("application/json")) {
    return jsonArrayRowToApplicationTransform(response.body)!;
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
  if (+response.status === 201 && response.headers["content-type"]?.includes("application/json")) {
    return jsonArrayRowToApplicationTransform(response.body)!;
  }
  if (+response.status === 201 && response.headers["content-type"]?.includes("application/vnd.pgrst.array+json")) {
    return jsonArrayRowToApplicationTransform(response.body)!;
  }
  if (+response.status === 201 && response.headers["content-type"]?.includes("application/vnd.pgrst.object+json")) {
    return jsonRecordUnknownToApplicationTransform(response.body)!;
  }
  if (+response.status === 201 && response.headers["content-type"]?.includes("text/csv")) {
    return response.body!;
  }
  if (+response.status === 201 && response.headers["content-type"]?.includes("application/geo+json")) {
    return jsonGeoJsonFeatureCollectionToApplicationTransform(response.body)!;
  }
  if (+response.status === 201 && response.headers["content-type"]?.includes("application/vnd.pgrst.plan+text")) {
    return response.body!;
  }
  if (+response.status === 201 && response.headers["content-type"]?.includes("application/vnd.pgrst.plan+json")) {
    return jsonArrayRecordToApplicationTransform(response.body)!;
  }
  if (+response.status === 201 && response.headers["content-type"]?.includes("*/*")) {
    return response.body!;
  }
  throw createRestError(response);
}
;
export interface UpsertFormOptions extends OperationOptions {
  filters?: Record<string, string>
  or?: string
  and?: string
  notOr?: string
  notAnd?: string
  select?: string
  columns?: string
  accept?: AcceptMediaType
  contentProfile?: string
  prefer?: Array<HandlingPreference | string | TxPreference | ReturnPreference>
  contentType?: "application/x-www-form-urlencoded"
}
export async function upsertForm(
  client: RelationsClientContext,
  relation: string,
  body: Record<string, string>,
  options?: UpsertFormOptions,
): Promise<void | Array<Record<string, unknown>> | Record<string, unknown> | string | GeoJsonFeatureCollection | Array<Record<string, unknown>> | Uint8Array> {
  const path = parse("/{relation}{?filters*,or,and,not.or,not.and,select,columns}").expand({
    relation: relation,
    ...(options?.filters && {filters: jsonRecordStringToTransportTransform(options.filters)}),
    ...(options?.or && {or: options.or}),
    ...(options?.and && {and: options.and}),
    ...(options?.notOr && {"not.or": options.notOr}),
    ...(options?.notAnd && {"not.and": options.notAnd}),
    ...(options?.select && {select: options.select}),
    ...(options?.columns && {columns: options.columns})
  });
  const httpRequestOptions = {
    headers: {
      ...(options?.accept && {accept: jsonAcceptMediaTypeToTransportTransform(options.accept)}),
      ...(options?.contentProfile && {"content-profile": options.contentProfile}),
      ...(options?.prefer && {prefer: jsonArrayElementToTransportTransform_3(options.prefer)}),
      "content-type": options?.contentType ?? "application/x-www-form-urlencoded"
    },body: jsonRecordStringToTransportTransform(body),
  };
  const response = await client.pathUnchecked(path).put(httpRequestOptions);


  if (typeof options?.operationOptions?.onResponse === "function") {
    options?.operationOptions?.onResponse(response);
  }
  if (+response.status === 204 && !response.body) {
    return;
  }
  if (+response.status === 200 && response.headers["content-type"]?.includes("application/json")) {
    return jsonArrayRowToApplicationTransform(response.body)!;
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
  if (+response.status === 201 && response.headers["content-type"]?.includes("application/json")) {
    return jsonArrayRowToApplicationTransform(response.body)!;
  }
  if (+response.status === 201 && response.headers["content-type"]?.includes("application/vnd.pgrst.array+json")) {
    return jsonArrayRowToApplicationTransform(response.body)!;
  }
  if (+response.status === 201 && response.headers["content-type"]?.includes("application/vnd.pgrst.object+json")) {
    return jsonRecordUnknownToApplicationTransform(response.body)!;
  }
  if (+response.status === 201 && response.headers["content-type"]?.includes("text/csv")) {
    return response.body!;
  }
  if (+response.status === 201 && response.headers["content-type"]?.includes("application/geo+json")) {
    return jsonGeoJsonFeatureCollectionToApplicationTransform(response.body)!;
  }
  if (+response.status === 201 && response.headers["content-type"]?.includes("application/vnd.pgrst.plan+text")) {
    return response.body!;
  }
  if (+response.status === 201 && response.headers["content-type"]?.includes("application/vnd.pgrst.plan+json")) {
    return jsonArrayRecordToApplicationTransform(response.body)!;
  }
  if (+response.status === 201 && response.headers["content-type"]?.includes("*/*")) {
    return response.body!;
  }
  throw createRestError(response);
}
;
export interface UpsertCsvOptions extends OperationOptions {
  filters?: Record<string, string>
  or?: string
  and?: string
  notOr?: string
  notAnd?: string
  select?: string
  columns?: string
  accept?: AcceptMediaType
  contentProfile?: string
  prefer?: Array<HandlingPreference | string | TxPreference | ReturnPreference>
  contentType?: "text/csv"
}
export async function upsertCsv(
  client: RelationsClientContext,
  relation: string,
  body: string,
  options?: UpsertCsvOptions,
): Promise<void | Array<Record<string, unknown>> | Record<string, unknown> | string | GeoJsonFeatureCollection | Array<Record<string, unknown>> | Uint8Array> {
  const path = parse("/{relation}{?filters*,or,and,not.or,not.and,select,columns}").expand({
    relation: relation,
    ...(options?.filters && {filters: jsonRecordStringToTransportTransform(options.filters)}),
    ...(options?.or && {or: options.or}),
    ...(options?.and && {and: options.and}),
    ...(options?.notOr && {"not.or": options.notOr}),
    ...(options?.notAnd && {"not.and": options.notAnd}),
    ...(options?.select && {select: options.select}),
    ...(options?.columns && {columns: options.columns})
  });
  const httpRequestOptions = {
    headers: {
      ...(options?.accept && {accept: jsonAcceptMediaTypeToTransportTransform(options.accept)}),
      ...(options?.contentProfile && {"content-profile": options.contentProfile}),
      ...(options?.prefer && {prefer: jsonArrayElementToTransportTransform_3(options.prefer)}),
      "content-type": options?.contentType ?? "text/csv"
    },body: body,
  };
  const response = await client.pathUnchecked(path).put(httpRequestOptions);


  if (typeof options?.operationOptions?.onResponse === "function") {
    options?.operationOptions?.onResponse(response);
  }
  if (+response.status === 204 && !response.body) {
    return;
  }
  if (+response.status === 200 && response.headers["content-type"]?.includes("application/json")) {
    return jsonArrayRowToApplicationTransform(response.body)!;
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
  if (+response.status === 201 && response.headers["content-type"]?.includes("application/json")) {
    return jsonArrayRowToApplicationTransform(response.body)!;
  }
  if (+response.status === 201 && response.headers["content-type"]?.includes("application/vnd.pgrst.array+json")) {
    return jsonArrayRowToApplicationTransform(response.body)!;
  }
  if (+response.status === 201 && response.headers["content-type"]?.includes("application/vnd.pgrst.object+json")) {
    return jsonRecordUnknownToApplicationTransform(response.body)!;
  }
  if (+response.status === 201 && response.headers["content-type"]?.includes("text/csv")) {
    return response.body!;
  }
  if (+response.status === 201 && response.headers["content-type"]?.includes("application/geo+json")) {
    return jsonGeoJsonFeatureCollectionToApplicationTransform(response.body)!;
  }
  if (+response.status === 201 && response.headers["content-type"]?.includes("application/vnd.pgrst.plan+text")) {
    return response.body!;
  }
  if (+response.status === 201 && response.headers["content-type"]?.includes("application/vnd.pgrst.plan+json")) {
    return jsonArrayRecordToApplicationTransform(response.body)!;
  }
  if (+response.status === 201 && response.headers["content-type"]?.includes("*/*")) {
    return response.body!;
  }
  throw createRestError(response);
}
;
export interface UpdateOptions extends OperationOptions {
  filters?: Record<string, string>
  or?: string
  and?: string
  notOr?: string
  notAnd?: string
  select?: string
  columns?: string
  accept?: AcceptMediaType
  contentProfile?: string
  prefer?: Array<HandlingPreference | string | TxPreference | CountPreference | ReturnPreference | MissingPreference | string>
  contentType?: "application/json"
}
/**
 * Sets the payload columns on every row that matches the filters. Without
 * filters every row is updated.
 *
 * @param {RelationsClientContext} client
 * @param {string} relation
 * @param {Record<string, unknown>} body
 * @param {UpdateOptions} [options]
 */
export async function update(
  client: RelationsClientContext,
  relation: string,
  body: Record<string, unknown>,
  options?: UpdateOptions,
): Promise<void | Array<Record<string, unknown>> | Record<string, unknown> | string | GeoJsonFeatureCollection | Array<Record<string, unknown>> | Uint8Array> {
  const path = parse("/{relation}{?filters*,or,and,not.or,not.and,select,columns}").expand({
    relation: relation,
    ...(options?.filters && {filters: jsonRecordStringToTransportTransform(options.filters)}),
    ...(options?.or && {or: options.or}),
    ...(options?.and && {and: options.and}),
    ...(options?.notOr && {"not.or": options.notOr}),
    ...(options?.notAnd && {"not.and": options.notAnd}),
    ...(options?.select && {select: options.select}),
    ...(options?.columns && {columns: options.columns})
  });
  const httpRequestOptions = {
    headers: {
      ...(options?.accept && {accept: jsonAcceptMediaTypeToTransportTransform(options.accept)}),
      ...(options?.contentProfile && {"content-profile": options.contentProfile}),
      ...(options?.prefer && {prefer: jsonArrayElementToTransportTransform_4(options.prefer)}),
      "content-type": options?.contentType ?? "application/json"
    },body: jsonRecordUnknownToTransportTransform(body),
  };
  const response = await client.pathUnchecked(path).patch(httpRequestOptions);


  if (typeof options?.operationOptions?.onResponse === "function") {
    options?.operationOptions?.onResponse(response);
  }
  if (+response.status === 204 && !response.body) {
    return;
  }
  if (+response.status === 200 && response.headers["content-type"]?.includes("application/json")) {
    return jsonArrayRowToApplicationTransform(response.body)!;
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
  throw createRestError(response);
}
;
export interface UpdateFormOptions extends OperationOptions {
  filters?: Record<string, string>
  or?: string
  and?: string
  notOr?: string
  notAnd?: string
  select?: string
  columns?: string
  accept?: AcceptMediaType
  contentProfile?: string
  prefer?: Array<HandlingPreference | string | TxPreference | CountPreference | ReturnPreference | MissingPreference | string>
  contentType?: "application/x-www-form-urlencoded"
}
export async function updateForm(
  client: RelationsClientContext,
  relation: string,
  body: Record<string, string>,
  options?: UpdateFormOptions,
): Promise<void | Array<Record<string, unknown>> | Record<string, unknown> | string | GeoJsonFeatureCollection | Array<Record<string, unknown>> | Uint8Array> {
  const path = parse("/{relation}{?filters*,or,and,not.or,not.and,select,columns}").expand({
    relation: relation,
    ...(options?.filters && {filters: jsonRecordStringToTransportTransform(options.filters)}),
    ...(options?.or && {or: options.or}),
    ...(options?.and && {and: options.and}),
    ...(options?.notOr && {"not.or": options.notOr}),
    ...(options?.notAnd && {"not.and": options.notAnd}),
    ...(options?.select && {select: options.select}),
    ...(options?.columns && {columns: options.columns})
  });
  const httpRequestOptions = {
    headers: {
      ...(options?.accept && {accept: jsonAcceptMediaTypeToTransportTransform(options.accept)}),
      ...(options?.contentProfile && {"content-profile": options.contentProfile}),
      ...(options?.prefer && {prefer: jsonArrayElementToTransportTransform_4(options.prefer)}),
      "content-type": options?.contentType ?? "application/x-www-form-urlencoded"
    },body: jsonRecordStringToTransportTransform(body),
  };
  const response = await client.pathUnchecked(path).patch(httpRequestOptions);


  if (typeof options?.operationOptions?.onResponse === "function") {
    options?.operationOptions?.onResponse(response);
  }
  if (+response.status === 204 && !response.body) {
    return;
  }
  if (+response.status === 200 && response.headers["content-type"]?.includes("application/json")) {
    return jsonArrayRowToApplicationTransform(response.body)!;
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
  throw createRestError(response);
}
;
export interface UpdateCsvOptions extends OperationOptions {
  filters?: Record<string, string>
  or?: string
  and?: string
  notOr?: string
  notAnd?: string
  select?: string
  columns?: string
  accept?: AcceptMediaType
  contentProfile?: string
  prefer?: Array<HandlingPreference | string | TxPreference | CountPreference | ReturnPreference | MissingPreference | string>
  contentType?: "text/csv"
}
export async function updateCsv(
  client: RelationsClientContext,
  relation: string,
  body: string,
  options?: UpdateCsvOptions,
): Promise<void | Array<Record<string, unknown>> | Record<string, unknown> | string | GeoJsonFeatureCollection | Array<Record<string, unknown>> | Uint8Array> {
  const path = parse("/{relation}{?filters*,or,and,not.or,not.and,select,columns}").expand({
    relation: relation,
    ...(options?.filters && {filters: jsonRecordStringToTransportTransform(options.filters)}),
    ...(options?.or && {or: options.or}),
    ...(options?.and && {and: options.and}),
    ...(options?.notOr && {"not.or": options.notOr}),
    ...(options?.notAnd && {"not.and": options.notAnd}),
    ...(options?.select && {select: options.select}),
    ...(options?.columns && {columns: options.columns})
  });
  const httpRequestOptions = {
    headers: {
      ...(options?.accept && {accept: jsonAcceptMediaTypeToTransportTransform(options.accept)}),
      ...(options?.contentProfile && {"content-profile": options.contentProfile}),
      ...(options?.prefer && {prefer: jsonArrayElementToTransportTransform_4(options.prefer)}),
      "content-type": options?.contentType ?? "text/csv"
    },body: body,
  };
  const response = await client.pathUnchecked(path).patch(httpRequestOptions);


  if (typeof options?.operationOptions?.onResponse === "function") {
    options?.operationOptions?.onResponse(response);
  }
  if (+response.status === 204 && !response.body) {
    return;
  }
  if (+response.status === 200 && response.headers["content-type"]?.includes("application/json")) {
    return jsonArrayRowToApplicationTransform(response.body)!;
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
  throw createRestError(response);
}
;
export interface DeleteOptions extends OperationOptions {
  filters?: Record<string, string>
  or?: string
  and?: string
  notOr?: string
  notAnd?: string
  select?: string
  accept?: AcceptMediaType
  contentProfile?: string
  prefer?: Array<HandlingPreference | string | TxPreference | CountPreference | ReturnPreference | string>
}
/**
 * Deletes every row that matches the filters. Without filters every row is
 * deleted.
 *
 * @param {RelationsClientContext} client
 * @param {string} relation
 * @param {DeleteOptions} [options]
 */
export async function delete_(
  client: RelationsClientContext,
  relation: string,
  options?: DeleteOptions,
): Promise<void | Array<Record<string, unknown>> | Record<string, unknown> | string | GeoJsonFeatureCollection | Array<Record<string, unknown>> | Uint8Array> {
  const path = parse("/{relation}{?filters*,or,and,not.or,not.and,select}").expand({
    relation: relation,
    ...(options?.filters && {filters: jsonRecordStringToTransportTransform(options.filters)}),
    ...(options?.or && {or: options.or}),
    ...(options?.and && {and: options.and}),
    ...(options?.notOr && {"not.or": options.notOr}),
    ...(options?.notAnd && {"not.and": options.notAnd}),
    ...(options?.select && {select: options.select})
  });
  const httpRequestOptions = {
    headers: {
      ...(options?.accept && {accept: jsonAcceptMediaTypeToTransportTransform(options.accept)}),
      ...(options?.contentProfile && {"content-profile": options.contentProfile}),
      ...(options?.prefer && {prefer: jsonArrayElementToTransportTransform_5(options.prefer)})
    },
  };
  const response = await client.pathUnchecked(path).delete(httpRequestOptions);


  if (typeof options?.operationOptions?.onResponse === "function") {
    options?.operationOptions?.onResponse(response);
  }
  if (+response.status === 204 && !response.body) {
    return;
  }
  if (+response.status === 200 && response.headers["content-type"]?.includes("application/json")) {
    return jsonArrayRowToApplicationTransform(response.body)!;
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
  throw createRestError(response);
}
;
