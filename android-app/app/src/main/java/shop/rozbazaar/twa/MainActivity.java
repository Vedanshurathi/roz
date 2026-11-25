package shop.rozbazaar.twa;

import android.Manifest;
import android.annotation.SuppressLint;
import android.content.ActivityNotFoundException;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.net.ConnectivityManager;
import android.net.NetworkCapabilities;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.provider.MediaStore;
import android.text.SpannableString;
import android.text.Spanned;
import android.text.style.ForegroundColorSpan;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.CookieManager;
import android.webkit.GeolocationPermissions;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.TextView;

import androidx.activity.ComponentActivity;
import androidx.activity.OnBackPressedCallback;
import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.browser.customtabs.CustomTabColorSchemeParams;
import androidx.browser.customtabs.CustomTabsIntent;
import androidx.core.content.ContextCompat;
import androidx.core.content.FileProvider;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout;
import androidx.webkit.WebViewCompat;
import androidx.webkit.WebViewFeature;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.Collections;
import java.util.Map;

/** RozBazaar: the website https://rozbazaar.shop in a full-screen WebView. */
public class MainActivity extends ComponentActivity {

    static final String HOST = "rozbazaar.shop";
    static final String START_URL = "https://rozbazaar.shop/?source=pwa";
    private static final String SUPABASE_HOST = "srvpfyjmwaruebbkqkdj.supabase.co";
    private static final int GREEN = 0xFF1E8E3E, NAVY = 0xFF101B30, MUTED = 0xFF5B564C;

    private WebView web;
    private SwipeRefreshLayout swipe;
    private View splash, offline, statusBg, navBg;
    private TextView offlineMsg;
    private WebBridge bridge;
    private final Handler ui = new Handler(Looper.getMainLooper());

    private volatile boolean ownPage = false;
    private volatile boolean pullAllowed = false;
    private boolean mainFrameFailed = false;
    private boolean splashGone = false;
    private String failedUrl = null;

    // file chooser
    private ValueCallback<Uri[]> fileCallback;
    private Uri cameraUri;
    private ActivityResultLauncher<Intent> fileLauncher;
    // permissions
    private ActivityResultLauncher<String[]> locLauncher;
    private ActivityResultLauncher<String> micLauncher;
    private GeolocationPermissions.Callback geoCallback;
    private String geoOrigin;
    private PermissionResult micResult;
    private ActivityResultLauncher<String> notifLauncher;
    private int notifReqId = 0;
    private final java.util.List<Runnable> afterLocation = new java.util.ArrayList<>();
    private NativeGeo geo;

    /** true while the app is on screen (the background checker then leaves alerts to the website) */
    static volatile boolean inForeground = false;

    interface PermissionResult { void done(boolean granted); }

    // ------------------------------------------------------------------ lifecycle

