import { Platform } from "react-native";
import Constants from "expo-constants";
import {
  addDoc,
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
} from "firebase/firestore";

import { auth, db } from "../firebaseConfig";
import { isCurrentUserAdmin } from "./userService";

let isLoggingError = false;

function cleanString(value, maxLength = 4000) {
  if (!value) return "";
  return String(value).slice(0, maxLength);
}

function serializeError(error) {
  if (!error) {
    return {
      name: "UnknownError",
      message: "Unknown error",
      stack: "",
    };
  }

  return {
    name: cleanString(error.name || "Error", 120),
    message: cleanString(error.message || String(error), 1000),
    stack: cleanString(error.stack || "", 6000),
  };
}

export async function logAppError(error, context = {}) {
  try {
    if (isLoggingError) return;

    const user = auth.currentUser;
    const serializedError = serializeError(error);

    isLoggingError = true;

    await addDoc(collection(db, "appErrors"), {
      ...serializedError,
      context,
      userId: user?.uid || "",
      userEmail: user?.email || "",
      platform: Platform.OS,
      appVersion: Constants?.expoConfig?.version || "",
      iosBuildNumber: Constants?.expoConfig?.ios?.buildNumber || "",
      androidVersionCode: Constants?.expoConfig?.android?.versionCode || "",
      createdAt: serverTimestamp(),
    });
  } catch (logError) {
    console.log("logAppError failed:", logError?.message || logError);
  } finally {
    isLoggingError = false;
  }
}

export function installGlobalErrorTracking() {
  if (global.__cliqzeeErrorTrackingInstalled) return;

  global.__cliqzeeErrorTrackingInstalled = true;

  const defaultHandler = global.ErrorUtils?.getGlobalHandler?.();

  global.ErrorUtils?.setGlobalHandler?.((error, isFatal) => {
    logAppError(error, {
      source: "global",
      isFatal: !!isFatal,
    });

    if (typeof defaultHandler === "function") {
      defaultHandler(error, isFatal);
    }
  });
}

export async function getAdminAppErrors(currentUserId, count = 50) {
  const allowed = await isCurrentUserAdmin(currentUserId);
  if (!allowed) throw new Error("Admin access only.");

  const errorsQuery = query(
    collection(db, "appErrors"),
    orderBy("createdAt", "desc"),
    limit(count)
  );

  const snapshot = await getDocs(errorsQuery);

  return snapshot.docs.map((docItem) => ({
    id: docItem.id,
    ...docItem.data(),
  }));
}
