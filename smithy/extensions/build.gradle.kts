plugins {
    `java-library`
    `maven-publish`
}

group = "io.supabase"
version = "1.0.0-SNAPSHOT"

repositories {
    mavenCentral()
}

dependencies {
    // Provided at runtime by the Smithy CLI — compile-only here
    compileOnly("software.amazon.smithy:smithy-openapi:1.52.1")
    compileOnly("software.amazon.smithy:smithy-jsonschema:1.52.1")
    compileOnly("software.amazon.smithy:smithy-model:1.52.1")
}

java {
    toolchain {
        languageVersion = JavaLanguageVersion.of(17)
    }
}

publishing {
    publications {
        create<MavenPublication>("mavenJava") {
            from(components["java"])
            artifactId = "smithy-supabase-extensions"
        }
    }
    repositories {
        mavenLocal()
    }
}
