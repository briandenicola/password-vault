module.exports = {
    pwa: {
        name: "Password Vault",
        themeColor: "#202A44",
        msTileColor: "#202A44",
        appleMobileWebAppCapable: "yes",
        appleMobileWebAppStatusBarStyle: "black",
        // Web app manifest (manifest.json). These options — not the top-level
        // `icons`/`start_url` keys — are what actually populate manifest.json, so
        // the install icon, splash colour and standalone display come from here.
        manifestOptions: {
            name: "Password Vault",
            short_name: "Vault",
            description: "Secure family password vault — store and generate account credentials.",
            id: "/",
            start_url: ".",
            scope: ".",
            display: "standalone",
            orientation: "portrait",
            lang: "en",
            categories: ["productivity", "utilities"],
            theme_color: "#202A44",
            background_color: "#343541",
            icons: [
                { src: "./img/icons/android-chrome-192x192.png", sizes: "192x192", type: "image/png", purpose: "any" },
                { src: "./img/icons/android-chrome-512x512.png", sizes: "512x512", type: "image/png", purpose: "any" },
                { src: "./img/icons/android-chrome-maskable-192x192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
                { src: "./img/icons/android-chrome-maskable-512x512.png", sizes: "512x512", type: "image/png", purpose: "maskable" }
            ]
        },
        // HTML <link>/<meta> icon tags (favicons + iOS home-screen icon).
        iconPaths: {
            faviconSVG: null,
            favicon32: "img/icons/favicon-32x32.png",
            favicon16: "img/icons/favicon-16x16.png",
            appleTouchIcon: "img/icons/apple-touch-icon.png",
            maskIcon: null,
            msTileImage: "img/icons/android-chrome-192x192.png"
        },
        workboxOptions: {
            // We surface an in-app "update available" prompt that posts SKIP_WAITING,
            // so the new worker waits until the user opts in rather than taking over
            // mid-session. clientsClaim + cleanupOutdatedCaches keep things tidy.
            skipWaiting: false,
            clientsClaim: true,
            cleanupOutdatedCaches: true
        }
    }
};
