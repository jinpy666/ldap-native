{
  "targets": [
    {
      "target_name": "ldap_native",
      "sources": ["native/addon.cc"],
      "include_dirs": ["<!@(node -p \"require('node-addon-api').include\")"],
      "dependencies": ["<!(node -p \"require('node-addon-api').gyp\")"],
      "defines": ["NAPI_CPP_EXCEPTIONS"],
      "cflags_cc!": ["-fno-exceptions"],
      "conditions": [
        [
          "OS=='win'",
          {
            "libraries": ["-lldap", "-llber", "-lsasl2"]
          },
          {
            "libraries": ["-lldap", "-llber", "-lsasl2"]
          }
        ]
      ]
    }
  ]
}
