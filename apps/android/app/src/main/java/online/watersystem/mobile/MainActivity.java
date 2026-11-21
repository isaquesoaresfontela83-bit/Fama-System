package online.watersystem.mobile;

import android.Manifest;
import android.app.Activity;
import android.app.AlertDialog;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.graphics.Insets;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Message;
import android.util.Base64;
import android.view.Gravity;
import android.view.View;
import android.view.WindowInsets;
import android.webkit.CookieManager;
import android.webkit.GeolocationPermissions;
import android.webkit.JsPromptResult;
import android.webkit.JsResult;
import android.webkit.PermissionRequest;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebMessage;
import android.webkit.WebMessagePort;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.webkit.URLUtil;
import android.widget.Button;
import android.widget.EditText;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.widget.Toast;

import org.json.JSONObject;

import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

public final class MainActivity extends Activity {
    private static final int CHOOSE_FILE = 101;
    private static final int SAVE_FILE = 102;
    private static final int MEDIA_PERMISSION = 103;
    private static final int LOCATION_PERMISSION = 104;
    private static final int MAX_BLOB_BYTES = 15 * 1024 * 1024;
    private WebView web;
    private View errorView;
    private Uri trustedOrigin;
    private ValueCallback<Uri[]> fileCallback;
    private PermissionRequest mediaRequest;
    private GeolocationPermissions.Callback geoCallback;
    private String geoOrigin;
    private byte[] fileBytes;
    private String fileUrl;
    private String fileCookie;
    private String fileAgent;
    private boolean saving;

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        Uri home = Uri.parse(getString(R.string.home_url));
        trustedOrigin = Uri.parse(home.getScheme() + "://" + home.getHost());
        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(Color.rgb(8, 23, 44));
        if (Build.VERSION.SDK_INT >= 35) {
            root.setOnApplyWindowInsetsListener((v, insets) -> {
                Insets bars = insets.getInsets(WindowInsets.Type.systemBars() | WindowInsets.Type.displayCutout());
                Insets keyboard = insets.getInsets(WindowInsets.Type.ime());
                v.setPadding(bars.left, bars.top, bars.right, Math.max(bars.bottom, keyboard.bottom));
                return insets;
            });
        }
        setContentView(root);
        web = new WebView(this);
        web.setBackgroundColor(Color.rgb(8, 23, 44));
        WebSettings settings = web.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setJavaScriptCanOpenWindowsAutomatically(true);
        settings.setSupportMultipleWindows(true);
        settings.setAllowFileAccess(false);
        // Android's document picker supplies content: URIs for user-selected uploads.
        settings.setAllowContentAccess(true);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setMediaPlaybackRequiresUserGesture(true);
        settings.setGeolocationEnabled(true);
        CookieManager.getInstance().setAcceptCookie(true);
        CookieManager.getInstance().setAcceptThirdPartyCookies(web, false);
        web.setWebViewClient(new MainClient());
        web.setWebChromeClient(new BrowserChrome());
        web.setDownloadListener((url, agent, disposition, mime, length) -> {
            if (!isTrusted(web.getUrl())) return;
            String name = cleanName(URLUtil.guessFileName(url, disposition, mime));
            if (url.startsWith("blob:")) {
                saveBlob(url, name, mime);
            } else if (isTrusted(url)) {
                saveNetworkFile(url, name, mime, agent);
            } else {
                openExternal(Uri.parse(url));
            }
        });
        root.addView(web, new FrameLayout.LayoutParams(-1, -1));
        errorView = makeErrorView();
        errorView.setVisibility(View.GONE);
        root.addView(errorView, new FrameLayout.LayoutParams(-1, -1));
        if (state != null) web.restoreState(state);
        if (web.getUrl() == null) web.loadUrl(getString(R.string.home_url));
    }

    private View makeErrorView() {
        LinearLayout box = new LinearLayout(this);
        box.setOrientation(LinearLayout.VERTICAL);
        box.setGravity(Gravity.CENTER);
        box.setPadding(40, 40, 40, 40);
        box.setBackgroundColor(Color.rgb(8, 23, 44));
        TextView message = new TextView(this);
        message.setText("Não foi possível carregar o sistema. Confira sua conexão com a internet.");
        message.setTextColor(Color.WHITE);
        message.setTextSize(17);
        message.setGravity(Gravity.CENTER);
        box.addView(message);
        Button retry = new Button(this);
        retry.setText("Tentar novamente");
        retry.setOnClickListener(v -> { errorView.setVisibility(View.GONE); web.reload(); });
        box.addView(retry);
        return box;
    }

    private boolean isTrusted(String url) {
        if (url == null) return false;
        Uri uri = Uri.parse(url);
        return "https".equalsIgnoreCase(uri.getScheme())
                && trustedOrigin.getHost().equalsIgnoreCase(uri.getHost())
                && uri.getUserInfo() == null && (uri.getPort() == -1 || uri.getPort() == 443);
    }

    private void openExternal(Uri uri) {
        String scheme = uri.getScheme() == null ? "" : uri.getScheme().toLowerCase(Locale.ROOT);
        if (!(scheme.equals("https") || scheme.equals("http") || scheme.equals("mailto")
                || scheme.equals("tel") || scheme.equals("sms") || scheme.equals("geo")
                || scheme.equals("whatsapp") || scheme.equals("market"))) return;
        try { startActivity(new Intent(Intent.ACTION_VIEW, uri).addCategory(Intent.CATEGORY_BROWSABLE)); }
        catch (ActivityNotFoundException e) { toast("Nenhum aplicativo encontrado para abrir este link."); }
    }

    private boolean route(String url) {
        if (isTrusted(url)) return false;
        if (url != null) openExternal(Uri.parse(url));
        return true;
    }

    private final class MainClient extends WebViewClient {
        @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
            return request.isForMainFrame() && route(request.getUrl().toString());
        }
        @Override public void onPageStarted(WebView view, String url, android.graphics.Bitmap icon) {
            errorView.setVisibility(View.GONE);
        }
        @Override public void onReceivedError(WebView view, WebResourceRequest req, WebResourceError error) {
            if (req.isForMainFrame()) errorView.setVisibility(View.VISIBLE);
        }
    }

    private final class BrowserChrome extends WebChromeClient {
        @Override public boolean onJsAlert(WebView view, String url, String message, JsResult result) {
            if (!isTrusted(url)) { result.cancel(); return true; }
            new AlertDialog.Builder(MainActivity.this).setMessage(message)
                    .setPositiveButton("OK", (dialog, which) -> result.confirm())
                    .setOnCancelListener(dialog -> result.cancel()).show();
            return true;
        }
        @Override public boolean onJsConfirm(WebView view, String url, String message, JsResult result) {
            if (!isTrusted(url)) { result.cancel(); return true; }
            new AlertDialog.Builder(MainActivity.this).setMessage(message)
                    .setPositiveButton("Confirmar", (dialog, which) -> result.confirm())
                    .setNegativeButton("Cancelar", (dialog, which) -> result.cancel())
                    .setOnCancelListener(dialog -> result.cancel()).show();
            return true;
        }
        @Override public boolean onJsPrompt(WebView view, String url, String message, String defaultValue, JsPromptResult result) {
            if (!isTrusted(url)) { result.cancel(); return true; }
            EditText input = new EditText(MainActivity.this);
            input.setText(defaultValue);
            new AlertDialog.Builder(MainActivity.this).setMessage(message).setView(input)
                    .setPositiveButton("Confirmar", (dialog, which) -> result.confirm(input.getText().toString()))
                    .setNegativeButton("Cancelar", (dialog, which) -> result.cancel())
                    .setOnCancelListener(dialog -> result.cancel()).show();
            return true;
        }
        @Override public boolean onCreateWindow(WebView view, boolean dialog, boolean userGesture, Message result) {
            if (!userGesture) return false;
            WebView popup = new WebView(MainActivity.this);
            popup.setWebViewClient(new WebViewClient() {
                @Override public boolean shouldOverrideUrlLoading(WebView unused, WebResourceRequest request) {
                    if (request.isForMainFrame()) {
                        String url = request.getUrl().toString();
                        if (isTrusted(url)) web.loadUrl(url); else openExternal(request.getUrl());
                        popup.post(popup::destroy);
                    }
                    return true;
                }
            });
            ((WebView.WebViewTransport) result.obj).setWebView(popup);
            result.sendToTarget();
            return true;
        }
        @Override public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
            if (!isTrusted(view.getUrl())) return false;
            if (fileCallback != null) fileCallback.onReceiveValue(null);
            fileCallback = callback;
            try { startActivityForResult(params.createIntent(), CHOOSE_FILE); }
            catch (ActivityNotFoundException e) { fileCallback = null; callback.onReceiveValue(null); toast("Não foi possível abrir os arquivos."); }
            return true;
        }
        @Override public void onPermissionRequest(PermissionRequest request) {
            if (!isTrusted(request.getOrigin().toString()) || mediaRequest != null || geoCallback != null) {
                request.deny(); return;
            }
            List<String> required = new ArrayList<>();
            for (String resource : request.getResources()) {
                String permission = null;
                if (PermissionRequest.RESOURCE_VIDEO_CAPTURE.equals(resource)) permission = Manifest.permission.CAMERA;
                if (PermissionRequest.RESOURCE_AUDIO_CAPTURE.equals(resource)) permission = Manifest.permission.RECORD_AUDIO;
                if (permission != null && checkSelfPermission(permission) != PackageManager.PERMISSION_GRANTED && !required.contains(permission)) required.add(permission);
            }
            mediaRequest = request;
            if (required.isEmpty()) finishMediaRequest();
            else requestPermissions(required.toArray(new String[0]), MEDIA_PERMISSION);
        }
        @Override public void onPermissionRequestCanceled(PermissionRequest request) {
            if (mediaRequest == request) mediaRequest = null;
        }
        @Override public void onGeolocationPermissionsShowPrompt(String origin, GeolocationPermissions.Callback callback) {
            if (!isTrusted(origin) || geoCallback != null || mediaRequest != null) { callback.invoke(origin, false, false); return; }
            if (hasLocation()) { callback.invoke(origin, true, false); return; }
            geoCallback = callback;
            geoOrigin = origin;
            requestPermissions(new String[]{Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION}, LOCATION_PERMISSION);
        }
    }

    private boolean hasLocation() {
        return checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED
                || checkSelfPermission(Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED;
    }
    private void finishMediaRequest() {
        if (mediaRequest == null) return;
        List<String> allowed = new ArrayList<>();
        for (String resource : mediaRequest.getResources()) {
            if (PermissionRequest.RESOURCE_VIDEO_CAPTURE.equals(resource) && checkSelfPermission(Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED) allowed.add(resource);
            if (PermissionRequest.RESOURCE_AUDIO_CAPTURE.equals(resource) && checkSelfPermission(Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED) allowed.add(resource);
        }
        if (allowed.isEmpty()) mediaRequest.deny(); else mediaRequest.grant(allowed.toArray(new String[0]));
        mediaRequest = null;
    }
    @Override public void onRequestPermissionsResult(int code, String[] permissions, int[] results) {
        super.onRequestPermissionsResult(code, permissions, results);
        if (code == MEDIA_PERMISSION) finishMediaRequest();
        if (code == LOCATION_PERMISSION && geoCallback != null) {
            geoCallback.invoke(geoOrigin, hasLocation(), false);
            geoCallback = null; geoOrigin = null;
        }
    }

    private static String cleanName(String name) {
        if (name == null || name.isEmpty()) return "arquivo";
        name = name.replaceAll("[\\\\/\\p{Cntrl}]", "_");
        return name.length() > 120 ? name.substring(name.length() - 120) : name;
    }
    private static String safeMime(String mime) {
        return mime != null && mime.matches("[A-Za-z0-9.+-]+/[A-Za-z0-9.+-]+") ? mime : "application/octet-stream";
    }
    private void requestSave(String name, String mime) {
        try {
            Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE);
            intent.setType(safeMime(mime));
            intent.putExtra(Intent.EXTRA_TITLE, cleanName(name));
            startActivityForResult(intent, SAVE_FILE);
        } catch (ActivityNotFoundException e) { clearPendingFile(); toast("Não foi possível salvar o arquivo neste aparelho."); }
    }
    private void clearPendingFile() { fileBytes = null; fileUrl = null; fileCookie = null; fileAgent = null; saving = false; }
    private void saveNetworkFile(String url, String name, String mime, String agent) {
        if (saving) { toast("Aguarde o arquivo atual terminar."); return; }
        saving = true;
        fileUrl = url;
        fileCookie = CookieManager.getInstance().getCookie(url);
        fileAgent = agent;
        requestSave(name, mime);
    }

    private void saveBlob(String url, String name, String mime) {
        if (saving) { toast("Aguarde o arquivo atual terminar."); return; }
        saving = true;
        String nonce = UUID.randomUUID().toString();
        WebMessagePort[] ports = web.createWebMessageChannel();
        ports[0].setWebMessageCallback(new WebMessagePort.WebMessageCallback() {
            @Override public void onMessage(WebMessagePort port, WebMessage message) {
                port.close();
                try {
                    JSONObject payload = new JSONObject(message.getData());
                    if (payload.has("error")) throw new IllegalArgumentException("Não foi possível preparar o arquivo.");
                    String data = payload.getString("data");
                    int comma = data.indexOf(',');
                    if (comma < 0 || data.length() > MAX_BLOB_BYTES * 2L) throw new IllegalArgumentException("Arquivo muito grande.");
                    fileBytes = Base64.decode(data.substring(comma + 1), Base64.DEFAULT);
                    if (fileBytes.length > MAX_BLOB_BYTES) throw new IllegalArgumentException("Arquivo muito grande.");
                    requestSave(name, payload.optString("type", mime));
                } catch (Exception e) { clearPendingFile(); toast("Não foi possível preparar este arquivo para download."); }
            }
        });
        String script = "(function(){const n=" + JSONObject.quote(nonce) + ";const u=" + JSONObject.quote(url)
                + ";window.addEventListener('message',function h(e){if(e.data!==n||!e.ports||!e.ports[0])return;window.removeEventListener('message',h);const p=e.ports[0];"
                + "fetch(u).then(r=>r.blob()).then(b=>{if(b.size>" + MAX_BLOB_BYTES + ")throw Error('large');const f=new FileReader();"
                + "f.onload=()=>p.postMessage(JSON.stringify({data:f.result,type:b.type}));f.onerror=()=>p.postMessage(JSON.stringify({error:'read'}));f.readAsDataURL(b);})"
                + ".catch(()=>p.postMessage(JSON.stringify({error:'fetch'})));});})();";
        web.evaluateJavascript(script, ignored -> {
            if (isTrusted(web.getUrl())) web.postWebMessage(new WebMessage(nonce, new WebMessagePort[]{ports[1]}), trustedOrigin);
            else { ports[0].close(); ports[1].close(); clearPendingFile(); }
        });
    }

    @Override protected void onActivityResult(int request, int result, Intent data) {
        super.onActivityResult(request, result, data);
        if (request == CHOOSE_FILE && fileCallback != null) {
            fileCallback.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(result, data));
            fileCallback = null;
        } else if (request == SAVE_FILE) {
            if (result != RESULT_OK || data == null || data.getData() == null) { clearPendingFile(); return; }
            Uri destination = data.getData();
            byte[] bytes = fileBytes;
            String url = fileUrl, cookie = fileCookie, agent = fileAgent;
            new Thread(() -> writeFile(destination, bytes, url, cookie, agent)).start();
        }
    }
    private void writeFile(Uri destination, byte[] bytes, String url, String cookie, String agent) {
        try {
            InputStream input = null;
            HttpURLConnection connection = null;
            if (bytes == null) {
                URL current = new URL(url);
                for (int i = 0; i < 6; i++) {
                    if (!isTrusted(current.toString())) throw new SecurityException("Destino externo");
                    connection = (HttpURLConnection) current.openConnection();
                    connection.setInstanceFollowRedirects(false);
                    connection.setConnectTimeout(20000); connection.setReadTimeout(30000);
                    if (cookie != null) connection.setRequestProperty("Cookie", cookie);
                    if (agent != null) connection.setRequestProperty("User-Agent", agent);
                    int status = connection.getResponseCode();
                    if (status >= 300 && status < 400) {
                        String next = connection.getHeaderField("Location");
                        connection.disconnect();
                        if (next == null) throw new IllegalStateException("Redirecionamento inválido");
                        current = new URL(current, next); connection = null; continue;
                    }
                    if (status < 200 || status >= 300) throw new IllegalStateException("Download indisponível");
                    input = connection.getInputStream(); break;
                }
                if (input == null) throw new IllegalStateException("Download indisponível");
            }
            try (InputStream source = input; OutputStream output = getContentResolver().openOutputStream(destination)) {
                if (output == null) throw new IllegalStateException("Destino indisponível");
                if (bytes != null) output.write(bytes);
                else { byte[] buffer = new byte[16384]; int n; while ((n = source.read(buffer)) != -1) output.write(buffer, 0, n); }
            } finally { if (connection != null) connection.disconnect(); }
            runOnUiThread(() -> { clearPendingFile(); toast("Arquivo salvo."); });
        } catch (Exception e) {
            try { getContentResolver().delete(destination, null, null); } catch (Exception ignored) { }
            runOnUiThread(() -> { clearPendingFile(); toast("Não foi possível salvar o arquivo. Tente novamente."); });
        }
    }
    private void toast(String message) { Toast.makeText(this, message, Toast.LENGTH_LONG).show(); }

    @Override protected void onSaveInstanceState(Bundle out) { super.onSaveInstanceState(out); web.saveState(out); }
    @Override public void onBackPressed() { if (errorView.getVisibility() == View.VISIBLE) errorView.setVisibility(View.GONE); else if (web.canGoBack()) web.goBack(); else super.onBackPressed(); }
    @Override protected void onDestroy() {
        if (fileCallback != null) fileCallback.onReceiveValue(null);
        if (mediaRequest != null) mediaRequest.deny();
        if (geoCallback != null) geoCallback.invoke(geoOrigin, false, false);
        web.destroy();
        super.onDestroy();
    }
}
