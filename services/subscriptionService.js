import Constants from "expo-constants";
import { Platform } from "react-native";
import Purchases, { LOG_LEVEL } from "react-native-purchases";

const revenueCatConfig = Constants?.expoConfig?.extra?.revenueCat || {};
const FALLBACK_APPLE_API_KEY = "appl_uAy1AiUuhksrIgIDoUnqxskrNFM";

const ENTITLEMENT_ID = revenueCatConfig.entitlementId || "cliqzee_plus";
const ACCEPTED_ENTITLEMENT_IDS = [
  ENTITLEMENT_ID,
  "cliqzee_plus",
  "CLIQZEE PLUS",
  "CliqZee Plus",
  "cliqzee plus",
];

let configuredUserId = null;

function hasCliqzeePlusEntitlement(customerInfo) {
  const activeEntitlements = customerInfo?.entitlements?.active || {};
  return ACCEPTED_ENTITLEMENT_IDS.some((id) => !!activeEntitlements[id]);
}

function getApiKey() {
  if (Platform.OS === "ios") {
    return revenueCatConfig.appleApiKey || FALLBACK_APPLE_API_KEY;
  }

  if (Platform.OS === "android") {
    return revenueCatConfig.googleApiKey || "";
  }

  return "";
}

function ensureRevenueCatKey() {
  const apiKey = getApiKey();

  if (!apiKey || apiKey.includes("REPLACE_WITH")) {
    throw new Error(
      "RevenueCat API key is missing. Add EXPO_PUBLIC_REVENUECAT_APPLE_API_KEY to the EAS production environment, then make a new TestFlight build."
    );
  }

  if (apiKey.startsWith("test_")) {
    throw new Error(
      "RevenueCat is using a test API key. Replace it with the production iOS SDK key from RevenueCat, then make a new TestFlight build."
    );
  }

  return apiKey;
}

export async function configureRevenueCat(appUserId) {
  if (!appUserId) return false;
  if (configuredUserId === appUserId) return true;

  const apiKey = ensureRevenueCatKey();

  Purchases.setLogLevel(LOG_LEVEL.WARN);
  Purchases.configure({
    apiKey,
    appUserID: appUserId,
  });

  configuredUserId = appUserId;
  return true;
}

export async function isCliqzeePlusActive(appUserId) {
  await configureRevenueCat(appUserId);

  const customerInfo = await Purchases.getCustomerInfo();
  return hasCliqzeePlusEntitlement(customerInfo);
}

export async function getCliqzeePlusPackage(appUserId) {
  await configureRevenueCat(appUserId);

  const offerings = await Purchases.getOfferings();
  const currentOffering = offerings?.current;

  if (!currentOffering?.availablePackages?.length) {
    throw new Error("Cliqzee Plus is not available yet.");
  }

  return currentOffering.availablePackages[0];
}

export async function getCliqzeePlusPackages(appUserId) {
  await configureRevenueCat(appUserId);

  const offerings = await Purchases.getOfferings();
  const currentOffering = offerings?.current;

  if (!currentOffering?.availablePackages?.length) {
    return [];
  }

  return currentOffering.availablePackages;
}

export async function purchaseCliqzeePlus(appUserId, packageToBuy = null) {
  const selectedPackage = packageToBuy || (await getCliqzeePlusPackage(appUserId));
  const { customerInfo } = await Purchases.purchasePackage(selectedPackage);

  return hasCliqzeePlusEntitlement(customerInfo);
}

export async function restoreCliqzeePlus(appUserId) {
  await configureRevenueCat(appUserId);

  const customerInfo = await Purchases.restorePurchases();
  return hasCliqzeePlusEntitlement(customerInfo);
}

export function getRevenueCatSetupMessage() {
  return (
    "Create the Cliqzee Plus subscription in App Store Connect and RevenueCat, " +
    "then add the production EXPO_PUBLIC_REVENUECAT_APPLE_API_KEY to the EAS production environment."
  );
}

