import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  FlatList,
  Image,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from "react-native";

import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import COLORS from "../../constants/colors";

import { auth } from "../../firebaseConfig";
import {
  getUsersWhoLikedMe,
  getUsersILiked,
  getMyMatches,
  likeUser,
  getMyBlockedUserIds,
} from "../../services/userService";
import { playMatchWhistle } from "../../services/soundService";
import { isCliqzeePlusActive } from "../../services/subscriptionService";

const FREE_CONNECTION_LIMIT = 10;
const LOCKED_PREVIEW_COUNT = 3;

function isUserBanned(user) {
  return user?.banned === true || user?.accountStatus === "banned";
}

function getUserMainPhoto(user) {
  if (Array.isArray(user?.photos) && user.photos.length > 0) {
    return user.photos[0];
  }

  if (user?.photoURL) {
    return user.photoURL;
  }

  return "https://picsum.photos/500";
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

function getDateFromFirestore(value) {
  if (!value) return null;
  if (value.toDate) return value.toDate();

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;

  return parsed;
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

function getConnectionText(user) {
  return (
    user?.lastMessageText ||
    user?.vibePlan ||
    user?.currentVibe ||
    user?.interestedIn ||
    user?.intent ||
    "Active vibe"
  );
}

function getConnectionTime(user, tabType) {
  if (tabType === "history") {
    return formatRelativeTime(user?.lastMessageAt || user?.matchCreatedAt);
  }

  return formatRelativeTime(
    user?.connectionCreatedAt || user?.likedAt || user?.createdAt || user?.lastSeen
  );
}

function getTabSummary(activeTab) {
  if (activeTab === "received") {
    return {
      icon: "heart",
      title: "People who chose you",
      text: "Tap the heart to connect back. If they already liked you, it becomes a match.",
      color: COLORS.rose,
      backgroundColor: COLORS.pinkSoft,
    };
  }

  if (activeTab === "sent") {
    return {
      icon: "paper-plane",
      title: "Waiting for them",
      text: "These are people you sent a connection to. They move to History after both of you connect.",
      color: COLORS.teal,
      backgroundColor: COLORS.blueSoft,
    };
  }

  return {
    icon: "chatbubble-ellipses",
    title: "Mutual connections",
    text: "These are your matches. Tap Chat to continue the conversation.",
    color: COLORS.rose,
    backgroundColor: COLORS.pinkSoft,
  };
}

function getMatchedVibeKeyMap(users) {
  const matchedVibeKeysByUserId = new Map();

  (Array.isArray(users) ? users : []).forEach((user) => {
    if (!user?.id) return;

    const vibeKeys = Array.isArray(user.matchVibeKeys)
      ? user.matchVibeKeys
      : [user.matchVibeKey];

    matchedVibeKeysByUserId.set(
      user.id,
      new Set(vibeKeys.filter(Boolean))
    );
  });

  return matchedVibeKeysByUserId;
}

function isAlreadyMatchedForConnection(user, matchedVibeKeysByUserId) {
  const matchedVibeKeys = matchedVibeKeysByUserId.get(user?.id);
  if (!matchedVibeKeys) return false;

  const connectionVibeKey = user?.connectionVibeKey || "";

  if (!connectionVibeKey) {
    return matchedVibeKeys.size > 0;
  }

  return matchedVibeKeys.has(connectionVibeKey);
}

function filterAvailableUsers(
  users,
  blockedUserIds,
  matchedVibeKeysByUserId = new Map()
) {
  return (Array.isArray(users) ? users : [])
    .filter((user) => user?.id)
    .filter((user) => !blockedUserIds.includes(user.id))
    .filter(
      (user) => !isAlreadyMatchedForConnection(user, matchedVibeKeysByUserId)
    )
    .filter((user) => !isUserBanned(user));
}

function SegmentTab({ label, count, selected, onPress }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      style={{
        paddingBottom: 10,
        marginRight: 28,
        borderBottomWidth: selected ? 2 : 0,
        borderBottomColor: COLORS.rose,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <Text
          style={{
            color: selected ? COLORS.rose : COLORS.darkBlueGray,
            fontWeight: "900",
            fontSize: 14,
          }}
        >
          {label}
        </Text>

        {typeof count === "number" && count > 0 ? (
          <View
            style={{
              marginLeft: 5,
              backgroundColor: COLORS.rose,
              borderRadius: 999,
              minWidth: 18,
              height: 18,
              alignItems: "center",
              justifyContent: "center",
              paddingHorizontal: 5,
            }}
          >
            <Text
              style={{
                color: COLORS.white,
                fontSize: 10,
                fontWeight: "900",
              }}
            >
              {count}
            </Text>
          </View>
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

function ActionButton({ tabType, actionState, onPress }) {
  if (tabType === "history") {
    return (
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.86}
        style={{
          width: 68,
          height: 46,
          borderRadius: 999,
          backgroundColor: COLORS.blueSoft,
          alignItems: "center",
          justifyContent: "center",
          marginLeft: 8,
        }}
      >
        <Ionicons name="chatbubble-ellipses" size={18} color={COLORS.teal} />
        <Text style={{ color: COLORS.teal, fontSize: 10, fontWeight: "900" }}>
          Chat
        </Text>
      </TouchableOpacity>
    );
  }

  if (tabType === "sent") {
    return (
      <View
        style={{
          width: 74,
          height: 42,
          borderRadius: 999,
          backgroundColor: COLORS.blueSoft,
          alignItems: "center",
          justifyContent: "center",
          marginLeft: 8,
        }}
      >
        <Ionicons name="time-outline" size={17} color={COLORS.teal} />
        <Text style={{ color: COLORS.teal, fontSize: 10, fontWeight: "900" }}>
          Waiting
        </Text>
      </View>
    );
  }

  const isSending = actionState === "sending";
  const isSent = actionState === "sent";
  const isMatched = actionState === "matched";

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={isSending || isSent || isMatched}
      activeOpacity={0.86}
      style={{
        width: isSending || isSent || isMatched ? 68 : 54,
        height: 54,
        borderRadius: 27,
        backgroundColor:
          isSent || isMatched ? COLORS.rose : COLORS.pinkSoft,
        alignItems: "center",
        justifyContent: "center",
        marginLeft: 8,
        shadowColor: COLORS.rose,
        shadowOpacity: isSent || isMatched ? 0.28 : 0,
        shadowRadius: 14,
        shadowOffset: { width: 0, height: 6 },
        elevation: isSent || isMatched ? 4 : 0,
      }}
    >
      {isSending ? (
        <ActivityIndicator color={COLORS.rose} size="small" />
      ) : isSent ? (
        <>
          <Ionicons name="checkmark" size={19} color={COLORS.white} />
          <Text
            style={{ color: COLORS.white, fontSize: 10, fontWeight: "900" }}
          >
            Sent
          </Text>
        </>
      ) : isMatched ? (
        <>
          <Ionicons name="heart" size={19} color={COLORS.white} />
          <Text
            style={{ color: COLORS.white, fontSize: 10, fontWeight: "900" }}
          >
            Match
          </Text>
        </>
      ) : (
        <Ionicons name="heart" size={25} color={COLORS.rose} />
      )}
    </TouchableOpacity>
  );
}

function ConnectionRow({
  user,
  tabType,
  actionState,
  onAction,
  onOpenProfile,
}) {
  const mainPhoto = getUserMainPhoto(user);
  const rowHighlighted = actionState === "sent" || actionState === "matched";

  return (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={() => onOpenProfile(user)}
      style={{
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: rowHighlighted ? COLORS.pinkSoft : COLORS.softCard,
        borderRadius: 22,
        padding: 12,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: rowHighlighted ? "#FFD0E7" : COLORS.softBorder,
        shadowColor: "#8EA4C8",
        shadowOpacity: 0.08,
        shadowRadius: 14,
        shadowOffset: { width: 0, height: 6 },
        elevation: 3,
      }}
    >
      <View>
        <Image
          source={{ uri: mainPhoto }}
          style={{
            width: 58,
            height: 58,
            borderRadius: 29,
            backgroundColor: "#dbe3ea",
          }}
        />

        <View
          style={{
            position: "absolute",
            right: 1,
            bottom: 2,
            width: 13,
            height: 13,
            borderRadius: 7,
            backgroundColor: user?.isOnline ? "#22C55E" : "#CBD5E1",
            borderWidth: 2,
            borderColor: COLORS.white,
          }}
        />
      </View>

      <View style={{ flex: 1, marginLeft: 12 }}>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <Text
            numberOfLines={1}
            style={{
              flexShrink: 1,
              color: COLORS.black,
              fontSize: 16,
              fontWeight: "900",
            }}
          >
            {user?.name || "User"}
          </Text>

          {user?.verified ? (
            <Ionicons
              name="checkmark-circle"
              size={15}
              color={COLORS.rose}
              style={{ marginLeft: 5 }}
            />
          ) : null}
        </View>

        <Text
          numberOfLines={1}
          style={{
            color: COLORS.darkBlueGray,
            marginTop: 3,
            fontSize: 13,
            fontWeight: "700",
          }}
        >
          {getConnectionText(user)}
        </Text>

        <Text
          style={{
            color: "#94A3B8",
            marginTop: 3,
            fontSize: 12,
            fontWeight: "800",
          }}
        >
          {getConnectionTime(user, tabType)}
        </Text>
      </View>

      <ActionButton
        tabType={tabType}
        actionState={actionState}
        onPress={() => onAction(user)}
      />
    </TouchableOpacity>
  );
}

function LockedConnectionPreview({ user }) {
  const mainPhoto = getUserMainPhoto(user);

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: COLORS.softCard,
        borderRadius: 22,
        padding: 12,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: COLORS.softBorder,
      }}
    >
      <Image
        source={{ uri: mainPhoto }}
        blurRadius={12}
        style={{
          width: 54,
          height: 54,
          borderRadius: 27,
          backgroundColor: "#dbe3ea",
        }}
      />

      <View style={{ flex: 1, marginLeft: 12 }}>
        <Text
          style={{
            color: COLORS.black,
            fontSize: 16,
            fontWeight: "900",
          }}
        >
          Hidden connection
        </Text>

        <Text
          numberOfLines={1}
          style={{
            color: COLORS.darkBlueGray,
            marginTop: 3,
            fontWeight: "700",
          }}
        >
          Unlock with Cliqzee Plus
        </Text>
      </View>

      <Ionicons name="lock-closed" size={20} color={COLORS.darkBlueGray} />
    </View>
  );
}

function EmptyState({ activeTab }) {
  const title =
    activeTab === "received"
      ? "No connections yet"
      : activeTab === "sent"
      ? "No sent connections yet"
      : "No match history yet";

  const text =
    activeTab === "received"
      ? "Keep your vibe active and people nearby can connect with you."
      : activeTab === "sent"
      ? "People you send a connection to will appear here until they match back."
      : "People who mutually connected with you will appear here.";

  return (
    <View
      style={{
        marginTop: 36,
        backgroundColor: COLORS.softCard,
        borderRadius: 28,
        padding: 24,
        alignItems: "center",
        borderWidth: 1,
        borderColor: COLORS.softBorder,
      }}
    >
      <Text
        style={{
          color: COLORS.black,
          fontSize: 22,
          fontWeight: "900",
          textAlign: "center",
        }}
      >
        {title}
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
        {text}
      </Text>

      {activeTab === "sent" ? (
        <TouchableOpacity
          activeOpacity={0.86}
          onPress={() => router.push("/discover")}
          style={{
            marginTop: 18,
            backgroundColor: COLORS.rose,
            borderRadius: 999,
            paddingHorizontal: 22,
            paddingVertical: 12,
          }}
        >
          <Text style={{ color: COLORS.white, fontWeight: "900" }}>
            Find People
          </Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

function TabSummary({ activeTab }) {
  const summary = getTabSummary(activeTab);

  return (
    <View
      style={{
        marginBottom: 14,
        backgroundColor: summary.backgroundColor,
        borderRadius: 22,
        padding: 15,
        borderWidth: 1,
        borderColor: activeTab === "sent" ? "#CFE0FF" : "#FFD0E7",
        flexDirection: "row",
        alignItems: "center",
      }}
    >
      <View
        style={{
          width: 38,
          height: 38,
          borderRadius: 19,
          backgroundColor: COLORS.softCard,
          alignItems: "center",
          justifyContent: "center",
          marginRight: 12,
        }}
      >
        <Ionicons name={summary.icon} size={19} color={summary.color} />
      </View>

      <View style={{ flex: 1 }}>
        <Text style={{ color: COLORS.black, fontWeight: "900", fontSize: 15 }}>
          {summary.title}
        </Text>

        <Text
          style={{
            color: COLORS.darkBlueGray,
            marginTop: 3,
            lineHeight: 18,
            fontSize: 12,
            fontWeight: "700",
          }}
        >
          {summary.text}
        </Text>
      </View>
    </View>
  );
}

export default function LikedYouScreen() {
  const [receivedUsers, setReceivedUsers] = useState([]);
  const [sentUsers, setSentUsers] = useState([]);
  const [historyUsers, setHistoryUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("received");
  const [actionUserId, setActionUserId] = useState("");
  const [completedAction, setCompletedAction] = useState(null);
  const [feedbackMessage, setFeedbackMessage] = useState("");
  const [plusActive, setPlusActive] = useState(false);
  const [checkingPlus, setCheckingPlus] = useState(true);
  const feedbackTimerRef = useRef(null);

  useEffect(() => {
    return () => {
      if (feedbackTimerRef.current) {
        clearTimeout(feedbackTimerRef.current);
      }
    };
  }, []);

  const loadConnections = useCallback(async () => {
    try {
      if (!auth.currentUser?.uid) {
        router.replace("/login");
        return;
      }

      setLoading(true);

      const [receivedResult, sentResult, matchesResult, blockedUserIds] =
        await Promise.all([
          getUsersWhoLikedMe(auth.currentUser.uid),
          getUsersILiked(auth.currentUser.uid),
          getMyMatches(auth.currentUser.uid),
          getMyBlockedUserIds(auth.currentUser.uid),
        ]);

      try {
        const active = await isCliqzeePlusActive(auth.currentUser.uid);
        setPlusActive(active);
      } catch (subscriptionError) {
        console.log("Cliqzee Plus check skipped:", subscriptionError.message);
        setPlusActive(false);
      } finally {
        setCheckingPlus(false);
      }

      const cleanHistoryUsers = (Array.isArray(matchesResult)
        ? matchesResult
        : []
      )
        .filter((user) => user?.id)
        .filter((user) => !blockedUserIds.includes(user.id))
        .filter((user) => !isUserBanned(user));

      const matchedVibeKeysByUserId = getMatchedVibeKeyMap(cleanHistoryUsers);

      setReceivedUsers(
        filterAvailableUsers(
          receivedResult,
          blockedUserIds,
          matchedVibeKeysByUserId
        )
      );
      setSentUsers(
        filterAvailableUsers(
          sentResult,
          blockedUserIds,
          matchedVibeKeysByUserId
        )
      );
      setHistoryUsers(cleanHistoryUsers);
    } catch (error) {
      Alert.alert("Load failed", error?.message || "Something went wrong.");
      setCheckingPlus(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadConnections();
  }, [loadConnections]);

  const openProfile = async (user) => {
    if (!user?.id) return;

    if (isUserBanned(user)) {
      Alert.alert("Unavailable", "This user is no longer available.");
      await loadConnections();
      return;
    }

    router.push(`/user-profile?userId=${encodeURIComponent(user.id)}`);
  };

  const openChat = (user) => {
    if (!auth.currentUser?.uid || !user?.id) return;

    const chatId = [auth.currentUser.uid, user.id].sort().join("_");
    const mainPhoto = getUserMainPhoto(user);
    const photosParam = getPhotosParam(user);

    router.push(
      `/chat?chatId=${chatId}&name=${encodeURIComponent(
        user.name || "User"
      )}&photoURL=${encodeURIComponent(mainPhoto)}&photos=${photosParam}`
    );
  };

  const moveUserAfterFeedback = (user, result) => {
    if (feedbackTimerRef.current) {
      clearTimeout(feedbackTimerRef.current);
    }

    feedbackTimerRef.current = setTimeout(() => {
      setReceivedUsers((prev) => prev.filter((person) => person.id !== user.id));

      if (result?.matched) {
        setSentUsers((prev) => prev.filter((person) => person.id !== user.id));
        setHistoryUsers((prev) => [
          { ...user, matchCreatedAt: new Date(), lastMessageText: "Tap to chat" },
          ...prev.filter((person) => person.id !== user.id),
        ]);
      } else {
        setSentUsers((prev) => [
          { ...user, connectionCreatedAt: new Date() },
          ...prev.filter((person) => person.id !== user.id),
        ]);
      }

      setCompletedAction(null);
      feedbackTimerRef.current = null;
    }, 850);
  };

  const handleReceivedAction = async (user) => {
    try {
      if (!auth.currentUser?.uid || !user?.id || actionUserId) return;

      if (isUserBanned(user)) {
        Alert.alert("Unavailable", "This user is no longer available.");
        await loadConnections();
        return;
      }

      setActionUserId(user.id);
      setFeedbackMessage("");

      const blockedUserIds = await getMyBlockedUserIds(auth.currentUser.uid);

      if (blockedUserIds.includes(user.id)) {
        Alert.alert(
          "Blocked user",
          "You blocked this user, so you cannot connect or chat with them."
        );
        await loadConnections();
        return;
      }

      const result = await likeUser(auth.currentUser.uid, user.id);

      if (result?.matched) {
        await playMatchWhistle();
        setCompletedAction({ userId: user.id, type: "matched" });
        setFeedbackMessage(`You matched with ${user.name || "User"}`);
      } else {
        setCompletedAction({ userId: user.id, type: "sent" });
        setFeedbackMessage(`Connection sent to ${user.name || "User"}`);
      }

      moveUserAfterFeedback(user, result);
    } catch (error) {
      Alert.alert(
        "Connection failed",
        error?.message || "Something went wrong."
      );
    } finally {
      setActionUserId("");
    }
  };

  const handleRowAction = (user) => {
    if (activeTab === "history") {
      openChat(user);
      return;
    }

    if (activeTab === "received") {
      handleReceivedAction(user);
    }
  };

  const handleUpgradePress = () => {
    router.push("/plus");
  };

  const visibleReceivedUsers = plusActive
    ? receivedUsers
    : receivedUsers.slice(0, FREE_CONNECTION_LIMIT);
  const lockedUsers = plusActive ? [] : receivedUsers.slice(FREE_CONNECTION_LIMIT);
  const lockedPreviewUsers = lockedUsers.slice(0, LOCKED_PREVIEW_COUNT);
  const lockedConnectionCount = Math.max(
    plusActive ? 0 : receivedUsers.length - FREE_CONNECTION_LIMIT,
    0
  );

  const listData =
    activeTab === "received"
      ? visibleReceivedUsers
      : activeTab === "sent"
      ? sentUsers
      : historyUsers;

  return (
    <LinearGradient
      colors={[COLORS.background, COLORS.mint, COLORS.background]}
      style={{
        flex: 1,
        paddingTop: 58,
        paddingHorizontal: 18,
      }}
    >
      <Text
        style={{
          fontSize: 31,
          fontWeight: "900",
          color: COLORS.black,
        }}
      >
        Connections
      </Text>

      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          marginTop: 22,
        }}
      >
        <SegmentTab
          label="Received"
          count={receivedUsers.length}
          selected={activeTab === "received"}
          onPress={() => setActiveTab("received")}
        />
        <SegmentTab
          label="Sent"
          count={sentUsers.length}
          selected={activeTab === "sent"}
          onPress={() => setActiveTab("sent")}
        />
        <SegmentTab
          label="History"
          count={historyUsers.length}
          selected={activeTab === "history"}
          onPress={() => setActiveTab("history")}
        />
      </View>

      {feedbackMessage ? (
        <View
          style={{
            marginTop: 14,
            backgroundColor: COLORS.pinkSoft,
            borderRadius: 18,
            paddingHorizontal: 14,
            paddingVertical: 11,
            borderWidth: 1,
            borderColor: "#FFD0E7",
            flexDirection: "row",
            alignItems: "center",
          }}
        >
          <Ionicons name="heart" size={17} color={COLORS.rose} />
          <Text
            numberOfLines={1}
            style={{
              flex: 1,
              marginLeft: 8,
              color: COLORS.black,
              fontWeight: "900",
            }}
          >
            {feedbackMessage}
          </Text>
        </View>
      ) : null}

      {loading ? (
        <View
          style={{
            flex: 1,
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <ActivityIndicator color={COLORS.rose} />
          <Text
            style={{
              marginTop: 12,
              fontSize: 18,
              fontWeight: "900",
              color: COLORS.black,
            }}
          >
            Loading connections...
          </Text>
        </View>
      ) : (
        <FlatList
          data={listData}
          keyExtractor={(item, index) => item?.id || `connection-${index}`}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            paddingTop: 20,
            paddingBottom: 40,
            flexGrow: 1,
          }}
          ListHeaderComponent={<TabSummary activeTab={activeTab} />}
          ListEmptyComponent={<EmptyState activeTab={activeTab} />}
          ListFooterComponent={
            activeTab === "received" && lockedConnectionCount > 0 ? (
              <View style={{ marginTop: 4 }}>
                {lockedPreviewUsers.map((user, index) => (
                  <LockedConnectionPreview
                    key={user?.id || `locked-${index}`}
                    user={user}
                  />
                ))}

                <View
                  style={{
                    backgroundColor: COLORS.softCard,
                    borderRadius: 24,
                    padding: 18,
                    borderWidth: 1,
                    borderColor: COLORS.softBorder,
                  }}
                >
                  <Text
                    style={{
                      color: COLORS.black,
                      fontSize: 20,
                      fontWeight: "900",
                    }}
                  >
                    {lockedConnectionCount} more waiting
                  </Text>

                  <Text
                    style={{
                      color: COLORS.darkBlueGray,
                      marginTop: 6,
                      lineHeight: 21,
                      fontWeight: "700",
                    }}
                  >
                    Your first {FREE_CONNECTION_LIMIT} connections are free.
                    More will unlock with Cliqzee Plus.
                  </Text>

                  <TouchableOpacity
                    activeOpacity={0.86}
                    onPress={handleUpgradePress}
                    disabled={checkingPlus}
                    style={{
                      marginTop: 14,
                      backgroundColor: COLORS.rose,
                      borderRadius: 999,
                      paddingVertical: 14,
                      alignItems: "center",
                      opacity: checkingPlus ? 0.65 : 1,
                    }}
                  >
                    <Text
                      style={{
                        color: COLORS.white,
                        fontSize: 15,
                        fontWeight: "900",
                      }}
                    >
                      {checkingPlus ? "Checking Plus..." : "Unlock Cliqzee Plus"}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : null
          }
          renderItem={({ item }) => {
            const actionState =
              actionUserId === item.id
                ? "sending"
                : completedAction?.userId === item.id
                ? completedAction.type
                : "idle";

            return (
              <ConnectionRow
                user={item}
                tabType={activeTab}
                actionState={actionState}
                onAction={handleRowAction}
                onOpenProfile={openProfile}
              />
            );
          }}
        />
      )}
    </LinearGradient>
  );
}
