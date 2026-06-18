export const sendPushNotification = async (
  pushToken,
  title,
  body,
  data = {}
) => {
  try {
    if (!pushToken) {
      console.log("❌ No push token provided");
      return null;
    }

    console.log("📨 Sending push to:", pushToken);

    const sound = data?.sound || "notification_whistle.wav";

    const message = {
      to: pushToken,
      sound,
      channelId: "cliqzee",
      title,
      body,
      data: {
        ...data,
        sound,
      },
    };

    const response = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Accept-Encoding": "gzip, deflate",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(message),
    });

    const result = await response.json().catch(() => null);

    if (!response.ok) {
      console.log(
        "Expo push request failed:",
        response.status,
        result ? JSON.stringify(result) : "No response body"
      );
      return null;
    }

    console.log("📬 Expo push response:", JSON.stringify(result, null, 2));

    return result;
  } catch (error) {
    console.log("❌ sendPushNotification error:", error.message);
    return null;
  }
};
