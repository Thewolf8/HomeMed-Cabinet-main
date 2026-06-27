package com.homemed.cabinet;

import android.Manifest;
import android.app.Activity;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.RectF;
import android.graphics.drawable.GradientDrawable;
import android.os.Bundle;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.View;
import android.view.WindowManager;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.TextView;
import android.widget.Toast;

import androidx.annotation.NonNull;
import androidx.appcompat.app.AppCompatActivity;
import androidx.camera.core.CameraSelector;
import androidx.camera.core.Preview;
import androidx.camera.lifecycle.ProcessCameraProvider;
import androidx.camera.view.PreviewView;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;

import com.google.common.util.concurrent.ListenableFuture;
import com.google.mlkit.vision.common.InputImage;
import com.google.mlkit.vision.text.Text;
import com.google.mlkit.vision.text.TextRecognition;
import com.google.mlkit.vision.text.TextRecognizer;
import com.google.mlkit.vision.text.latin.TextRecognizerOptions;

/**
 * TextScanActivity — native full-screen camera scanner for the Smart Camera Scan feature.
 *
 * UX flow (mirrors the barcode scanner experience):
 *   1. Opens instantly with a live CameraX preview.
 *   2. A white guide rectangle shows the user where to frame the medicine box.
 *   3. The user taps "مسح / Scan" to capture the current preview frame.
 *   4. ML Kit Text Recognition runs on-device (<200 ms for a sharp image).
 *   5. On success → returns recognised text via Activity result → JS receives it.
 *   6. On failure / no text → shows feedback and lets the user retry.
 *
 * No internet used at any step — ML Kit Text Recognition (bundled model) is fully offline.
 */
public class TextScanActivity extends AppCompatActivity {

    public static final String RESULT_TEXT = "recognized_text";
    private static final int REQ_CAMERA    = 101;

    private PreviewView      previewView;
    private ProgressBar      progressBar;
    private TextView         statusText;
    private Button           scanButton;
    private ProcessCameraProvider cameraProvider;

