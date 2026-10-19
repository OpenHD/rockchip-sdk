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
        applicationId = "os.nex.tv"
        minSdk = 24
        targetSdk = 34
        versionCode = 1
        versionName = "0.1.0"

        buildConfigField("String", "MDM_URL", "\"${nexProp("nex.mdmUrl")}\"")
        buildConfigField("String", "MDM_ANON_KEY", "\"${nexProp("nex.mdmAnonKey")}\"")
        // Dominios que siempre se permiten además de Supabase (separados por espacio).
        buildConfigField("String", "BASE_DOMAINS", "\"${nexProp("nex.baseDomains")}\"")
    }

    buildFeatures {
        buildConfig = true
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            // Prototipo: firmado con la clave de debug para poder instalarlo directo.
            signingConfig = signingConfigs.getByName("debug")
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
