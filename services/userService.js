import {
  doc,
  setDoc,
  collection,
  getDocs,
  getDoc,
  documentId,
  addDoc,
  query,
  where,
  orderBy,
  startAt,
  endAt,
  startAfter,
  limit as firestoreLimit,
  onSnapshot,
  serverTimestamp,
  updateDoc,
  deleteDoc,
} from "firebase/firestore";

import { ref, uploadBytes, getDownloadURL } from "firebase/storage";

import { db, storage } from "../firebaseConfig";
import { sendPushNotification } from "./pushService";

const safePush = async (pushToken, title, body, data = {}) => {
  try {
    if (!pushToken) return;
    await sendPushNotification(pushToken, title, body, data);
  } catch (error) {
    console.log("Push notification failed:", error.message);
  }
};

const CHAT_MESSAGE_LIMIT = 80;

const isBannedUser = (user) => {
  return user?.banned === true || user?.accountStatus === "banned";
};

function getDateFromFirestore(value) {
  if (!value) return null;
  if (value.toDate) return value.toDate();

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;

  return parsed;
}

function isActiveVibeUser(user) {
  if (!user?.currentVibe) return false;
  if (user.vibeDuration === "always") return true;

  const expiresAt = getDateFromFirestore(user?.vibeExpiresAt);
  if (!expiresAt) {
    const updatedAtMillis = getDateMillis(user?.vibeUpdatedAt);
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;

    return updatedAtMillis > oneDayAgo;
  }

  return expiresAt.getTime() > Date.now();
}

function getDateMillis(value) {
  if (!value) return 0;
  if (value.toDate) return value.toDate().getTime();

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
}

function getMessageText(message) {
  return String(
    message?.text ??
      message?.messageText ??
      message?.body ??
      message?.content ??
      ""
  );
}

function hasMessageContent(message) {
  return !!(
    getMessageText(message).trim() ||
    message?.imageUrl ||
    message?.audioUrl
  );
}

function getMessagesFromSnapshot(snapshot) {
  return snapshot.docs
    .map((docItem) => ({
      id: docItem.id,
      ...docItem.data(),
    }))
    .filter(hasMessageContent);
}

function sortMessagesAscending(messages) {
  return [...messages].sort((a, b) => {
    const aTime = getDateMillis(a?.createdAt);
    const bTime = getDateMillis(b?.createdAt);

    if (aTime !== bTime) return aTime - bTime;

    return String(a?.id || "").localeCompare(String(b?.id || ""));
  });
}

function getLatestMessages(messages, limitCount = CHAT_MESSAGE_LIMIT) {
  const sortedMessages = sortMessagesAscending(messages);

  return sortedMessages.slice(Math.max(0, sortedMessages.length - limitCount));
}

function getMatchVibeKeys(matchData) {
  return Array.isArray(matchData?.vibeKeys)
    ? matchData.vibeKeys.map(normalizeVibeKey).filter(Boolean)
    : [normalizeVibeKey(matchData?.vibeKey)].filter(Boolean);
}

function getLatestLikePerUser(likeDocs, userIdField) {
  const latestLikesByUserId = new Map();

  likeDocs.forEach((likeDoc) => {
    const likeData = likeDoc.data();
    const userId = likeData?.[userIdField];
    if (!userId) return;

    const existing = latestLikesByUserId.get(userId);
    const existingTime = getDateMillis(existing?.data?.createdAt);
    const nextTime = getDateMillis(likeData?.createdAt);

    if (!existing || nextTime >= existingTime) {
      latestLikesByUserId.set(userId, {
        id: likeDoc.id,
        data: likeData,
      });
    }
  });

  return [...latestLikesByUserId.values()].sort(
    (a, b) => getDateMillis(b.data?.createdAt) - getDateMillis(a.data?.createdAt)
  );
}

