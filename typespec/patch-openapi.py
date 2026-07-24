#!/usr/bin/env python3
"""
Post-generation patches for TypeSpec-emitted OpenAPI artifacts.

TypeSpec 0.65 limitation: @sharedRoute operations always concatenate all variant
names into the operationId (e.g. "invokePost_invokePostBinary_invokePostText_...").
This script rewrites those concatenated ids to the canonical short form.
"""
import re
import sys
import json
import yaml

def patch_functions(path: str) -> None:
    with open(path) as f:
        text = f.read()

    # Each HTTP method's @sharedRoute group produces a concatenated operationId.
    # Replace with the clean canonical name (first segment before the first underscore-duplicate).
    for method in ("invokePost", "invokePut", "invokePatch", "invokeDelete"):
        # Match any concatenation starting with FunctionInvocations_{method} followed by more segments
        pattern = re.compile(
            r"FunctionInvocations_" + re.escape(method) + r"(?:_FunctionInvocations_\w+)+"
        )
        replacement = f"FunctionInvocations_{method}"
        text = pattern.sub(replacement, text)

    with open(path, "w") as f:
        f.write(text)
    print(f"Patched {path}")

if __name__ == "__main__":
    import pathlib, glob, os
    openapi_dir = pathlib.Path(__file__).parent / "openapi" / "@typespec" / "openapi3"
    patch_functions(str(openapi_dir / "openapi.Supabase.Functions.yaml"))
