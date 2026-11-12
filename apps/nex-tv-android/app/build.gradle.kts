import java.util.Properties

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

// URL y clave pública del proyecto Supabase del MDM (ver nex.properties.example).
// Sin ellas el agente no sincroniza y la UI se queda en "Iniciando…" (falla cerrado).
val nex = Properties().apply {
    val f = rootProject.file("nex.properties")
    if (f.exists()) f.inputStream().use { load(it) }
}

fun nexProp(key: String): String =
    (project.findProperty(key) as String?) ?: nex.getProperty(key) ?: ""

android {
    namespace = "os.nex.tv"
    compileSdk = 36

    defaultConfig {
        manifestPlaceholders["nexNetworkConfig"] = if (nexProp("nex.demo") == "true") "@xml/network_demo" else "@xml/network_release"
        applicationId = "os.nex.tv"
        minSdk = 24
        targetSdk = 34
        versionCode = nexProp("nex.build").toIntOrNull() ?: 1
        versionName = nexProp("nex.version").ifEmpty { "0.1.0" }

        buildConfigField("String", "MDM_URL", "\"${nexProp("nex.mdmUrl")}\"")
        buildConfigField("String", "MDM_ANON_KEY", "\"${nexProp("nex.mdmAnonKey")}\"")
        buildConfigField("String", "RELEASE_PUB_KEYS", "\"${nexProp("nex.releasePubKey")}\"")
        // Dominios que siempre se permiten además de Supabase (separados por espacio).
        buildConfigField("String", "BASE_DOMAINS", "\"${nexProp("nex.baseDomains")}\"")
        // Demo sin backend: el agente simula al servidor (ver Demo.kt). Nunca en equipos de clientes.
        buildConfigField("boolean", "DEMO", "${nexProp("nex.demo") == "true"}")
    }

    buildFeatures {
        buildConfig = true
    }

    // Clave definitiva de NEX TV: los equipos solo aceptan actualizaciones firmadas con la misma clave y el QR
    // de alta fija su huella. Ruta en nex.keystore; contraseñas por entorno (no quedan en ps ni en el historial).
    val keystore = nexProp("nex.keystore")
    signingConfigs {
        if (keystore.isNotEmpty()) {
            create("nex") {
                storeFile = file(keystore)
                storePassword = System.getenv("NEX_KEYSTORE_PASSWORD")
                keyAlias = nexProp("nex.keyAlias").ifEmpty { "nex-tv" }
                keyPassword = System.getenv("NEX_KEY_PASSWORD") ?: System.getenv("NEX_KEYSTORE_PASSWORD")
            }
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            signingConfig = if (keystore.isNotEmpty()) {
                signingConfigs.getByName("nex")
            } else {
                logger.warn("NEX TV: sin nex.keystore el APK se firma con la clave de debug (solo para pruebas)")
                signingConfigs.getByName("debug")
            }
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions {
        jvmTarget = "17"
    }
}

dependencies {
    implementation("androidx.webkit:webkit:1.12.1")
}
