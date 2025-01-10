module.exports = {
    pwa: {
        name: "Password Vault",
        start_url: ".",
        display: "standalone",
        orientation: "portrait",
        background_color: "#343541",
        themeColor: "#202A44",
        appleMobileWebAppCapable: 'yes',
        appleMobileWebAppStatusBarStyle: 'black',
        icons: [
            {
                src: "/img/icons/favicon-16x16.png",
                sizes: "16x16",
                type: "image/png"
            },
            {
                src: "/img/icons/favicon-32x32.png",
                sizes: "32x32",
                type: "image/png"
            },
            {
                src: "/img/icons/favicon-64x64.png",
                sizes: "64x64",
                type: "image/png"
            },
            {
                src: "/img/icons/apple-touch-icon.png",
                sizes: "32x32",
                type: "image/png"
            }
        ]
    }
}
module.exports = {
    pwa: {
        name: 'Password Vault',
        themeColor: '#202A44',
        msTileColor: '#000000',
        appleMobileWebAppCapable: 'yes',
        appleMobileWebAppStatusBarStyle: 'black-translucent',
        manifestOptions: {
            start_url: '.',
            display: 'standalone',
            orientation: "portrait",
            background_color: "#343541",
            short_name: "Vault",
            icons: [
                {
                    src: "/img/icons/favicon-16x16.png",
                    sizes: "16x16",
                    type: "image/png"
                },
                {
                    src: "/img/icons/favicon-32x32.png",
                    sizes: "32x32",
                    type: "image/png"
                },
                {
                    src: "/img/icons/favicon-64x64.png",
                    sizes: "64x64",
                    type: "image/png"
                },
                {
                    src: "/img/icons/apple-touch-icon.png",
                    sizes: "32x32",
                    type: "image/png"
                }
            ]
        }
    }
};