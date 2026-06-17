# CdnAPI

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**deleteCdnByBucketNameByObjectPath**](CdnAPI.md#deletecdnbybucketnamebyobjectpath) | **DELETE** /cdn/{bucketName}/{objectPath} | Purge cache for an object


# **deleteCdnByBucketNameByObjectPath**
```swift
    internal class func deleteCdnByBucketNameByObjectPath(bucketName: String, objectPath: String, completion: @escaping (_ data: PostBucketByBucketIdEmpty200Response?, _ error: Error?) -> Void)
```

Purge cache for an object

### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import SupabaseStorage

let bucketName = "bucketName_example" // String | 
let objectPath = "objectPath_example" // String | 

// Purge cache for an object
CdnAPI.deleteCdnByBucketNameByObjectPath(bucketName: bucketName, objectPath: objectPath) { (response, error) in
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
 **bucketName** | **String** |  | 
 **objectPath** | **String** |  | 

### Return type

[**PostBucketByBucketIdEmpty200Response**](PostBucketByBucketIdEmpty200Response.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

