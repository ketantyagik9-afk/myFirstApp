import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Image,
  Modal,
  TouchableOpacity,
  Vibration,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import COLORS from "../../constants/colors";

import { auth, db } from "../../firebaseConfig";

import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  getDoc,
} from "firebase/firestore";

function getUserPhotos(user) {
  if (Array.isArray(user?.photos) && user.photos.length > 0) {
    return user.photos.filter(Boolean);
  }

  if (user?.photoURL) {
    return [user.photoURL];
  }

  return ["https://picsum.photos/400"];
}

function getPhotosParam(user) {
  const photos = getUserPhotos(user);

  if (Array.isArray(photos) && photos.length > 0) {
    return encodeURIComponent(JSON.stringify(photos));
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

function formatPlanTime(value) {
  const date = getDateFromFirestore(value);
  if (!date) return "Active now";

  const today = new Date();
  const isToday = date.toDateString() === today.toDateString();

  const time = date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  return `${isToday ? "Today" : "Recently"} - ${time}`;
}

function isPastPlan(value) {
  const date = getDateFromFirestore(value);
  if (!date) return false;

  return Date.now() - date.getTime() > 24 * 60 * 60 * 1000;
}

function getPlanTitle(item, tabType) {
  if (item?.planText) return item.planText;
  if (item?.planVibe) return item.planVibe;

  return tabType === "joined" ? "Joined vibe" : "New join";
}

function getPlanIcon(value) {
  const text = (value || "").toLowerCase();

  if (text.includes("coffee")) return "cafe";
  if (text.includes("movie")) return "film";
  if (text.includes("walk")) return "walk";
  if (text.includes("dinner") || text.includes("food")) return "restaurant";
  if (text.includes("gym")) return "barbell";
  if (text.includes("drink")) return "wine";

  return "flame";
}

function getPlanColor(index) {
  const colors = [COLORS.rose, COLORS.purple, COLORS.teal];
  return colors[index % colors.length];
}

function SegmentButton({ label, selected, onPress }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.86}
      style={{
        flex: 1,
        backgroundColor: selected ? COLORS.rose : "transparent",
        borderRadius: 999,
        paddingVertical: 12,
        alignItems: "center",
      }}
    >
      <Text
        style={{
          color: selected ? COLORS.white : COLORS.darkBlueGray,
          fontWeight: "900",
          fontSize: 13,
        }}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

function MiniAvatars({ users }) {
  const visibleUsers = (Array.isArray(users) ? users : [])
    .filter(Boolean)
    .slice(0, 4);

  if (visibleUsers.length === 0) return null;

  return (
    <View style={{ flexDirection: "row", marginTop: 10, marginLeft: 1 }}>
      {visibleUsers.map((user, index) => (
        <Image
          key={`${user.id || user.name || "user"}-${index}`}
          source={{ uri: getUserPhotos(user)[0] }}
          style={{
            width: 24,
            height: 24,
            borderRadius: 12,
            borderWidth: 2,
            borderColor: COLORS.white,
            marginLeft: index === 0 ? 0 : -7,
            backgroundColor: COLORS.softBorder,
          }}
        />
      ))}
    </View>
  );
}

function PlanCard({ item, index, tabType, onOpenChat }) {
  const person = tabType === "joined" ? item.owner : item.user;
  const accentColor = getPlanColor(index);
  const title = getPlanTitle(item, tabType);
  const subtitle =
    tabType === "joined"
      ? `${person?.name || "Someone"}'s plan`
      : `${person?.name || "Someone"} joined`;
  const peopleText =
    tabType === "joined"
      ? "You joined"
      : `${person?.name || "1 person"} ${person?.name ? "joined" : "going"}`;

  return (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={() => person?.id && onOpenChat(person)}
      style={{
        backgroundColor: COLORS.softCard,
        borderRadius: 24,
        padding: 14,
        marginBottom: 14,
        flexDirection: "row",
        alignItems: "center",
        borderWidth: 1,
        borderColor: COLORS.softBorder,
        shadowColor: "#8EA4C8",
        shadowOpacity: 0.09,
        shadowRadius: 16,
        shadowOffset: { width: 0, height: 8 },
        elevation: 3,
      }}
    >
      <View
        style={{
          width: 58,
          height: 58,
          borderRadius: 17,
          backgroundColor: accentColor,
          alignItems: "center",
          justifyContent: "center",
          marginRight: 14,
        }}
      >
        <Ionicons name={getPlanIcon(title)} size={26} color={COLORS.white} />
      </View>

      <View style={{ flex: 1 }}>
        <Text
          numberOfLines={1}
          style={{
            color: COLORS.black,
            fontSize: 16,
            fontWeight: "900",
          }}
        >
          {title}
        </Text>

        <Text
          numberOfLines={1}
          style={{
            color: COLORS.darkBlueGray,
            marginTop: 4,
            fontSize: 13,
            fontWeight: "800",
          }}
        >
          {formatPlanTime(item.createdAt)}
        </Text>

        <Text
          numberOfLines={1}
          style={{
            color: COLORS.darkBlueGray,
            marginTop: 3,
            fontSize: 12,
            fontWeight: "700",
          }}
        >
          {subtitle}
        </Text>

        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <MiniAvatars users={[person]} />
          <Text
            numberOfLines={1}
            style={{
              color: "#94A3B8",
              marginTop: 10,
              marginLeft: person ? 8 : 0,
              fontSize: 12,
              fontWeight: "900",
            }}
          >
            {peopleText}
          </Text>
        </View>
      </View>

      {tabType === "joined" && isPastPlan(item.createdAt) ? (
        <Ionicons name="checkmark" size={22} color="#22C55E" />
      ) : (
        <Ionicons name="chevron-forward" size={20} color="#CBD5E1" />
      )}
    </TouchableOpacity>
  );
}

function EmptyPlans({ activeTab }) {
  return (
    <View
      style={{
        backgroundColor: COLORS.softCard,
        borderRadius: 26,
        padding: 24,
        alignItems: "center",
        borderWidth: 1,
        borderColor: COLORS.softBorder,
      }}
    >
      <View
        style={{
          width: 58,
          height: 58,
          borderRadius: 18,
          backgroundColor: COLORS.pinkSoft,
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 14,
        }}
      >
        <Ionicons name="calendar" size={26} color={COLORS.rose} />
      </View>

      <Text style={{ color: COLORS.black, fontSize: 22, fontWeight: "900" }}>
        {activeTab === "joined" ? "No joined plans yet" : "No joins yet"}
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
        {activeTab === "joined"
          ? "Plans you join from Discover will appear here."
          : "Keep your vibe active and people joining your plan will appear here."}
      </Text>

      <TouchableOpacity
        onPress={() => router.push(activeTab === "joined" ? "/discover" : "/home")}
        activeOpacity={0.86}
        style={{
          marginTop: 18,
          backgroundColor: COLORS.rose,
          borderRadius: 999,
          paddingHorizontal: 24,
          paddingVertical: 13,
        }}
      >
        <Text style={{ color: COLORS.white, fontWeight: "900" }}>
          {activeTab === "joined" ? "Find Plans" : "Set My Vibe"}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

function PlanSection({ title, items, tabType, onOpenChat }) {
  if (items.length === 0) return null;

  return (
    <View style={{ marginTop: 18 }}>
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

      {items.map((item, index) => (
        <PlanCard
          key={item.id}
          item={item}
          index={index}
          tabType={tabType}
          onOpenChat={onOpenChat}
        />
      ))}
    </View>
  );
}

export default function MyPlansScreen() {
  const [incomingJoins, setIncomingJoins] = useState([]);
  const [outgoingJoins, setOutgoingJoins] = useState([]);
  const [activeTab, setActiveTab] = useState("mine");
  const [liveJoin, setLiveJoin] = useState(null);

  const hasLoadedOnceRef = useRef(false);
  const previousJoinIdsRef = useRef(new Set());

  useEffect(() => {
    if (!auth.currentUser) {
      router.replace("/login");
      return undefined;
    }

    let isActive = true;

    const incomingQuery = query(
      collection(db, "planJoins"),
      where("toUserId", "==", auth.currentUser.uid)
    );

    const unsubscribe = onSnapshot(
      incomingQuery,
      async (snapshot) => {
        try {
          const result = [];

          for (const joinDoc of snapshot.docs) {
            const data = joinDoc.data();
            const userSnap = data.fromUserId
              ? await getDoc(doc(db, "users", data.fromUserId))
              : null;

            result.push({
              id: joinDoc.id,
              ...data,
              user: userSnap?.exists()
                ? { id: data.fromUserId, ...userSnap.data() }
                : null,
            });
          }

          const sortedResult = result.sort((a, b) => {
            const aDate = getDateFromFirestore(a.createdAt)?.getTime() || 0;
            const bDate = getDateFromFirestore(b.createdAt)?.getTime() || 0;
            return bDate - aDate;
          });

          if (!isActive) return;

          setIncomingJoins(sortedResult);

          const currentIds = new Set(sortedResult.map((item) => item.id));

          if (hasLoadedOnceRef.current) {
            const newJoin = sortedResult.find(
              (item) => !previousJoinIdsRef.current.has(item.id)
            );

            if (newJoin) {
              setLiveJoin(newJoin);
              Vibration.vibrate(300);
            }
          }

          previousJoinIdsRef.current = currentIds;
          hasLoadedOnceRef.current = true;
        } catch (error) {
          console.log("Incoming plans listener error:", error.message);
        }
      },
      (error) => {
        console.log("Incoming plans snapshot error:", error.message);
      }
    );

    return () => {
      isActive = false;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!auth.currentUser) return undefined;

    let isActive = true;

    const outgoingQuery = query(
      collection(db, "planJoins"),
      where("fromUserId", "==", auth.currentUser.uid)
    );

    const unsubscribe = onSnapshot(
      outgoingQuery,
      async (snapshot) => {
        try {
          const result = [];

          for (const joinDoc of snapshot.docs) {
            const data = joinDoc.data();
            const ownerSnap = data.toUserId
              ? await getDoc(doc(db, "users", data.toUserId))
              : null;

            result.push({
              id: joinDoc.id,
              ...data,
              owner: ownerSnap?.exists()
                ? { id: data.toUserId, ...ownerSnap.data() }
                : null,
            });
          }

          const sortedResult = result.sort((a, b) => {
            const aDate = getDateFromFirestore(a.createdAt)?.getTime() || 0;
            const bDate = getDateFromFirestore(b.createdAt)?.getTime() || 0;
            return bDate - aDate;
          });

          if (isActive) {
            setOutgoingJoins(sortedResult);
          }
        } catch (error) {
          console.log("Outgoing plans listener error:", error.message);
        }
      },
      (error) => {
        console.log("Outgoing plans snapshot error:", error.message);
      }
    );

    return () => {
      isActive = false;
      unsubscribe();
    };
  }, []);

  const openChat = (user) => {
    if (!auth.currentUser?.uid || !user?.id) return;

    const chatId = [auth.currentUser.uid, user.id].sort().join("_");
    const mainPhoto = getUserPhotos(user)[0] || "";
    const photosParam = getPhotosParam(user);

    setLiveJoin(null);

    router.push(
      `/chat?chatId=${chatId}&name=${encodeURIComponent(
        user.name || "User"
      )}&photoURL=${encodeURIComponent(mainPhoto)}&photos=${photosParam}`
    );
  };

  const currentItems = activeTab === "mine" ? incomingJoins : outgoingJoins;
  const upcomingPlans = currentItems.filter((item) => !isPastPlan(item.createdAt));
  const pastPlans = currentItems.filter((item) => isPastPlan(item.createdAt));

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
          paddingBottom: 110,
        }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <Text style={{ fontSize: 31, fontWeight: "900", color: COLORS.black }}>
            Plans
          </Text>

          <TouchableOpacity
            activeOpacity={0.86}
            onPress={() => router.push("/home")}
            style={{
              width: 46,
              height: 46,
              borderRadius: 23,
              backgroundColor: COLORS.rose,
              alignItems: "center",
              justifyContent: "center",
              shadowColor: COLORS.rose,
              shadowOpacity: 0.25,
              shadowRadius: 14,
              shadowOffset: { width: 0, height: 7 },
              elevation: 4,
            }}
          >
            <Ionicons name="add" size={26} color={COLORS.white} />
          </TouchableOpacity>
        </View>

        <View
          style={{
            marginTop: 18,
            backgroundColor: COLORS.background,
            borderRadius: 999,
            padding: 4,
            flexDirection: "row",
            borderWidth: 1,
            borderColor: COLORS.softBorder,
          }}
        >
          <SegmentButton
            label="My Plans"
            selected={activeTab === "mine"}
            onPress={() => setActiveTab("mine")}
          />
          <SegmentButton
            label="Joined"
            selected={activeTab === "joined"}
            onPress={() => setActiveTab("joined")}
          />
        </View>

        {currentItems.length === 0 ? (
          <View style={{ marginTop: 22 }}>
            <EmptyPlans activeTab={activeTab === "mine" ? "mine" : "joined"} />
          </View>
        ) : (
          <>
            <PlanSection
              title="Upcoming"
              items={upcomingPlans}
              tabType={activeTab === "mine" ? "mine" : "joined"}
              onOpenChat={openChat}
            />

            <PlanSection
              title="Past Plans"
              items={pastPlans}
              tabType={activeTab === "mine" ? "mine" : "joined"}
              onOpenChat={openChat}
            />
          </>
        )}

        <Modal transparent visible={!!liveJoin} animationType="fade">
          <View
            style={{
              flex: 1,
              backgroundColor: "rgba(0,0,0,0.78)",
              justifyContent: "center",
              alignItems: "center",
              padding: 24,
            }}
          >
            <View
              style={{
                backgroundColor: COLORS.softCard,
                borderRadius: 34,
                padding: 24,
                width: "100%",
                alignItems: "center",
              }}
            >
              <View
                style={{
                  width: 68,
                  height: 68,
                  borderRadius: 24,
                  backgroundColor: COLORS.pinkSoft,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Ionicons name="flame" size={32} color={COLORS.rose} />
              </View>

              <Text
                style={{
                  marginTop: 16,
                  fontSize: 32,
                  fontWeight: "900",
                  color: COLORS.black,
                }}
              >
                New Join
              </Text>

              <Text
                style={{
                  marginTop: 10,
                  color: COLORS.darkBlueGray,
                  fontSize: 16,
                  textAlign: "center",
                  lineHeight: 22,
                  fontWeight: "700",
                }}
              >
                {liveJoin?.user?.name || "Someone"} joined your vibe.
              </Text>

              <Image
                source={{ uri: getUserPhotos(liveJoin?.user)[0] }}
                style={{
                  width: 116,
                  height: 116,
                  borderRadius: 58,
                  marginTop: 18,
                  backgroundColor: COLORS.softBorder,
                }}
              />

              <TouchableOpacity
                onPress={() => openChat(liveJoin?.user)}
                style={{
                  marginTop: 24,
                  backgroundColor: COLORS.rose,
                  borderRadius: 999,
                  paddingVertical: 15,
                  width: "100%",
                  alignItems: "center",
                }}
              >
                <Text
                  style={{
                    color: COLORS.white,
                    fontWeight: "900",
                    fontSize: 16,
                  }}
                >
                  Open Chat
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setLiveJoin(null)}
                style={{
                  marginTop: 12,
                  backgroundColor: COLORS.background,
                  borderRadius: 999,
                  paddingVertical: 15,
                  width: "100%",
                  alignItems: "center",
                  borderWidth: 1,
                  borderColor: COLORS.softBorder,
                }}
              >
                <Text
                  style={{
                    color: COLORS.black,
                    fontWeight: "900",
                    fontSize: 16,
                  }}
                >
                  Later
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </ScrollView>
    </LinearGradient>
  );
}
