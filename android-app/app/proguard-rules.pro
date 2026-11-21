# Methods called from the web page through the RBNative bridge
-keepclassmembers class shop.rozbazaar.twa.WebBridge {
    @android.webkit.JavascriptInterface <methods>;
}
-keepattributes JavascriptInterface
