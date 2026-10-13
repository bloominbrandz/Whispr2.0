import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, collection, doc, getDoc, addDoc, query, orderBy, onSnapshot, serverTimestamp, setDoc, updateDoc, arrayUnion, arrayRemove, where, increment } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

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
const params = new URLSearchParams(location.search);
const groupId = params.get("group");
const otherUid = params.get("uid");
const otherName = params.get("name") || "User";
let conversationId = groupId || "";
const messagesEl = document.getElementById("messages");
const input = document.getElementById("msgInput");
const notice = document.getElementById("notice");
const callBtn = document.getElementById("callBtn");
const blockBtn = document.getElementById("blockBtn");
const callOverlay = document.getElementById("callOverlay");
const callStatus = document.getElementById("callStatus");
const remoteAudio = document.getElementById("remoteAudio");
let currentUser = null;
let currentName = "Anonymous";
let members = [];
let activeCallId = null;
let peer = null;
let localStream = null;
let callUnsubscribe = null;
let candidateUnsubscribes = [];
let incomingUnsubscribe = null;
let blocked = false;
let messagesUnsubscribe = null;
let initialMessagesLoaded = false;
let sendingMessage = false;

function setNotice(text) { notice.textContent = text || ""; }
function getName(data, user) { return data?.username || data?.displayName || user?.displayName || user?.email || "Anonymous"; }
function showEmpty(text) {
  const el = document.createElement("div");
  el.className = "empty-state";
  el.textContent = text;
  messagesEl.replaceChildren(el);
}
function escapeTime(value) {
  if (!value?.toDate) return "";
  return value.toDate().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}
function canUseMessaging() { return Boolean(currentUser && conversationId && !blocked); }
function updateComposer() {
  input.disabled = !canUseMessaging();
  document.getElementById("sendBtn").disabled = !canUseMessaging();
}

async function checkBlockStatus() {
  if (!otherUid || !currentUser) return;
  try {
    const [mine, theirs] = await Promise.all([
      getDoc(doc(db, "users", currentUser.uid)),
      getDoc(doc(db, "users", otherUid))
    ]);
    const mineBlocked = mine.exists() ? (mine.data().blockedUsers || []) : [];
    const theirsBlocked = theirs.exists() ? (theirs.data().blockedUsers || []) : [];
    blocked = mineBlocked.includes(otherUid) || theirsBlocked.includes(currentUser.uid);
    blockBtn.textContent = mineBlocked.includes(otherUid) ? "Unblock" : "Block";
    blockBtn.hidden = false;
    callBtn.hidden = blocked;
    if (blocked) setNotice(mineBlocked.includes(otherUid) ? "You blocked this person. Unblock them to send messages." : "You can’t message this person because they blocked you.");
    updateComposer();
  } catch (error) {
    console.error("Block status could not be checked", error);
    blocked = true;
    setNotice("Could not confirm messaging permissions. Try again.");
    updateComposer();
  }
}

async function checkMutualFollow() {
  if (!otherUid || !currentUser) return false;
  try {
    const [mine, theirs] = await Promise.all([
      getDoc(doc(db, "users", currentUser.uid)),
      getDoc(doc(db, "users", otherUid))
    ]);
    const following = mine.exists() ? (mine.data().following || []) : [];
    const followedBy = theirs.exists() ? (theirs.data().following || []) : [];
    return following.includes(otherUid) && followedBy.includes(currentUser.uid);
  } catch (error) {
    console.error("Could not verify mutual follows", error);
    return false;
  }
}

