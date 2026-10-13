import {
  collection,
  documentId,
  getDocs,
  limit,
  orderBy,
  query,
  startAt,
  endAt,
  doc,
  getDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const MAX_RESULTS = 8;

export async function searchUsers(db, value, currentUid) {
  const term = value.trim().toLowerCase();
  if (!term) return [];

  const matches = new Map();
  const failures = [];

  try {
    const usernameQuery = query(
      collection(db, "usernames"),
      orderBy(documentId()),
      startAt(term),
      endAt(`${term}\uf8ff`),
      limit(MAX_RESULTS)
    );
    const usernameSnapshot = await getDocs(usernameQuery);
    await Promise.all(usernameSnapshot.docs.map(async usernameDoc => {
      const uid = usernameDoc.data().uid;
      if (!uid || uid === currentUid) return;
      const userSnapshot = await getDoc(doc(db, "users", uid));
      if (userSnapshot.exists()) matches.set(uid, { uid, ...userSnapshot.data() });
    }));
  } catch (error) {
    failures.push(error);
  }

  try {
    const emailQuery = query(
      collection(db, "users"),
      orderBy("email"),
      startAt(term),
      endAt(`${term}\uf8ff`),
      limit(MAX_RESULTS)
    );
    const emailSnapshot = await getDocs(emailQuery);
    emailSnapshot.docs.forEach(userDoc => {
      if (userDoc.id !== currentUid) matches.set(userDoc.id, { uid: userDoc.id, ...userDoc.data() });
    });
  } catch (error) {
    failures.push(error);
  }

  if (!matches.size && failures.length === 2) throw failures[0];
  return [...matches.values()].slice(0, MAX_RESULTS);
}

export function userDisplayName(user) {
  return user.username || user.displayName || "WHISPR user";
}

export function userAvatar(user) {
  return user.avatarUrl || user.photoURL || user.photoUrl || user.profileImage || "";
}
