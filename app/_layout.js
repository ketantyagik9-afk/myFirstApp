import { Stack, router } from "expo-router";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { AppState } from "react-native";

import * as Notifications from "expo-notifications";
import { useEffect, useRef } from "react";
import { onAuthStateChanged } from "firebase/auth";

import { auth } from "../firebaseConfig";
import { registerForPushNotificationsAsync } from "../services/notificationService";
import { playNotificationWhistle } from "../services/soundService";
import { updateUserOnlineStatus } from "../services/userService";
import {
  installGlobalErrorTracking,
  logAppError,
} from "../services/errorService";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

export default function RootLayout() {
  const appStateRef = useRef(AppState.currentState);
  const heartbeatRef = useRef(null);
  const handledNotificationRef = useRef("");

  useEffect(() => {
    installGlobalErrorTracking();

    const setOnline = async () => {
      try {
        if (auth.currentUser?.uid) {
          await updateUserOnlineStatus(auth.currentUser.uid, true);
        }
      } catch (error) {
        logAppError(error, { source: "root-layout", action: "setOnline" });
        console.log("Set online error:", error.message);
      }
    };

    const setOffline = async () => {
      try {
        if (auth.currentUser?.uid) {
          await updateUserOnlineStatus(auth.currentUser.uid, false);
        }
      } catch (error) {
        logAppError(error, { source: "root-layout", action: "setOffline" });
        console.log("Set offline error:", error.message);
      }
    };

    const startHeartbeat = () => {
      if (heartbeatRef.current) return;

      heartbeatRef.current = setInterval(() => {
        setOnline();
      }, 90000);
    };

    const stopHeartbeat = () => {
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current);
        heartbeatRef.current = null;
      }
    };

    const authUnsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user?.uid) {
        await registerForPushNotificationsAsync(user.uid);
        await updateUserOnlineStatus(user.uid, true);
        startHeartbeat();
      } else {
        stopHeartbeat();
      }
    }, (error) => {
      logAppError(error, { source: "auth-state-listener" });
    });

    const appStateSubscription = AppState.addEventListener(
      "change",
      async (nextAppState) => {
        const previousState = appStateRef.current;
        appStateRef.current = nextAppState;

        if (
          previousState.match(/inactive|background/) &&
          nextAppState === "active"
        ) {
          await setOnline();
          startHeartbeat();
        }

        if (nextAppState.match(/inactive|background/)) {
          stopHeartbeat();
          await setOffline();
        }
      }
    );

    const receivedListener =
      Notifications.addNotificationReceivedListener((notification) => {
        console.log("🔔 Notification received:", notification);
        playNotificationWhistle();
      });

    const openNotificationTarget = (response) => {
        console.log("👉 Notification tapped:", response);

        const notificationId = response?.notification?.request?.identifier;

        if (
          notificationId &&
          handledNotificationRef.current === notificationId
        ) {
          return;
        }

        if (notificationId) {
          handledNotificationRef.current = notificationId;
        }

        const data = response?.notification?.request?.content?.data || {};
        const notificationType = data?.type || "";
        const notificationRoute = data?.route || "";

        if (
          (notificationType === "chat" ||
            notificationType === "message" ||
            notificationType === "match" ||
            notificationRoute === "chat") &&
          data?.chatId
        ) {
          router.push(
            `/chat?chatId=${encodeURIComponent(
              data.chatId
            )}&name=${encodeURIComponent(
              data.name || "User"
            )}&photoURL=${encodeURIComponent(data.photoURL || "")}`
          );
          return;
        }

        if (
          notificationType === "liked-you" ||
          notificationType === "connection" ||
          notificationRoute === "connections"
        ) {
          router.push("/liked-you");
          return;
        }

        if (
          notificationType === "plan-join" ||
          notificationType === "plan" ||
          notificationRoute === "plans"
        ) {
          router.push("/my-plans");
          return;
        }

        if (data?.userId) {
          router.push(
            `/user-profile?userId=${encodeURIComponent(data.userId)}`
          );
          return;
        }

        router.push("/notifications");
      };

    Notifications.getLastNotificationResponseAsync()
      .then((response) => {
        if (response) {
          openNotificationTarget(response);
        }
      })
      .catch((error) => {
        logAppError(error, {
          source: "notification",
          action: "getLastNotificationResponse",
        });
        console.log("Last notification response error:", error.message);
      });

    const responseListener =
      Notifications.addNotificationResponseReceivedListener(
        openNotificationTarget
      );

    return () => {
      stopHeartbeat();
      setOffline();

      authUnsubscribe();
      appStateSubscription.remove();
      receivedListener.remove();
      responseListener.remove();
    };
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="login" />
        <Stack.Screen name="signup" />
        <Stack.Screen name="profile-setup" />
        <Stack.Screen name="terms" />
        <Stack.Screen name="privacy" />
        <Stack.Screen name="guidelines" />
        <Stack.Screen name="admin" />
        <Stack.Screen name="admin-errors" />
        <Stack.Screen name="admin-reports" />
        <Stack.Screen name="admin-support" />
        <Stack.Screen name="notifications" />
        <Stack.Screen name="nearby-feed" />
        <Stack.Screen name="edit-profile" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="chat" />
        <Stack.Screen name="user-profile" />
      </Stack>
    </GestureHandlerRootView>
  );
}