async function initChat() {
  if (!conversationId || (!groupId && !otherUid)) {
    setNotice("This conversation link is incomplete.");
    input.disabled = true;
    document.getElementById("sendBtn").disabled = true;
    showEmpty("Open a conversation from Messages or Search.");
    return;
  }
  if (groupId) {
    const groupSnap = await getDoc(doc(db, "groupChats", groupId));
    if (!groupSnap.exists()) throw new Error("This group could not be found.");
    const groupData = groupSnap.data();
    members = Array.isArray(groupData.members) ? groupData.members : [];
    if (!members.includes(currentUser.uid)) throw new Error("You are not a member of this group.");
    document.getElementById("profileIdentity").removeAttribute("href");
    document.getElementById("profileIdentity").setAttribute("aria-label", "Group conversation");
    document.getElementById("profileInitial").textContent = "✦";
    document.getElementById("chatName").textContent = groupData.name || "Group chat";
    document.getElementById("chatSubtitle").textContent = `${members.length} members`;
    callBtn.hidden = true;
    blockBtn.hidden = true;
  } else {
    members = [currentUser.uid, otherUid];
    document.getElementById("chatSubtitle").textContent = "Private conversation";
    const otherSnap = await getDoc(doc(db, "users", otherUid));
    const profile = otherSnap.exists() ? otherSnap.data() : {};
    const targetName = otherSnap.exists() ? getName(profile, null) : otherName;
    const profileIdentity = document.getElementById("profileIdentity");
    const profileAvatar = document.getElementById("profileAvatar");
    profileIdentity.href = `other.html?uid=${encodeURIComponent(otherUid)}`;
    profileIdentity.setAttribute("aria-label", `Visit ${targetName}'s profile`);
    document.getElementById("profileInitial").textContent = targetName.charAt(0).toUpperCase();
    profileAvatar.hidden = true;
    const avatarUrl = profile.avatarUrl || profile.photoURL || profile.photoUrl || profile.profileImage || "";
    if (avatarUrl) profileAvatar.src = avatarUrl;
    else profileAvatar.removeAttribute("src");
    profileAvatar.alt = `${targetName}'s profile photo`;
    profileAvatar.onload = () => { profileAvatar.hidden = false; };
    profileAvatar.onerror = () => { profileAvatar.hidden = true; };
    document.getElementById("chatName").textContent = targetName;
    await checkBlockStatus();
    if (!blocked && await checkMutualFollow()) callBtn.hidden = false;
    else callBtn.hidden = true;
    listenForCalls();
  }
  loadMessages();
}

function loadMessages() {
  if (messagesUnsubscribe) messagesUnsubscribe();
  initialMessagesLoaded = false;
  const q = query(collection(db, "messages", conversationId, "chat"), orderBy("time"));

  messagesUnsubscribe = onSnapshot(q, snapshot => {
    const wasNearBottom = messagesEl.scrollHeight - messagesEl.scrollTop - messagesEl.clientHeight < 120;
    const shouldScrollToBottom = !initialMessagesLoaded || wasNearBottom;
    if (initialMessagesLoaded) {
      snapshot.docChanges().forEach(change => {
        const message = change.doc.data();
        if (change.type === "added" && message.senderId !== currentUser.uid) {
          window.whisprNotify?.("New message", `${message.senderName || "Someone"}: ${message.text || "Sent you a message."}`, { tag: `message-${change.doc.id}` });
        }
      });
    }
    initialMessagesLoaded = true;
    messagesEl.replaceChildren();
    if (snapshot.empty) {
      showEmpty("This is the beginning of your conversation.");
      return;
    }
    snapshot.forEach(messageDoc => {
      const message = messageDoc.data();
      const bubble = document.createElement("div");
      const isSent = message.senderId === currentUser.uid;
      bubble.className = `msg ${isSent ? "sent" : "received"}`;
      if (groupId && !isSent) {
        const sender = document.createElement("a");
        sender.className = "sender-name";
        sender.textContent = message.senderName || "Member";
        if (message.senderId) sender.href = `other.html?uid=${encodeURIComponent(message.senderId)}`;
        bubble.appendChild(sender);
      }
      const text = document.createElement("span");
      text.textContent = message.text || "";
      bubble.appendChild(text);
      const time = escapeTime(message.time);
      if (time) {
        const timeEl = document.createElement("span");
        timeEl.className = "msg-time";
        timeEl.textContent = time;
        bubble.appendChild(timeEl);
      }
      messagesEl.appendChild(bubble);
    });
    if (shouldScrollToBottom) messagesEl.scrollTop = messagesEl.scrollHeight;
  }, error => {
    console.error("Could not load messages", error);
    setNotice("Could not load messages. Check your access permissions.");
    showEmpty("Unable to load messages.");
  });
}