function normalizeVibeKey(value) {
  return (value || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getUserVibeKey(user) {
  return normalizeVibeKey(user?.activity || user?.currentVibe);
}

function getPairId(userIdA, userIdB) {
  return [userIdA, userIdB].sort().join("_");
}

function getVibeScopedId(userIdA, userIdB, vibeKey) {
  const pairId = getPairId(userIdA, userIdB);
  const safeVibeKey = normalizeVibeKey(vibeKey).replace(/\s+/g, "-");

  return safeVibeKey ? `${pairId}_${safeVibeKey}` : pairId;
}

function getLikeId(fromUserId, toUserId, vibeKey) {
  const safeVibeKey = normalizeVibeKey(vibeKey).replace(/\s+/g, "-");

  return safeVibeKey
    ? `${fromUserId}_${toUserId}_${safeVibeKey}`
    : `${fromUserId}_${toUserId}`;
}

async function getReverseLikeSnap(fromUserId, toUserId, vibeKey) {
  const exactLikeSnap = await getDoc(
    doc(db, "likes", getLikeId(fromUserId, toUserId, vibeKey))
  );

  if (exactLikeSnap.exists()) {
    return exactLikeSnap;
  }

  const reverseLikesQuery = query(
    collection(db, "likes"),
    where("fromUserId", "==", fromUserId),
    where("toUserId", "==", toUserId),
    firestoreLimit(1)
  );
  const reverseLikesSnap = await getDocs(reverseLikesQuery);

  return reverseLikesSnap.docs[0] || null;
}

const getApproximateLocation = (coords) => {
  const latitude = coords?.latitude;
  const longitude = coords?.longitude;

  if (typeof latitude !== "number" || typeof longitude !== "number") {
    return null;
  }

  return {
    latitude: Number(latitude.toFixed(2)),
    longitude: Number(longitude.toFixed(2)),
    precision: "approximate",
  };
};

function getLatitudeBounds(centerLocation, radiusKm) {
  const latitude = centerLocation?.latitude;

  if (typeof latitude !== "number" || typeof radiusKm !== "number") {
    return null;
  }

  const latitudeDelta = radiusKm / 111;

  return {
    minLatitude: latitude - latitudeDelta,
    maxLatitude: latitude + latitudeDelta,
  };
}

function dedupeUsers(users) {
  const seen = new Set();
  const result = [];

  for (const user of Array.isArray(users) ? users : []) {
    if (!user?.id || seen.has(user.id)) continue;
    seen.add(user.id);
    result.push(user);
  }

  return result;
}

function uniqueIds(ids) {
  return [...new Set((Array.isArray(ids) ? ids : []).filter(Boolean))];
}

async function getUsersByIds(userIds) {
  const ids = uniqueIds(userIds);
  if (ids.length === 0) return new Map();

  const usersById = new Map();

  for (let index = 0; index < ids.length; index += 10) {
    const chunk = ids.slice(index, index + 10);
    const usersQuery = query(
      collection(db, "users"),
      where(documentId(), "in", chunk)
    );

    const snapshot = await getDocs(usersQuery);

    snapshot.docs.forEach((docItem) => {
      const user = {
        id: docItem.id,
        ...docItem.data(),
      };

      if (!isBannedUser(user)) {
        usersById.set(docItem.id, user);
      }
    });
  }

  return usersById;
}

export const saveUserProfile = async (uid, profileData) => {
  if (!uid) throw new Error("Missing user ID.");
  await setDoc(doc(db, "users", uid), profileData || {}, { merge: true });
};

export const savePushToken = async (uid, pushToken) => {
  if (!uid || !pushToken) return;

  await setDoc(
    doc(db, "users", uid),
    {
      pushToken,
      pushTokenUpdatedAt: new Date(),
    },
    { merge: true }
  );
};

export const updateUserOnlineStatus = async (uid, isOnline) => {
  if (!uid) return;

  await setDoc(
    doc(db, "users", uid),
    {
      isOnline: !!isOnline,
      lastSeen: new Date(),
    },
    { merge: true }
  );
};

export const updateMyVibe = async (uid, vibe, durationType, planText, coords) => {
  if (!uid) throw new Error("Missing user ID.");
  if (!vibe) throw new Error("Missing vibe.");

  const now = new Date();
  let vibeExpiresAt = null;
  const approximateLocation = getApproximateLocation(coords);

  if (durationType === "4hours") {
    vibeExpiresAt = new Date(now.getTime() + 4 * 60 * 60 * 1000);
  }

  if (durationType === "wholeDay") {
    vibeExpiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  }

  const vibeUpdate = {
    currentVibe: vibe.label || "",
    mood: vibe.mood || "",
    activity: vibe.activity || "",
    intent: vibe.intent || "",
    vibeDuration: durationType || "",
    vibePlan: planText || "",
    vibeUpdatedAt: now,
    vibeExpiresAt,
  };

  if (approximateLocation) {
    vibeUpdate.location = approximateLocation;
  }

  await setDoc(doc(db, "users", uid), vibeUpdate, { merge: true });
};

export const joinPlan = async (currentUserId, planOwnerId, planData) => {
  if (!currentUserId || !planOwnerId) {
    throw new Error("Missing user information.");
  }

  const joinId = `${currentUserId}_${planOwnerId}`;
  const currentUserSnap = await getDoc(doc(db, "users", currentUserId));
  const currentUser = currentUserSnap.exists() ? currentUserSnap.data() : {};

  await setDoc(doc(db, "planJoins", joinId), {
    fromUserId: currentUserId,
    toUserId: planOwnerId,
    planOwnerName: planData?.name || "",
    planVibe: planData?.currentVibe || "",
    planText: planData?.vibePlan || "",
    createdAt: serverTimestamp(),
  });

  await safePush(
    planData?.pushToken,
    "🔥 Someone joined your plan",
    `${currentUser.name || "Someone"} joined your vibe`,
    {
      type: "plan-join",
      route: "plans",
      chatId: [currentUserId, planOwnerId].sort().join("_"),
      userId: currentUserId,
      name: currentUser.name || "User",
      photoURL: currentUser.photoURL || "",
    }
  );
};

export const getAllUsers = async () => {
  const snapshot = await getDocs(collection(db, "users"));

  return snapshot.docs
    .map((docItem) => ({
      id: docItem.id,
      ...docItem.data(),
    }))
    .filter((user) => !isBannedUser(user));
};

export const getUserProfile = async (uid) => {
  if (!uid) return null;

  const userSnap = await getDoc(doc(db, "users", uid));

  if (!userSnap.exists()) return null;

  const user = {
    id: userSnap.id,
    ...userSnap.data(),
  };

  return isBannedUser(user) ? null : user;
};

export const getDiscoverCandidates = async ({
  currentUserId,
  centerLocation = null,
  radiusKm = null,
  limitCount = 80,
} = {}) => {
  if (!currentUserId) return [];

  const usersRef = collection(db, "users");
  const safeLimit = Math.max(20, Math.min(Number(limitCount) || 80, 150));
  const collectedUsers = [];
  const latitudeBounds = getLatitudeBounds(centerLocation, radiusKm);

  if (latitudeBounds) {
    const nearbyQuery = query(
      usersRef,
      orderBy("location.latitude"),
      startAt(latitudeBounds.minLatitude),
      endAt(latitudeBounds.maxLatitude),
      firestoreLimit(safeLimit * 3)
    );

    const nearbySnapshot = await getDocs(nearbyQuery);

    collectedUsers.push(
      ...nearbySnapshot.docs.map((docItem) => ({
        id: docItem.id,
        ...docItem.data(),
      }))
    );
  }

  const recentActiveQuery = query(
    usersRef,
    orderBy("vibeUpdatedAt", "desc"),
    firestoreLimit(safeLimit)
  );

  const recentSnapshot = await getDocs(recentActiveQuery);

  collectedUsers.push(
    ...recentSnapshot.docs.map((docItem) => ({
      id: docItem.id,
      ...docItem.data(),
    }))
  );

  return dedupeUsers(collectedUsers)
    .filter((user) => user.id !== currentUserId)
    .filter((user) => !isBannedUser(user))
    .filter((user) => isActiveVibeUser(user))
    .slice(0, safeLimit);
};

export const getMyMatchIds = async (currentUserId, currentVibeKey = "") => {
  if (!currentUserId) return [];

  const normalizedCurrentVibeKey = normalizeVibeKey(currentVibeKey);
  const matchesQuery = query(
    collection(db, "matches"),
    where("users", "array-contains", currentUserId),
    firestoreLimit(150)
  );
  const matchesSnapshot = await getDocs(matchesQuery);

  return matchesSnapshot.docs
    .map((matchDoc) => {
      const matchData = matchDoc.data();
      const users = matchData?.users;
      if (!Array.isArray(users)) return "";
      const matchVibeKeys = getMatchVibeKeys(matchData);

      if (
        normalizedCurrentVibeKey &&
        !matchVibeKeys.includes(normalizedCurrentVibeKey)
      ) {
        return "";
      }

      return users.find((id) => id && id !== currentUserId) || "";
    })
    .filter(Boolean);
};

export const saveLike = async (fromUserId, toUserId) => {
  if (!fromUserId || !toUserId) return false;

  const currentUserSnap = await getDoc(doc(db, "users", fromUserId));
  const currentUser = currentUserSnap.exists() ? currentUserSnap.data() : {};
  const vibeKey = getUserVibeKey(currentUser);
  const likeId = vibeKey
    ? `${fromUserId}_${toUserId}_${vibeKey.replace(/\s+/g, "-")}`
    : `${fromUserId}_${toUserId}`;

  await setDoc(doc(db, "likes", likeId), {
    fromUserId,
    toUserId,
    vibeKey,
    vibe: currentUser.currentVibe || "",
    activity: currentUser.activity || "",
    createdAt: serverTimestamp(),
  });

  const reverseLikeId = vibeKey
    ? `${toUserId}_${fromUserId}_${vibeKey.replace(/\s+/g, "-")}`
    : `${toUserId}_${fromUserId}`;
  const reverseLikeRef = doc(db, "likes", reverseLikeId);
  const reverseLikeSnap = await getDoc(reverseLikeRef);

  if (reverseLikeSnap.exists()) {
    const matchId = getVibeScopedId(fromUserId, toUserId, vibeKey);

    await setDoc(doc(db, "matches", matchId), {
      users: [fromUserId, toUserId],
      chatId: getPairId(fromUserId, toUserId),
      vibeKey,
      vibe: currentUser.currentVibe || "",
      activity: currentUser.activity || "",
      createdAt: serverTimestamp(),
    });

    return true;
  }

  return false;
};

export const likeUser = async (currentUserId, targetUserId) => {
  if (!currentUserId || !targetUserId) {
    throw new Error("Missing like information.");
  }

  const currentUserSnap = await getDoc(doc(db, "users", currentUserId));
  const targetUserSnap = await getDoc(doc(db, "users", targetUserId));

  const currentUser = currentUserSnap.exists() ? currentUserSnap.data() : {};
  const targetUser = targetUserSnap.exists() ? targetUserSnap.data() : {};
  const vibeKey = getUserVibeKey(currentUser);
  const likeId = getLikeId(currentUserId, targetUserId, vibeKey);
  const chatId = getPairId(currentUserId, targetUserId);
  const matchId = getVibeScopedId(currentUserId, targetUserId, vibeKey);
  const existingMatch = await getDoc(doc(db, "matches", matchId));
  const existingLike = await getDoc(doc(db, "likes", likeId));
  const reverseLike = await getReverseLikeSnap(targetUserId, currentUserId, vibeKey);

  if (existingMatch.exists()) {
    return { matched: false, alreadyMatched: true };
  }

  if (existingLike.exists() && !reverseLike) {
    return { matched: false, alreadyLiked: true };
  }

  if (!existingLike.exists()) {
    await setDoc(doc(db, "likes", likeId), {
      fromUserId: currentUserId,
      toUserId: targetUserId,
      vibeKey,
      vibe: currentUser.currentVibe || "",
      activity: currentUser.activity || "",
      createdAt: serverTimestamp(),
    });
  }

  if (reverseLike) {
    const reverseLikeData = reverseLike.data?.() || {};
    const matchVibeKeys = [
      ...new Set([vibeKey, reverseLikeData.vibeKey].map(normalizeVibeKey)),
    ].filter(Boolean);

    await setDoc(doc(db, "matches", matchId), {
      users: [currentUserId, targetUserId],
      chatId,
      vibeKey,
      vibeKeys: matchVibeKeys,
      vibe: currentUser.currentVibe || "",
      activity: currentUser.activity || "",
      createdAt: serverTimestamp(),
    });

    await safePush(
      targetUser.pushToken,
      "❤️ You got a new match!",
      `${currentUser.name || "Someone"} matched with you`,
      {
        type: "chat",
        route: "chat",
        chatId,
        userId: currentUserId,
        name: currentUser.name || "User",
        photoURL: currentUser.photoURL || "",
      }
    );

    await safePush(
      currentUser.pushToken,
      "❤️ You got a new match!",
      `You matched with ${targetUser.name || "someone"}`,
      {
        type: "chat",
        route: "chat",
        chatId,
        userId: targetUserId,
        name: targetUser.name || "User",
        photoURL: targetUser.photoURL || "",
      }
    );

    return { matched: true };
  }

  await safePush(
    targetUser.pushToken,
    "🔥 Someone said Yeah to you",
    `${currentUser.name || "Someone"} liked your profile`,
    {
      type: "liked-you",
      route: "connections",
      userId: currentUserId,
      name: currentUser.name || "User",
      photoURL: currentUser.photoURL || "",
    }
  );

  return { matched: false };
};

export const getUsersWhoLikedMe = async (myUserId) => {
  try {
    if (!myUserId) return [];

    const likesQuery = query(
      collection(db, "likes"),
      where("toUserId", "==", myUserId),
      firestoreLimit(80)
    );

    const snapshot = await getDocs(likesQuery);

    const sortedLikes = getLatestLikePerUser(snapshot.docs, "fromUserId");

    const fromUserIds = sortedLikes
      .map((likeItem) => likeItem.data?.fromUserId)
      .filter(Boolean);

    if (fromUserIds.length === 0) return [];

    const usersById = await getUsersByIds(fromUserIds);

    return sortedLikes
      .map((likeItem) => {
        const likeData = likeItem.data;
        const user = usersById.get(likeData?.fromUserId);
        if (!user) return null;

        return {
          ...user,
          connectionLikeId: likeItem.id,
          connectionCreatedAt: likeData?.createdAt || null,
          connectionVibe: likeData?.vibe || "",
          connectionVibeKey: normalizeVibeKey(likeData?.vibeKey),
          connectionActivity: likeData?.activity || "",
        };
      })
      .filter(Boolean);
  } catch (error) {
    console.log("❌ getUsersWhoLikedMe error:", error.message);
    return [];
  }
};

export const getUsersILiked = async (myUserId) => {
  try {
    if (!myUserId) return [];

    const likesQuery = query(
      collection(db, "likes"),
      where("fromUserId", "==", myUserId),
      firestoreLimit(80)
    );

    const snapshot = await getDocs(likesQuery);

    const sortedLikes = getLatestLikePerUser(snapshot.docs, "toUserId");

    const toUserIds = sortedLikes
      .map((likeItem) => likeItem.data?.toUserId)
      .filter(Boolean);
    const usersById = await getUsersByIds(toUserIds);

    return sortedLikes
      .map((likeItem) => {
        const likeData = likeItem.data;
        const user = usersById.get(likeData?.toUserId);
        if (!user) return null;

        return {
          ...user,
          connectionLikeId: likeItem.id,
          connectionCreatedAt: likeData?.createdAt || null,
          connectionVibe: likeData?.vibe || "",
          connectionVibeKey: normalizeVibeKey(likeData?.vibeKey),
          connectionActivity: likeData?.activity || "",
        };
      })
      .filter(Boolean);
  } catch (error) {
    console.log("getUsersILiked error:", error.message);
    return [];
  }
};

export const getMyMatches = async (currentUserId) => {
  if (!currentUserId) return [];

  const matchesQuery = query(
    collection(db, "matches"),
    where("users", "array-contains", currentUserId),
    firestoreLimit(80)
  );
  const matchesSnapshot = await getDocs(matchesQuery);
  const myMatchesByUserId = new Map();
  const matchItems = matchesSnapshot.docs
    .map((matchDoc) => {
      const matchData = matchDoc.data();
      const otherUserId = Array.isArray(matchData.users)
        ? matchData.users.find((id) => id !== currentUserId)
        : "";

      if (!otherUserId) return null;

      return {
        id: matchDoc.id,
        data: matchData,
        otherUserId,
      };
    })
    .filter(Boolean);
  const usersById = await getUsersByIds(
    matchItems.map((matchItem) => matchItem.otherUserId)
  );

  for (const matchItem of matchItems) {
    const user = usersById.get(matchItem.otherUserId);
    if (!user) continue;

    const matchData = matchItem.data;

    const existingMatch = myMatchesByUserId.get(matchItem.otherUserId);
    const existingTime = getDateMillis(
      existingMatch?.lastMessageAt || existingMatch?.matchCreatedAt
    );
    const nextTime = getDateMillis(
      matchData.lastMessageAt || matchData.createdAt
    );

    if (existingMatch && existingTime >= nextTime) continue;

    myMatchesByUserId.set(matchItem.otherUserId, {
      ...user,
      matchVibeKey: normalizeVibeKey(matchData.vibeKey),
      matchVibeKeys: getMatchVibeKeys(matchData),
      matchCreatedAt: matchData.createdAt || null,
      lastMessageAt: matchData.lastMessageAt || null,
      lastMessageText: matchData.lastMessageText || "Tap to chat",
      lastMessageSenderId: matchData.lastMessageSenderId || "",
    });
  }

  return [...myMatchesByUserId.values()].sort((a, b) => {
    const aTime = getDateMillis(a.lastMessageAt || a.matchCreatedAt);
    const bTime = getDateMillis(b.lastMessageAt || b.matchCreatedAt);
    return bTime - aTime;
  });
};

export const sendMessage = async (
  chatId,
  senderId,
  text,
  imageUrl = "",
  audioUrl = "",
  clientMessageId = ""
) => {
  if (!chatId || !senderId) {
    throw new Error("Missing chat information.");
  }

  const cleanText = typeof text === "string" ? text : "";
  const cleanImageUrl = typeof imageUrl === "string" ? imageUrl : "";
  const cleanAudioUrl = typeof audioUrl === "string" ? audioUrl : "";
  const cleanClientMessageId =
    typeof clientMessageId === "string" ? clientMessageId : "";

  if (!cleanText.trim() && !cleanImageUrl && !cleanAudioUrl) return;

  const userIds = chatId.split("_");

  if (userIds.length !== 2) {
    throw new Error("Invalid chat ID format.");
  }

  const receiverId = userIds.find((id) => id && id !== senderId);

  if (!receiverId || receiverId === senderId) {
    console.log("❌ Receiver not found or same as sender");
    return;
  }

  const messageRef = await addDoc(collection(db, "messages"), {
    chatId,
    senderId,
    receiverId,
    text: cleanText,
    imageUrl: cleanImageUrl,
    audioUrl: cleanAudioUrl,
    clientMessageId: cleanClientMessageId,
    status: "sent",
    createdAt: serverTimestamp(),
  });

  const latestMessageText =
    cleanText.trim() ||
    (cleanImageUrl ? "Photo" : cleanAudioUrl ? "Voice message" : "Message");

  await setDoc(
    doc(db, "matches", chatId),
    {
      users: userIds,
      lastMessageAt: serverTimestamp(),
      lastMessageText: latestMessageText,
      lastMessageSenderId: senderId,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );

  const senderSnap = await getDoc(doc(db, "users", senderId));
  const receiverSnap = await getDoc(doc(db, "users", receiverId));

  const sender = senderSnap.exists() ? senderSnap.data() : {};
  const receiver = receiverSnap.exists() ? receiverSnap.data() : {};

  let notificationBody = cleanText;

  if (!notificationBody && cleanImageUrl) {
    notificationBody = "Sent you a photo 📸";
  }

  if (!notificationBody && cleanAudioUrl) {
    notificationBody = "Sent you a voice message 🎤";
  }

  await safePush(
    receiver.pushToken,
    `New message from ${sender.name || "Someone"}`,
    notificationBody || "Sent you a message",
    {
      type: "chat",
      route: "chat",
      chatId,
      userId: senderId,
      name: sender.name || "User",
      photoURL: sender.photoURL || "",
    }
  );

  return messageRef.id;
};

export const markMessagesAsRead = async (chatId, currentUserId) => {
  if (!chatId || !currentUserId) return;

  const q = query(
    collection(db, "messages"),
    where("chatId", "==", chatId),
    orderBy("createdAt", "desc"),
    firestoreLimit(CHAT_MESSAGE_LIMIT)
  );
  const snapshot = await getDocs(q);

  const updates = snapshot.docs
    .filter((messageDoc) => {
      const data = messageDoc.data();
      return data.senderId !== currentUserId && data.status !== "read";
    })
    .map((messageDoc) =>
      updateDoc(doc(db, "messages", messageDoc.id), {
        status: "read",
      })
    );

  await Promise.all(updates);
};

export const listenToMessages = (chatId, callback) => {
  if (!chatId) {
    callback([]);
    return () => {};
  }

  let fallbackUnsubscribe = null;
  let isUnsubscribed = false;

  const primaryQuery = query(
    collection(db, "messages"),
    where("chatId", "==", chatId),
    orderBy("createdAt", "desc"),
    firestoreLimit(CHAT_MESSAGE_LIMIT)
  );

  const startFallbackListener = () => {
    if (isUnsubscribed || fallbackUnsubscribe) return;

    const fallbackQuery = query(
      collection(db, "messages"),
      where("chatId", "==", chatId)
    );

    fallbackUnsubscribe = onSnapshot(
      fallbackQuery,
      (snapshot) => {
        if (isUnsubscribed) return;

        callback(getLatestMessages(getMessagesFromSnapshot(snapshot)));
      },
      (fallbackError) => {
        console.log("listenToMessages fallback error:", fallbackError.message);
        callback([]);
      }
    );
  };

  const primaryUnsubscribe = onSnapshot(
    primaryQuery,
    (snapshot) => {
      if (isUnsubscribed) return;

      callback(getMessagesFromSnapshot(snapshot).reverse());
    },
    (error) => {
      console.log("listenToMessages error:", error.message);
      startFallbackListener();
    }
  );

  return () => {
    isUnsubscribed = true;
    primaryUnsubscribe?.();
    fallbackUnsubscribe?.();
  };
};

export const getOlderMessages = async (
  chatId,
  oldestCreatedAt,
  limitCount = CHAT_MESSAGE_LIMIT
) => {
  if (!chatId || !oldestCreatedAt) return [];

  try {
    const q = query(
      collection(db, "messages"),
      where("chatId", "==", chatId),
      orderBy("createdAt", "desc"),
      startAfter(oldestCreatedAt),
      firestoreLimit(limitCount)
    );

    const snapshot = await getDocs(q);

    return getMessagesFromSnapshot(snapshot).reverse();
  } catch (error) {
    console.log("getOlderMessages error:", error.message);

    const fallbackQuery = query(
      collection(db, "messages"),
      where("chatId", "==", chatId)
    );
    const fallbackSnapshot = await getDocs(fallbackQuery);
    const oldestTime = getDateMillis(oldestCreatedAt);

    return sortMessagesAscending(getMessagesFromSnapshot(fallbackSnapshot))
      .filter((message) => getDateMillis(message?.createdAt) < oldestTime)
      .slice(-limitCount);
  }
};

export const setTypingStatus = async (chatId, userId, isTyping) => {
  if (!chatId || !userId) return;

  await setDoc(
    doc(db, "typing", `${chatId}_${userId}`),
    {
      chatId,
      userId,
      isTyping: !!isTyping,
    },
    { merge: true }
  );
};

export const listenToTyping = (chatId, otherUserId, callback) => {
  if (!chatId || !otherUserId) {
    callback(false);
    return () => {};
  }

  const typingRef = doc(db, "typing", `${chatId}_${otherUserId}`);

  return onSnapshot(
    typingRef,
    (docSnap) => {
      if (docSnap.exists()) {
        callback(!!docSnap.data().isTyping);
      } else {
        callback(false);
      }
    },
    (error) => {
      console.log("listenToTyping error:", error.message);
      callback(false);
    }
  );
};

export const updateUserLocation = async (userId, latitude, longitude) => {
  try {
    if (!userId) return;

    const approximateLocation = getApproximateLocation({
      latitude,
      longitude,
    });

    if (!approximateLocation) return;

    await setDoc(
      doc(db, "users", userId),
      {
        location: approximateLocation,
        updatedLocationAt: new Date(),
      },
      { merge: true }
    );
  } catch (error) {
    console.log("updateUserLocation error:", error.message);
  }
};

export const blockUser = async (currentUserId, targetUserId) => {
  if (!currentUserId || !targetUserId) {
    throw new Error("Missing user information.");
  }

  const blockId = `${currentUserId}_${targetUserId}`;

  await setDoc(doc(db, "blocks", blockId), {
    blockerId: currentUserId,
    blockedUserId: targetUserId,
    createdAt: serverTimestamp(),
  });
};

export const unblockUser = async (currentUserId, targetUserId) => {
  if (!currentUserId || !targetUserId) {
    throw new Error("Missing user information.");
  }

  const blockId = `${currentUserId}_${targetUserId}`;
  await deleteDoc(doc(db, "blocks", blockId));
};

export const getMyBlockedUserIds = async (currentUserId) => {
  try {
    if (!currentUserId) return [];

    const q = query(
      collection(db, "blocks"),
      where("blockerId", "==", currentUserId)
    );

    const snapshot = await getDocs(q);

    return snapshot.docs
      .map((docItem) => docItem.data()?.blockedUserId)
      .filter(Boolean);
  } catch (error) {
    console.log("getMyBlockedUserIds error:", error.message);
    return [];
  }
};

export const isUserBlocked = async (currentUserId, otherUserId) => {
  try {
    if (!currentUserId || !otherUserId) return false;

    const blockOne = await getDoc(doc(db, "blocks", `${currentUserId}_${otherUserId}`));
    const blockTwo = await getDoc(doc(db, "blocks", `${otherUserId}_${currentUserId}`));

    return blockOne.exists() || blockTwo.exists();
  } catch (error) {
    console.log("isUserBlocked error:", error.message);
    return false;
  }
};

export const reportUser = async (reporterId, reportedUserId, reason = "") => {
  if (!reporterId || !reportedUserId) {
    throw new Error("Missing report information.");
  }

  await addDoc(collection(db, "reports"), {
    reporterId,
    reportedUserId,
    reason: reason || "No reason provided",
    status: "pending",
    createdAt: serverTimestamp(),
  });
};

export const createSupportRequest = async (
  userId,
  email = "",
  topic = "",
  message = ""
) => {
  if (!userId) throw new Error("Missing user information.");

  await addDoc(collection(db, "supportRequests"), {
    userId,
    email,
    topic: topic || "Other",
    message: message || "",
    status: "open",
    createdAt: serverTimestamp(),
  });
};

export const getAdminSupportRequests = async (currentUserId) => {
  try {
    const isAdmin = await isCurrentUserAdmin(currentUserId);
    if (!isAdmin) throw new Error("Admin access only.");

    const snapshot = await getDocs(collection(db, "supportRequests"));
    const requests = [];

    for (const supportDoc of snapshot.docs) {
      const request = {
        id: supportDoc.id,
        ...supportDoc.data(),
      };

      let user = null;

      if (request.userId) {
        const userSnap = await getDoc(doc(db, "users", request.userId));
        if (userSnap.exists()) {
          user = {
            id: userSnap.id,
            ...userSnap.data(),
          };
        }
      }

      requests.push({
        ...request,
        user,
      });
    }

    return requests.sort(
      (a, b) => getDateMillis(b.createdAt) - getDateMillis(a.createdAt)
    );
  } catch (error) {
    console.log("getAdminSupportRequests error:", error.message);
    throw error;
  }
};

export const updateSupportRequestStatus = async (
  currentUserId,
  requestId,
  status = "closed"
) => {
  try {
    const isAdmin = await isCurrentUserAdmin(currentUserId);
    if (!isAdmin) throw new Error("Admin access only.");
    if (!requestId) throw new Error("Missing support request.");

    await setDoc(
      doc(db, "supportRequests", requestId),
      {
        status,
        updatedAt: new Date(),
        updatedBy: currentUserId,
      },
      { merge: true }
    );
  } catch (error) {
    console.log("updateSupportRequestStatus error:", error.message);
    throw error;
  }
};

export const createDataDeletionRequest = async (userId, email = "") => {
  if (!userId) throw new Error("Missing user information.");

  await setDoc(
    doc(db, "deletionRequests", userId),
    {
      userId,
      email,
      type: "data_deletion",
      status: "pending",
      createdAt: new Date(),
    },
    { merge: true }
  );
};

export const markAccountForDeletion = async (userId, email = "") => {
  if (!userId) throw new Error("Missing user information.");

  await setDoc(
    doc(db, "deletionRequests", userId),
    {
      userId,
      email,
      type: "account_deletion",
      status: "pending",
      createdAt: new Date(),
    },
    { merge: true }
  );

  await setDoc(
    doc(db, "users", userId),
    {
      accountStatus: "deletion_requested",
      deletionRequestedAt: new Date(),
    },
    { merge: true }
  );
};

export const isCurrentUserAdmin = async (currentUserId) => {
  try {
    if (!currentUserId) return false;

    const adminSnap = await getDoc(doc(db, "admins", currentUserId));
    return adminSnap.exists();
  } catch (error) {
    console.log("isCurrentUserAdmin error:", error.message);
    return false;
  }
};

export const getAdminReports = async (currentUserId) => {
  try {
    const isAdmin = await isCurrentUserAdmin(currentUserId);
    if (!isAdmin) throw new Error("Admin access only.");

    const snapshot = await getDocs(collection(db, "reports"));
    const reports = [];

    for (const reportDoc of snapshot.docs) {
      const report = {
        id: reportDoc.id,
        ...reportDoc.data(),
      };

      let reportedUser = null;
      let reporterUser = null;

      if (report.reportedUserId) {
        const userSnap = await getDoc(doc(db, "users", report.reportedUserId));
        if (userSnap.exists()) {
          reportedUser = {
            id: userSnap.id,
            ...userSnap.data(),
          };
        }
      }

      if (report.reporterId) {
        const reporterSnap = await getDoc(doc(db, "users", report.reporterId));
        if (reporterSnap.exists()) {
          reporterUser = {
            id: reporterSnap.id,
            ...reporterSnap.data(),
          };
        }
      }

      reports.push({
        ...report,
        reportedUser,
        reporterUser,
      });
    }

    return reports;
  } catch (error) {
    console.log("getAdminReports error:", error.message);
    throw error;
  }
};

export const updateReportStatus = async (
  currentUserId,
  reportId,
  status = "reviewed"
) => {
  try {
    const isAdmin = await isCurrentUserAdmin(currentUserId);
    if (!isAdmin) throw new Error("Admin access only.");

    await setDoc(
      doc(db, "reports", reportId),
      {
        status,
        reviewedAt: new Date(),
        reviewedBy: currentUserId,
      },
      { merge: true }
    );
  } catch (error) {
    console.log("updateReportStatus error:", error.message);
    throw error;
  }
};

export const setUserBanStatus = async (currentUserId, targetUserId, shouldBan) => {
  try {
    const isAdmin = await isCurrentUserAdmin(currentUserId);
    if (!isAdmin) throw new Error("Admin access only.");
    if (!targetUserId) throw new Error("Missing user.");

    await setDoc(
      doc(db, "users", targetUserId),
      {
        accountStatus: shouldBan ? "banned" : "active",
        banned: !!shouldBan,
        bannedAt: shouldBan ? new Date() : null,
        bannedBy: shouldBan ? currentUserId : "",
      },
      { merge: true }
    );
  } catch (error) {
    console.log("setUserBanStatus error:", error.message);
    throw error;
  }
};

export const setUserVerifiedStatus = async (
  currentUserId,
  targetUserId,
  shouldVerify
) => {
  try {
    const isAdmin = await isCurrentUserAdmin(currentUserId);
    if (!isAdmin) throw new Error("Admin access only.");
    if (!targetUserId) throw new Error("Missing user.");

    await setDoc(
      doc(db, "users", targetUserId),
      {
        verified: !!shouldVerify,
        verificationStatus: shouldVerify ? "approved" : "not_verified",
        verifiedAt: shouldVerify ? new Date() : null,
        verifiedBy: shouldVerify ? currentUserId : "",
      },
      { merge: true }
    );
  } catch (error) {
    console.log("setUserVerifiedStatus error:", error.message);
    throw error;
  }
};

export const getAdminUsers = async (currentUserId) => {
  try {
    const isAdmin = await isCurrentUserAdmin(currentUserId);
    if (!isAdmin) throw new Error("Admin access only.");

    const snapshot = await getDocs(collection(db, "users"));

    return snapshot.docs.map((docItem) => ({
      id: docItem.id,
      ...docItem.data(),
    }));
  } catch (error) {
    console.log("getAdminUsers error:", error.message);
    throw error;
  }
};

export const requestPhotoVerification = async (
  currentUserId,
  verificationPhotoURL = ""
) => {
  try {
    if (!currentUserId) {
      throw new Error("Missing user information.");
    }

    if (!verificationPhotoURL) {
      throw new Error("Please add at least one profile photo first.");
    }

    await setDoc(
      doc(db, "users", currentUserId),
      {
        verificationStatus: "pending",
        verificationPhotoURL,
        verificationRequestedAt: new Date(),
        verified: false,
      },
      { merge: true }
    );
  } catch (error) {
    console.log("requestPhotoVerification error:", error.message);
    throw error;
  }
};

export const rejectUserVerification = async (currentUserId, targetUserId) => {
  try {
    const isAdmin = await isCurrentUserAdmin(currentUserId);
    if (!isAdmin) throw new Error("Admin access only.");
    if (!targetUserId) throw new Error("Missing user.");

    await setDoc(
      doc(db, "users", targetUserId),
      {
        verified: false,
        verificationStatus: "rejected",
        verificationRejectedAt: new Date(),
        verificationRejectedBy: currentUserId,
      },
      { merge: true }
    );
  } catch (error) {
    console.log("rejectUserVerification error:", error.message);
    throw error;
  }
};

export const uploadProfilePhoto = async (currentUserId, imageUri) => {
  try {
    if (!currentUserId) throw new Error("Missing user.");
    if (!imageUri) throw new Error("Missing image.");

    const response = await fetch(imageUri);
    const blob = await response.blob();

    const fileName = `photo_${Date.now()}.jpg`;
    const storageRef = ref(storage, `profilePhotos/${currentUserId}/${fileName}`);

    await uploadBytes(storageRef, blob);

    return await getDownloadURL(storageRef);
  } catch (error) {
    console.log("uploadProfilePhoto error:", error.message);
    throw error;
  }
};
export const activateProfileBoost = async (userId) => {
  try {
    if (!userId) {
      throw new Error("Missing user.");
    }

    const now = new Date();

    const boostEndsAt = new Date(
      now.getTime() + 30 * 60 * 1000
    );

    await setDoc(
      doc(db, "users", userId),
      {
        boostActive: true,
        boostStartedAt: now,
        boostEndsAt,
      },
      { merge: true }
    );

    return true;
  } catch (error) {
    console.log("activateProfileBoost error:", error.message);
    throw error;
  }
};
