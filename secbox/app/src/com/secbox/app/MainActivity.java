package com.secbox.app;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.webkit.JavascriptInterface;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

/**
 * SecBox 控制台：一个 WebView 壳，页面在 assets/index.html。
 * 通过 JS 桥调用：Termux 命令、内置浏览器、系统浏览器、Toast。
 */
public class MainActivity extends Activity {

    private WebView web;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        web = new WebView(this);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setAllowFileAccess(true);
        s.setAllowContentAccess(true);
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
        WebView.setWebContentsDebuggingEnabled(true);   // 电脑 chrome://inspect 可直接调试

        web.setWebViewClient(new WebViewClient());
        web.addJavascriptInterface(new Bridge(), "SecBox");
        setContentView(web);
        web.loadUrl("file:///android_asset/index.html");
    }

    @Override
    public void onBackPressed() {
        if (web != null && web.canGoBack()) {
            web.goBack();
            return;
        }
        super.onBackPressed();
    }

    private class Bridge {

        @JavascriptInterface
        public String termuxInstalled() {
            try {
                getPackageManager().getPackageInfo("com.termux", 0);
                return "1";
            } catch (Exception e) {
                return "0";
            }
        }

        @JavascriptInterface
        public void toast(final String msg) {
            runOnUiThread(new Runnable() {
                public void run() {
                    Toast.makeText(MainActivity.this, msg, Toast.LENGTH_SHORT).show();
                }
            });
        }

        @JavascriptInterface
        public void openUrl(final String url) {
            runOnUiThread(new Runnable() {
                public void run() {
                    if (web != null) web.loadUrl(url);
                }
            });
        }

        @JavascriptInterface
        public void openExternal(final String url) {
            runOnUiThread(new Runnable() {
                public void run() {
                    try {
                        startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url)));
                    } catch (Exception e) {
                        Toast.makeText(MainActivity.this, "没有可用的浏览器", Toast.LENGTH_SHORT).show();
                    }
                }
            });
        }

        /** 调用 Termux 的 RUN_COMMAND（需要 Termux + Termux:Tasker，且 allow-external-apps=true） */
        @JavascriptInterface
        public void runTermux(final String path, final String args) {
            runOnUiThread(new Runnable() {
                public void run() {
                    String[] argv = (args == null || args.trim().isEmpty())
                            ? new String[0]
                            : args.trim().split("\\s+");
                    Intent i = new Intent();
                    i.setClassName("com.termux", "com.termux.app.RunCommandService");
                    i.setAction("com.termux.RUN_COMMAND");
                    i.putExtra("com.termux.RUN_COMMAND_PATH", path);
                    i.putExtra("com.termux.RUN_COMMAND_ARGUMENTS", argv);
                    i.putExtra("com.termux.RUN_COMMAND_BACKGROUND", false);
                    try {
                        startService(i);
                    } catch (Exception e) {
                        Toast.makeText(MainActivity.this,
                                "调不起 Termux：需 Termux + Termux:Tasker + allow-external-apps",
                                Toast.LENGTH_LONG).show();
                    }
                }
            });
        }
    }
}