document.getElementById("sendForm").addEventListener("submit", async event => {
  event.preventDefault();
  const text = input.value.trim();
  if (!text || !canUseMessaging() || sendingMessage) return;
  const sendBtn = document.getElementById("sendBtn");
  sendingMessage = true;
  sendBtn.disabled = true;
  let messageSaved = false;
  try {
    await addDoc(collection(db, "messages", conversationId, "chat"), {
      text,
      senderId: currentUser.uid,
      senderName: currentName,
      time: serverTimestamp()
    });
    messageSaved = true;
    input.value = "";
    const recipientIds = members.filter(uid => uid !== currentUser.uid);
    const updates = [setDoc(doc(db, "userChats", currentUser.uid), {
      [conversationId]: {
        conversationId,
        ...(groupId ? { isGroup: true, groupName: document.getElementById("chatName").textContent, memberIds: members } : { otherUserId: otherUid, otherUsername: document.getElementById("chatName").textContent }),
        lastMessageText: text,
        lastMessageTime: serverTimestamp(),
        unreadCount: 0
      }
    }, { merge: true })];
    for (const uid of recipientIds) {
      const chatEntry = groupId
        ? { conversationId, isGroup: true, groupName: document.getElementById("chatName").textContent, memberIds: members, lastMessageText: text, lastMessageTime: serverTimestamp(), unreadCount: increment(1) }
        : { conversationId, otherUserId: currentUser.uid, otherUsername: currentName, lastMessageText: text, lastMessageTime: serverTimestamp(), unreadCount: increment(1) };
      updates.push(setDoc(doc(db, "userChats", uid), { [conversationId]: chatEntry }, { merge: true }));
    }
    await Promise.all(updates);
    setNotice("");
  } catch (error) {
    console.error(messageSaved ? "Message sent but chat preview could not update" : "Could not send message", error);
    setNotice(messageSaved
      ? "Message sent, but the conversation preview could not be updated."
      : "Message not sent. Please try again.");
  } finally {
    sendingMessage = false;
    updateComposer();
  }
});

blockBtn.addEventListener("click", async () => {
  if (!otherUid || !currentUser) return;
  const mine = await getDoc(doc(db, "users", currentUser.uid));
  const blockedList = mine.exists() ? (mine.data().blockedUsers || []) : [];
  const isBlockedByMe = blockedList.includes(otherUid);
  const confirmText = isBlockedByMe ? "Unblock this person?" : "Block this person? They will no longer be able to message you.";
  const confirmed = window.whisprConfirm
    ? await window.whisprConfirm(confirmText, { title: isBlockedByMe ? "Unblock person" : "Block person", confirmText: isBlockedByMe ? "Unblock" : "Block", danger: !isBlockedByMe })
    : window.confirm(confirmText);
  if (!confirmed) return;
  try {
    await updateDoc(doc(db, "users", currentUser.uid), { blockedUsers: isBlockedByMe ? arrayRemove(otherUid) : arrayUnion(otherUid) });
    await checkBlockStatus();
    setNotice(isBlockedByMe ? "Person unblocked." : "Person blocked.");
  } catch (error) {
    console.error("Block update failed", error);
    setNotice("Could not update block settings.");
  }
});

