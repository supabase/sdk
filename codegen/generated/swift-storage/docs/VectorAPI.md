# VectorAPI

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**postVectorCreateIndex**](VectorAPI.md#postvectorcreateindex) | **POST** /vector/CreateIndex | Create a vector index
[**postVectorCreateVectorBucket**](VectorAPI.md#postvectorcreatevectorbucket) | **POST** /vector/CreateVectorBucket | Create a vector bucket
[**postVectorDeleteIndex**](VectorAPI.md#postvectordeleteindex) | **POST** /vector/DeleteIndex | Delete a vector index
[**postVectorDeleteVectorBucket**](VectorAPI.md#postvectordeletevectorbucket) | **POST** /vector/DeleteVectorBucket | Create a vector bucket
[**postVectorDeleteVectors**](VectorAPI.md#postvectordeletevectors) | **POST** /vector/DeleteVectors | Delete vectors from an index
[**postVectorGetIndex**](VectorAPI.md#postvectorgetindex) | **POST** /vector/GetIndex | Get a vector index
[**postVectorGetVectorBucket**](VectorAPI.md#postvectorgetvectorbucket) | **POST** /vector/GetVectorBucket | Create a vector bucket
[**postVectorGetVectors**](VectorAPI.md#postvectorgetvectors) | **POST** /vector/GetVectors | Returns vector attributes
[**postVectorListIndexes**](VectorAPI.md#postvectorlistindexes) | **POST** /vector/ListIndexes | List indexes in a vector bucket
[**postVectorListVectorBuckets**](VectorAPI.md#postvectorlistvectorbuckets) | **POST** /vector/ListVectorBuckets | List vector buckets
[**postVectorListVectors**](VectorAPI.md#postvectorlistvectors) | **POST** /vector/ListVectors | List vectors in a vector index
[**postVectorPutVectors**](VectorAPI.md#postvectorputvectors) | **POST** /vector/PutVectors | Put vectors into an index
[**postVectorQueryVectors**](VectorAPI.md#postvectorqueryvectors) | **POST** /vector/QueryVectors | Query vectors


# **postVectorCreateIndex**
```swift
    internal class func postVectorCreateIndex(postVectorCreateIndexRequest: PostVectorCreateIndexRequest, completion: @escaping (_ data: Void?, _ error: Error?) -> Void)
```

Create a vector index

### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import SupabaseStorage

let postVectorCreateIndexRequest = postVectorCreateIndex_request(dataType: "dataType_example", dimension: 123, distanceMetric: "distanceMetric_example", indexName: "indexName_example", metadataConfiguration: postVectorCreateIndex_request_metadataConfiguration(nonFilterableMetadataKeys: ["nonFilterableMetadataKeys_example"]), vectorBucketName: "vectorBucketName_example") // PostVectorCreateIndexRequest | 

// Create a vector index
VectorAPI.postVectorCreateIndex(postVectorCreateIndexRequest: postVectorCreateIndexRequest) { (response, error) in
    guard error == nil else {
        print(error)
        return
    }

    if (response) {
        dump(response)
    }
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **postVectorCreateIndexRequest** | [**PostVectorCreateIndexRequest**](PostVectorCreateIndexRequest.md) |  | 

### Return type

Void (empty response body)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: Not defined

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **postVectorCreateVectorBucket**
```swift
    internal class func postVectorCreateVectorBucket(postVectorCreateVectorBucketRequest: PostVectorCreateVectorBucketRequest, completion: @escaping (_ data: Void?, _ error: Error?) -> Void)
```

Create a vector bucket

### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import SupabaseStorage

let postVectorCreateVectorBucketRequest = postVectorCreateVectorBucket_request(vectorBucketName: "vectorBucketName_example") // PostVectorCreateVectorBucketRequest | 

// Create a vector bucket
VectorAPI.postVectorCreateVectorBucket(postVectorCreateVectorBucketRequest: postVectorCreateVectorBucketRequest) { (response, error) in
    guard error == nil else {
        print(error)
        return
    }

    if (response) {
        dump(response)
    }
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **postVectorCreateVectorBucketRequest** | [**PostVectorCreateVectorBucketRequest**](PostVectorCreateVectorBucketRequest.md) |  | 

### Return type

Void (empty response body)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: Not defined

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **postVectorDeleteIndex**
```swift
    internal class func postVectorDeleteIndex(postVectorDeleteIndexRequest: PostVectorDeleteIndexRequest, completion: @escaping (_ data: Void?, _ error: Error?) -> Void)
```

Delete a vector index

### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import SupabaseStorage

let postVectorDeleteIndexRequest = postVectorDeleteIndex_request(indexName: "indexName_example", vectorBucketName: "vectorBucketName_example") // PostVectorDeleteIndexRequest | 

// Delete a vector index
VectorAPI.postVectorDeleteIndex(postVectorDeleteIndexRequest: postVectorDeleteIndexRequest) { (response, error) in
    guard error == nil else {
        print(error)
        return
    }

    if (response) {
        dump(response)
    }
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **postVectorDeleteIndexRequest** | [**PostVectorDeleteIndexRequest**](PostVectorDeleteIndexRequest.md) |  | 

### Return type

Void (empty response body)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: Not defined

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **postVectorDeleteVectorBucket**
```swift
    internal class func postVectorDeleteVectorBucket(postVectorCreateVectorBucketRequest: PostVectorCreateVectorBucketRequest, completion: @escaping (_ data: Void?, _ error: Error?) -> Void)
```

Create a vector bucket

### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import SupabaseStorage

let postVectorCreateVectorBucketRequest = postVectorCreateVectorBucket_request(vectorBucketName: "vectorBucketName_example") // PostVectorCreateVectorBucketRequest | 

// Create a vector bucket
VectorAPI.postVectorDeleteVectorBucket(postVectorCreateVectorBucketRequest: postVectorCreateVectorBucketRequest) { (response, error) in
    guard error == nil else {
        print(error)
        return
    }

    if (response) {
        dump(response)
    }
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **postVectorCreateVectorBucketRequest** | [**PostVectorCreateVectorBucketRequest**](PostVectorCreateVectorBucketRequest.md) |  | 

### Return type

Void (empty response body)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: Not defined

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **postVectorDeleteVectors**
```swift
    internal class func postVectorDeleteVectors(postVectorDeleteVectorsRequest: PostVectorDeleteVectorsRequest, completion: @escaping (_ data: Void?, _ error: Error?) -> Void)
```

Delete vectors from an index

### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import SupabaseStorage

let postVectorDeleteVectorsRequest = postVectorDeleteVectors_request(vectorBucketName: "vectorBucketName_example", indexName: "indexName_example", keys: ["keys_example"]) // PostVectorDeleteVectorsRequest | 

// Delete vectors from an index
VectorAPI.postVectorDeleteVectors(postVectorDeleteVectorsRequest: postVectorDeleteVectorsRequest) { (response, error) in
    guard error == nil else {
        print(error)
        return
    }

    if (response) {
        dump(response)
    }
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **postVectorDeleteVectorsRequest** | [**PostVectorDeleteVectorsRequest**](PostVectorDeleteVectorsRequest.md) |  | 

### Return type

Void (empty response body)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: Not defined

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **postVectorGetIndex**
```swift
    internal class func postVectorGetIndex(postVectorGetIndexRequest: PostVectorGetIndexRequest, completion: @escaping (_ data: Void?, _ error: Error?) -> Void)
```

Get a vector index

### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import SupabaseStorage

let postVectorGetIndexRequest = postVectorGetIndex_request(vectorBucketName: "vectorBucketName_example", indexName: "indexName_example") // PostVectorGetIndexRequest | 

// Get a vector index
VectorAPI.postVectorGetIndex(postVectorGetIndexRequest: postVectorGetIndexRequest) { (response, error) in
    guard error == nil else {
        print(error)
        return
    }

    if (response) {
        dump(response)
    }
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **postVectorGetIndexRequest** | [**PostVectorGetIndexRequest**](PostVectorGetIndexRequest.md) |  | 

### Return type

Void (empty response body)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: Not defined

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **postVectorGetVectorBucket**
```swift
    internal class func postVectorGetVectorBucket(postVectorCreateVectorBucketRequest: PostVectorCreateVectorBucketRequest, completion: @escaping (_ data: Void?, _ error: Error?) -> Void)
```

Create a vector bucket

### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import SupabaseStorage

let postVectorCreateVectorBucketRequest = postVectorCreateVectorBucket_request(vectorBucketName: "vectorBucketName_example") // PostVectorCreateVectorBucketRequest | 

// Create a vector bucket
VectorAPI.postVectorGetVectorBucket(postVectorCreateVectorBucketRequest: postVectorCreateVectorBucketRequest) { (response, error) in
    guard error == nil else {
        print(error)
        return
    }

    if (response) {
        dump(response)
    }
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **postVectorCreateVectorBucketRequest** | [**PostVectorCreateVectorBucketRequest**](PostVectorCreateVectorBucketRequest.md) |  | 

### Return type

Void (empty response body)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: Not defined

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **postVectorGetVectors**
```swift
    internal class func postVectorGetVectors(postVectorGetVectorsRequest: PostVectorGetVectorsRequest, completion: @escaping (_ data: Void?, _ error: Error?) -> Void)
```

Returns vector attributes

### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import SupabaseStorage

let postVectorGetVectorsRequest = postVectorGetVectors_request(indexName: "indexName_example", keys: ["keys_example"], returnData: false, returnMetadata: false, vectorBucketName: "vectorBucketName_example") // PostVectorGetVectorsRequest | 

// Returns vector attributes
VectorAPI.postVectorGetVectors(postVectorGetVectorsRequest: postVectorGetVectorsRequest) { (response, error) in
    guard error == nil else {
        print(error)
        return
    }

    if (response) {
        dump(response)
    }
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **postVectorGetVectorsRequest** | [**PostVectorGetVectorsRequest**](PostVectorGetVectorsRequest.md) |  | 

### Return type

Void (empty response body)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: Not defined

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **postVectorListIndexes**
```swift
    internal class func postVectorListIndexes(postVectorListIndexesRequest: PostVectorListIndexesRequest, completion: @escaping (_ data: Void?, _ error: Error?) -> Void)
```

List indexes in a vector bucket

### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import SupabaseStorage

let postVectorListIndexesRequest = postVectorListIndexes_request(vectorBucketName: "vectorBucketName_example", maxResults: 123, nextToken: "nextToken_example", _prefix: "_prefix_example") // PostVectorListIndexesRequest | 

// List indexes in a vector bucket
VectorAPI.postVectorListIndexes(postVectorListIndexesRequest: postVectorListIndexesRequest) { (response, error) in
    guard error == nil else {
        print(error)
        return
    }

    if (response) {
        dump(response)
    }
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **postVectorListIndexesRequest** | [**PostVectorListIndexesRequest**](PostVectorListIndexesRequest.md) |  | 

### Return type

Void (empty response body)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: Not defined

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **postVectorListVectorBuckets**
```swift
    internal class func postVectorListVectorBuckets(postVectorListVectorBucketsRequest: PostVectorListVectorBucketsRequest, completion: @escaping (_ data: Void?, _ error: Error?) -> Void)
```

List vector buckets

### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import SupabaseStorage

let postVectorListVectorBucketsRequest = postVectorListVectorBuckets_request(maxResults: 123, nextToken: "nextToken_example", _prefix: "_prefix_example") // PostVectorListVectorBucketsRequest | 

// List vector buckets
VectorAPI.postVectorListVectorBuckets(postVectorListVectorBucketsRequest: postVectorListVectorBucketsRequest) { (response, error) in
    guard error == nil else {
        print(error)
        return
    }

    if (response) {
        dump(response)
    }
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **postVectorListVectorBucketsRequest** | [**PostVectorListVectorBucketsRequest**](PostVectorListVectorBucketsRequest.md) |  | 

### Return type

Void (empty response body)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: Not defined

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **postVectorListVectors**
```swift
    internal class func postVectorListVectors(postVectorListVectorsRequest: PostVectorListVectorsRequest, completion: @escaping (_ data: Void?, _ error: Error?) -> Void)
```

List vectors in a vector index

### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import SupabaseStorage

let postVectorListVectorsRequest = postVectorListVectors_request(vectorBucketName: "vectorBucketName_example", indexArn: "indexArn_example", indexName: "indexName_example", maxResults: 123, nextToken: "nextToken_example", returnData: false, returnMetadata: false, segmentCount: 123, segmentIndex: 123) // PostVectorListVectorsRequest | 

// List vectors in a vector index
VectorAPI.postVectorListVectors(postVectorListVectorsRequest: postVectorListVectorsRequest) { (response, error) in
    guard error == nil else {
        print(error)
        return
    }

    if (response) {
        dump(response)
    }
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **postVectorListVectorsRequest** | [**PostVectorListVectorsRequest**](PostVectorListVectorsRequest.md) |  | 

### Return type

Void (empty response body)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: Not defined

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **postVectorPutVectors**
```swift
    internal class func postVectorPutVectors(postVectorPutVectorsRequest: PostVectorPutVectorsRequest, completion: @escaping (_ data: Void?, _ error: Error?) -> Void)
```

Put vectors into an index

### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import SupabaseStorage

let postVectorPutVectorsRequest = postVectorPutVectors_request(vectorBucketName: "vectorBucketName_example", indexName: "indexName_example", vectors: [postVectorPutVectors_request_vectors_inner(data: postVectorPutVectors_request_vectors_inner_data(float32: [123]), metadata: "TODO", key: "key_example")]) // PostVectorPutVectorsRequest | 

// Put vectors into an index
VectorAPI.postVectorPutVectors(postVectorPutVectorsRequest: postVectorPutVectorsRequest) { (response, error) in
    guard error == nil else {
        print(error)
        return
    }

    if (response) {
        dump(response)
    }
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **postVectorPutVectorsRequest** | [**PostVectorPutVectorsRequest**](PostVectorPutVectorsRequest.md) |  | 

### Return type

Void (empty response body)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: Not defined

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **postVectorQueryVectors**
```swift
    internal class func postVectorQueryVectors(body: JSONValue, completion: @escaping (_ data: Void?, _ error: Error?) -> Void)
```

Query vectors

### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import SupabaseStorage

let body = "TODO" // JSONValue | 

// Query vectors
VectorAPI.postVectorQueryVectors(body: body) { (response, error) in
    guard error == nil else {
        print(error)
        return
    }

    if (response) {
        dump(response)
    }
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **body** | **JSONValue** |  | 

### Return type

Void (empty response body)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: Not defined

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

