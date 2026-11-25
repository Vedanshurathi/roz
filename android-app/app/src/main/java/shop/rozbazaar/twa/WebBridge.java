package shop.rozbazaar.twa;

import android.Manifest;
import android.content.ClipData;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.speech.RecognitionListener;
import android.speech.RecognizerIntent;
import android.speech.SpeechRecognizer;
import android.util.Base64;
import android.webkit.JavascriptInterface;

import androidx.core.content.ContextCompat;
import androidx.core.content.FileProvider;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.File;
import java.io.FileOutputStream;
import java.util.ArrayList;

/**
 * Methods the website can call as window.RBNative.* (see assets/rb-bridge.js).
 * Every method refuses to work unless the page on screen is rozbazaar.shop.
 */
final class WebBridge {
    private final MainActivity act;
    private SpeechRecognizer recognizer;
    private int speechId;
    private boolean speechEnded = true;
    private Runnable pendingSpeechStart;

    WebBridge(MainActivity act) { this.act = act; }

    private boolean trusted() { return act.isOwnPageShowing(); }

    // ---------------------------------------------------------------- permissions
    @JavascriptInterface
    public String permState(String name) {
        if (!trusted()) return "denied";
        String perm = "microphone".equals(name) ? Manifest.permission.RECORD_AUDIO : Manifest.permission.ACCESS_FINE_LOCATION;
        if (ContextCompat.checkSelfPermission(act, perm) == PackageManager.PERMISSION_GRANTED) return "granted";
        if ("geolocation".equals(name)
                && ContextCompat.checkSelfPermission(act, Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED)
            return "granted";
        return act.wasPermanentlyDenied(perm) ? "denied" : "prompt";
    }

    // ---------------------------------------------------------------- pull to refresh
    @JavascriptInterface
    public void setPull(boolean allowed) { act.setPullAllowed(allowed && trusted()); }

    // ---------------------------------------------------------------- voice
    @JavascriptInterface
    public boolean speechAvailable() {
        return SpeechRecognizer.isRecognitionAvailable(act);
    }

    @JavascriptInterface
    public void speechStart(final int id, final String lang, final int maxAlt, final boolean interim) {
        if (!trusted()) return;
        act.runOnUiThread(() -> {
            cancelRecognizer();
            speechId = id;
            speechEnded = false;
            Runnable go = () -> startRecognizer(id, lang, maxAlt, interim);
            if (ContextCompat.checkSelfPermission(act, Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED) {
                go.run();
            } else if (act.wasPermanentlyDenied(Manifest.permission.RECORD_AUDIO)) {
                sendError(id, "not-allowed");
            } else {
                pendingSpeechStart = go;
                act.askMicPermission(granted -> {
                    Runnable r = pendingSpeechStart;
                    pendingSpeechStart = null;
                    if (speechId != id || speechEnded) return;
                    if (granted && r != null) r.run(); else sendError(id, "not-allowed");
                });
            }
        });
    }

    @JavascriptInterface
    public void speechStop(final int id) {
        act.runOnUiThread(() -> {
            if (id != speechId || speechEnded) return;
            if (recognizer != null) recognizer.stopListening(); else finish(id);
        });
    }

    @JavascriptInterface
    public void speechAbort(final int id) {
        act.runOnUiThread(() -> {
            if (id != speechId) return;
            speechEnded = true;
            pendingSpeechStart = null;
            cancelRecognizer();
        });
    }

    private void startRecognizer(final int id, String lang, int maxAlt, final boolean interim) {
        try {
            recognizer = SpeechRecognizer.createSpeechRecognizer(act);
        } catch (Exception e) {
            sendError(id, "service-not-allowed");
            return;
        }
        recognizer.setRecognitionListener(new RecognitionListener() {
            @Override public void onReadyForSpeech(Bundle b) { act.speechEvent(id, "start", null); }
            @Override public void onBeginningOfSpeech() {}
            @Override public void onRmsChanged(float v) {}
            @Override public void onBufferReceived(byte[] bytes) {}
            @Override public void onEndOfSpeech() { act.speechEvent(id, "speechend", null); }
            @Override public void onError(int code) {
                if (id != speechId || speechEnded) return;
                String err;
                switch (code) {
                    case SpeechRecognizer.ERROR_NO_MATCH:
                    case SpeechRecognizer.ERROR_SPEECH_TIMEOUT: err = "no-speech"; break;
                    case SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS: err = "not-allowed"; break;
                    case SpeechRecognizer.ERROR_NETWORK:
                    case SpeechRecognizer.ERROR_NETWORK_TIMEOUT:
                    case SpeechRecognizer.ERROR_SERVER: err = "network"; break;
                    case SpeechRecognizer.ERROR_AUDIO: err = "audio-capture"; break;
                    default: err = "aborted";
                }
                sendError(id, err);
            }
            @Override public void onResults(Bundle b) {
                if (id != speechId || speechEnded) return;
                sendResult(id, b, true);
                finish(id);
            }
            @Override public void onPartialResults(Bundle b) {
                if (interim && id == speechId && !speechEnded) sendResult(id, b, false);
            }
            @Override public void onEvent(int t, Bundle b) {}
        });
        Intent i = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
        i.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
        i.putExtra(RecognizerIntent.EXTRA_LANGUAGE, lang);
        i.putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, Math.max(1, Math.min(5, maxAlt)));
        i.putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, interim);
        i.putExtra(RecognizerIntent.EXTRA_CALLING_PACKAGE, act.getPackageName());
        try {
            recognizer.startListening(i);
        } catch (Exception e) {
            sendError(id, "aborted");
        }
    }