// WebRTC audio uses Firestore documents and candidate subcollections for signaling.
function newPeer() {
  peer = new RTCPeerConnection({ iceServers: [{ urls: "stun:stun.l.google.com:19302" }] });
  peer.ontrack = event => { remoteAudio.srcObject = event.streams[0]; };
  peer.onconnectionstatechange = () => {
    if (peer?.connectionState === "connected") callStatus.textContent = "Connected";
    if (peer?.connectionState === "failed") callStatus.textContent = "Call connection failed. You may need to try again.";
    if (peer?.connectionState === "disconnected") callStatus.textContent = "Call disconnected";
  };
  return peer;
}
async function startLocalAudio() {
  if (!navigator.mediaDevices?.getUserMedia) throw new Error("Voice calls need a supported browser and a secure connection.");
  localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
  localStream.getTracks().forEach(track => peer.addTrack(track, localStream));
}
function listenCandidates(callId, collectionName) {
  const stop = onSnapshot(collection(db, "calls", callId, collectionName), snapshot => {
    snapshot.docChanges().forEach(change => {
      if (change.type === "added" && peer) peer.addIceCandidate(new RTCIceCandidate(change.doc.data())).catch(console.warn);
    });
  }, error => console.warn("Call candidate listener failed", error));
  candidateUnsubscribes.push(stop);
}
function cleanupCall() {
  if (callUnsubscribe) callUnsubscribe();
  callUnsubscribe = null;
  candidateUnsubscribes.forEach(stop => stop());
  candidateUnsubscribes = [];
  if (peer) peer.close();
  peer = null;
  if (localStream) localStream.getTracks().forEach(track => track.stop());
  localStream = null;
  remoteAudio.srcObject = null;
  activeCallId = null;
  callOverlay.hidden = true;
  document.getElementById("acceptCallBtn").hidden = true;
}
async function endCall(updateServer = true) {
  const id = activeCallId;
  if (updateServer && id) {
    try { await updateDoc(doc(db, "calls", id), { status: "ended", endedAt: serverTimestamp() }); } catch (error) { console.warn("Call end signal failed", error); }
  }
  cleanupCall();
}
async function startCall() {
  if (groupId || blocked || !await checkMutualFollow()) {
    setNotice("Voice calls are available only between people who follow each other.");
    callBtn.hidden = true;
    return;
  }
  callBtn.disabled = true;
  try {
    callOverlay.hidden = false;
    document.getElementById("callTitle").textContent = `Calling ${document.getElementById("chatName").textContent}`;
    callStatus.textContent = "Waiting for them to answer…";
    newPeer();
    await startLocalAudio();
    const callRef = doc(collection(db, "calls"));
    activeCallId = callRef.id;
    peer.onicecandidate = event => {
      if (event.candidate) addDoc(collection(db, "calls", callRef.id, "callerCandidates"), event.candidate.toJSON()).catch(console.warn);
    };
    const offer = await peer.createOffer();
    await peer.setLocalDescription(offer);
    await setDoc(callRef, { callerId: currentUser.uid, calleeId: otherUid, conversationId, offer: { type: offer.type, sdp: offer.sdp }, status: "ringing", createdAt: serverTimestamp() });
    listenCandidates(callRef.id, "calleeCandidates");
    callUnsubscribe = onSnapshot(callRef, async snapshot => {
      const data = snapshot.data();
      if (!data) return;
      if (data.answer && peer?.signalingState !== "stable") {
        await peer.setRemoteDescription(new RTCSessionDescription(data.answer));
        callStatus.textContent = "Connecting…";
      }
      if (data.status === "ended" || data.status === "declined") {
        callStatus.textContent = data.status === "declined" ? "Call declined" : "Call ended";
        setTimeout(() => cleanupCall(), 900);
      }
    });
  } catch (error) {
    console.error("Could not start voice call", error);
    setNotice(error.message || "Could not start the call. Check microphone permissions.");
    await endCall(false);
  } finally { callBtn.disabled = false; }
}

