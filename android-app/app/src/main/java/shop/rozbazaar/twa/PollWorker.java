package shop.rozbazaar.twa;

import android.Manifest;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;

import androidx.annotation.NonNull;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import androidx.core.content.ContextCompat;
import androidx.work.Constraints;
import androidx.work.ExistingPeriodicWorkPolicy;
import androidx.work.ExistingWorkPolicy;
import androidx.work.NetworkType;
import androidx.work.OneTimeWorkRequest;
import androidx.work.PeriodicWorkRequest;
import androidx.work.WorkManager;
import androidx.work.Worker;
import androidx.work.WorkerParameters;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.util.concurrent.TimeUnit;

/**
 * A WebView cannot receive Web Push, so the app asks the server for new customer notifications
 * (app_device_poll, keyed by a random secret this phone registered after login) and shows them itself.
 * Android runs this about every 15 minutes in the background; while the app is open the website shows them.
 */
public class PollWorker extends Worker {
    static final String CHANNEL = "orders";
    private static final String RPC = "https://srvpfyjmwaruebbkqkdj.supabase.co/rest/v1/rpc/app_device_poll";
    private static final String KEY = "sb_publishable__x6pa1NvoGWJtntByA8QEw_CfNUP5ZV"; // public site key, same as the website
    private static final String WORK = "rb-notif-poll";

    public PollWorker(@NonNull Context c, @NonNull WorkerParameters p) { super(c, p); }

    static SharedPreferences prefs(Context c) { return c.getSharedPreferences("rb_app", Context.MODE_PRIVATE); }

    /** Random device secret, made once per install. */
    static synchronized String token(Context c) {
        SharedPreferences p = prefs(c);
        String t = p.getString("push_token", null);
        if (t == null) {
            byte[] b = new byte[32];
            new SecureRandom().nextBytes(b);
            StringBuilder sb = new StringBuilder();
            for (byte x : b) sb.append(String.format("%02x", x));
            t = sb.toString();
            p.edit().putString("push_token", t).apply();
        }
        return t;
    }

    static void enable(Context c, boolean on) {
        prefs(c).edit().putBoolean("push_on", on).apply();
        WorkManager wm = WorkManager.getInstance(c);
        if (!on) { wm.cancelUniqueWork(WORK); return; }
        Constraints net = new Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build();
        wm.enqueueUniquePeriodicWork(WORK, ExistingPeriodicWorkPolicy.KEEP,
                new PeriodicWorkRequest.Builder(PollWorker.class, 15, TimeUnit.MINUTES).setConstraints(net).build());
    }

    /** One extra check soon after the app goes to the background. */
    static void kick(Context c) {
        if (!prefs(c).getBoolean("push_on", false)) return;
        Constraints net = new Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build();
        WorkManager.getInstance(c).enqueueUniqueWork(WORK + "-now", ExistingWorkPolicy.REPLACE,
                new OneTimeWorkRequest.Builder(PollWorker.class).setInitialDelay(90, TimeUnit.SECONDS).setConstraints(net).build());
    }

    static void ensureChannel(Context c) {
        if (Build.VERSION.SDK_INT < 26) return;
        NotificationManager nm = c.getSystemService(NotificationManager.class);
        if (nm == null || nm.getNotificationChannel(CHANNEL) != null) return;
        NotificationChannel ch = new NotificationChannel(CHANNEL, "Order updates", NotificationManager.IMPORTANCE_HIGH);
        ch.setDescription("Booking confirmed, vendor on the way, bill ready and slot reminders");
        nm.createNotificationChannel(ch);
    }

    static boolean canNotify(Context c) {
        if (Build.VERSION.SDK_INT >= 33
                && ContextCompat.checkSelfPermission(c, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED)
            return false;
        return NotificationManagerCompat.from(c).areNotificationsEnabled();
    }

    @SuppressWarnings("MissingPermission")
    static void show(Context c, int id, String title, String body) {
        if (!canNotify(c)) return;
        ensureChannel(c);
        Intent open = new Intent(c, MainActivity.class)
                .setAction(Intent.ACTION_VIEW)
                .setData(Uri.parse(MainActivity.START_URL))
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent pi = PendingIntent.getActivity(c, id, open, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
        NotificationCompat.Builder b = new NotificationCompat.Builder(c, CHANNEL)
                .setSmallIcon(R.drawable.ic_stat_rb)
                .setColor(0xFF1E8E3E)
                .setContentTitle(title == null || title.isEmpty() ? "RozBazaar" : title)
                .setContentText(body)
                .setStyle(new NotificationCompat.BigTextStyle().bigText(body))
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setAutoCancel(true)
                .setContentIntent(pi);
        NotificationManagerCompat.from(c).notify(id, b.build());
    }

    @NonNull
    @Override
    public Result doWork() {
        Context c = getApplicationContext();
        SharedPreferences p = prefs(c);
        if (!p.getBoolean("push_on", false)) return Result.success();
        try {
            JSONObject body = new JSONObject();
            body.put("p_token", token(c));
            String after = p.getString("poll_after", null);
            body.put("p_after", after == null ? JSONObject.NULL : after);

            HttpURLConnection h = (HttpURLConnection) new URL(RPC).openConnection();
            h.setRequestMethod("POST");
            h.setConnectTimeout(15000);
            h.setReadTimeout(15000);
            h.setDoOutput(true);
            h.setRequestProperty("Content-Type", "application/json");
            h.setRequestProperty("apikey", KEY);
            try (OutputStream o = h.getOutputStream()) { o.write(body.toString().getBytes(StandardCharsets.UTF_8)); }
            int code = h.getResponseCode();
            if (code != 200) { h.disconnect(); return Result.success(); }   // e.g. server not updated yet — try next time
            String txt;
            try (InputStream in = h.getInputStream(); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
                byte[] buf = new byte[8192]; int n;
                while ((n = in.read(buf)) > 0) out.write(buf, 0, n);
                txt = out.toString(StandardCharsets.UTF_8.name());
            }
            h.disconnect();
            JSONObject r = new JSONObject(txt);
            if (!r.optBoolean("ok")) return Result.success();
            String now = r.optString("now", null);
            JSONArray data = r.optJSONArray("data");
            String seen = p.getString("seen_ids", "");
            StringBuilder newSeen = new StringBuilder(seen);
            if (data != null && !MainActivity.inForeground) {
                for (int i = 0; i < data.length(); i++) {
                    JSONObject n = data.getJSONObject(i);
                    String nid = n.optString("id");
                    if (nid.isEmpty() || seen.contains(nid)) continue;
                    show(c, nid.hashCode(), n.optString("title"), n.optString("message"));
                    newSeen.append(nid).append(',');
                }
            }
            String s = newSeen.toString();
            if (s.length() > 4000) s = s.substring(s.length() - 3000);
            SharedPreferences.Editor e = p.edit().putString("seen_ids", s);
            if (now != null && !now.isEmpty()) e.putString("poll_after", now);
            e.apply();
            return Result.success();
        } catch (Exception e) {
            return Result.retry();
        }
    }
}
