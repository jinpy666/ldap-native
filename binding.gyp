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
          "OS=='win'",
          {
            "libraries": ["-lldap", "-llber", "-lsasl2"],
            "library_dirs": [
              "<!@(node scripts/detect-openldap-paths.cjs lib)"
            ],
            "msvs_settings": {
              "VCCLCompilerTool": {
                "AdditionalIncludeDirectories": [
                  "<!@(node scripts/detect-openldap-paths.cjs include)"
                ],
                "ExceptionHandling": "1",
                "RuntimeTypeInfo": "true"
              },
              "VCLinkerTool": {
                "AdditionalLibraryDirectories": [
                  "<!@(node scripts/detect-openldap-paths.cjs lib)"
                ]
              }
            }
          },
          {
            "libraries": ["-lldap", "-llber", "-lsasl2"]
          }
        ]
      ]
    }
  ]
}
