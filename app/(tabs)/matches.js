import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Image,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from "react-native";
import { router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import COLORS from "../../constants/colors";

import { auth } from "../../firebaseConfig";
import { getMyMatches, getMyBlockedUserIds } from "../../services/userService";

function getMainPhoto(user) {
  if (Array.isArray(user?.photos) && user.photos.length > 0) {
    return user.photos[0];
  }

  if (user?.photoURL) {
    return user.photoURL;
  }

  return "https://picsum.photos/300";
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

function formatLastSeen(value) {
  const date = getDateFromFirestore(value);
  if (!date) return "Last seen recently";

  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);

  if (diffMin < 1) return "Last seen just now";
  if (diffMin < 60) return `Last seen ${diffMin} min ago`;

  const diffHours = Math.floor(diffMin / 60);

  if (diffHours < 24) {
    return `Last seen ${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
  }

  return "Last seen earlier";
}

function OnlineLine({ user }) {
  const isOnline = !!user?.isOnline;

  return (
    <View style={{ flexDirection: "row", alignItems: "center", marginTop: 4 }}>
      <View
        style={{
          width: 8,
          height: 8,
          borderRadius: 4,
          backgroundColor: isOnline ? COLORS.lime : "#aaa",
          marginRight: 6,
        }}
      />

      <Text
        numberOfLines={1}
        style={{
          color: isOnline ? COLORS.lime : "#999",
          fontSize: 13,
          fontWeight: "700",
        }}
      >
        {isOnline ? "Online now" : formatLastSeen(user?.lastSeen)}
      </Text>
    </View>
  );
}

export default function MatchesScreen() {
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState("");

  const loadMatches = useCallback(async () => {
    try {
      if (!auth.currentUser?.uid) {
        router.replace("/login");
        return;
      }

      setLoading(true);

      const result = await getMyMatches(auth.currentUser.uid);
      const blockedUserIds = await getMyBlockedUserIds(auth.currentUser.uid);

      const filteredMatches = (Array.isArray(result) ? result : []).filter(
        (user) => !blockedUserIds.includes(user?.id)
      );

      setMatches(filteredMatches);
    } catch (error) {
      Alert.alert("Matches failed", error?.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadMatches();
    }, [loadMatches])
  );

  const openChat = (match) => {
    if (!auth.currentUser?.uid || !match?.id) return;

    const chatId = [auth.currentUser.uid, match.id].sort().join("_");
    const mainPhoto = getMainPhoto(match);
    const photosParam = getPhotosParam(match);

    router.push(
      `/chat?chatId=${chatId}&name=${encodeURIComponent(
        match.name || "User"
      )}&photoURL=${encodeURIComponent(mainPhoto)}&photos=${photosParam}`
    );
  };

  const filteredMatches = matches.filter((match) => {
    const search = searchText.toLowerCase().trim();
    if (!search) return true;

    return (
      (match?.name || "").toLowerCase().includes(search) ||
      (match?.lastMessageText || "").toLowerCase().includes(search) ||
      (match?.vibePlan || "").toLowerCase().includes(search)
    );
  });

  const newMatches = matches.slice(0, 8);

  return (
    <LinearGradient
      colors={[COLORS.background, COLORS.mint, COLORS.background]}
      style={{ flex: 1 }}
    >
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          padding: 20,
          paddingTop: 60,
          paddingBottom: 40,
        }}
      >
        <Text style={{ fontSize: 34, fontWeight: "900", color: COLORS.black }}>
          Matches
        </Text>

        <View
          style={{
            marginTop: 18,
            backgroundColor: COLORS.softCard,
            borderRadius: 999,
            borderWidth: 1,
            borderColor: COLORS.softBorder,
            paddingHorizontal: 14,
            height: 46,
            flexDirection: "row",
            alignItems: "center",
          }}
        >
          <Ionicons name="search" size={18} color={COLORS.darkBlueGray} />

          <TextInput
            value={searchText}
            onChangeText={setSearchText}
            placeholder="Search matches"
            placeholderTextColor="#94A3B8"
            style={{
              flex: 1,
              marginLeft: 8,
              color: COLORS.black,
              fontWeight: "800",
            }}
          />
        </View>

        {loading ? (
          <View style={{ paddingTop: 80, alignItems: "center" }}>
            <ActivityIndicator color={COLORS.teal} />
            <Text
              style={{
                marginTop: 12,
                fontWeight: "900",
                color: COLORS.black,
              }}
            >
              Loading matches...
            </Text>
          </View>
        ) : matches.length === 0 ? (
          <View
            style={{
              backgroundColor: COLORS.softCard,
              borderRadius: 30,
              padding: 24,
              alignItems: "center",
              shadowColor: "#000",
              shadowOpacity: 0.06,
              shadowRadius: 14,
              shadowOffset: { width: 0, height: 6 },
              elevation: 3,
            }}
          >
            <Text
              style={{
                fontSize: 22,
                fontWeight: "900",
                color: COLORS.black,
              }}
            >
              No matches yet
            </Text>

            <Text
              style={{
                color: COLORS.darkBlueGray,
                marginTop: 8,
                textAlign: "center",
                lineHeight: 22,
              }}
            >
              Like people or join plans to start conversations.
            </Text>
          </View>
        ) : (
          <>
            <Text
              style={{
                marginTop: 24,
                color: COLORS.black,
                fontSize: 17,
                fontWeight: "900",
              }}
            >
              New Matches
            </Text>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingTop: 12, paddingBottom: 18 }}
            >
              {newMatches.map((match, index) => {
                const mainPhoto = getMainPhoto(match);

                return (
                  <TouchableOpacity
                    key={match.id || `new-match-${index}`}
                    activeOpacity={0.85}
                    onPress={() => openChat(match)}
                    style={{ marginRight: 12, alignItems: "center" }}
                  >
                    <View>
                      <Image
                        source={{ uri: mainPhoto }}
                        style={{
                          width: 62,
                          height: 62,
                          borderRadius: 31,
                          backgroundColor: "#dbe3ea",
                          borderWidth: 3,
                          borderColor: index === 0 ? COLORS.rose : COLORS.white,
                        }}
                      />

                      {match.isOnline ? (
                        <View
                          style={{
                            position: "absolute",
                            right: 2,
                            bottom: 3,
                            width: 13,
                            height: 13,
                            borderRadius: 7,
                            backgroundColor: "#22C55E",
                            borderWidth: 2,
                            borderColor: COLORS.white,
                          }}
                        />
                      ) : null}
                    </View>

                    <Text
                      numberOfLines={1}
                      style={{
                        marginTop: 6,
                        maxWidth: 68,
                        color: COLORS.black,
                        fontSize: 12,
                        fontWeight: "900",
                        textAlign: "center",
                      }}
                    >
                      {match.name || "User"}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <Text
              style={{
                color: COLORS.black,
                fontSize: 17,
                fontWeight: "900",
                marginBottom: 10,
              }}
            >
              Messages
            </Text>

            {filteredMatches.length === 0 ? (
              <View
                style={{
                  backgroundColor: COLORS.softCard,
                  borderRadius: 24,
                  padding: 20,
                  borderWidth: 1,
                  borderColor: COLORS.softBorder,
                }}
              >
                <Text style={{ color: COLORS.black, fontWeight: "900" }}>
                  No matches found
                </Text>
              </View>
            ) : (
              filteredMatches.map((match) => {
                const mainPhoto = getMainPhoto(match);

                return (
                  <TouchableOpacity
                    key={match.id}
                    onPress={() => openChat(match)}
                    activeOpacity={0.85}
                    style={{
                      backgroundColor: COLORS.softCard,
                      borderRadius: 24,
                      padding: 13,
                      marginBottom: 12,
                      flexDirection: "row",
                      alignItems: "center",
                      borderWidth: 1,
                      borderColor: COLORS.softBorder,
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
                          width: 62,
                          height: 62,
                          borderRadius: 31,
                          backgroundColor: "#dbe3ea",
                        }}
                      />

                      {match.isOnline && (
                        <View
                          style={{
                            position: "absolute",
                            right: 2,
                            bottom: 3,
                            width: 14,
                            height: 14,
                            borderRadius: 7,
                            backgroundColor: "#22C55E",
                            borderWidth: 2,
                            borderColor: COLORS.white,
                          }}
                        />
                      )}
                    </View>

                    <View style={{ flex: 1, marginLeft: 13 }}>
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          flexWrap: "wrap",
                        }}
                      >
                        <Text
                          numberOfLines={1}
                          style={{
                            flexShrink: 1,
                            fontSize: 17,
                            fontWeight: "900",
                            color: COLORS.black,
                          }}
                        >
                          {match.name || "No name"}
                        </Text>

                        {match?.verified && (
                          <Ionicons
                            name="checkmark-circle"
                            size={15}
                            color={COLORS.rose}
                            style={{ marginLeft: 5 }}
                          />
                        )}
                      </View>

                      <Text
                        numberOfLines={1}
                        style={{
                          color: COLORS.darkBlueGray,
                          marginTop: 4,
                          fontSize: 13,
                          fontWeight: "700",
                        }}
                      >
                        {match.lastMessageText ||
                          match.vibePlan ||
                          match.interests ||
                          "Tap to chat"}
                      </Text>

                      <OnlineLine user={match} />
                    </View>

                    <View
                      style={{
                        width: 42,
                        height: 42,
                        borderRadius: 21,
                        backgroundColor: COLORS.pinkSoft,
                        alignItems: "center",
                        justifyContent: "center",
                        marginLeft: 8,
                      }}
                    >
                      <Ionicons
                        name="chatbubble-ellipses"
                        size={19}
                        color={COLORS.rose}
                      />
                    </View>
                  </TouchableOpacity>
                );
              })
            )}
          </>
        )}
      </ScrollView>
    </LinearGradient>
  );
}
