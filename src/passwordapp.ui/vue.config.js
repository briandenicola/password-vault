module.exports = {
    pwa: {
      appleMobileWebAppCapable: 'yes',
      appleMobileWebAppStatusBarStyle: 'black',
      short_name: "Vault",
      name: "Password Vault",
      start_url: ".",
      display: "standalone",
      orientation: "portrait",
      background_color: "#343541",
      theme_color: "#202A44",
      icons: [
        {
          "src": "/img/icons/favicon-16x16.png",
          "sizes": "16x16",
          "type": "image/png"
        },
        {
          "src": "/img/icons/favicon-32x32.png",
          "sizes": "32x32",
          "type": "image/png"
        },
        {
          "src": "/img/icons/favicon-64x64.png",
          "sizes": "64x64",
          "type": "image/png"
        },      
        {
          "src": "/img/icons/apple-touch-icon.png",
          "sizes": "32x32",
          "type": "image/png"
        }      
      ]      
    },
  }