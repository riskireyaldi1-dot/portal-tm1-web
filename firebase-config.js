// ======================================================================
// KONFIGURASI FIREBASE - Portal Kelas TM-1
// ======================================================================
// File ini isinya "alamat" project Firebase kamu, dipakai supaya
// website bisa terhubung ke Firestore Database.
// Ini BUKAN password rahasia — aman untuk terlihat oleh siapa saja
// yang buka website (memang begitu cara kerja Firebase untuk web).
// ======================================================================

const firebaseConfig = {
  apiKey: "AIzaSyC3WVGTLUoyNEFQaEiXzRljAMjAc714SCQ",
  authDomain: "portal-tm1.firebaseapp.com",
  projectId: "portal-tm1",
  storageBucket: "portal-tm1.firebasestorage.app",
  messagingSenderId: "702305091551",
  appId: "1:702305091551:web:a527a6fd29024dcb5f8e6a",
  measurementId: "G-BW0QNH6XT0"
};

// Menyalakan koneksi ke Firebase (pakai versi "compat" supaya cukup
// dengan tag <script> biasa, tidak perlu npm/build tool).
firebase.initializeApp(firebaseConfig);

// db = "pintu masuk" ke database Firestore, dipakai di database.js
const db = firebase.firestore();
