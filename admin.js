// ADMIN-ONLY MODULE. Do not put a shared Admin password/code in this file.
// A user is an Admin only when Firebase Console has an admins/{uid} document.
// Create that document manually for the authorized administrator's UID.
// This prevents ordinary Guests from granting themselves Admin privileges.
import { signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

export async function signInAdmin(auth, db, email, password) {
  const credential = await signInWithEmailAndPassword(auth, email, password);
  const adminDoc = await getDoc(doc(db, "admins", credential.user.uid));
  if (!adminDoc.exists() || adminDoc.data().active !== true) {
    // Signed-in account is not an authorized SchoolTrack Admin.
    await auth.signOut();
    throw new Error("This account has not been approved as a SchoolTrack Admin.");
  }
  return credential.user;
}

export async function checkAdmin(db, uid) {
  if (!uid) return false;
  const adminDoc = await getDoc(doc(db, "admins", uid));
  return adminDoc.exists() && adminDoc.data().active === true;
}
