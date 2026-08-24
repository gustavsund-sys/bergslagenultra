import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAqc0rpskfEyIoXi4I6y6j3XCg7SXyxbUk",
  authDomain: "bergslagenultra.firebaseapp.com",
  projectId: "bergslagenultra",
  storageBucket: "bergslagenultra.firebasestorage.app",
  messagingSenderId: "219813830447",
  appId: "1:219813830447:web:8699138946df66f89a8bda",
};

export const firebaseApp = initializeApp(firebaseConfig);
export const auth = getAuth(firebaseApp);
export const db = getFirestore(firebaseApp);