    @Override
    protected void onCreate(Bundle saved) {
        super.onCreate(saved);
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
        registerLaunchers();
        geo = new NativeGeo(this, (id, type, json) -> jsCall("__rbGeo", id, type, json));
        PollWorker.ensureChannel(this);
        if (PollWorker.prefs(this).getBoolean("push_on", false)) PollWorker.enable(this, true);
        buildViews();
        setupWebView();
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override public void handleOnBackPressed() {
                if (offline.getVisibility() == View.VISIBLE && web.canGoBack()) { hideOffline(); web.goBack(); return; }
                if (web.canGoBack()) { web.goBack(); return; }
                finish();
            }
        });
        if (saved != null && web.restoreState(saved) != null) {
            hideSplash();
        } else {
            String deep = linkFrom(getIntent());
            loadFirst(deep != null ? deep : START_URL);
        }
        ui.postDelayed(this::hideSplash, 9000);   // never keep the splash longer than 9 s
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        String link = linkFrom(intent);
        if (link != null) { hideOffline(); web.loadUrl(link); }
    }

    @Override protected void onSaveInstanceState(Bundle out) { super.onSaveInstanceState(out); web.saveState(out); }
    @Override protected void onResume() { super.onResume(); inForeground = true; web.onResume(); CookieManager.getInstance().flush(); }
    @Override protected void onPause() { inForeground = false; CookieManager.getInstance().flush(); web.onPause(); bridge.release(); geo.stopAll(); super.onPause(); }
    @Override protected void onStop() { super.onStop(); PollWorker.kick(this); }
    @Override protected void onDestroy() {
        bridge.release();
        if (geo != null) geo.stopAll();
        if (web != null) { web.stopLoading(); web.destroy(); }
        super.onDestroy();
    }

    /** A https://rozbazaar.shop link the app was opened with (WhatsApp link, Google login coming back). */
    private String linkFrom(Intent i) {
        if (i == null || !Intent.ACTION_VIEW.equals(i.getAction()) || i.getData() == null) return null;
        Uri u = i.getData();
        if (!"https".equals(u.getScheme()) || !HOST.equals(u.getHost())) return null;
        // keep ?source=pwa so the website knows it is inside the app
        String q = u.getEncodedQuery();
        Uri.Builder b = u.buildUpon();
        if (q == null || !q.contains("source=pwa")) b.encodedQuery(q == null || q.isEmpty() ? "source=pwa" : q + "&source=pwa");
        return b.build().toString();
    }

    // ------------------------------------------------------------------ views

    private int dp(float v) { return (int) TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, v, getResources().getDisplayMetrics()); }

    private void buildViews() {
        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(Color.WHITE);

        FrameLayout content = new FrameLayout(this);
        swipe = new SwipeRefreshLayout(this);
        swipe.setColorSchemeColors(GREEN, 0xFFF2760D);
        web = new WebView(this);
        web.setBackgroundColor(Color.WHITE);
        swipe.addView(web, new ViewGroup.LayoutParams(-1, -1));
        swipe.setOnChildScrollUpCallback((parent, child) -> !pullAllowed || web.getScrollY() > 0);
        swipe.setOnRefreshListener(() -> {
            if (offline.getVisibility() == View.VISIBLE) retry(); else web.reload();
            ui.postDelayed(() -> swipe.setRefreshing(false), 8000);
        });
        content.addView(swipe, new FrameLayout.LayoutParams(-1, -1));
        offline = buildOffline();
        offline.setVisibility(View.GONE);
        content.addView(offline, new FrameLayout.LayoutParams(-1, -1));
        root.addView(content, new FrameLayout.LayoutParams(-1, -1));

        // green bars behind the phone's status bar and navigation bar (same colours as before)
        statusBg = new View(this);
        statusBg.setBackgroundColor(GREEN);
        root.addView(statusBg, new FrameLayout.LayoutParams(-1, 0, Gravity.TOP));
        navBg = new View(this);
        navBg.setBackgroundColor(GREEN);
        root.addView(navBg, new FrameLayout.LayoutParams(-1, 0, Gravity.BOTTOM));

        splash = buildSplash();
        root.addView(splash, new FrameLayout.LayoutParams(-1, -1));

        ViewCompat.setOnApplyWindowInsetsListener(root, (v, insets) -> {
            Insets bars = insets.getInsets(WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout());
            Insets ime = insets.getInsets(WindowInsetsCompat.Type.ime());
            int bottom = Math.max(bars.bottom, ime.bottom);
            content.setPadding(bars.left, bars.top, bars.right, bottom);
            statusBg.getLayoutParams().height = bars.top;
            navBg.getLayoutParams().height = bars.bottom;
            statusBg.requestLayout();
            navBg.requestLayout();
            return WindowInsetsCompat.CONSUMED;
        });
        setContentView(root);
        WindowInsetsControllerCompat c = WindowCompat.getInsetsController(getWindow(), root);
        c.setAppearanceLightStatusBars(false);
        c.setAppearanceLightNavigationBars(false);
    }

    private View buildSplash() {
        LinearLayout s = new LinearLayout(this);
        s.setOrientation(LinearLayout.VERTICAL);
        s.setGravity(Gravity.CENTER);
        s.setBackgroundColor(Color.WHITE);
        s.setClickable(true);
        ImageView logo = new ImageView(this);
        logo.setImageResource(R.drawable.splash);
        s.addView(logo, new LinearLayout.LayoutParams(dp(144), dp(144)));
        TextView name = new TextView(this);
        SpannableString t = new SpannableString("RozBazaar");
        t.setSpan(new ForegroundColorSpan(GREEN), 0, 3, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE);
        t.setSpan(new ForegroundColorSpan(NAVY), 3, 9, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE);
        name.setText(t);
        name.setTextSize(TypedValue.COMPLEX_UNIT_SP, 34);
        name.setTypeface(Typeface.create("sans-serif", Typeface.BOLD));
        name.setLetterSpacing(-0.02f);
        LinearLayout.LayoutParams np = new LinearLayout.LayoutParams(-2, -2);
        np.topMargin = dp(8);
        s.addView(name, np);
        TextView tag = new TextView(this);
        tag.setText("ताज़ी सब्ज़ी, आपके दरवाज़े पर");
        tag.setTextColor(MUTED);
        tag.setTextSize(TypedValue.COMPLEX_UNIT_SP, 15);
        LinearLayout.LayoutParams tp = new LinearLayout.LayoutParams(-2, -2);
        tp.topMargin = dp(4);
        s.addView(tag, tp);
        ProgressBar pb = new ProgressBar(this);
        pb.setIndeterminateTintList(android.content.res.ColorStateList.valueOf(GREEN));
        LinearLayout.LayoutParams pp = new LinearLayout.LayoutParams(dp(32), dp(32));
        pp.topMargin = dp(28);
        s.addView(pb, pp);
        return s;
    }

    private View buildOffline() {
        LinearLayout o = new LinearLayout(this);
        o.setOrientation(LinearLayout.VERTICAL);
        o.setGravity(Gravity.CENTER);
        o.setBackgroundColor(0xFFFCF8F0);
        o.setPadding(dp(32), dp(32), dp(32), dp(32));
        o.setClickable(true);
        ImageView logo = new ImageView(this);
        logo.setImageResource(R.drawable.splash);
        logo.setAlpha(0.9f);
        o.addView(logo, new LinearLayout.LayoutParams(dp(96), dp(96)));
        TextView h = new TextView(this);
        h.setText("इंटरनेट नहीं मिल रहा\nNo internet connection");
        h.setTextColor(0xFF16150F);
        h.setTextSize(TypedValue.COMPLEX_UNIT_SP, 20);
        h.setTypeface(Typeface.DEFAULT_BOLD);
        h.setGravity(Gravity.CENTER);
        LinearLayout.LayoutParams hp = new LinearLayout.LayoutParams(-2, -2);
        hp.topMargin = dp(20);
        o.addView(h, hp);
        offlineMsg = new TextView(this);
        offlineMsg.setTextColor(MUTED);
        offlineMsg.setTextSize(TypedValue.COMPLEX_UNIT_SP, 15);
        offlineMsg.setGravity(Gravity.CENTER);
        LinearLayout.LayoutParams mp = new LinearLayout.LayoutParams(-2, -2);
        mp.topMargin = dp(10);
        o.addView(offlineMsg, mp);
        Button retry = new Button(this);
        retry.setText("फिर कोशिश करें · Retry");
        retry.setAllCaps(false);
        retry.setTextColor(Color.WHITE);
        retry.setTextSize(TypedValue.COMPLEX_UNIT_SP, 16);
        retry.setTypeface(Typeface.DEFAULT_BOLD);
        GradientDrawable bg = new GradientDrawable();
        bg.setColor(GREEN);
        bg.setCornerRadius(dp(14));
        retry.setBackground(bg);
        retry.setPadding(dp(28), dp(12), dp(28), dp(12));
        retry.setOnClickListener(v -> retry());
        LinearLayout.LayoutParams rp = new LinearLayout.LayoutParams(-2, dp(52));
        rp.topMargin = dp(24);
        o.addView(retry, rp);
        return o;
    }

    private void hideSplash() {
        if (splashGone) return;
        splashGone = true;
        splash.animate().alpha(0f).setDuration(220).withEndAction(() -> splash.setVisibility(View.GONE)).start();
    }

    private void showOffline(boolean noNet) {
        offlineMsg.setText(noNet
                ? "अपना मोबाइल डेटा या Wi-Fi चालू करें, फिर दोबारा कोशिश करें।\nTurn on mobile data or Wi-Fi and try again."
                : "RozBazaar अभी नहीं खुल पाया। थोड़ी देर में दोबारा कोशिश करें।\nRozBazaar could not open right now. Please try again.");
        offline.setVisibility(View.VISIBLE);
        swipe.setRefreshing(false);
        hideSplash();
    }

    private void hideOffline() { offline.setVisibility(View.GONE); }

    private void retry() {
        if (!isOnline()) { showOffline(true); return; }
        hideOffline();
        String u = failedUrl != null ? failedUrl : web.getUrl();
        failedUrl = null;
        if (u == null || u.startsWith("about:") || u.startsWith("data:")) u = START_URL;
        web.loadUrl(u);
    }

    private boolean isOnline() {
        ConnectivityManager cm = (ConnectivityManager) getSystemService(Context.CONNECTIVITY_SERVICE);
        if (cm == null) return true;
        NetworkCapabilities nc = cm.getNetworkCapabilities(cm.getActiveNetwork());
        return nc != null && nc.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET);
    }

    private void loadFirst(String url) {
        if (!isOnline()) { failedUrl = url; showOffline(true); return; }
        web.loadUrl(url);
    }

    // ------------------------------------------------------------------ WebView

    @SuppressLint({"SetJavaScriptEnabled", "JavascriptInterface"})
    private void setupWebView() {
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setGeolocationEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(true);
        s.setJavaScriptCanOpenWindowsAutomatically(true);
        s.setSupportMultipleWindows(false);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(false);
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        s.setTextZoom(100);
        s.setUserAgentString(s.getUserAgentString() + " RozBazaarApp/" + BuildConfigInfo.VERSION);

        CookieManager cm = CookieManager.getInstance();
        cm.setAcceptCookie(true);
        cm.setAcceptThirdPartyCookies(web, true);

        bridge = new WebBridge(this);
        web.addJavascriptInterface(bridge, "RBNative");
        String js = readAsset("rb-bridge.js");
        if (WebViewFeature.isFeatureSupported(WebViewFeature.DOCUMENT_START_SCRIPT)) {
            WebViewCompat.addDocumentStartJavaScript(web, js, Collections.singleton("https://" + HOST));
        }
        final String lateJs = WebViewFeature.isFeatureSupported(WebViewFeature.DOCUMENT_START_SCRIPT) ? null : js;

        web.setDownloadListener((url, ua, cd, mime, len) -> openOutside(Uri.parse(url)));

        web.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest req) {
                if (!req.isForMainFrame()) return false;
                return route(req.getUrl());
            }

            @Override
            public void onPageStarted(WebView view, String url, android.graphics.Bitmap icon) {
                ownPage = isOwn(Uri.parse(url));
                mainFrameFailed = false;
                if (lateJs != null && ownPage) view.evaluateJavascript(lateJs, null);
            }

            @Override
            public void onPageCommitVisible(WebView view, String url) {
                if (!mainFrameFailed) hideSplash();
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                ownPage = isOwn(Uri.parse(url));
                swipe.setRefreshing(false);
                if (!mainFrameFailed) { hideSplash(); hideOffline(); }
                CookieManager.getInstance().flush();
            }

            @Override
            public void onReceivedError(WebView view, WebResourceRequest req, WebResourceError err) {
                if (!req.isForMainFrame()) return;
                mainFrameFailed = true;
                failedUrl = req.getUrl().toString();
                showOffline(!isOnline());   // our own screen covers the WebView's raw error page
            }

            @Override
            public void onReceivedHttpError(WebView view, WebResourceRequest req, WebResourceResponse res) {
                if (req.isForMainFrame() && res.getStatusCode() >= 500 && isOwn(req.getUrl())) {
                    mainFrameFailed = true;
                    failedUrl = req.getUrl().toString();
                    showOffline(false);
                }
            }
        });

        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onGeolocationPermissionsShowPrompt(String origin, GeolocationPermissions.Callback cb) {
                if (!origin.startsWith("https://" + HOST)) { cb.invoke(origin, false, false); return; }
                if (hasLocation()) { cb.invoke(origin, true, false); return; }
                if (wasPermanentlyDenied(Manifest.permission.ACCESS_FINE_LOCATION)) { cb.invoke(origin, false, false); return; }
                geoCallback = cb;
                geoOrigin = origin;
                markAsked(Manifest.permission.ACCESS_FINE_LOCATION);
                locLauncher.launch(new String[]{Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION});
            }

            @Override
            public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> cb, FileChooserParams params) {
                if (fileCallback != null) fileCallback.onReceiveValue(null);
                fileCallback = cb;
                openFileChooser(params);
                return true;
            }

            @Override
            public void onProgressChanged(WebView view, int p) {
                if (p >= 100) swipe.setRefreshing(false);
            }
        });
    }

    private static boolean isOwn(Uri u) {
        return u != null && "https".equals(u.getScheme()) && HOST.equals(u.getHost());
    }

    boolean isOwnPageShowing() { return ownPage; }

    /** true = handled here (do not load in the WebView). */
    private boolean route(Uri u) {
        String scheme = u.getScheme() == null ? "" : u.getScheme().toLowerCase();
        String host = u.getHost() == null ? "" : u.getHost().toLowerCase();
        if ("https".equals(scheme) && HOST.equals(host)) {
            // the app download file is for the website only; anything else of ours stays in the app
            return u.getPath() != null && u.getPath().endsWith(".apk") && openOutside(u);
        }
        if ("https".equals(scheme) && (
                (SUPABASE_HOST.equals(host) && u.getPath() != null && u.getPath().startsWith("/auth/v1/authorize"))
                || "accounts.google.com".equals(host))) {
            openLogin(u);   // Google does not allow sign-in inside a WebView
            return true;
        }
        if ("about".equals(scheme) || "javascript".equals(scheme) || "blob".equals(scheme) || "data".equals(scheme)) return false;
        if ("intent".equals(scheme)) {
            try {
                Intent i = Intent.parseUri(u.toString(), Intent.URI_INTENT_SCHEME);
                i.addCategory(Intent.CATEGORY_BROWSABLE);
                i.setComponent(null);
                i.setSelector(null);
                startActivity(i);
            } catch (Exception e) {
                try {
                    String fb = Intent.parseUri(u.toString(), Intent.URI_INTENT_SCHEME).getStringExtra("browser_fallback_url");
                    if (fb != null) openOutside(Uri.parse(fb));
                } catch (Exception ignored) {}
            }
            return true;
        }
        openOutside(u);   // WhatsApp, phone calls, maps, other websites → their own app / the browser
        return true;
    }

    private boolean openOutside(Uri u) {
        Intent i = new Intent(Intent.ACTION_VIEW, u);
        i.addCategory(Intent.CATEGORY_BROWSABLE);
        try { startActivity(i); } catch (ActivityNotFoundException ignored) {}
        return true;
    }

    /** Google login page in a Chrome Custom Tab; it comes back to the app through the rozbazaar.shop link. */
    private void openLogin(Uri u) {
        CustomTabsIntent tab = new CustomTabsIntent.Builder()
                .setDefaultColorSchemeParams(new CustomTabColorSchemeParams.Builder().setToolbarColor(GREEN).build())
                .setShowTitle(true)
                .build();
        try {
            tab.launchUrl(this, u);
        } catch (ActivityNotFoundException e) {
            openOutside(u);
        }
    }

    // ------------------------------------------------------------------ file chooser (profile photo)

    private void openFileChooser(WebChromeClient.FileChooserParams params) {
        Intent pick;
        try { pick = params.createIntent(); } catch (Exception e) { pick = new Intent(Intent.ACTION_GET_CONTENT).setType("*/*"); }
        pick.addCategory(Intent.CATEGORY_OPENABLE);
        boolean images = false;
        for (String t : params.getAcceptTypes()) if (t != null && (t.startsWith("image") || t.isEmpty())) images = true;
        Intent chooser = Intent.createChooser(pick, null);
        cameraUri = null;
        if (images) {
            try {
                File dir = new File(getCacheDir(), "camera");
                if (dir.exists() || dir.mkdirs()) {
                    File f = new File(dir, "photo-" + System.currentTimeMillis() + ".jpg");
                    cameraUri = FileProvider.getUriForFile(this, getPackageName() + ".files", f);
                    Intent cam = new Intent(MediaStore.ACTION_IMAGE_CAPTURE);
                    cam.putExtra(MediaStore.EXTRA_OUTPUT, cameraUri);
                    cam.addFlags(Intent.FLAG_GRANT_WRITE_URI_PERMISSION | Intent.FLAG_GRANT_READ_URI_PERMISSION);
                    chooser.putExtra(Intent.EXTRA_INITIAL_INTENTS, new Intent[]{cam});
                }
            } catch (Exception e) { cameraUri = null; }
        }
        try {
            fileLauncher.launch(chooser);
        } catch (ActivityNotFoundException e) {
            fileCallback.onReceiveValue(null);
            fileCallback = null;
        }
    }

    private void onFileResult(int code, Intent data) {
        if (fileCallback == null) return;
        Uri[] result = null;
        if (code == RESULT_OK) {
            if (data != null && (data.getData() != null || data.getClipData() != null)) {
                result = WebChromeClient.FileChooserParams.parseResult(code, data);
            } else if (cameraUri != null) {
                File f = new File(new File(getCacheDir(), "camera"), cameraUri.getLastPathSegment());
                if (f.exists() && f.length() > 0) result = new Uri[]{cameraUri};
            }
        }
        fileCallback.onReceiveValue(result);
        fileCallback = null;
    }

    // ------------------------------------------------------------------ permissions

    private void registerLaunchers() {
        fileLauncher = registerForActivityResult(new ActivityResultContracts.StartActivityForResult(),
                r -> onFileResult(r.getResultCode(), r.getData()));
        locLauncher = registerForActivityResult(new ActivityResultContracts.RequestMultiplePermissions(), (Map<String, Boolean> r) -> {
            boolean ok = hasLocation();
            if (geoCallback != null) geoCallback.invoke(geoOrigin, ok, false);
            geoCallback = null;
            java.util.List<Runnable> q = new java.util.ArrayList<>(afterLocation);
            afterLocation.clear();
            for (Runnable x : q) x.run();
        });
        notifLauncher = registerForActivityResult(new ActivityResultContracts.RequestPermission(), ok -> {
            jsCall("__rbNotif", notifReqId, ok ? "granted" : bridgeNotifState(), null);
        });
        micLauncher = registerForActivityResult(new ActivityResultContracts.RequestPermission(), ok -> {
            PermissionResult cb = micResult;
            micResult = null;
            if (cb != null) cb.done(ok);
        });
    }

    private boolean hasLocation() {
        return ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED
                || ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED;
    }

    void askMicPermission(PermissionResult cb) {
        micResult = cb;
        markAsked(Manifest.permission.RECORD_AUDIO);
        micLauncher.launch(Manifest.permission.RECORD_AUDIO);
    }

    private SharedPreferences prefs() { return getSharedPreferences("rb_app", MODE_PRIVATE); }
    private void markAsked(String perm) { prefs().edit().putBoolean("asked_" + perm, true).apply(); }

    /** Asked before, refused, and Android will not show the question again ("Don't allow" twice). */
    boolean wasPermanentlyDenied(String perm) {
        if (ContextCompat.checkSelfPermission(this, perm) == PackageManager.PERMISSION_GRANTED) return false;
        return prefs().getBoolean("asked_" + perm, false) && !shouldShowRequestPermissionRationale(perm);
    }

    // ------------------------------------------------------------------ bridge helpers

    private String bridgeNotifState() { return bridge.notifState(); }

    /** Android 13+: the system "Allow notifications?" question. Older phones: open the app's notification settings if off. */
    void askNotifPermission(int reqId) {
        notifReqId = reqId;
        if (PollWorker.canNotify(this)) { jsCall("__rbNotif", reqId, "granted", null); return; }
        if (Build.VERSION.SDK_INT >= 33 && !wasPermanentlyDenied(Manifest.permission.POST_NOTIFICATIONS)) {
            markAsked(Manifest.permission.POST_NOTIFICATIONS);
            notifLauncher.launch(Manifest.permission.POST_NOTIFICATIONS);
            return;
        }
        try {
            Intent i = new Intent(android.provider.Settings.ACTION_APP_NOTIFICATION_SETTINGS)
                    .putExtra(android.provider.Settings.EXTRA_APP_PACKAGE, getPackageName());
            startActivity(i);
        } catch (Exception ignored) {}
        jsCall("__rbNotif", reqId, bridgeNotifState(), null);
    }

    void geoStart(int id, boolean high) {
        if (geo.permitted()) { geo.start(id, high); return; }
        if (wasPermanentlyDenied(Manifest.permission.ACCESS_FINE_LOCATION)) { geo.start(id, high); return; }   // reports "denied"
        afterLocation.add(() -> geo.start(id, high));
        if (afterLocation.size() == 1) {
            markAsked(Manifest.permission.ACCESS_FINE_LOCATION);
            locLauncher.launch(new String[]{Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION});
        }
    }

    void geoStop(int id) { geo.stop(id); }

    /** window.<fn>(id, 'type', json) on the page, from any thread */
    void jsCall(String fn, int id, String type, String json) {
        final String js = "window." + fn + "&&window." + fn + "(" + id + ",'" + type + "'," + (json == null ? "null" : json) + ")";
        ui.post(() -> { if (web != null && ownPage) web.evaluateJavascript(js, null); });
    }

    void setPullAllowed(boolean ok) { pullAllowed = ok; }

    void speechEvent(int id, String type, String json) {
        final String js = "window.__rbSpeech&&window.__rbSpeech(" + id + ",'" + type + "'," + (json == null ? "null" : json) + ")";
        ui.post(() -> { if (web != null && ownPage) web.evaluateJavascript(js, null); });
    }

    private String readAsset(String name) {
        try (InputStream in = getAssets().open(name); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            byte[] b = new byte[8192];
            int n;
            while ((n = in.read(b)) > 0) out.write(b, 0, n);
            return out.toString(StandardCharsets.UTF_8.name());
        } catch (Exception e) {
            return "";
        }
    }

    /** Small holder so the user-agent carries the app version without enabling BuildConfig generation. */
    static final class BuildConfigInfo { static final String VERSION = "1.1.0"; }
}
