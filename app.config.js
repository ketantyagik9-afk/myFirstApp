const { expo } = require("./app.json");

const revenueCat = expo.extra?.revenueCat || {};
const PRODUCTION_REVENUECAT_APPLE_API_KEY =
  "appl_uAy1AiUuhksrIgIDoUnqxskrNFM";

function getRevenueCatAppleApiKey() {
  const envKey = process.env.EXPO_PUBLIC_REVENUECAT_APPLE_API_KEY;

  if (envKey && !envKey.startsWith("test_")) {
    return envKey;
  }

  return revenueCat.appleApiKey || PRODUCTION_REVENUECAT_APPLE_API_KEY;
}

module.exports = () => ({
  ...expo,
  extra: {
    ...expo.extra,
    revenueCat: {
      ...revenueCat,
      entitlementId:
        process.env.EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ID ||
        revenueCat.entitlementId ||
        "cliqzee_plus",
      appleApiKey: getRevenueCatAppleApiKey(),
      googleApiKey:
        process.env.EXPO_PUBLIC_REVENUECAT_GOOGLE_API_KEY ||
        revenueCat.googleApiKey ||
        "",
    },
  },
});
