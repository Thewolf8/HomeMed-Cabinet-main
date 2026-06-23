# =============================================================================
# HomeMed Cabinet — ProGuard Rules
# =============================================================================
# Applied for: minifyEnabled true / shrinkResources true release builds.
# Goal: shrink dead code while protecting every class that is reached
# reflectively, via the WebView JS bridge, or through JSON serialisation
# (localStorage ↔ TypeScript data models).
# =============================================================================


# -----------------------------------------------------------------------------
# 1. Capacitor core — keep the entire bridge intact
# -----------------------------------------------------------------------------
# The JS layer talks to these classes by name via WebView.addJavascriptInterface,
# so their names, constructors, and @JavascriptInterface-annotated methods must
# survive obfuscation and tree-shaking.

-keep class com.getcapacitor.** { *; }
-keep interface com.getcapacitor.** { *; }
-keep @interface com.getcapacitor.annotation.** { *; }

# Keep every @CapacitorPlugin class and its @PluginMethod methods
-keep @com.getcapacitor.annotation.CapacitorPlugin class * { *; }
-keepclassmembers class * {
    @com.getcapacitor.PluginMethod *;
}

# The JS bridge itself is registered via reflection
-keepclassmembers class * extends com.getcapacitor.Plugin {
    public <init>(...);
    public *;
}


# -----------------------------------------------------------------------------
# 2. Cordova / Capacitor-Cordova plugin bridge
# -----------------------------------------------------------------------------
-keep class org.apache.cordova.** { *; }
-keep interface org.apache.cordova.** { *; }


# -----------------------------------------------------------------------------
# 3. Our MainActivity (entry point)
# -----------------------------------------------------------------------------
-keep class com.homemed.cabinet.MainActivity { *; }


# -----------------------------------------------------------------------------
# 4. WebView JavaScript interface
# -----------------------------------------------------------------------------
# Any class annotated with @JavascriptInterface must retain its public members
# so the WebView engine can call them by reflection.
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# Also keep all superclasses used to deliver JS → Java calls
-keepclassmembers class * extends android.webkit.WebViewClient { *; }
-keepclassmembers class * extends android.webkit.WebChromeClient { *; }


# -----------------------------------------------------------------------------
# 5. Android / Jetpack classes used at runtime
# -----------------------------------------------------------------------------
# AppCompat
-keep class androidx.appcompat.** { *; }
-keep interface androidx.appcompat.** { *; }

# Core splash screen
-keep class androidx.core.splashscreen.** { *; }

# Parcelable implementations must not be renamed
-keepclassmembers class * implements android.os.Parcelable {
    public static final ** CREATOR;
}

# Serializable
-keepclassmembers class * implements java.io.Serializable {
    private static final long serialVersionUID;
    private void writeObject(java.io.ObjectOutputStream);
    private void readObject(java.io.ObjectInputStream);
    java.lang.Object writeReplace();
    java.lang.Object readResolve();
}

# Enum safety
-keepclassmembers enum * {
    public static **[] values();
    public static ** valueOf(java.lang.String);
}


# -----------------------------------------------------------------------------
# 6. Capacitor Filesystem & other official Capacitor plugins
# -----------------------------------------------------------------------------
# These plugins are shipped as AARs; their plugin classes are looked up by name.
-keep class com.capacitorjs.plugins.filesystem.** { *; }
-keep class com.capacitorjs.plugins.share.** { *; }
-keep class com.capacitorjs.plugins.localnotifications.** { *; }
-keep class com.capacitorjs.plugins.camera.** { *; }
-keep class com.capacitorjs.plugins.barcodescanner.** { *; }


# -----------------------------------------------------------------------------
# 7. JSON / localStorage data-model protection
# -----------------------------------------------------------------------------
# HomeMed Cabinet stores Medication, DoseReminder, AppSettings, and related
# TypeScript interfaces as plain JSON strings in localStorage (via the
# Capacitor WebView's window.localStorage).  R8/ProGuard can strip or rename
# helper Java/Kotlin classes generated for these when they are only touched
# through reflection or cross-language serialisation.
#
# Rule: retain any class whose name contains a canonical domain keyword used
# in the app's data layer.  This is deliberately broad so future model
# additions don't silently break JSON round-trips.

-keep class **.*Medication* { *; }
-keep class **.*Medicine* { *; }
-keep class **.*Reminder* { *; }
-keep class **.*Backup* { *; }
-keep class **.*Settings* { *; }
-keep class **.*DoseLog* { *; }
-keep class **.*HomeMed* { *; }

# Keep all fields so JSON keys are never renamed by R8
-keepclassmembers class ** {
    @com.google.gson.annotations.SerializedName <fields>;
}


# -----------------------------------------------------------------------------
# 8. Reflection / annotation safety
# -----------------------------------------------------------------------------
-keepattributes *Annotation*
-keepattributes Signature
-keepattributes Exceptions
-keepattributes InnerClasses
-keepattributes EnclosingMethod


# -----------------------------------------------------------------------------
# 9. Debugging aids (safe to enable in staging / CI builds)
# -----------------------------------------------------------------------------
# Uncomment these two lines in a debug-signed release to get readable
# crash stack traces without disabling obfuscation entirely:
#-keepattributes SourceFile,LineNumberTable
#-renamesourcefileattribute SourceFile


# -----------------------------------------------------------------------------
# 10. Third-party libraries bundled in the APK
# -----------------------------------------------------------------------------
# OkHttp (used by Capacitor internally)
-dontwarn okhttp3.**
-dontwarn okio.**

# Conscrypt (TLS on older Android)
-dontwarn org.conscrypt.**
-dontwarn org.bouncycastle.**
-dontwarn org.openjsse.**