    private void sendResult(int id, Bundle b, boolean fin) {
        ArrayList<String> list = b.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
        if (list == null || list.isEmpty()) return;
        try {
            JSONObject o = new JSONObject();
            JSONArray alts = new JSONArray();
            for (String s : list) if (s != null && !s.trim().isEmpty()) alts.put(s);
            if (alts.length() == 0) return;
            o.put("alts", alts);
            o.put("final", fin);
            act.speechEvent(id, "result", o.toString());
        } catch (Exception ignored) {}
    }

    private void sendError(int id, String err) {
        act.speechEvent(id, "error", "{\"error\":\"" + err + "\"}");
        finish(id);
    }

    private void finish(int id) {
        if (id != speechId || speechEnded) return;
        speechEnded = true;
        cancelRecognizer();
        act.speechEvent(id, "end", null);
    }

    private void cancelRecognizer() {
        if (recognizer != null) {
            try { recognizer.cancel(); recognizer.destroy(); } catch (Exception ignored) {}
            recognizer = null;
        }
    }

    void release() {
        speechEnded = true;
        cancelRecognizer();
    }

    // ---------------------------------------------------------------- location (fast, native)
    @JavascriptInterface
    public boolean geoNative() { return true; }

    @JavascriptInterface
    public void geoStart(final int id, final boolean high) {
        if (!trusted()) return;
        act.runOnUiThread(() -> act.geoStart(id, high));
    }

    @JavascriptInterface
    public void geoStop(final int id) {
        act.runOnUiThread(() -> act.geoStop(id));
    }

    // ---------------------------------------------------------------- notifications
    /** "granted" | "denied" | "default" — same words as the web Notification.permission */
    @JavascriptInterface
    public String notifState() {
        if (PollWorker.canNotify(act)) return "granted";
        if (Build.VERSION.SDK_INT >= 33) {
            return act.wasPermanentlyDenied(Manifest.permission.POST_NOTIFICATIONS) ? "denied" : "default";
        }
        return "denied";   // switched off in phone settings (older Android has no question to ask)
    }

    @JavascriptInterface
    public void notifRequest(final int reqId) {
        if (!trusted()) return;
        act.runOnUiThread(() -> act.askNotifPermission(reqId));
    }

    /** show a notification now (the website's `new Notification(...)`) */
    @JavascriptInterface
    public void notify(String title, String body, String tag) {
        if (!trusted()) return;
        int id = (tag == null || tag.isEmpty() ? String.valueOf(System.currentTimeMillis()) : tag).hashCode();
        PollWorker.show(act, id, title, body);
    }

    /** this phone's secret for app_device_poll; the website registers it with customer_app_device_register */
    @JavascriptInterface
    public String pushToken() { return trusted() ? PollWorker.token(act) : ""; }

    /** turn background order alerts on/off (after login / logout) */
    @JavascriptInterface
    public void pushEnable(boolean on) {
        if (!trusted()) return;
        PollWorker.enable(act, on);
    }

    // ---------------------------------------------------------------- sharing
    @JavascriptInterface
    public boolean share(String title, String text, String filesJson) {
        if (!trusted()) return false;
        try {
            JSONArray files = new JSONArray(filesJson == null || filesJson.isEmpty() ? "[]" : filesJson);
            File dir = new File(act.getCacheDir(), "share");
            if (!dir.exists() && !dir.mkdirs()) return false;
            ArrayList<Uri> uris = new ArrayList<>();
            String type = null;
            for (int k = 0; k < files.length() && k < 10; k++) {
                JSONObject f = files.getJSONObject(k);
                String name = f.optString("name", "file").replaceAll("[^A-Za-z0-9._-]", "_");
                if (name.isEmpty() || name.startsWith(".")) name = "file" + name;
                byte[] data = Base64.decode(f.getString("data"), Base64.DEFAULT);
                if (data.length > 15 * 1024 * 1024) return false;
                File out = new File(dir, name);
                try (FileOutputStream fo = new FileOutputStream(out)) { fo.write(data); }
                uris.add(FileProvider.getUriForFile(act, act.getPackageName() + ".files", out));
                String t = f.optString("type", "application/octet-stream");
                type = type == null ? t : (type.equals(t) ? type : "*/*");
            }
            Intent send;
            if (uris.isEmpty()) {
                send = new Intent(Intent.ACTION_SEND).setType("text/plain");
            } else if (uris.size() == 1) {
                send = new Intent(Intent.ACTION_SEND).setType(type);
                send.putExtra(Intent.EXTRA_STREAM, uris.get(0));
                send.setClipData(ClipData.newRawUri("", uris.get(0)));
            } else {
                send = new Intent(Intent.ACTION_SEND_MULTIPLE).setType(type);
                send.putParcelableArrayListExtra(Intent.EXTRA_STREAM, uris);
                ClipData cd = ClipData.newRawUri("", uris.get(0));
                for (int k = 1; k < uris.size(); k++) cd.addItem(new ClipData.Item(uris.get(k)));
                send.setClipData(cd);
            }
            if (text != null && !text.isEmpty()) send.putExtra(Intent.EXTRA_TEXT, text);
            if (title != null && !title.isEmpty()) send.putExtra(Intent.EXTRA_SUBJECT, title);
            send.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            final Intent chooser = Intent.createChooser(send, null);
            act.runOnUiThread(() -> {
                try { act.startActivity(chooser); } catch (Exception ignored) {}
            });
            return true;
        } catch (Exception e) {
            return false;
        }
    }
}