async function acceptCall(callId, callData) {
  document.getElementById("acceptCallBtn").disabled = true;
  try {
    if (blocked || !await checkMutualFollow()) throw new Error("Voice calls are only available between mutual follows.");
    activeCallId = callId;
    callOverlay.hidden = false;
    document.getElementById("callTitle").textContent = "Incoming voice call";
    callStatus.textContent = "Connecting…";
    newPeer();
    await startLocalAudio();
    peer.onicecandidate = event => {
      if (event.candidate) addDoc(collection(db, "calls", callId, "calleeCandidates"), event.candidate.toJSON()).catch(console.warn);
    };
    await peer.setRemoteDescription(new RTCSessionDescription(callData.offer));
    const answer = await peer.createAnswer();
    await peer.setLocalDescription(answer);
    await updateDoc(doc(db, "calls", callId), { answer: { type: answer.type, sdp: answer.sdp }, status: "accepted", acceptedAt: serverTimestamp() });
    listenCandidates(callId, "callerCandidates");
    callUnsubscribe = onSnapshot(doc(db, "calls", callId), snapshot => {
      if (snapshot.data()?.status === "ended") {
        callStatus.textContent = "Call ended";
        setTimeout(() => cleanupCall(), 900);
      }
    });
  } catch (error) {
    console.error("Could not answer call", error);
    setNotice(error.message || "Could not answer. Check microphone permissions.");
    await endCall();
  } finally { document.getElementById("acceptCallBtn").disabled = false; }
}

function listenForCalls() {
  if (incomingUnsubscribe) incomingUnsubscribe();
  const q = query(collection(db, "calls"), where("calleeId", "==", currentUser.uid), where("status", "==", "ringing"));
  incomingUnsubscribe = onSnapshot(q, snapshot => {
    if (activeCallId) return;
    const incoming = snapshot.docs.find(item => item.data().callerId === otherUid && item.data().conversationId === conversationId);
    if (!incoming) return;
    activeCallId = incoming.id;
    const data = incoming.data();
    window.whisprNotify?.("Incoming voice call", `${document.getElementById("chatName").textContent} is calling.`, { tag: `call-${incoming.id}` });
    callOverlay.hidden = false;
    document.getElementById("callTitle").textContent = "Incoming voice call";
    callStatus.textContent = `${document.getElementById("chatName").textContent} is calling…`;
    document.getElementById("acceptCallBtn").hidden = false;
    document.getElementById("acceptCallBtn").onclick = () => acceptCall(incoming.id, data);
  }, error => console.warn("Incoming call listener failed", error));
}
callBtn.addEventListener("click", startCall);
document.getElementById("endCallBtn").addEventListener("click", () => endCall(true));

document.addEventListener("visibilitychange", () => {
  if (!document.hidden && currentUser && !groupId && otherUid) checkBlockStatus();
});
window.addEventListener("beforeunload", () => {
  if (messagesUnsubscribe) messagesUnsubscribe();
  if (incomingUnsubscribe) incomingUnsubscribe();
  cleanupCall();
});

onAuthStateChanged(auth, async user => {
  if (!user) { window.location.href = "login.html"; return; }
  currentUser = user;
  conversationId = groupId || (otherUid ? [user.uid, otherUid].sort().join("_") : "");
  try {
    if (!groupId && otherUid) {
      const chatsSnap = await getDoc(doc(db, "userChats", user.uid));
      if (chatsSnap.exists()) {
        const existingChat = Object.entries(chatsSnap.data()).find(([id, chat]) =>
          !chat?.isGroup && (
            chat?.otherUserId === otherUid ||
            (Array.isArray(chat?.memberIds) && chat.memberIds.includes(user.uid) && chat.memberIds.includes(otherUid))
          )
        );
        if (existingChat) conversationId = existingChat[1].conversationId || existingChat[0];
      }
    }
    if (conversationId) {
      try {
        await setDoc(doc(db, "userChats", user.uid), { [conversationId]: { unreadCount: 0 } }, { merge: true });
      } catch (error) {
        console.warn("Could not clear unread count", error);
      }
    }
    const userSnap = await getDoc(doc(db, "users", user.uid));
    currentName = userSnap.exists() ? getName(userSnap.data(), user) : getName(null, user);
    await initChat();
  } catch (error) {
    console.error("Could not initialize chat", error);
    setNotice(error.message || "Could not open this conversation.");
    showEmpty(error.message || "Could not open this conversation.");
    input.disabled = true;
    document.getElementById("sendBtn").disabled = true;
  }
});
