import { initializeApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, doc, setDoc } from 'firebase/firestore';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID,
  measurementId: process.env.VITE_FIREBASE_MEASUREMENT_ID
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Admin user credentials
const ADMIN_EMAIL = 'admin@retta.fi';
const ADMIN_PASSWORD = 'RettaAdmin2024!';

async function createAdminUser() {
  try {
    console.log('🔧 Creating admin user...');
    
    // Create user in Firebase Auth
    const userCredential = await createUserWithEmailAndPassword(
      auth,
      ADMIN_EMAIL,
      ADMIN_PASSWORD
    );
    
    const user = userCredential.user;
    console.log('✅ Admin user created successfully!');
    console.log('📧 Email:', ADMIN_EMAIL);
    console.log('🔑 Password:', ADMIN_PASSWORD);
    console.log('🆔 User ID:', user.uid);
    
    // Optionally, add user metadata to Firestore
    await setDoc(doc(db, 'users', user.uid), {
      email: ADMIN_EMAIL,
      role: 'admin',
      createdAt: new Date().toISOString(),
      displayName: 'Retta Admin'
    });
    
    console.log('📝 User metadata saved to Firestore');
    console.log('\n✨ You can now login with:');
    console.log('   Email: ', ADMIN_EMAIL);
    console.log('   Password:', ADMIN_PASSWORD);
    
    process.exit(0);
  } catch (error) {
    if (error.code === 'auth/email-already-in-use') {
      console.log('⚠️ Admin user already exists!');
      console.log('📧 Email:', ADMIN_EMAIL);
      console.log('🔑 Password:', ADMIN_PASSWORD);
    } else {
      console.error('❌ Error creating admin user:', error.message);
    }
    process.exit(1);
  }
}

// Run the function
createAdminUser();