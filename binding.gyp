{
  "targets": [
    {
      "target_name": "ldap_native",
      "sources": ["native/addon.cc"],
      "win_delay_load_hook": "true",
      "include_dirs": [
        "<!@(node scripts/detect-openldap-paths.cjs include)"
      ],
      "defines": ["NAPI_CPP_EXCEPTIONS"],
      "cflags_cc!": ["-fno-exceptions"],
      "cflags_cc": ["-fexceptions", "-frtti"],
      "msvs_settings": {
        "VCCLCompilerTool": {
          "ExceptionHandling": 1,
          "RuntimeTypeInfo": "true"
        }
      },
      "conditions": [
        [
          "OS=='mac'",
          {
            "include_dirs": [
              "<!@(node -p \"require('node-addon-api').include\")"
            ],
            "dependencies": ["<!(node -p \"require('node-addon-api').gyp\")"],
            "libraries": [
              "<!@(node scripts/detect-openldap-paths.cjs libs)",
              "-lsasl2"
            ],
            "library_dirs": [
              "<!@(node scripts/detect-openldap-paths.cjs lib)"
            ]
          }
        ],
        [
          "OS=='win'",
          {
            "include_dirs": [
              "<!@(node -p \"require('node-addon-api').include\")"
            ],
            "dependencies": ["<!(node -p \"require('node-addon-api').gyp\")"],
            "libraries": ["Wldap32.lib", "Crypt32.lib"]
          }
        ],
        [
          "OS!='win' and OS!='mac'",
          {
            "include_dirs": [
              "<!@(node -p \"require('node-addon-api').include\")"
            ],
            "dependencies": ["<!(node -p \"require('node-addon-api').gyp\")"],
            "libraries": ["-lldap", "-llber", "-lsasl2"]
          }
        ]
      ]
    }
  ]
}
