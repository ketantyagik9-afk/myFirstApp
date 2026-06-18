import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
} from "firebase/firestore";

import COLORS from "../constants/colors";
import { auth, db } from "../firebaseConfig";
import {
  getMyMatches,
  getUsersWhoLikedMe,
} from "../services/userService";

function getDateFromFirestore(value) {
  if (!value) return null;
  if (value.toDate) return value.toDate();

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;

  return parsed;
}

function getDateMillis(value) {
  const date = getDateFromFirestore(value);
  return date ? date.getTime() : 0;
}

function formatRelativeTime(value) {
  const date = getDateFromFirestore(value);
  if (!date) return "Recently";

  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);

  if (diffMin < 1) return "Just now";
  if (diffMin < 60) return `${diffMin}m ago`;

  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;

  return "Earlier";
}

function getPhotosParam(user) {
  if (Array.isArray(user?.photos) && user.photos.length > 0) {
    return encodeURIComponent(JSON.stringify(user.photos));
  }

  if (user?.photoURL) {
    return encodeURIComponent(JSON.stringify([user.photoURL]));
  }

  return "";
}

function openNotification(item) {
  const itemRoute = item?.route || "";
  const itemType = item?.type || "";

  if (itemRoute === "connections" || itemType === "connection") {
    router.push("/liked-you");
    return;
  }

  if (itemRoute === "plans" || itemType === "plan") {
    router.push("/my-plans");
    return;
  }

  if (
    (itemRoute === "chat" || itemType === "chat" || itemType === "match") &&
    item.user?.id &&
    auth.currentUser?.uid
  ) {
    const chatId = [auth.currentUser.uid, item.user.id].sort().join("_");
    const photoURL = item.user?.photos?.[0] || item.user?.photoURL || "";
    const photosParam = getPhotosParam(item.user);

    router.push(
      `/chat?chatId=${chatId}&name=${encodeURIComponent(
        item.user.name || "User"
      )}&photoURL=${encodeURIComponent(photoURL)}&photos=${photosParam}`
    );
    return;
  }

  if (item.user?.id) {
    router.push(`/user-profile?userId=${encodeURIComponent(item.user.id)}`);
    return;
  }

  router.push("/notifications");
}

function getIconStyle(type) {
  if (type === "match") {
    return { icon: "heart", color: COLORS.rose, backgroundColor: COLORS.pinkSoft };
  }

  if (type === "plan") {
    return { icon: "calendar", color: COLORS.teal, backgroundColor: COLORS.blueSoft };
  }

  if (type === "chat") {
    return {
      icon: "chatbubble-ellipses",
      color: COLORS.teal,
      backgroundColor: COLORS.blueSoft,
    };
  }

  return { icon: "heart-circle", color: COLORS.rose, backgroundColor: COLORS.pinkSoft };
}

function NotificationRow({ item }) {
  const iconStyle = getIconStyle(item.type);

  return (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={() => openNotification(item)}
      style={{
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: COLORS.softCard,
        borderRadius: 22,
        padding: 13,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: COLORS.softBorder,
        shadowColor: "#8EA4C8",
        shadowOpacity: 0.08,
        shadowRadius: 14,
        shadowOffset: { width: 0, height: 6 },
        elevation: 3,
      }}
    >
      <View
        style={{
          width: 50,
          height: 50,
          borderRadius: 16,
          backgroundColor: iconStyle.backgroundColor,
          alignItems: "center",
          justifyContent: "center",
          marginRight: 12,
        }}
      >
        <Ionicons name={iconStyle.icon} size={24} color={iconStyle.color} />
      </View>

      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <Text
            numberOfLines={1}
            style={{
              flex: 1,
              color: COLORS.black,
              fontSize: 15,
              fontWeight: "900",
            }}
          >
            {item.title}
          </Text>

          {item.isNew ? (
            <View
              style={{
                width: 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: COLORS.rose,
                marginLeft: 8,
              }}
            />
          ) : null}
        </View>

        <Text
          numberOfLines={2}
          style={{
            color: COLORS.darkBlueGray,
            marginTop: 4,
            lineHeight: 18,
            fontSize: 13,
            fontWeight: "700",
          }}
        >
          {item.body}
        </Text>

        <Text
          style={{
            color: "#94A3B8",
            marginTop: 5,
            fontSize: 12,
            fontWeight: "800",
          }}
        >
          {formatRelativeTime(item.createdAt)}
        </Text>
      </View>

      <Ionicons name="chevron-forward" size={18} color="#CBD5E1" />
    </TouchableOpacity>
  );
}

function Section({ title, items }) {
  if (items.length === 0) return null;

  return (
    <View style={{ marginTop: 22 }}>
      <Text
        style={{
          color: COLORS.black,
          fontSize: 17,
          fontWeight: "900",
          marginBottom: 12,
        }}
      >
        {title}
      </Text>

      {items.map((item) => (
        <NotificationRow key={item.id} item={item} />
      ))}
    </View>
  );
}

function EmptyNotifications() {
  return (
    <View
      style={{
        marginTop: 42,
        backgroundColor: COLORS.softCard,
        borderRadius: 28,
        padding: 24,
        alignItems: "center",
        borderWidth: 1,
        borderColor: COLORS.softBorder,
      }}
    >
      <View
        style={{
          width: 62,
          height: 62,
          borderRadius: 22,
          backgroundColor: COLORS.pinkSoft,
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 14,
        }}
      >
        <Ionicons name="notifications" size={28} color={COLORS.rose} />
      </View>

      <Text style={{ color: COLORS.black, fontSize: 22, fontWeight: "900" }}>
        No notifications yet
      </Text>

      <Text
        style={{
          color: COLORS.darkBlueGray,
          marginTop: 8,
          textAlign: "center",
          lineHeight: 21,
          fontWeight: "700",
        }}
      >
        Matches, connections, plan joins, and chat activity will appear here.
      </Text>
    </View>
  );
}

