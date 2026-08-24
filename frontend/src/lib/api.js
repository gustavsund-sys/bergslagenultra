import {
  collection, doc, getDoc, getDocs, onSnapshot, orderBy, query,
  runTransaction, serverTimestamp, setDoc, updateDoc, where, writeBatch,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

export const LOGO_URL = `${process.env.PUBLIC_URL}/assets/bergslagen-logo.jpg`;
export const DISTANCES = ["6 km", "14 km", "47 km"];

const privateCollection = collection(db, "registrations_private");
const publicCollection = collection(db, "registrations_public");

function appError(message) {
  const error = new Error(message);
  error.response = { data: { detail: message } };
  return error;
}

export function formatApiErrorDetail(detail) {
  if (detail == null) return "Något gick fel. Försök igen.";
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) return detail.map((e) => e?.msg || String(e)).join(" ");
  if (detail && typeof detail.msg === "string") return detail.msg;
  return String(detail);
}

function fromSnapshot(snapshot) {
  const data = snapshot.data({ serverTimestamps: "estimate" });
  return Object.fromEntries(Object.entries(data).map(([key, value]) => [
    key,
    value && typeof value.toDate === "function" ? value.toDate().toISOString() : value,
  ]));
}

function sortByBib(rows) {
  return [...rows].sort((a, b) => Number(a.bib_number) - Number(b.bib_number));
}

function groupStartList(rows) {
  const groups = Object.fromEntries(DISTANCES.map((distance) => [distance, []]));
  sortByBib(rows).forEach((row) => {
    if (groups[row.distance]) groups[row.distance].push(row);
  });
  return { distances: DISTANCES, groups };
}

function groupResults(rows) {
  const groups = Object.fromEntries(DISTANCES.map((distance) => [distance, []]));
  rows.filter((row) => row.finish_seconds != null).forEach((row) => {
    if (groups[row.distance]) groups[row.distance].push(row);
  });
  DISTANCES.forEach((distance) => {
    groups[distance].sort((a, b) => a.finish_seconds - b.finish_seconds);
    groups[distance] = groups[distance].map((row, index) => ({ ...row, rank: index + 1 }));
  });
  return { distances: DISTANCES, groups };
}

async function readRows(ref = publicCollection) {
  const snapshot = await getDocs(query(ref, orderBy("bib_number", "asc")));
  return snapshot.docs.map(fromSnapshot);
}

export function subscribePublicRows(callback, onError = () => {}) {
  return onSnapshot(query(publicCollection, orderBy("bib_number", "asc")),
    (snapshot) => callback(snapshot.docs.map(fromSnapshot)), onError);
}

export function subscribeAdminRows(callback, onError = () => {}) {
  return onSnapshot(query(privateCollection, orderBy("bib_number", "asc")),
    (snapshot) => callback(snapshot.docs.map(fromSnapshot)), onError);
}

export function subscribeTiming(callback, onError = () => {}) {
  return onSnapshot(collection(db, "timing"), (snapshot) => {
    const state = Object.fromEntries(DISTANCES.map((distance) => [distance, null]));
    snapshot.docs.forEach((item) => {
      const data = fromSnapshot(item);
      if (DISTANCES.includes(data.distance)) state[data.distance] = data.start_time || null;
    });
    callback(state);
  }, onError);
}

function parseTime(value) {
  const match = String(value).trim().match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (!match) throw appError("Ogiltigt tidsformat. Använd TT:MM:SS eller MM:SS.");
  const parts = match.slice(1).filter((part) => part !== undefined).map(Number);
  const [hours, minutes, seconds] = parts.length === 3 ? parts : [0, parts[0], parts[1]];
  if (minutes >= 60 || seconds >= 60) throw appError("Minuter och sekunder måste vara under 60.");
  return {
    seconds: hours * 3600 + minutes * 60 + seconds,
    formatted: `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`,
  };
}

async function createRegistration(payload) {
  if (!DISTANCES.includes(payload.distance)) throw appError("Ogiltig distans.");
  return runTransaction(db, async (transaction) => {
    const counterRef = doc(db, "metadata", "counters");
    const counterSnapshot = await transaction.get(counterRef);
    if (!counterSnapshot.exists()) {
      throw appError("Startnummerräknaren saknas. Skapa metadata/counters med nextBib = 1 i Firestore.");
    }
    const bib = Number(counterSnapshot.data().nextBib);
    if (!Number.isInteger(bib) || bib < 1) throw appError("Startnummerräknaren är felkonfigurerad.");
    const id = String(bib);
    const common = {
      bib_number: bib,
      name: payload.name.trim(),
      club: payload.club.trim() || "Klubblös",
      nationality: payload.nationality.trim(),
      distance: payload.distance,
      finish_time: null,
      finish_seconds: null,
      created_at: serverTimestamp(),
    };
    const privateData = {
      ...common,
      birthdate: payload.birthdate.trim(),
      email: payload.email.trim().toLowerCase(),
      medal: payload.distance === "47 km" ? payload.medal : null,
      bus_transfer: payload.distance === "47 km" ? payload.bus_transfer : null,
      paid: false,
    };
    transaction.set(doc(db, "registrations_private", id), privateData);
    transaction.set(doc(db, "registrations_public", id), common);
    transaction.update(counterRef, { nextBib: bib + 1 });
    return { ...privateData, created_at: new Date().toISOString() };
  });
}

