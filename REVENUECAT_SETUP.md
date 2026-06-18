# RevenueCat Setup for Cliqzee

The app code is already wired to unlock paid features through the RevenueCat entitlement `cliqzee_plus`.

## App Store Connect

1. Open App Store Connect.
2. Go to `Cliqzee` > `Distribution` > `Subscriptions`.
3. Create a subscription group named `Cliqzee Plus`.
4. Add an auto-renewable subscription.
5. Suggested product ID: `cliqzee_plus_monthly`.
6. Add a display name, description, duration, and price.
7. Make sure Agreements, Tax, and Banking are complete, otherwise Apple products may not load in testing.

## RevenueCat

1. Create or open the Cliqzee project in RevenueCat.
2. Add the iOS app using bundle ID `com.ketantyagi.myFirstApp`.
3. Connect App Store Connect.
4. Import or create the product `cliqzee_plus_monthly`.
5. Create the entitlement `cliqzee_plus`.
6. Attach `cliqzee_plus_monthly` to the `cliqzee_plus` entitlement.
7. Create an Offering and mark it as the Default Offering.
8. Add a package to that Offering using the `cliqzee_plus_monthly` product.
9. Copy the RevenueCat Apple public SDK API key. It usually starts with `appl_`.

## EAS Environment Variable

Add this variable to the Expo/EAS project for the `production` environment:

```powershell
npx eas-cli env:create --name EXPO_PUBLIC_REVENUECAT_APPLE_API_KEY --value appl_your_key_here --environment production --visibility plaintext
```

Optional Android key for later:

```powershell
npx eas-cli env:create --name EXPO_PUBLIC_REVENUECAT_GOOGLE_API_KEY --value goog_your_key_here --environment production --visibility plaintext
```

## Build and Test

After the RevenueCat key is added:

```powershell
$env:EAS_NO_VCS='1'; npx eas-cli build --platform ios --profile production --non-interactive
$env:EAS_NO_VCS='1'; npx eas-cli submit --platform ios --profile production --latest --non-interactive
```

Real purchases must be tested in TestFlight or a development build. Expo Go can show the screens, but it cannot complete real native in-app purchases.
