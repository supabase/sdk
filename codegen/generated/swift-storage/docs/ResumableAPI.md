# ResumableAPI

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**deleteUploadResumableByObjectPath**](ResumableAPI.md#deleteuploadresumablebyobjectpath) | **DELETE** /upload/resumable/{objectPath} | Handle DELETE request for TUS Resumable uploads
[**deleteUploadResumableSignByObjectPath**](ResumableAPI.md#deleteuploadresumablesignbyobjectpath) | **DELETE** /upload/resumable/sign/{objectPath} | Handle DELETE request for TUS Resumable uploads
[**headUploadResumableByObjectPath**](ResumableAPI.md#headuploadresumablebyobjectpath) | **HEAD** /upload/resumable/{objectPath} | Handle HEAD request for TUS Resumable uploads
[**headUploadResumableSignByObjectPath**](ResumableAPI.md#headuploadresumablesignbyobjectpath) | **HEAD** /upload/resumable/sign/{objectPath} | Handle HEAD request for TUS Resumable uploads
[**optionsUploadResumable**](ResumableAPI.md#optionsuploadresumable) | **OPTIONS** /upload/resumable/ | Handle OPTIONS request for TUS Resumable uploads
[**optionsUploadResumableByObjectPath**](ResumableAPI.md#optionsuploadresumablebyobjectpath) | **OPTIONS** /upload/resumable/{objectPath} | Handle OPTIONS request for TUS Resumable uploads
[**optionsUploadResumableSign**](ResumableAPI.md#optionsuploadresumablesign) | **OPTIONS** /upload/resumable/sign/ | Handle OPTIONS request for TUS Resumable uploads
[**optionsUploadResumableSignByObjectPath**](ResumableAPI.md#optionsuploadresumablesignbyobjectpath) | **OPTIONS** /upload/resumable/sign/{objectPath} | Handle OPTIONS request for TUS Resumable uploads
[**patchUploadResumableByObjectPath**](ResumableAPI.md#patchuploadresumablebyobjectpath) | **PATCH** /upload/resumable/{objectPath} | Handle PATCH request for TUS Resumable uploads
[**patchUploadResumableSignByObjectPath**](ResumableAPI.md#patchuploadresumablesignbyobjectpath) | **PATCH** /upload/resumable/sign/{objectPath} | Handle PATCH request for TUS Resumable uploads
[**postUploadResumable**](ResumableAPI.md#postuploadresumable) | **POST** /upload/resumable/ | Handle POST request for TUS Resumable uploads
[**postUploadResumableByObjectPath**](ResumableAPI.md#postuploadresumablebyobjectpath) | **POST** /upload/resumable/{objectPath} | Handle POST request for TUS Resumable uploads
[**postUploadResumableSign**](ResumableAPI.md#postuploadresumablesign) | **POST** /upload/resumable/sign/ | Handle POST request for TUS Resumable uploads
[**postUploadResumableSignByObjectPath**](ResumableAPI.md#postuploadresumablesignbyobjectpath) | **POST** /upload/resumable/sign/{objectPath} | Handle POST request for TUS Resumable uploads
[**putUploadResumableByObjectPath**](ResumableAPI.md#putuploadresumablebyobjectpath) | **PUT** /upload/resumable/{objectPath} | Handle PUT request for TUS Resumable uploads
[**putUploadResumableSignByObjectPath**](ResumableAPI.md#putuploadresumablesignbyobjectpath) | **PUT** /upload/resumable/sign/{objectPath} | Handle PUT request for TUS Resumable uploads


# **deleteUploadResumableByObjectPath**
```swift
    internal class func deleteUploadResumableByObjectPath(objectPath: String, completion: @escaping (_ data: Void?, _ error: Error?) -> Void)
```

Handle DELETE request for TUS Resumable uploads

### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import SupabaseStorage

let objectPath = "objectPath_example" // String | 

// Handle DELETE request for TUS Resumable uploads
ResumableAPI.deleteUploadResumableByObjectPath(objectPath: objectPath) { (response, error) in
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
 **objectPath** | **String** |  | 

### Return type

Void (empty response body)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: Not defined

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **deleteUploadResumableSignByObjectPath**
```swift
    internal class func deleteUploadResumableSignByObjectPath(objectPath: String, completion: @escaping (_ data: Void?, _ error: Error?) -> Void)
```

Handle DELETE request for TUS Resumable uploads

### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import SupabaseStorage

let objectPath = "objectPath_example" // String | 

// Handle DELETE request for TUS Resumable uploads
ResumableAPI.deleteUploadResumableSignByObjectPath(objectPath: objectPath) { (response, error) in
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
 **objectPath** | **String** |  | 

### Return type

Void (empty response body)

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: Not defined

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **headUploadResumableByObjectPath**
```swift
    internal class func headUploadResumableByObjectPath(objectPath: String, completion: @escaping (_ data: Void?, _ error: Error?) -> Void)
```

Handle HEAD request for TUS Resumable uploads

### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import SupabaseStorage

let objectPath = "objectPath_example" // String | 

// Handle HEAD request for TUS Resumable uploads
ResumableAPI.headUploadResumableByObjectPath(objectPath: objectPath) { (response, error) in
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
 **objectPath** | **String** |  | 

### Return type

Void (empty response body)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: Not defined

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **headUploadResumableSignByObjectPath**
```swift
    internal class func headUploadResumableSignByObjectPath(objectPath: String, completion: @escaping (_ data: Void?, _ error: Error?) -> Void)
```

Handle HEAD request for TUS Resumable uploads

### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import SupabaseStorage

let objectPath = "objectPath_example" // String | 

// Handle HEAD request for TUS Resumable uploads
ResumableAPI.headUploadResumableSignByObjectPath(objectPath: objectPath) { (response, error) in
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
 **objectPath** | **String** |  | 

### Return type

Void (empty response body)

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: Not defined

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **optionsUploadResumable**
```swift
    internal class func optionsUploadResumable(completion: @escaping (_ data: Void?, _ error: Error?) -> Void)
```

Handle OPTIONS request for TUS Resumable uploads

Handle OPTIONS request for TUS Resumable uploads

### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import SupabaseStorage


// Handle OPTIONS request for TUS Resumable uploads
ResumableAPI.optionsUploadResumable() { (response, error) in
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
This endpoint does not need any parameter.

### Return type

Void (empty response body)

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: Not defined

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **optionsUploadResumableByObjectPath**
```swift
    internal class func optionsUploadResumableByObjectPath(objectPath: String, completion: @escaping (_ data: Void?, _ error: Error?) -> Void)
```

Handle OPTIONS request for TUS Resumable uploads

Handle OPTIONS request for TUS Resumable uploads

### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import SupabaseStorage

let objectPath = "objectPath_example" // String | 

// Handle OPTIONS request for TUS Resumable uploads
ResumableAPI.optionsUploadResumableByObjectPath(objectPath: objectPath) { (response, error) in
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
 **objectPath** | **String** |  | 

### Return type

Void (empty response body)

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: Not defined

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **optionsUploadResumableSign**
```swift
    internal class func optionsUploadResumableSign(completion: @escaping (_ data: Void?, _ error: Error?) -> Void)
```

Handle OPTIONS request for TUS Resumable uploads

Handle OPTIONS request for TUS Resumable uploads

### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import SupabaseStorage


// Handle OPTIONS request for TUS Resumable uploads
ResumableAPI.optionsUploadResumableSign() { (response, error) in
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
This endpoint does not need any parameter.

### Return type

Void (empty response body)

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: Not defined

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **optionsUploadResumableSignByObjectPath**
```swift
    internal class func optionsUploadResumableSignByObjectPath(objectPath: String, completion: @escaping (_ data: Void?, _ error: Error?) -> Void)
```

Handle OPTIONS request for TUS Resumable uploads

Handle OPTIONS request for TUS Resumable uploads

### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import SupabaseStorage

let objectPath = "objectPath_example" // String | 

// Handle OPTIONS request for TUS Resumable uploads
ResumableAPI.optionsUploadResumableSignByObjectPath(objectPath: objectPath) { (response, error) in
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
 **objectPath** | **String** |  | 

### Return type

Void (empty response body)

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: Not defined

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **patchUploadResumableByObjectPath**
```swift
    internal class func patchUploadResumableByObjectPath(objectPath: String, completion: @escaping (_ data: Void?, _ error: Error?) -> Void)
```

Handle PATCH request for TUS Resumable uploads

### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import SupabaseStorage

let objectPath = "objectPath_example" // String | 

// Handle PATCH request for TUS Resumable uploads
ResumableAPI.patchUploadResumableByObjectPath(objectPath: objectPath) { (response, error) in
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
 **objectPath** | **String** |  | 

### Return type

Void (empty response body)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: Not defined

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **patchUploadResumableSignByObjectPath**
```swift
    internal class func patchUploadResumableSignByObjectPath(objectPath: String, completion: @escaping (_ data: Void?, _ error: Error?) -> Void)
```

Handle PATCH request for TUS Resumable uploads

### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import SupabaseStorage

let objectPath = "objectPath_example" // String | 

// Handle PATCH request for TUS Resumable uploads
ResumableAPI.patchUploadResumableSignByObjectPath(objectPath: objectPath) { (response, error) in
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
 **objectPath** | **String** |  | 

### Return type

Void (empty response body)

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: Not defined

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **postUploadResumable**
```swift
    internal class func postUploadResumable(completion: @escaping (_ data: Void?, _ error: Error?) -> Void)
```

Handle POST request for TUS Resumable uploads

### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import SupabaseStorage


// Handle POST request for TUS Resumable uploads
ResumableAPI.postUploadResumable() { (response, error) in
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
This endpoint does not need any parameter.

### Return type

Void (empty response body)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: Not defined

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **postUploadResumableByObjectPath**
```swift
    internal class func postUploadResumableByObjectPath(objectPath: String, completion: @escaping (_ data: Void?, _ error: Error?) -> Void)
```

Handle POST request for TUS Resumable uploads

### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import SupabaseStorage

let objectPath = "objectPath_example" // String | 

// Handle POST request for TUS Resumable uploads
ResumableAPI.postUploadResumableByObjectPath(objectPath: objectPath) { (response, error) in
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
 **objectPath** | **String** |  | 

### Return type

Void (empty response body)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: Not defined

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **postUploadResumableSign**
```swift
    internal class func postUploadResumableSign(completion: @escaping (_ data: Void?, _ error: Error?) -> Void)
```

Handle POST request for TUS Resumable uploads

### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import SupabaseStorage


// Handle POST request for TUS Resumable uploads
ResumableAPI.postUploadResumableSign() { (response, error) in
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
This endpoint does not need any parameter.

### Return type

Void (empty response body)

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: Not defined

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **postUploadResumableSignByObjectPath**
```swift
    internal class func postUploadResumableSignByObjectPath(objectPath: String, completion: @escaping (_ data: Void?, _ error: Error?) -> Void)
```

Handle POST request for TUS Resumable uploads

### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import SupabaseStorage

let objectPath = "objectPath_example" // String | 

// Handle POST request for TUS Resumable uploads
ResumableAPI.postUploadResumableSignByObjectPath(objectPath: objectPath) { (response, error) in
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
 **objectPath** | **String** |  | 

### Return type

Void (empty response body)

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: Not defined

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **putUploadResumableByObjectPath**
```swift
    internal class func putUploadResumableByObjectPath(objectPath: String, completion: @escaping (_ data: Void?, _ error: Error?) -> Void)
```

Handle PUT request for TUS Resumable uploads

### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import SupabaseStorage

let objectPath = "objectPath_example" // String | 

// Handle PUT request for TUS Resumable uploads
ResumableAPI.putUploadResumableByObjectPath(objectPath: objectPath) { (response, error) in
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
 **objectPath** | **String** |  | 

### Return type

Void (empty response body)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: Not defined

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **putUploadResumableSignByObjectPath**
```swift
    internal class func putUploadResumableSignByObjectPath(objectPath: String, completion: @escaping (_ data: Void?, _ error: Error?) -> Void)
```

Handle PUT request for TUS Resumable uploads

### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import SupabaseStorage

let objectPath = "objectPath_example" // String | 

// Handle PUT request for TUS Resumable uploads
ResumableAPI.putUploadResumableSignByObjectPath(objectPath: objectPath) { (response, error) in
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
 **objectPath** | **String** |  | 

### Return type

Void (empty response body)

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: Not defined

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

