{
  "targets": [
    {
      "target_name": "ldap_native",
      "sources": ["native/addon.cc"],
      "include_dirs": [
        "<!@(node -p \"require('node-addon-api').include\")",
        "<!@(node scripts/detect-openldap-paths.cjs include)"
      ],
      "dependencies": ["<!(node -p \"require('node-addon-api').gyp\")"],
      "defines": ["NAPI_CPP_EXCEPTIONS"],
      "cflags_cc!": ["-fno-exceptions"],
      "cflags_cc": ["-fexceptions", "-frtti"],
      "conditions": [
        [
          "OS=='mac'",
          {
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
            "libraries": ["-lldap", "-llber", "-lsasl2"],
            "library_dirs": [
              "<!@(node scripts/detect-openldap-paths.cjs lib)"
            ]
          }
        ],
        [
          "OS!='win' and OS!='mac'",
          {
            "libraries": ["-lldap", "-llber", "-lsasl2"]
          }
        ]
      ]
    }
  ]
}
