# Cordova Plugin for MABS Debug Symbols

This Cordova plugin automates the upload of iOS debug symbols (dSYM files) after a build. It is designed for use with MABS (Mobile Application Build Service) where debug symbols need to be uploaded to a remote server for crash reporting and debugging.

## Features

- Automatically detects and locates dSYM files in Xcode's DerivedData directory after an iOS build.
- Zips the dSYM file for efficient transfer.
- Uploads the zipped dSYM to a configurable remote server using multipart upload with retry logic.
- Configurable via plugin variables in the project's `package.json`.

## Installation

Add the plugin to your Cordova project:

```bash
cordova plugin add cordova-plugin-mabsdebugsymbols
```

Or, if installing from a local directory:

```bash
cordova plugin add /path/to/cordova-plugin-mabsdebugsymbols
```

## Configuration

Configure the plugin by adding variables to the `cordova.plugins` section in your project's `package.json`:

```json
{
  "cordova": {
    "plugins": {
      "cordova-plugin-mabsdebugsymbols": {
        "ENABLED": "true",
        "BASEURL": "https://your-upload-server.com/api",
        "USERNAME": "your-username",
        "PASSWORD": "your-password"
      }
    }
  }
}
```

- `ENABLED`: Set to `"true"` to enable the plugin. If not set or false, the plugin will skip execution.
- `BASEURL`: The base URL of the upload server (e.g., the API endpoint for uploads).
- `USERNAME`: Username for authentication with the upload server.
- `PASSWORD`: Password for authentication with the upload server.

## How It Works

1. After an iOS build, the `after_build.js` hook checks if the iOS platform is included.
2. It retrieves the app name from `config.xml`.
3. Locates the dSYM file in the Xcode DerivedData directory based on the app name and build type (debug/release).
4. Zips the dSYM file.
5. Calls the `upload.js` module to perform a multipart upload to the configured server.
6. The upload uses chunked transfer (10 MB chunks) with retry logic for reliability.

## Requirements

- Cordova project with iOS platform added.
- Xcode and iOS build environment.
- Access to a server that supports multipart uploads (e.g., compatible with AWS S3 multipart upload API or similar).

## Troubleshooting

- Ensure the plugin is enabled and all required variables are set in `package.json`.
- Check console logs for errors during build (e.g., dSYM not found, upload failures).
- Verify network access to the upload server.
- For debug builds, the plugin looks in `Debug-iphoneos`; for release, `Release-iphoneos`.