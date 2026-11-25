package shop.rozbazaar.twa;

import android.Manifest;
import android.annotation.SuppressLint;
import android.content.Context;
import android.content.pm.PackageManager;
import android.location.Location;
import android.location.LocationListener;
import android.location.LocationManager;
import android.os.Build;
import android.os.Bundle;
import android.os.Looper;

import androidx.core.content.ContextCompat;

import org.json.JSONObject;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Fast location for the website's navigator.geolocation (see rb-bridge.js).
 * The WebView's own location is slow to give a first reading. Here every provider the phone has
 * (fused, GPS, network) is asked at once, a fresh last-known reading (< 2 min old) is handed over
 * straight away, and every better reading follows; the website keeps the sharpest one.
 */
final class NativeGeo {
    interface Sink { void send(int id, String type, String json); }

    private final Context ctx;
    private final Sink sink;
    private final LocationManager lm;
    private final Map<Integer, List<LocationListener>> running = new HashMap<>();

    NativeGeo(Context ctx, Sink sink) {
        this.ctx = ctx;
        this.sink = sink;
        this.lm = (LocationManager) ctx.getSystemService(Context.LOCATION_SERVICE);
    }

    boolean permitted() {
        return ContextCompat.checkSelfPermission(ctx, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED
                || ContextCompat.checkSelfPermission(ctx, Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED;
    }

    private List<String> providers() {
        List<String> out = new ArrayList<>();
        if (lm == null) return out;
        if (Build.VERSION.SDK_INT >= 31 && lm.isProviderEnabled(LocationManager.FUSED_PROVIDER)) out.add(LocationManager.FUSED_PROVIDER);
        if (lm.isProviderEnabled(LocationManager.GPS_PROVIDER)) out.add(LocationManager.GPS_PROVIDER);
        if (lm.isProviderEnabled(LocationManager.NETWORK_PROVIDER)) out.add(LocationManager.NETWORK_PROVIDER);
        return out;
    }

    /** must run on the main thread */
    @SuppressLint("MissingPermission")
    void start(final int id, boolean high) {
        stop(id);
        if (!permitted()) { err(id, 1, "User denied Geolocation"); return; }
        List<String> provs = providers();
        if (provs.isEmpty()) { err(id, 2, "Location is turned off on this phone"); return; }

        // a fresh reading the phone already has: hand it over at once
        Location quick = null;
        for (String p : new String[]{"fused", LocationManager.GPS_PROVIDER, LocationManager.NETWORK_PROVIDER, LocationManager.PASSIVE_PROVIDER}) {
            try {
                Location l = lm.getLastKnownLocation(p);
                if (l == null) continue;
                long age = System.currentTimeMillis() - l.getTime();
                if (age > 120_000) continue;
                if (quick == null || l.getAccuracy() < quick.getAccuracy()) quick = l;
            } catch (Exception ignored) {}
        }
        if (quick != null) pos(id, quick);

        List<LocationListener> ls = new ArrayList<>();
        for (String p : provs) {
            if (!high && LocationManager.GPS_PROVIDER.equals(p) && provs.size() > 1) continue;
            LocationListener l = new LocationListener() {
                @Override public void onLocationChanged(Location loc) { pos(id, loc); }
                @Override public void onProviderEnabled(String s) {}
                @Override public void onProviderDisabled(String s) {}
                @Override public void onStatusChanged(String s, int i, Bundle b) {}
            };
            try {
                lm.requestLocationUpdates(p, 1000, 0f, l, Looper.getMainLooper());
                ls.add(l);
            } catch (Exception ignored) {}
        }
        if (ls.isEmpty()) { err(id, 2, "Location unavailable"); return; }
        running.put(id, ls);
    }

    void stop(int id) {
        List<LocationListener> ls = running.remove(id);
        if (ls == null || lm == null) return;
        for (LocationListener l : ls) { try { lm.removeUpdates(l); } catch (Exception ignored) {} }
    }

    void stopAll() {
        for (Integer id : new ArrayList<>(running.keySet())) stop(id);
    }

    private void pos(int id, Location l) {
        try {
            JSONObject o = new JSONObject();
            o.put("lat", l.getLatitude());
            o.put("lng", l.getLongitude());
            o.put("acc", l.hasAccuracy() ? l.getAccuracy() : 100);
            if (l.hasAltitude()) o.put("alt", l.getAltitude());
            if (l.hasBearing()) o.put("head", l.getBearing());
            if (l.hasSpeed()) o.put("speed", l.getSpeed());
            o.put("ts", l.getTime() > 0 ? l.getTime() : System.currentTimeMillis());
            sink.send(id, "pos", o.toString());
        } catch (Exception ignored) {}
    }

    private void err(int id, int code, String msg) {
        sink.send(id, "err", "{\"code\":" + code + ",\"message\":" + JSONObject.quote(msg) + "}");
    }
}
