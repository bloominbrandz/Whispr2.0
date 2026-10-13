import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, collection, doc, getDoc, setDoc, onSnapshot, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBSmm2lC7iAMmQJqsG_jXi4DWpL7ghcJnc",
  authDomain: "whispr-92fc0.firebaseapp.com",
  projectId: "whispr-92fc0",
  storageBucket: "whispr-92fc0.firebasestorage.app",
  messagingSenderId: "133594748424",
  appId: "1:133594748424:web:7dc7ff44e105d2d5cee3bd"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const results = document.getElementById("results");
const searchInput = document.getElementById("searchInput");
const statusMessage = document.getElementById("statusMessage");
const groupModal = document.getElementById("groupModal");
let activeUser = null;
let cachedChats = [];
let stopChats = null;

function makeChatItem(chat) {
  const item = document.createElement("article");
  item.className = "chat-item";
  item.tabIndex = 0;
  const title = chat.isGroup ? (chat.groupName || "Group chat") : (chat.otherUsername || "Anonymous");
  const openChat = () => {
    if (chat.isGroup) window.location.href = `chat.html?group=${encodeURIComponent(chat.conversationId)}`;
    else window.location.href = `chat.html?uid=${encodeURIComponent(chat.otherUserId)}&name=${encodeURIComponent(title)}`;
  };
  const profileUrl = `other.html?uid=${encodeURIComponent(chat.otherUserId || "")}`;
  const avatar = chat.isGroup ? document.createElement("div") : document.createElement("a");
  avatar.className = "avatar-link";
  if (!chat.isGroup && chat.otherUserId) {
    avatar.href = profileUrl;
    avatar.setAttribute("aria-label", `Visit ${title}'s profile`);
    avatar.addEventListener("click", event => event.stopPropagation());
  }
  const avatarImage = document.createElement("img");
  avatarImage.className = "avatar";
  avatarImage.alt = chat.isGroup ? "Group conversation" : `${title}'s profile`;
  if (chat.otherAvatarUrl) avatarImage.src = chat.otherAvatarUrl;
  else avatarImage.hidden = true;
  const avatarInitial = document.createElement("span");
  avatarInitial.className = "avatar-initial";
  avatarInitial.textContent = chat.isGroup ? "✦" : title.charAt(0).toUpperCase();
  avatar.append(avatarInitial, avatarImage);
  const info = document.createElement("div");
  info.className = "chat-info";
  const name = chat.isGroup ? document.createElement("div") : document.createElement("a");
  name.className = "chat-title";
  name.textContent = title;
  if (!chat.isGroup && chat.otherUserId) {
    name.href = profileUrl;
    name.setAttribute("aria-label", `Visit ${title}'s profile`);
    name.addEventListener("click", event => event.stopPropagation());
  }
  const preview = document.createElement("div");
  preview.className = "last-message";
  preview.textContent = chat.lastMessageText || (chat.isGroup ? "Group conversation" : "Start a conversation");
  info.append(name, preview);
  if (Number(chat.unreadCount) > 0) {
    const badge = document.createElement("span");
    badge.className = "unread";
    badge.textContent = String(chat.unreadCount);
    name.appendChild(badge);
  }
  item.append(avatar, info);
  item.addEventListener("click", openChat);
  item.addEventListener("keydown", event => {
    if (event.target.closest("a")) return;
    if (event.key === "Enter" || event.key === " ") { event.preventDefault(); openChat(); }
  });
  avatarImage.addEventListener("error", () => { avatarImage.hidden = true; });
  return item;
}
function renderChats() {
  const filter = searchInput.value.trim().toLowerCase();
  results.replaceChildren();
  const visible = cachedChats.filter(chat => `${chat.groupName || ""} ${chat.otherUsername || ""} ${chat.lastMessageText || ""}`.toLowerCase().includes(filter));
  if (!visible.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = cachedChats.length ? "No conversations match your search." : "No conversations yet. Find someone or create a group.";
    results.appendChild(empty);
    return;
  }
  visible.forEach(chat => results.appendChild(makeChatItem(chat)));
}
function conversationSort(a, b) {
  return (b.lastMessageTime?.seconds || 0) - (a.lastMessageTime?.seconds || 0);
}

