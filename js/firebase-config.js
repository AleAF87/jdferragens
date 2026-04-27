import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import { getDatabase } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-database.js";
import { getAuth, GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";

const firebaseConfig = {
    apiKey: "AIzaSyC6ns13xNr8km7XgX-bvGE7iHr0hpWlwvI",
    authDomain: "jdferragens-30d99.firebaseapp.com",
    databaseURL: "https://jdferragens-30d99-default-rtdb.firebaseio.com",
    projectId: "jdferragens-30d99",
    storageBucket: "jdferragens-30d99.firebasestorage.app",
    messagingSenderId: "195251144568",
    appId: "1:195251144568:web:0d3fd13b2971d28ec36a8d"
};

const app = initializeApp(firebaseConfig);
const database = getDatabase(app, firebaseConfig.databaseURL);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

export { app, database, auth, provider, firebaseConfig };
