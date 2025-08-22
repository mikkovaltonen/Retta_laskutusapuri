// Script to force update the system prompt in Firestore
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyC_iVQPJnlo8l3Vv-L98cMYO0bRYFQHJi0",
  authDomain: "retta-invoicing.firebaseapp.com",
  projectId: "retta-invoicing",
  storageBucket: "retta-invoicing.firebasestorage.app",
  messagingSenderId: "106802303117",
  appId: "1:106802303117:web:3a3c674bb33f13d28b5df8"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function updatePrompt() {
  try {
    // Read the prompt file
    const promptPath = join(__dirname, '..', 'public', 'invoicing_prompt.md');
    const promptText = readFileSync(promptPath, 'utf-8');
    
    console.log('📖 Read prompt file, length:', promptText.length);
    
    // Create new prompt version for shared workspace
    const promptData = {
      promptText: promptText,
      version: Date.now(), // Use timestamp as version
      savedDate: serverTimestamp(),
      evaluation: 'Päivitetty älykkäällä tuotteiden yhdistämisellä',
      aiModel: 'gemini-2.0-flash-exp',
      userId: 'SYSTEM',
      userEmail: 'admin@retta.fi',
      workspace: 'invoicer', // Shared workspace
      isShared: true
    };
    
    // Save to Firestore
    const docRef = await addDoc(collection(db, 'systemPrompts'), promptData);
    console.log('✅ Prompt saved to Firestore with ID:', docRef.id);
    console.log('📝 Workspace:', promptData.workspace);
    console.log('🎯 Version:', promptData.version);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error updating prompt:', error);
    process.exit(1);
  }
}

updatePrompt();