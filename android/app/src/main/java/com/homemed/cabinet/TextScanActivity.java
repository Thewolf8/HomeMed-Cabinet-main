package com.homemed.cabinet;

import android.Manifest;
import android.app.Activity;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Bitmap;
import android.graphics.Color;
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
 * TextScanActivity  —  live CameraX viewfinder + ML Kit Text Recognition.
 *
 * Deliberately simple: no inner-class drawers, no complex decoration.
 * Every external call is wrapped in try/catch so a missing dep or CameraX
 * hiccup produces a graceful cancellation rather than a process crash.
 */
public class TextScanActivity extends AppCompatActivity {

    public static final String RESULT_TEXT = "recognized_text";
    private static final int REQ_CAMERA = 101;

    private PreviewView previewView;
    private TextView    statusText;
    private Button      scanButton;
    private ProgressBar progressBar;

    private ListenableFuture<ProcessCameraProvider> cameraFuture;
    private ProcessCameraProvider cameraProvider;
    private TextRecognizer        recognizer;

    // ── Lifecycle ─────────────────────────────────────────────────────────────

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);

        // Initialise ML Kit recogniser — if the library is missing this throws
        // immediately and we cancel cleanly instead of crashing the whole process.
        try {
            recognizer = TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS);
        } catch (Exception e) {
            setResult(Activity.RESULT_CANCELED);
            finish();
            return;
        }

        buildUI();
        checkCameraPermission();
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        try { if (cameraProvider != null) cameraProvider.unbindAll(); }
        catch (Exception ignored) {}
        try { if (recognizer != null) recognizer.close(); }
        catch (Exception ignored) {}
    }

    // ── UI (all programmatic — no XML layout needed) ──────────────────────────

    private void buildUI() {
        final float density = getResources().getDisplayMetrics().density;
        final int dp = Math.round(density);

        // Root
        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(Color.BLACK);

        // ── Live preview ──────────────────────────────────────────────────────
        previewView = new PreviewView(this);
        previewView.setScaleType(PreviewView.ScaleType.FILL_CENTER);
        root.addView(previewView, matchParent());

        // ── Guide rectangle — white stroked border ────────────────────────────
        View guide = new View(this);
        GradientDrawable border = new GradientDrawable();
        border.setShape(GradientDrawable.RECTANGLE);
        border.setColor(Color.TRANSPARENT);
        border.setStroke(2 * dp, 0xDDFFFFFF);
        border.setCornerRadius(8 * dp);
        guide.setBackground(border);
        FrameLayout.LayoutParams guideLP =
            new FrameLayout.LayoutParams(300 * dp, 175 * dp);
        guideLP.gravity     = Gravity.CENTER;
        guideLP.bottomMargin = 96 * dp;      // sits above the button bar
        root.addView(guide, guideLP);

        // ── Instruction label ─────────────────────────────────────────────────
        statusText = new TextView(this);
        statusText.setText("وجّه الكاميرا نحو علبة الدواء");
        statusText.setTextColor(Color.WHITE);
        statusText.setTextSize(TypedValue.COMPLEX_UNIT_SP, 13);
        statusText.setGravity(Gravity.CENTER);
        statusText.setPadding(18 * dp, 7 * dp, 18 * dp, 7 * dp);

        GradientDrawable labelBg = new GradientDrawable();
        labelBg.setShape(GradientDrawable.RECTANGLE);
        labelBg.setColor(0xAA000000);
        labelBg.setCornerRadius(20 * dp);
        statusText.setBackground(labelBg);

        FrameLayout.LayoutParams labelLP = new FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.WRAP_CONTENT,
            FrameLayout.LayoutParams.WRAP_CONTENT);
        labelLP.gravity      = Gravity.CENTER_HORIZONTAL | Gravity.BOTTOM;
        labelLP.bottomMargin = 178 * dp;
        root.addView(statusText, labelLP);

        // ── Spinner (hidden until scan is in progress) ────────────────────────
        progressBar = new ProgressBar(this);
        progressBar.setVisibility(View.GONE);
        FrameLayout.LayoutParams pbLP =
            new FrameLayout.LayoutParams(56 * dp, 56 * dp);
        pbLP.gravity = Gravity.CENTER;
        root.addView(progressBar, pbLP);

        // ── Bottom button bar ─────────────────────────────────────────────────
        LinearLayout bar = new LinearLayout(this);
        bar.setOrientation(LinearLayout.HORIZONTAL);
        bar.setGravity(Gravity.CENTER_VERTICAL);
        bar.setPadding(24 * dp, 16 * dp, 24 * dp, 36 * dp);
        bar.setBackgroundColor(0xF0111111);

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
            new LinearLayout.LayoutParams(
                0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f));

        // Scan (primary)
        scanButton = new Button(this);
        scanButton.setText("مسح النص");
        scanButton.setTextColor(Color.WHITE);
        scanButton.setTextSize(TypedValue.COMPLEX_UNIT_SP, 15);
        GradientDrawable scanBg = new GradientDrawable();
        scanBg.setShape(GradientDrawable.RECTANGLE);
        scanBg.setColor(0xFF2563EB);          // blue-600  — matches app primary
        scanBg.setCornerRadius(24 * dp);
        scanButton.setBackground(scanBg);
        scanButton.setPadding(32 * dp, 4 * dp, 32 * dp, 4 * dp);
        scanButton.setOnClickListener(v -> captureAndRecognize());

        LinearLayout.LayoutParams scanLP =
            new LinearLayout.LayoutParams(
                0, LinearLayout.LayoutParams.WRAP_CONTENT, 2f);
        scanLP.setMarginStart(12 * dp);
        bar.addView(scanButton, scanLP);

        FrameLayout.LayoutParams barLP = new FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT,
            FrameLayout.LayoutParams.WRAP_CONTENT);
        barLP.gravity = Gravity.BOTTOM;
        root.addView(bar, barLP);

        setContentView(root);
    }

    private static FrameLayout.LayoutParams matchParent() {
        return new FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT,
            FrameLayout.LayoutParams.MATCH_PARENT);
    }

    // ── Camera permission ─────────────────────────────────────────────────────

    private void checkCameraPermission() {
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA)
                == PackageManager.PERMISSION_GRANTED) {
            startCamera();
        } else {
            ActivityCompat.requestPermissions(
                this, new String[]{Manifest.permission.CAMERA}, REQ_CAMERA);
        }
    }

    @Override
    public void onRequestPermissionsResult(int code,
                                           @NonNull String[] perms,
                                           @NonNull int[] results) {
        super.onRequestPermissionsResult(code, perms, results);
        if (code == REQ_CAMERA) {
            if (results.length > 0
                    && results[0] == PackageManager.PERMISSION_GRANTED) {
                startCamera();
            } else {
                setResult(Activity.RESULT_CANCELED);
                finish();
            }
        }
    }

    // ── CameraX ───────────────────────────────────────────────────────────────

    private void startCamera() {
        try {
            cameraFuture = ProcessCameraProvider.getInstance(this);
            cameraFuture.addListener(() -> {
                try {
                    cameraProvider = cameraFuture.get();

                    Preview preview = new Preview.Builder().build();
                    preview.setSurfaceProvider(previewView.getSurfaceProvider());

                    cameraProvider.unbindAll();
                    cameraProvider.bindToLifecycle(
                        TextScanActivity.this,
                        CameraSelector.DEFAULT_BACK_CAMERA,
                        preview);

                } catch (Exception e) {
                    runOnUiThread(() -> {
                        Toast.makeText(TextScanActivity.this,
                            "تعذّر تشغيل الكاميرا.", Toast.LENGTH_SHORT).show();
                        setResult(Activity.RESULT_CANCELED);
                        finish();
                    });
                }
            }, ContextCompat.getMainExecutor(this));

        } catch (Exception e) {
            Toast.makeText(this,
                "تعذّر تشغيل الكاميرا.", Toast.LENGTH_SHORT).show();
            setResult(Activity.RESULT_CANCELED);
            finish();
        }
    }

    // ── OCR ──────────────────────────────────────────────────────────────────

    private void captureAndRecognize() {
        Bitmap frame = null;
        try { frame = previewView.getBitmap(); } catch (Exception ignored) {}

        if (frame == null) {
            Toast.makeText(this,
                "الكاميرا غير جاهزة — انتظر لحظة.", Toast.LENGTH_SHORT).show();
            return;
        }

        scanButton.setEnabled(false);
        progressBar.setVisibility(View.VISIBLE);
        statusText.setText("جاري القراءة…");

        final Bitmap captured = frame;
        try {
            InputImage image = InputImage.fromBitmap(captured, 0);
            recognizer.process(image)
                .addOnSuccessListener(this::onTextRecognized)
                .addOnFailureListener(e -> {
                    resetToReady();
                    Toast.makeText(this, "فشلت القراءة — حاول مجدداً.",
                        Toast.LENGTH_SHORT).show();
                });
        } catch (Exception e) {
            resetToReady();
        }
    }

    private void onTextRecognized(Text visionText) {
        String text = visionText.getText().trim();
        if (text.isEmpty()) {
            resetToReady();
            statusText.setText("لا نص — حسّن الإضاءة وكرّر المحاولة.");
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
}
