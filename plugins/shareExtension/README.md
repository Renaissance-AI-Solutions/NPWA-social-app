# Share extension plugin for Expo

This plugin handles moving the necessary files into their respective iOS and Android targets and updating the build
phases, plists, manifests, etc.

## Steps

### ios

1. Update entitlements
2. Set the app group to group.<identifier>
3. Add the extension plist
4. Add the view controller
5. Update the xcode project's build phases

### android

1. Update the manifest with the intents the app can receive

## Credits

Adapted from https://github.com/andrew-levy/react-native-safari-extension and https://github.com/timedtext/expo-config-plugin-ios-share-extension/blob/master/src/withShareExtensionXcodeTarget.ts