async function setFinish(bib, value) {
  const parsed = parseTime(value);
  const id = String(bib);
  const privateRef = doc(db, "registrations_private", id);
  const snapshot = await getDoc(privateRef);
  if (!snapshot.exists()) throw appError("Deltagarnummer hittades inte.");
  const batch = writeBatch(db);
  const update = { finish_time: parsed.formatted, finish_seconds: parsed.seconds };
  batch.update(privateRef, update);
  batch.update(doc(db, "registrations_public", id), update);
  await batch.commit();
  return { ...fromSnapshot(snapshot), ...update };
}

async function clearFinish(bib) {
  const id = String(bib);
  const batch = writeBatch(db);
  const update = { finish_time: null, finish_seconds: null };
  batch.update(doc(db, "registrations_private", id), update);
  batch.update(doc(db, "registrations_public", id), update);
  await batch.commit();
}

async function resetTiming(distance = null) {
  const registrations = distance
    ? await getDocs(query(privateCollection, where("distance", "==", distance)))
    : await getDocs(privateCollection);
  const operations = [];
  registrations.docs.forEach((item) => {
    const update = { finish_time: null, finish_seconds: null };
    operations.push([doc(db, "registrations_private", item.id), update]);
    operations.push([doc(db, "registrations_public", item.id), update]);
  });
  (distance ? [distance] : DISTANCES).forEach((item) => operations.push([
    doc(db, "timing", item.replace(" ", "-")),
    { distance: item, start_time: null },
  ]));
  for (let offset = 0; offset < operations.length; offset += 450) {
    const batch = writeBatch(db);
    operations.slice(offset, offset + 450).forEach(([ref, update]) => batch.set(ref, update, { merge: true }));
    await batch.commit();
  }
}

async function request(method, path, body) {
  if (method === "get" && path === "/startlist") return { data: groupStartList(await readRows()) };
  if (method === "get" && path === "/results") return { data: groupResults(await readRows()) };
  if (method === "get" && path === "/admin/registrations") return { data: await readRows(privateCollection) };
  if (method === "get" && path.startsWith("/admin/lookup/")) {
    const snapshot = await getDoc(doc(db, "registrations_private", path.split("/").pop()));
    if (!snapshot.exists()) throw appError("Deltagarnummer hittades inte.");
    return { data: fromSnapshot(snapshot) };
  }
  if (method === "get" && path === "/admin/timing") {
    const snapshot = await getDocs(collection(db, "timing"));
    const state = Object.fromEntries(DISTANCES.map((distance) => [distance, null]));
    snapshot.docs.forEach((item) => {
      const data = fromSnapshot(item);
      if (DISTANCES.includes(data.distance)) state[data.distance] = data.start_time || null;
    });
    return { data: state };
  }
  if (method === "post" && path === "/registrations") return { data: await createRegistration(body) };
  if (method === "post" && path === "/admin/finish") return { data: await setFinish(body.bib_number, body.finish_time) };
  if (method === "post" && /\/admin\/registrations\/\d+\/paid$/.test(path)) {
    const bib = path.split("/")[3];
    await updateDoc(doc(db, "registrations_private", bib), { paid: Boolean(body.paid) });
    return { data: { bib_number: Number(bib), paid: Boolean(body.paid) } };
  }
  if (method === "post" && path === "/admin/timing/start") {
    const localStart = new Date().toISOString();
    await setDoc(doc(db, "timing", body.distance.replace(" ", "-")), {
      distance: body.distance, start_time: serverTimestamp(),
    });
    return { data: { distance: body.distance, start_time: localStart } };
  }
  if (method === "post" && path === "/admin/timing/reset") {
    await resetTiming(body.distance);
    return { data: { distance: body.distance, start_time: null } };
  }
  if (method === "post" && path === "/admin/timing/reset-all") {
    await resetTiming();
    return { data: { message: "Tidtagningen är nollställd." } };
  }
  if (method === "delete" && path.startsWith("/admin/finish/")) {
    await clearFinish(path.split("/").pop());
    return { data: { message: "Tid rensad" } };
  }
  if (method === "delete" && path.startsWith("/admin/registrations/")) {
    const bib = path.split("/").pop();
    const batch = writeBatch(db);
    batch.delete(doc(db, "registrations_private", bib));
    batch.delete(doc(db, "registrations_public", bib));
    await batch.commit();
    return { data: { message: "Anmälan borttagen" } };
  }
  throw appError(`Okänd dataoperation: ${method.toUpperCase()} ${path}`);
}

export const api = {
  get: (path) => request("get", path),
  post: (path, body = {}) => request("post", path, body),
  delete: (path) => request("delete", path),
};

export const publicData = { groupStartList, groupResults };
