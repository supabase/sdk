import type {
  AcceptMediaType,
  CountPreference,
  GeoJsonFeatureCollection,
  HandlingPreference,
  MissingPreference,
  ResolutionPreference,
  ReturnPreference,
  TxPreference,
} from "../models.js";

export function decodeBase64(value: string): Uint8Array | undefined {
  if(!value) {
    return value as any;
  }
  // Normalize Base64URL to Base64
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/')
    .padEnd(value.length + (4 - (value.length % 4)) % 4, '=');

  return new Uint8Array(Buffer.from(base64, 'base64'));
}export function encodeUint8Array(
  value: Uint8Array | undefined | null,
  encoding: BufferEncoding,
): string | undefined {
  if (!value) {
    return value as any;
  }
  return Buffer.from(value).toString(encoding);
}export function dateDeserializer(date?: string | null): Date {
  if (!date) {
    return date as any;
  }

  return new Date(date);
}export function dateRfc7231Deserializer(date?: string | null): Date {
  if (!date) {
    return date as any;
  }

  return new Date(date);
}export function dateRfc3339Serializer(date?: Date | null): string {
  if (!date) {
    return date as any
  }

  return date.toISOString();
}export function dateRfc7231Serializer(date?: Date | null): string {
  if (!date) {
    return date as any;
  }

  return date.toUTCString();
}export function dateUnixTimestampSerializer(date?: Date | null): number {
  if (!date) {
    return date as any;
  }

  return Math.floor(date.getTime() / 1000);
}export function dateUnixTimestampDeserializer(date?: number | null): Date {
  if (!date) {
    return date as any;
  }

  return new Date(date * 1000);
}export function invokePayloadToTransport(payload: Record<string, unknown>) {
  return jsonRecordUnknownToTransportTransform_2(payload)!;
}export function invokeFormPayloadToTransport(payload: Record<string, string>) {
  return jsonRecordStringToTransportTransform(payload)!;
}export function invokeBinaryPayloadToTransport(payload: Uint8Array) {
  return payload!;
}export function invokeTextPayloadToTransport(payload: string) {
  return payload!;
}export function invokeXmlPayloadToTransport(payload: string) {
  return payload!;
}export function insertPayloadToTransport(
  payload: Record<string, unknown> | Array<Record<string, unknown>>,
) {
  return payload!;
}export function insertFormPayloadToTransport(payload: Record<string, string>) {
  return jsonRecordStringToTransportTransform(payload)!;
}export function insertCsvPayloadToTransport(payload: string) {
  return payload!;
}export function upsertPayloadToTransport(payload: Record<string, unknown>) {
  return jsonRecordUnknownToTransportTransform(payload)!;
}export function upsertFormPayloadToTransport(payload: Record<string, string>) {
  return jsonRecordStringToTransportTransform(payload)!;
}export function upsertCsvPayloadToTransport(payload: string) {
  return payload!;
}export function updatePayloadToTransport(payload: Record<string, unknown>) {
  return jsonRecordUnknownToTransportTransform(payload)!;
}export function updateFormPayloadToTransport(payload: Record<string, string>) {
  return jsonRecordStringToTransportTransform(payload)!;
}export function updateCsvPayloadToTransport(payload: string) {
  return payload!;
}export function jsonRecordStringToTransportTransform(
  items_?: Record<string, any> | null,
): any {
  if(!items_) {
    return items_ as any;
  }

  const _transformedRecord: any = {};

  for (const [key, value] of Object.entries(items_ ?? {})) {
    const transformedItem = value as any;
    _transformedRecord[key] = transformedItem;
  }

  return _transformedRecord;
}export function jsonRecordStringToApplicationTransform(
  items_?: any,
): Record<string, any> {
  if(!items_) {
    return items_ as any;
  }

  const _transformedRecord: any = {};

  for (const [key, value] of Object.entries(items_ ?? {})) {
    const transformedItem = value as any;
    _transformedRecord[key] = transformedItem;
  }

  return _transformedRecord;
}export function jsonAcceptMediaTypeToTransportTransform(
  input_?: AcceptMediaType | null,
): any {
  if(!input_) {
    return input_ as any;
  }return input_
}export function jsonAcceptMediaTypeToApplicationTransform(
  input_?: any,
): AcceptMediaType {
  if(!input_) {
    return input_ as any;
  }return input_
}export function jsonArrayElementToTransportTransform(
  items_?: Array<HandlingPreference | string | TxPreference | CountPreference> | null,
): any {
  if(!items_) {
    return items_ as any;
  }
  const _transformedArray = [];

  for (const item of items_ ?? []) {
    const transformedItem = jsonHandlingPreferenceToTransportTransform(item as any);
    _transformedArray.push(transformedItem);
  }

  return _transformedArray as any;
}export function jsonArrayElementToApplicationTransform(
  items_?: any,
): Array<HandlingPreference | string | TxPreference | CountPreference> {
  if(!items_) {
    return items_ as any;
  }
  const _transformedArray = [];

  for (const item of items_ ?? []) {
    const transformedItem = jsonHandlingPreferenceToApplicationTransform(item as any);
    _transformedArray.push(transformedItem);
  }

  return _transformedArray as any;
}export function jsonHandlingPreferenceToTransportTransform(
  input_?: HandlingPreference | null,
): any {
  if(!input_) {
    return input_ as any;
  }return input_
}export function jsonHandlingPreferenceToApplicationTransform(
  input_?: any,
): HandlingPreference {
  if(!input_) {
    return input_ as any;
  }return input_
}export function jsonTxPreferenceToTransportTransform(
  input_?: TxPreference | null,
): any {
  if(!input_) {
    return input_ as any;
  }return input_
}export function jsonTxPreferenceToApplicationTransform(
  input_?: any,
): TxPreference {
  if(!input_) {
    return input_ as any;
  }return input_
}export function jsonCountPreferenceToTransportTransform(
  input_?: CountPreference | null,
): any {
  if(!input_) {
    return input_ as any;
  }return input_
}export function jsonCountPreferenceToApplicationTransform(
  input_?: any,
): CountPreference {
  if(!input_) {
    return input_ as any;
  }return input_
}export function jsonArrayRowToTransportTransform(
  items_?: Array<Record<string, unknown>> | null,
): any {
  if(!items_) {
    return items_ as any;
  }
  const _transformedArray = [];

  for (const item of items_ ?? []) {
    const transformedItem = jsonRecordUnknownToTransportTransform(item as any);
    _transformedArray.push(transformedItem);
  }

  return _transformedArray as any;
}export function jsonArrayRowToApplicationTransform(
  items_?: any,
): Array<Record<string, unknown>> {
  if(!items_) {
    return items_ as any;
  }
  const _transformedArray = [];

  for (const item of items_ ?? []) {
    const transformedItem = jsonRecordUnknownToApplicationTransform(item as any);
    _transformedArray.push(transformedItem);
  }

  return _transformedArray as any;
}export function jsonRecordUnknownToTransportTransform(
  items_?: Record<string, any> | null,
): any {
  if(!items_) {
    return items_ as any;
  }

  const _transformedRecord: any = {};

  for (const [key, value] of Object.entries(items_ ?? {})) {
    const transformedItem = value as any;
    _transformedRecord[key] = transformedItem;
  }

  return _transformedRecord;
}export function jsonRecordUnknownToApplicationTransform(
  items_?: any,
): Record<string, any> {
  if(!items_) {
    return items_ as any;
  }

  const _transformedRecord: any = {};

  for (const [key, value] of Object.entries(items_ ?? {})) {
    const transformedItem = value as any;
    _transformedRecord[key] = transformedItem;
  }

  return _transformedRecord;
}export function jsonGeoJsonFeatureCollectionToTransportTransform(
  input_?: GeoJsonFeatureCollection | null,
): any {
  if(!input_) {
    return input_ as any;
  }
    return {
    type: input_.type,features: jsonArrayRecordToTransportTransform(input_.features)
  }!;
}export function jsonGeoJsonFeatureCollectionToApplicationTransform(
  input_?: any,
): GeoJsonFeatureCollection {
  if(!input_) {
    return input_ as any;
  }
    return {
    type: input_.type,features: jsonArrayRecordToApplicationTransform(input_.features)
  }!;
}export function jsonArrayRecordToTransportTransform(
  items_?: Array<Record<string, unknown>> | null,
): any {
  if(!items_) {
    return items_ as any;
  }
  const _transformedArray = [];

  for (const item of items_ ?? []) {
    const transformedItem = jsonRecordUnknownToTransportTransform_2(item as any);
    _transformedArray.push(transformedItem);
  }

  return _transformedArray as any;
}export function jsonArrayRecordToApplicationTransform(
  items_?: any,
): Array<Record<string, unknown>> {
  if(!items_) {
    return items_ as any;
  }
  const _transformedArray = [];

  for (const item of items_ ?? []) {
    const transformedItem = jsonRecordUnknownToApplicationTransform_2(item as any);
    _transformedArray.push(transformedItem);
  }

  return _transformedArray as any;
}export function jsonRecordUnknownToTransportTransform_2(
  items_?: Record<string, any> | null,
): any {
  if(!items_) {
    return items_ as any;
  }

  const _transformedRecord: any = {};

  for (const [key, value] of Object.entries(items_ ?? {})) {
    const transformedItem = value as any;
    _transformedRecord[key] = transformedItem;
  }

  return _transformedRecord;
}export function jsonRecordUnknownToApplicationTransform_2(
  items_?: any,
): Record<string, any> {
  if(!items_) {
    return items_ as any;
  }

  const _transformedRecord: any = {};

  for (const [key, value] of Object.entries(items_ ?? {})) {
    const transformedItem = value as any;
    _transformedRecord[key] = transformedItem;
  }

  return _transformedRecord;
}export function jsonArrayElementToTransportTransform_2(
  items_?: Array<HandlingPreference | string | TxPreference | CountPreference | ReturnPreference | ResolutionPreference | MissingPreference> | null,
): any {
  if(!items_) {
    return items_ as any;
  }
  const _transformedArray = [];

  for (const item of items_ ?? []) {
    const transformedItem = jsonHandlingPreferenceToTransportTransform(item as any);
    _transformedArray.push(transformedItem);
  }

  return _transformedArray as any;
}export function jsonArrayElementToApplicationTransform_2(
  items_?: any,
): Array<HandlingPreference | string | TxPreference | CountPreference | ReturnPreference | ResolutionPreference | MissingPreference> {
  if(!items_) {
    return items_ as any;
  }
  const _transformedArray = [];

  for (const item of items_ ?? []) {
    const transformedItem = jsonHandlingPreferenceToApplicationTransform(item as any);
    _transformedArray.push(transformedItem);
  }

  return _transformedArray as any;
}export function jsonReturnPreferenceToTransportTransform(
  input_?: ReturnPreference | null,
): any {
  if(!input_) {
    return input_ as any;
  }return input_
}export function jsonReturnPreferenceToApplicationTransform(
  input_?: any,
): ReturnPreference {
  if(!input_) {
    return input_ as any;
  }return input_
}export function jsonResolutionPreferenceToTransportTransform(
  input_?: ResolutionPreference | null,
): any {
  if(!input_) {
    return input_ as any;
  }return input_
}export function jsonResolutionPreferenceToApplicationTransform(
  input_?: any,
): ResolutionPreference {
  if(!input_) {
    return input_ as any;
  }return input_
}export function jsonMissingPreferenceToTransportTransform(
  input_?: MissingPreference | null,
): any {
  if(!input_) {
    return input_ as any;
  }return input_
}export function jsonMissingPreferenceToApplicationTransform(
  input_?: any,
): MissingPreference {
  if(!input_) {
    return input_ as any;
  }return input_
}export function jsonArrayElementToTransportTransform_3(
  items_?: Array<HandlingPreference | string | TxPreference | ReturnPreference> | null,
): any {
  if(!items_) {
    return items_ as any;
  }
  const _transformedArray = [];

  for (const item of items_ ?? []) {
    const transformedItem = jsonHandlingPreferenceToTransportTransform(item as any);
    _transformedArray.push(transformedItem);
  }

  return _transformedArray as any;
}export function jsonArrayElementToApplicationTransform_3(
  items_?: any,
): Array<HandlingPreference | string | TxPreference | ReturnPreference> {
  if(!items_) {
    return items_ as any;
  }
  const _transformedArray = [];

  for (const item of items_ ?? []) {
    const transformedItem = jsonHandlingPreferenceToApplicationTransform(item as any);
    _transformedArray.push(transformedItem);
  }

  return _transformedArray as any;
}export function jsonArrayElementToTransportTransform_4(
  items_?: Array<HandlingPreference | string | TxPreference | CountPreference | ReturnPreference | MissingPreference | string> | null,
): any {
  if(!items_) {
    return items_ as any;
  }
  const _transformedArray = [];

  for (const item of items_ ?? []) {
    const transformedItem = item as any;
    _transformedArray.push(transformedItem);
  }

  return _transformedArray as any;
}export function jsonArrayElementToApplicationTransform_4(
  items_?: any,
): Array<HandlingPreference | string | TxPreference | CountPreference | ReturnPreference | MissingPreference | string> {
  if(!items_) {
    return items_ as any;
  }
  const _transformedArray = [];

  for (const item of items_ ?? []) {
    const transformedItem = item as any;
    _transformedArray.push(transformedItem);
  }

  return _transformedArray as any;
}export function jsonArrayElementToTransportTransform_5(
  items_?: Array<HandlingPreference | string | TxPreference | CountPreference | ReturnPreference | string> | null,
): any {
  if(!items_) {
    return items_ as any;
  }
  const _transformedArray = [];

  for (const item of items_ ?? []) {
    const transformedItem = item as any;
    _transformedArray.push(transformedItem);
  }

  return _transformedArray as any;
}export function jsonArrayElementToApplicationTransform_5(
  items_?: any,
): Array<HandlingPreference | string | TxPreference | CountPreference | ReturnPreference | string> {
  if(!items_) {
    return items_ as any;
  }
  const _transformedArray = [];

  for (const item of items_ ?? []) {
    const transformedItem = item as any;
    _transformedArray.push(transformedItem);
  }

  return _transformedArray as any;
}export function jsonArrayElementToTransportTransform_6(
  items_?: Array<HandlingPreference | string | TxPreference | CountPreference | string> | null,
): any {
  if(!items_) {
    return items_ as any;
  }
  const _transformedArray = [];

  for (const item of items_ ?? []) {
    const transformedItem = item as any;
    _transformedArray.push(transformedItem);
  }

  return _transformedArray as any;
}export function jsonArrayElementToApplicationTransform_6(
  items_?: any,
): Array<HandlingPreference | string | TxPreference | CountPreference | string> {
  if(!items_) {
    return items_ as any;
  }
  const _transformedArray = [];

  for (const item of items_ ?? []) {
    const transformedItem = item as any;
    _transformedArray.push(transformedItem);
  }

  return _transformedArray as any;
}export function jsonRecordUnknownToTransportTransform_3(
  items_?: Record<string, any> | null,
): any {
  if(!items_) {
    return items_ as any;
  }

  const _transformedRecord: any = {};

  for (const [key, value] of Object.entries(items_ ?? {})) {
    const transformedItem = value as any;
    _transformedRecord[key] = transformedItem;
  }

  return _transformedRecord;
}export function jsonRecordUnknownToApplicationTransform_3(
  items_?: any,
): Record<string, any> {
  if(!items_) {
    return items_ as any;
  }

  const _transformedRecord: any = {};

  for (const [key, value] of Object.entries(items_ ?? {})) {
    const transformedItem = value as any;
    _transformedRecord[key] = transformedItem;
  }

  return _transformedRecord;
}
