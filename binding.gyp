{
  "targets": [
    {
      "target_name": "ldap_native",
      "sources": ["native/addon.cc"],
      "win_delay_load_hook": "false",
      "include_dirs": [
        "<!@(node scripts/detect-openldap-paths.cjs include)"
      ],
      "defines": ["NAPI_CPP_EXCEPTIONS"],
      "cflags_cc!": ["-fno-exceptions"],
      "cflags_cc": ["-fexceptions", "-frtti"],
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
              "node_modules/node-addon-api"
            ],
            "libraries": ["-lldap", "-llber", "-lsasl2"],
            "library_dirs": [
              "<!@(node scripts/detect-openldap-paths.cjs lib)"
            ]
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
