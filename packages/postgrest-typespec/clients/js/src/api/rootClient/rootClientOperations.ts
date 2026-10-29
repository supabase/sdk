import { parse } from "uri-template";
import { RootClientContext } from "./rootClientContext.js";
import { createRestError } from "../../helpers/error.js";
import type { OperationOptions } from "../../helpers/interfaces.js";
import {
  jsonAcceptMediaTypeToTransportTransform,
  jsonRecordUnknownToApplicationTransform_3 as jsonRecordUnknownToApplicationTransform,
} from "../../models/internal/serializers.js";
import type { AcceptMediaType } from "../../models/models.js";

export interface DescribeOptions extends OperationOptions {
  accept?: AcceptMediaType
  acceptProfile?: string
}
/**
 * Returns the OpenAPI description of the selected schema.
 *
 * @param {RootClientContext} client
 * @param {DescribeOptions} [options]
 */
export async function describe(
  client: RootClientContext,
  options?: DescribeOptions,
): Promise<Record<string, unknown>> {
  const path = parse("/").expand({});
  const httpRequestOptions = {
    headers: {
      ...(options?.accept && {accept: jsonAcceptMediaTypeToTransportTransform(options.accept)}),
      ...(options?.acceptProfile && {"accept-profile": options.acceptProfile})
    },
  };
  const response = await client.pathUnchecked(path).get(httpRequestOptions);


  if (typeof options?.operationOptions?.onResponse === "function") {
    options?.operationOptions?.onResponse(response);
  }
  if (+response.status === 200 && response.headers["content-type"]?.includes("application/openapi+json")) {
    return jsonRecordUnknownToApplicationTransform(response.body)!;
  }
  throw createRestError(response);
}
;
export interface DescribeHeadOptions extends OperationOptions {
  accept?: AcceptMediaType
  acceptProfile?: string
}
/**
 * Same as `describe`, without a response body.
 *
 * @param {RootClientContext} client
 * @param {DescribeHeadOptions} [options]
 */
export async function describeHead(
  client: RootClientContext,
  options?: DescribeHeadOptions,
): Promise<void> {
  const path = parse("/").expand({});
  const httpRequestOptions = {
    headers: {
      ...(options?.accept && {accept: jsonAcceptMediaTypeToTransportTransform(options.accept)}),
      ...(options?.acceptProfile && {"accept-profile": options.acceptProfile})
    },
  };
  const response = await client.pathUnchecked(path).head(httpRequestOptions);


  if (typeof options?.operationOptions?.onResponse === "function") {
    options?.operationOptions?.onResponse(response);
  }
  if (+response.status === 200 && !response.body) {
    return;
  }
  throw createRestError(response);
}
;