export default function NotificationsScreen() {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadNotifications = useCallback(async () => {
    try {
      if (!auth.currentUser?.uid) {
        router.replace("/login");
        return;
      }

      setLoading(true);

      const [likedMe, matches] = await Promise.all([
        getUsersWhoLikedMe(auth.currentUser.uid),
        getMyMatches(auth.currentUser.uid),
      ]);

      const incomingPlanQuery = query(
        collection(db, "planJoins"),
        where("toUserId", "==", auth.currentUser.uid)
      );
      const incomingPlanSnap = await getDocs(incomingPlanQuery);

      const planNotifications = [];

      for (const planDoc of incomingPlanSnap.docs) {
        const data = planDoc.data();
        const userSnap = await getDoc(doc(db, "users", data.fromUserId));
        const user = userSnap.exists()
          ? { id: data.fromUserId, ...userSnap.data() }
          : null;

        planNotifications.push({
          id: `plan-${planDoc.id}`,
          type: "plan",
          title: "Your plan was joined",
          body: `${user?.name || "Someone"} joined ${
            data.planText || data.planVibe || "your vibe"
          }.`,
          route: "plans",
          user,
          createdAt: data.createdAt || null,
        });
      }

      const connectionNotifications = (Array.isArray(likedMe) ? likedMe : []).map(
        (user) => ({
          id: `connection-${user.id}`,
          type: "connection",
          title: "New connection request",
          body: `${user.name || "Someone"} wants to connect with you.`,
          route: "connections",
          user,
          createdAt: user.connectionCreatedAt || user.createdAt || null,
        })
      );

      const matchNotifications = (Array.isArray(matches) ? matches : []).map(
        (user) => {
          const hasMessageFromThem =
            user.lastMessageSenderId &&
            user.lastMessageSenderId !== auth.currentUser?.uid;

          return {
            id: `${hasMessageFromThem ? "chat" : "match"}-${user.id}`,
            type: hasMessageFromThem ? "chat" : "match",
            title: hasMessageFromThem ? "New chat activity" : "New match",
            body: hasMessageFromThem
              ? `${user.name || "Someone"}: ${user.lastMessageText || "Message"}`
              : `You and ${user.name || "someone"} connected.`,
            route: "chat",
            user,
            createdAt:
              user.lastMessageAt || user.matchCreatedAt || user.createdAt || null,
          };
        }
      );

      const allNotifications = [
        ...connectionNotifications,
        ...matchNotifications,
        ...planNotifications,
      ]
        .filter((item) => item.id)
        .sort((a, b) => getDateMillis(b.createdAt) - getDateMillis(a.createdAt))
        .map((item) => ({
          ...item,
          isNew: Date.now() - getDateMillis(item.createdAt) < 24 * 60 * 60 * 1000,
        }));

      setNotifications(allNotifications);
    } catch (error) {
      console.log("loadNotifications error:", error.message);
      setNotifications([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  const newNotifications = notifications.filter((item) => item.isNew);
  const earlierNotifications = notifications.filter((item) => !item.isNew);

  return (
    <LinearGradient
      colors={[COLORS.background, COLORS.mint, COLORS.background]}
      style={{ flex: 1 }}
    >
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          padding: 20,
          paddingTop: 58,
          paddingBottom: 80,
        }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <TouchableOpacity
            onPress={() => router.back()}
            activeOpacity={0.86}
            style={{
              width: 42,
              height: 42,
              borderRadius: 21,
              backgroundColor: COLORS.softCard,
              alignItems: "center",
              justifyContent: "center",
              borderWidth: 1,
              borderColor: COLORS.softBorder,
            }}
          >
            <Ionicons name="arrow-back" size={21} color={COLORS.black} />
          </TouchableOpacity>

          <Text
            style={{
              flex: 1,
              marginLeft: 14,
              color: COLORS.black,
              fontSize: 29,
              fontWeight: "900",
            }}
          >
            Notifications
          </Text>

          <TouchableOpacity
            onPress={loadNotifications}
            activeOpacity={0.86}
            style={{
              width: 42,
              height: 42,
              borderRadius: 21,
              backgroundColor: COLORS.softCard,
              alignItems: "center",
              justifyContent: "center",
              borderWidth: 1,
              borderColor: COLORS.softBorder,
            }}
          >
            <Ionicons name="refresh" size={19} color={COLORS.rose} />
          </TouchableOpacity>
        </View>

        {loading ? (
          <View
            style={{
              flex: 1,
              minHeight: 420,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <ActivityIndicator color={COLORS.rose} />
            <Text
              style={{
                marginTop: 12,
                color: COLORS.black,
                fontSize: 17,
                fontWeight: "900",
              }}
            >
              Loading notifications...
            </Text>
          </View>
        ) : notifications.length === 0 ? (
          <EmptyNotifications />
        ) : (
          <>
            <Section title="New" items={newNotifications} />
            <Section title="Earlier" items={earlierNotifications} />
          </>
        )}
      </ScrollView>
    </LinearGradient>
  );
}