    private final TextRecognizer recognizer =
        TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS);

    // ── Lifecycle ─────────────────────────────────────────────────────────────

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        buildUI();
        checkPermissionThenStart();
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        if (cameraProvider != null) cameraProvider.unbindAll();
        recognizer.close();
    }

    // ── UI (fully programmatic — no XML layout file needed) ───────────────────

    private void buildUI() {
        final int dp = Math.round(getResources().getDisplayMetrics().density);

        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(Color.BLACK);

        // ── Live preview ────────────────────────────────────────────────────
        previewView = new PreviewView(this);
        previewView.setScaleType(PreviewView.ScaleType.FILL_CENTER);
        root.addView(previewView, matchParent());

        // ── Dark vignette overlay with cut-out guide box ─────────────────────
        View vignette = new VignetteView(this);
        root.addView(vignette, matchParent());

        // ── Guide box border (white rounded rectangle) ───────────────────────
        int boxW = 300 * dp, boxH = 180 * dp;
        View guide = new View(this);
        GradientDrawable border = new GradientDrawable();
        border.setShape(GradientDrawable.RECTANGLE);
        border.setColor(Color.TRANSPARENT);
        border.setStroke(3 * dp, Color.WHITE);
        border.setCornerRadius(10 * dp);
        guide.setBackground(border);
        FrameLayout.LayoutParams guideLP = new FrameLayout.LayoutParams(boxW, boxH);
        guideLP.gravity = Gravity.CENTER;
        guideLP.bottomMargin = 110 * dp;   // sit above the button bar
        root.addView(guide, guideLP);

        // ── Corner accent marks on the guide box ─────────────────────────────
        addCorner(root, boxW, boxH, true,  true,  dp);
        addCorner(root, boxW, boxH, true,  false, dp);
        addCorner(root, boxW, boxH, false, true,  dp);
        addCorner(root, boxW, boxH, false, false, dp);

        // ── Status text ──────────────────────────────────────────────────────
        statusText = new TextView(this);
        statusText.setText("وجّه الكاميرا نحو علبة الدواء");
        statusText.setTextColor(Color.WHITE);
        statusText.setTextSize(TypedValue.COMPLEX_UNIT_SP, 13);
        statusText.setGravity(Gravity.CENTER);
        statusText.setPadding(16 * dp, 8 * dp, 16 * dp, 8 * dp);
        statusText.setBackgroundColor(0xBB000000);
        GradientDrawable statusBg = new GradientDrawable();
        statusBg.setShape(GradientDrawable.RECTANGLE);
        statusBg.setColor(0xBB000000);
        statusBg.setCornerRadius(20 * dp);
        statusText.setBackground(statusBg);
        FrameLayout.LayoutParams statusLP = new FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.WRAP_CONTENT,
            FrameLayout.LayoutParams.WRAP_CONTENT);
        statusLP.gravity = Gravity.CENTER_HORIZONTAL | Gravity.BOTTOM;
        statusLP.bottomMargin = 195 * dp;
        root.addView(statusText, statusLP);

        // ── Loading spinner (hidden until scan) ──────────────────────────────
        progressBar = new ProgressBar(this);
        progressBar.setVisibility(View.GONE);
        FrameLayout.LayoutParams pbLP = new FrameLayout.LayoutParams(64 * dp, 64 * dp);
        pbLP.gravity = Gravity.CENTER;
        root.addView(progressBar, pbLP);

        // ── Bottom button bar ─────────────────────────────────────────────────
        LinearLayout bar = new LinearLayout(this);
        bar.setOrientation(LinearLayout.HORIZONTAL);
        bar.setGravity(Gravity.CENTER_VERTICAL);
        bar.setPadding(24 * dp, 16 * dp, 24 * dp, 36 * dp);
        bar.setBackgroundColor(0xEE000000);

        // Cancel
        Button cancelBtn = new Button(this);
        cancelBtn.setText("إلغاء");
        cancelBtn.setTextColor(0xFFBBBBBB);
        cancelBtn.setTextSize(TypedValue.COMPLEX_UNIT_SP, 14);
        cancelBtn.setBackground(null);
        cancelBtn.setOnClickListener(v -> {
            setResult(Activity.RESULT_CANCELED);
            finish();
        });
        bar.addView(cancelBtn,
            new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f));

        // Scan (primary action)
        scanButton = new Button(this);
        scanButton.setText("مسح");
        scanButton.setTextColor(Color.WHITE);
        scanButton.setTextSize(TypedValue.COMPLEX_UNIT_SP, 16);
        GradientDrawable scanBg = new GradientDrawable();
        scanBg.setShape(GradientDrawable.RECTANGLE);
        scanBg.setColor(0xFF2563EB);          // matches app primary (blue-600)
        scanBg.setCornerRadius(24 * dp);
        scanButton.setBackground(scanBg);
        scanButton.setPadding(40 * dp, 0, 40 * dp, 0);
        scanButton.setOnClickListener(v -> captureAndRecognize());
        LinearLayout.LayoutParams scanLP =
            new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 2f);
        scanLP.setMarginStart(16 * dp);
        bar.addView(scanButton, scanLP);

        FrameLayout.LayoutParams barLP = new FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT,
            FrameLayout.LayoutParams.WRAP_CONTENT);
        barLP.gravity = Gravity.BOTTOM;
        root.addView(bar, barLP);

        setContentView(root);
    }

    /** Small L-shaped corner accent drawn on top of the guide box border. */
    private void addCorner(FrameLayout root, int boxW, int boxH,
                           boolean top, boolean left, int dp) {
        int len = 20 * dp, thick = 3 * dp;
        // Horizontal stroke
        View h = new View(this);
        h.setBackgroundColor(0xFF60A5FA);   // blue-400 accent
        FrameLayout.LayoutParams hLP = new FrameLayout.LayoutParams(len, thick);
        hLP.gravity = Gravity.CENTER;
        hLP.bottomMargin = (top  ? -boxH / 2 : boxH / 2 - thick) + 110 * dp;
        hLP.leftMargin   = left  ?  -boxW / 2 : boxW / 2 - len;
        // setMarginEnd isn't reliable here; leftMargin offset from centre works
        root.addView(h, hLP);

        // Vertical stroke
        View v = new View(this);
        v.setBackgroundColor(0xFF60A5FA);
        FrameLayout.LayoutParams vLP = new FrameLayout.LayoutParams(thick, len);
        vLP.gravity = Gravity.CENTER;
        vLP.bottomMargin = (top  ? -boxH / 2 : boxH / 2 - len) + 110 * dp;
        vLP.leftMargin   = left  ? -boxW / 2 : boxW / 2 - thick;
        root.addView(v, vLP);
    }

    private static FrameLayout.LayoutParams matchParent() {
        return new FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT,
            FrameLayout.LayoutParams.MATCH_PARENT);
    }

    // ── Camera permission & start ─────────────────────────────────────────────

    private void checkPermissionThenStart() {
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA)
                == PackageManager.PERMISSION_GRANTED) {
            startCamera();
        } else {
            ActivityCompat.requestPermissions(this,
                new String[]{Manifest.permission.CAMERA}, REQ_CAMERA);
        }
    }

    private void startCamera() {
        ListenableFuture<ProcessCameraProvider> future =
            ProcessCameraProvider.getInstance(this);

        future.addListener(() -> {
            try {
                cameraProvider = future.get();
                Preview preview = new Preview.Builder().build();
                preview.setSurfaceProvider(previewView.getSurfaceProvider());
                cameraProvider.unbindAll();
                cameraProvider.bindToLifecycle(
                    this, CameraSelector.DEFAULT_BACK_CAMERA, preview);
            } catch (Exception e) {
                runOnUiThread(() -> {
                    Toast.makeText(this, "Camera error.", Toast.LENGTH_SHORT).show();
                    setResult(Activity.RESULT_CANCELED);
                    finish();
                });
            }
        }, ContextCompat.getMainExecutor(this));
    }

    @Override
    public void onRequestPermissionsResult(int code,
                                           @NonNull String[] perms,
                                           @NonNull int[] results) {
        super.onRequestPermissionsResult(code, perms, results);
        if (code == REQ_CAMERA && results.length > 0
                && results[0] == PackageManager.PERMISSION_GRANTED) {
            startCamera();
        } else {
            setResult(Activity.RESULT_CANCELED);
            finish();
        }
    }

    // ── OCR capture ──────────────────────────────────────────────────────────

    private void captureAndRecognize() {
        Bitmap frame = previewView.getBitmap();
        if (frame == null) {
            Toast.makeText(this, "الكاميرا غير جاهزة. حاول مجدداً.", Toast.LENGTH_SHORT).show();
            return;
        }

        scanButton.setEnabled(false);
        progressBar.setVisibility(View.VISIBLE);
        statusText.setText("جاري القراءة…");

        InputImage image = InputImage.fromBitmap(frame, 0);
        recognizer.process(image)
            .addOnSuccessListener(this::onRecognized)
            .addOnFailureListener(e -> resetToReady());
    }

    private void onRecognized(Text visionText) {
        String text = visionText.getText().trim();
        if (text.isEmpty()) {
            resetToReady();
            statusText.setText("لا نص واضح — حسّن الإضاءة وحاول مجدداً");
            return;
        }
        Intent data = new Intent();
        data.putExtra(RESULT_TEXT, text);
        setResult(Activity.RESULT_OK, data);
        finish();
    }

    private void resetToReady() {
        progressBar.setVisibility(View.GONE);
        scanButton.setEnabled(true);
        statusText.setText("وجّه الكاميرا نحو علبة الدواء");
    }

    // ── Vignette overlay — dims corners leaving centre bright ─────────────────

    private static class VignetteView extends View {
        VignetteView(android.content.Context ctx) { super(ctx); }

        @Override
        protected void onDraw(@NonNull Canvas canvas) {
            super.onDraw(canvas);
            int w = getWidth(), h = getHeight();
            Paint p = new Paint(Paint.ANTI_ALIAS_FLAG);
            p.setColor(0x66000000);

            int dp = Math.round(getResources().getDisplayMetrics().density);
            int boxW = 300 * dp, boxH = 180 * dp;
            int cx = w / 2, cy = h / 2 - 55 * dp;  // same offset as guide box

            // Four dark rectangles surrounding the guide box
            canvas.drawRect(0, 0, w, cy - boxH / 2, p);             // top
            canvas.drawRect(0, cy + boxH / 2, w, h, p);             // bottom
            canvas.drawRect(0, cy - boxH / 2, cx - boxW / 2,
                            cy + boxH / 2, p);                        // left
            canvas.drawRect(cx + boxW / 2, cy - boxH / 2,
                            w, cy + boxH / 2, p);                     // right
        }
    }
}