onAuthStateChanged(auth, user => {
  if (!user) { window.location.href = "login.html"; return; }
  activeUser = user;
  if (stopChats) stopChats();
  stopChats = onSnapshot(doc(db, "userChats", user.uid), async snapshot => {
    const data = snapshot.data() || {};
    const chats = Object.entries(data).map(([id, value]) => ({ ...value, conversationId: value.conversationId || id }));
    chats.sort(conversationSort);
    await Promise.all(chats.map(async chat => {
      if (chat.isGroup || chat.otherUsername || !chat.otherUserId) return;
      try {
        const userSnap = await getDoc(doc(db, "users", chat.otherUserId));
        if (userSnap.exists()) {
          const person = userSnap.data();
          chat.otherUsername = person.username || person.displayName || "Anonymous";
          chat.otherAvatarUrl = chat.otherAvatarUrl || person.avatarUrl || person.photoURL || person.photoUrl || person.profileImage || "";
        }
      } catch (error) { console.warn("Could not load conversation profile", error); }
    }));
    cachedChats = chats;
    renderChats();
  }, error => {
    console.error("Could not load conversations", error);
    statusMessage.textContent = "Could not load conversations. Check your connection and access permissions.";
    results.innerHTML = '<div class="empty-state">Unable to load conversations.</div>';
  });
});

searchInput.addEventListener("input", renderChats);
document.getElementById("backBtn").addEventListener("click", () => window.whisprBack("enter.html"));
document.getElementById("groupBtn").addEventListener("click", () => {
  groupModal.hidden = false;
  document.getElementById("groupName").focus();
});
document.getElementById("closeGroupBtn").addEventListener("click", () => { groupModal.hidden = true; });
groupModal.addEventListener("click", e => { if (e.target === groupModal) groupModal.hidden = true; });

function makeId() {
  return globalThis.crypto?.randomUUID ? crypto.randomUUID() : `${Date.now()}_${Math.random().toString(36).slice(2)}`;
}
document.getElementById("groupForm").addEventListener("submit", async event => {
  event.preventDefault();
  const submit = document.getElementById("createGroupBtn");
  const groupStatus = document.getElementById("groupStatus");
  const groupName = document.getElementById("groupName").value.trim();
  const usernames = [...new Set(document.getElementById("groupMembers").value.split(",").map(name => name.trim().toLowerCase()).filter(Boolean))];
  if (!activeUser || !groupName || !usernames.length) {
    groupStatus.textContent = "Add a group name and at least one username.";
    return;
  }
  submit.disabled = true;
  groupStatus.textContent = "Finding members…";
  try {
    const members = new Set([activeUser.uid]);
    for (const username of usernames) {
      const nameSnap = await getDoc(doc(db, "usernames", username));
      if (!nameSnap.exists()) throw new Error(`Could not find @${username}. Check the username and try again.`);
      const uid = nameSnap.data().uid;
      if (uid && uid !== activeUser.uid) members.add(uid);
    }
    if (members.size < 2) throw new Error("A group needs at least one other member.");
    const memberIds = [...members];
    const groupId = `group_${makeId()}`;
    await setDoc(doc(db, "groupChats", groupId), {
      name: groupName,
      members: memberIds,
      createdBy: activeUser.uid,
      createdAt: serverTimestamp()
    });
    await Promise.all(memberIds.map(uid => setDoc(doc(db, "userChats", uid), {
      [groupId]: {
        conversationId: groupId,
        isGroup: true,
        groupName,
        memberIds,
        lastMessageText: "Group created",
        lastMessageTime: serverTimestamp(),
        unreadCount: 0
      }
    }, { merge: true })));
    window.location.href = `chat.html?group=${encodeURIComponent(groupId)}`;
  } catch (error) {
    console.error("Could not create group", error);
    groupStatus.textContent = error.message || "Could not create the group.";
    submit.disabled = false;
  }
});
