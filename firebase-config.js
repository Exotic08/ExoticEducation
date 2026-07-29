const firebaseConfig = {
  apiKey: "AIzaSyBs4RYOu1AFKgiMqmbwtpZ8oE_bF3UL5vw",
  authDomain: "exoticstudy-f9f71.firebaseapp.com",
  databaseURL: "https://exoticstudy-f9f71-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "exoticstudy-f9f71",
  storageBucket: "exoticstudy-f9f71.firebasestorage.app",
  messagingSenderId: "1038878451591",
  appId: "1:1038878451591:web:069594341fb5f893ed9522",
  measurementId: "G-JPGZ2RXY38"
};

firebase.initializeApp(firebaseConfig);
export const db = firebase.database();