package com.homemed.cabinet;

import android.app.Activity;
import android.content.Intent;

// تم تصحيح المسار هنا للاعتماد على مكتبة أندرويد الرسمية بدلاً من كاباسيتور
import androidx.activity.result.ActivityResult; 

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * TextScanPlugin — Capacitor bridge for the Smart Camera Scan feature.
 *
 * Exposed to JavaScript via:
 * const TextScan = registerPlugin('TextScan');
 * const { text } = await TextScan.scan();
 *
 * The plugin launches TextScanActivity (a full-screen native camera viewfinder)
 * and returns the recognised text via an Activity result, exactly the same
 * pattern used by @capacitor-mlkit/barcode-scanning.
 */
@CapacitorPlugin(name = "TextScan")
public class TextScanPlugin extends Plugin {

    @PluginMethod
    public void scan(PluginCall call) {
        Intent intent = new Intent(getContext(), TextScanActivity.class);
        startActivityForResult(call, intent, "handleScanResult");
    }

    @ActivityCallback
    private void handleScanResult(PluginCall call, ActivityResult result) {
        if (call == null) return;

        if (result.getResultCode() == Activity.RESULT_OK && result.getData() != null) {
            String text = result.getData().getStringExtra(TextScanActivity.RESULT_TEXT);
            if (text != null && !text.trim().isEmpty()) {
                JSObject ret = new JSObject();
                ret.put("text", text.trim());
                call.resolve(ret);
            } else {
                call.reject("NO_TEXT", "No text was recognised in the image.");
            }
        } else {
            // User pressed Cancel — not an error, just a cancellation signal
            call.reject("CANCELLED", "Scan was cancelled.");
        }
    }
}
