package com.homemed.cabinet;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Register local Capacitor plugins before the bridge initialises
        registerPlugin(TextScanPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
