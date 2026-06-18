import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import { Platform } from "react-native";

import { savePushToken } from "./userService";

export const registerForPushNotificationsAsync = async (uid) => {
  try {
    if (!uid) return null;

    // VERY IMPORTANT: do not register push token on web/laptop
    if (Platform.OS === "web") {
      console.log("🌐 Web detected - skipping push token registration");
      return null;
    }

    const { status: existingStatus } =
      await Notifications.getPermissionsAsync();

    let finalStatus = existingStatus;

    if (existingStatus !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== "granted") {
      console.log("❌ Push permission not granted");
      return null;
    }

    const projectId =
      Constants?.expoConfig?.extra?.eas?.projectId ||
      Constants?.easConfig?.projectId;

    if (!projectId) {
      console.log("❌ Missing EAS projectId");
      return null;
    }

    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId,
    });

    const pushToken = tokenData?.data;

    if (
      typeof pushToken !== "string" ||
      !pushToken.startsWith("ExponentPushToken[") ||
      !pushToken.endsWith("]")
    ) {
      console.log("❌ Invalid generated push token:", pushToken);
      return null;
    }

    console.log("✅ Expo push token:", pushToken);

    await savePushToken(uid, pushToken);

    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("cliqzee", {
        name: "Cliqzee",
        importance: Notifications.AndroidImportance.MAX,
        sound: "notification_whistle.wav",
        vibrationPattern: [0, 250, 250, 250],
        lightColor: "#111111",
      });
    }

    return pushToken;
  } catch (error) {
    console.log("❌ Register push error:", error.message);
    return null;
  }
};
