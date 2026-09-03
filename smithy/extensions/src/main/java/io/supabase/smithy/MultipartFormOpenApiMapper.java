package io.supabase.smithy;

import java.util.ArrayList;
import java.util.List;

import software.amazon.smithy.model.node.ArrayNode;
import software.amazon.smithy.model.node.Node;
import software.amazon.smithy.model.node.ObjectNode;
import software.amazon.smithy.model.shapes.OperationShape;
import software.amazon.smithy.model.shapes.ShapeId;
import software.amazon.smithy.model.shapes.StructureShape;
import software.amazon.smithy.model.traits.Trait;
import software.amazon.smithy.openapi.fromsmithy.Context;
import software.amazon.smithy.openapi.fromsmithy.OpenApiMapper;
import software.amazon.smithy.jsonschema.Schema;
import software.amazon.smithy.openapi.model.MediaTypeObject;
import software.amazon.smithy.openapi.model.OperationObject;
import software.amazon.smithy.openapi.model.RequestBodyObject;

/**
 * Smithy OpenAPI mapper intended to handle the {@code io.supabase.traits#httpMultipartForm}
 * trait. Currently not active: the trait is stripped as a DynamicTrait by the OpenAPI
 * converter before {@link #updateOperation} is called. Multipart injection is handled by
 * {@code patch-openapi.py} instead. This class is kept for future reference.
 */
public final class MultipartFormOpenApiMapper implements OpenApiMapper {

    static {
        System.err.println("[MultipartFormOpenApiMapper] class loaded via SPI");
    }

    private static final ShapeId TRAIT_ID = ShapeId.from("io.supabase.traits#httpMultipartForm");

    @Override
    public OperationObject updateOperation(
            Context<? extends Trait> context,
            OperationShape shape,
            OperationObject operation,
            String httpMethodName,
            String path) {

        System.err.println("[MultipartFormOpenApiMapper] updateOperation: " + shape.getId() + " " + httpMethodName + " " + path);

        ShapeId inputId = shape.getInput().orElse(null);
        if (inputId == null) {
            return operation;
        }

        StructureShape input = context.getModel().expectShape(inputId, StructureShape.class);
        Trait rawTrait = input.findTrait(TRAIT_ID).orElse(null);
        if (rawTrait == null) {
            return operation;
        }

        ObjectNode traitNode = rawTrait.toNode().expectObjectNode();
        ArrayNode fieldsArray = traitNode.getArrayMember("fields").orElse(Node.arrayNode());

        Schema.Builder bodySchemaBuilder = Schema.builder().type("object");
        List<String> required = new ArrayList<>();

        for (Node fieldNode : fieldsArray.getElements()) {
            ObjectNode field = fieldNode.expectObjectNode();
            String name = field.expectStringMember("name").getValue();
            String fieldType = field.expectStringMember("fieldType").getValue();
            boolean isRequired = field.getBooleanMemberOrDefault("required", false);

            Schema fieldSchema;
            switch (fieldType) {
                case "binary":
                    fieldSchema = Schema.builder().type("string").format("binary").build();
                    break;
                case "object":
                    fieldSchema = Schema.builder().type("object").build();
                    break;
                default:
                    fieldSchema = Schema.builder().type("string").build();
            }

            bodySchemaBuilder.putProperty(name, fieldSchema);
            if (isRequired) {
                required.add(name);
            }
        }

        if (!required.isEmpty()) {
            bodySchemaBuilder.required(required);
        }

        RequestBodyObject requestBody = RequestBodyObject.builder()
                .putContent(
                        "multipart/form-data",
                        MediaTypeObject.builder()
                                .schema(bodySchemaBuilder.build())
                                .build())
                .required(true)
                .build();

        return operation.toBuilder()
                .requestBody(requestBody)
                .build();
    }
}
