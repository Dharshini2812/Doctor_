const express = require('express');
const http = require('http');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.static('public'));

const server = http.createServer(app);

const { Server } = require('socket.io');
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Patient Profile Generator with Medical Condition Datasets
const patientNames = [
  'Sarah Johnson', 'Michael Chen', 'Emily Rodriguez', 'David Kim', 'Jessica Williams',
  'James Martinez', 'Amanda Taylor', 'Robert Brown', 'Lisa Anderson', 'Christopher Lee',
  'Maria Garcia', 'Daniel Wilson', 'Jennifer Thomas', 'Matthew Jackson', 'Patricia White',
  'Andrew Harris', 'Linda Martin', 'Joseph Thompson', 'Barbara Moore', 'William Davis'
];

const medicalConditions = {
  'Upper Respiratory Infection': {
    symptoms: ['persistent cough', 'sore throat', 'runny nose', 'congestion', 'mild fever', 'headache', 'body aches', 'fatigue'],
    painLocations: ['throat', 'chest', 'sinuses'],
    typicalTemp: { min: 37.5, max: 39.0 },
    typicalDuration: ['2 days', '3 days', '4 days', '5 days', '1 week']
  },
  'Gastroenteritis': {
    symptoms: ['nausea', 'vomiting', 'diarrhea', 'abdominal cramps', 'fever', 'loss of appetite', 'dehydration', 'weakness'],
    painLocations: ['lower abdomen', 'upper abdomen', 'stomach'],
    typicalTemp: { min: 37.0, max: 38.5 },
    typicalDuration: ['1 day', '2 days', '3 days', '4 days']
  },
  'Migraine': {
    symptoms: ['severe headache', 'sensitivity to light', 'sensitivity to sound', 'nausea', 'dizziness', 'blurred vision', 'aura'],
    painLocations: ['head', 'temple', 'forehead', 'back of head'],
    typicalTemp: { min: null, max: null },
    typicalDuration: ['few hours', '4 hours', '6 hours', '1 day', '2 days']
  },
  'Urinary Tract Infection': {
    symptoms: ['burning sensation when urinating', 'frequent urination', 'lower abdominal pain', 'cloudy urine', 'fever', 'pelvic pain'],
    painLocations: ['lower abdomen', 'pelvic area', 'back'],
    typicalTemp: { min: 37.5, max: 38.5 },
    typicalDuration: ['1 day', '2 days', '3 days']
  },
  'Bronchitis': {
    symptoms: ['persistent cough', 'chest discomfort', 'shortness of breath', 'fatigue', 'mild fever', 'production of mucus', 'wheezing'],
    painLocations: ['chest', 'throat'],
    typicalTemp: { min: 37.0, max: 38.0 },
    typicalDuration: ['3 days', '1 week', '2 weeks']
  },
  'Sinusitis': {
    symptoms: ['facial pain', 'nasal congestion', 'thick nasal discharge', 'headache', 'postnasal drip', 'cough', 'fever'],
    painLocations: ['forehead', 'cheeks', 'around eyes', 'bridge of nose'],
    typicalTemp: { min: 37.0, max: 38.0 },
    typicalDuration: ['3 days', '1 week', '2 weeks']
  },
  'Arthritis Flare-up': {
    symptoms: ['joint pain', 'stiffness', 'swelling', 'reduced range of motion', 'warmth around joints', 'fatigue'],
    painLocations: ['knees', 'hands', 'wrists', 'shoulders', 'hips'],
    typicalTemp: { min: null, max: null },
    typicalDuration: ['2 days', '3 days', '1 week']
  },
  'Hypertension Symptoms': {
    symptoms: ['headache', 'dizziness', 'chest pain', 'shortness of breath', 'blurred vision', 'fatigue'],
    painLocations: ['head', 'chest'],
    typicalTemp: { min: null, max: null },
    typicalDuration: ['ongoing', 'few days', '1 week']
  }
};

function getRandomItem(array) {
  return array[Math.floor(Math.random() * array.length)];
}

function getRandomAge() {
  return Math.floor(Math.random() * 60) + 18; // Ages 18-77
}

function generateRandomTemperature(condition) {
  if (!condition.typicalTemp || condition.typicalTemp.min === null) {
    return null;
  }
  const temp = condition.typicalTemp.min + Math.random() * (condition.typicalTemp.max - condition.typicalTemp.min);
  return Math.round(temp * 10) / 10;
}

function generatePatientProfile() {
  const conditionName = getRandomItem(Object.keys(medicalConditions));
  const condition = medicalConditions[conditionName];
  const name = getRandomItem(patientNames);
  const age = getRandomAge();
  const symptoms = [...condition.symptoms];
  const selectedSymptoms = [];
  const numSymptoms = Math.floor(Math.random() * 3) + 2; // 2-4 symptoms
  for (let i = 0; i < numSymptoms && symptoms.length > 0; i++) {
    const idx = Math.floor(Math.random() * symptoms.length);
    selectedSymptoms.push(symptoms.splice(idx, 1)[0]);
  }
  const painLocation = getRandomItem(condition.painLocations);
  const duration = getRandomItem(condition.typicalDuration);
  const temperature = generateRandomTemperature(condition);
  const painLevel = Math.floor(Math.random() * 5) + 4; // 4-8 on scale of 10

  return {
    name,
    age,
    condition: conditionName,
    symptoms: selectedSymptoms,
    painLocation,
    painLevel,
    temperature,
    duration,
    coughType: conditionName.includes('Respiratory') || conditionName === 'Bronchitis' 
      ? (Math.random() > 0.5 ? 'dry' : 'productive') 
      : null
  };
}

// Simple in-memory presence map by room
const roomToUsers = new Map();
// Lightweight per-room conversation state with patient profile
const roomState = new Map(); // room -> { profile: {...}, progress, ... }
// Track rooms that already received an initial patient message
const greetedRooms = new Set();

io.on('connection', (socket) => {
  // role: 'doctor' | 'patient', patientId: string
  socket.on('join', ({ role, patientId, displayName }) => {
    if (!patientId || !role) {
      socket.emit('errorMessage', 'Missing role or patientId');
      return;
    }

    const room = `chat:${patientId}`;
    socket.join(room);
    socket.data.role = role;
    socket.data.patientId = patientId;
    socket.data.displayName = displayName || role;

    const users = roomToUsers.get(room) || [];
    users.push({ id: socket.id, role, displayName: socket.data.displayName });
    roomToUsers.set(room, users);

    io.to(room).emit('presence', users);

    // Generate patient profile and start chat when a doctor joins and no greeting sent yet
    if (role === 'doctor' && !greetedRooms.has(room)) {
      greetedRooms.add(room);
      const state = ensureRoomState(room);
      const profile = state.profile;
      
      // Notify patient connected
      io.to(room).emit('patientEvent', {
        type: 'connected',
        message: `New patient ${profile.name} connected`,
        patientId,
        profile,
        timestamp: Date.now()
      });
      
      setTimeout(() => {
        // Personalized initial greeting using patient profile
        const symptomList = profile.symptoms.slice(0, 2).join(' and ');
        const greeting = `Hello doctor, my name is ${profile.name}. I'm ${profile.age} years old and I've been experiencing ${symptomList} for about ${profile.duration}.`;
        
        io.to(room).emit('message', {
          text: greeting,
          role: 'patient',
          displayName: profile.name,
          timestamp: Date.now(),
          status: 'delivered'
        });
      }, 400);
    }
  });

  socket.on('message', ({ text }) => {
    const { patientId, role, displayName } = socket.data || {};
    if (!patientId || !text) return;
    const room = `chat:${patientId}`;
    const payload = {
      text,
      role: role || 'unknown',
      displayName: displayName || role || 'user',
      timestamp: Date.now(),
      status: 'delivered'
    };
    io.to(room).emit('message', payload);

    // Automatic reply only when the sender is the doctor
    if (role === 'doctor') {
      const state = ensureRoomState(room);
      const profile = state.profile;
      const botName = profile.name;
      const replyText = generateContextAwareReply(text, state);
      
      // Show typing indicator
      io.to(room).emit('typing', { role: 'patient', displayName: botName, isTyping: true, patientId });
      
      setTimeout(() => {
        io.to(room).emit('typing', { role: 'patient', displayName: botName, isTyping: false, patientId });
        io.to(room).emit('message', {
          text: replyText,
          role: 'patient',
          displayName: botName,
          timestamp: Date.now(),
          status: 'delivered'
        });
      }, 1000 + Math.random() * 1000); // Random delay between 1-2 seconds
    }
  });

  socket.on('typing', (isTyping) => {
    const { patientId, role, displayName } = socket.data || {};
    if (!patientId) return;
    const room = `chat:${patientId}`;
    socket.to(room).emit('typing', { role, displayName, isTyping: !!isTyping, patientId });
  });

  // Get list of all patients
  socket.on('getPatients', () => {
    const patients = [];
    roomState.forEach((state, room) => {
      if (state.profile) {
        const roomUsers = roomToUsers.get(room) || [];
        const isOnline = roomUsers.some(u => u.role === 'patient');
        const isTyping = false; // Could be enhanced to track typing state
        patients.push({
          id: room.replace('chat:', ''),
          name: state.profile.name,
          age: state.profile.age,
          condition: state.profile.condition,
          online: isOnline,
          typing: isTyping,
          profile: state.profile
        });
      }
    });
    socket.emit('patientsList', patients);
  });

  socket.on('disconnect', () => {
    const { patientId, role } = socket.data || {};
    if (!patientId) return;
    const room = `chat:${patientId}`;
    const users = (roomToUsers.get(room) || []).filter(u => u.id !== socket.id);
    if (users.length === 0) {
      roomToUsers.delete(room);
    } else {
      roomToUsers.set(room, users);
    }
    io.to(room).emit('presence', users);
    
    // Notify doctor if patient disconnected
    if (role === 'patient') {
      io.to(room).emit('patientEvent', {
        type: 'disconnected',
        message: 'Patient disconnected',
        patientId,
        timestamp: Date.now()
      });
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

function ensureRoomState(room) {
  if (!roomState.has(room)) {
    const profile = generatePatientProfile();
    roomState.set(room, {
      profile,
      progress: 0,
      symptomsMentioned: new Set(),
      questionsAnswered: new Set()
    });
  }
  return roomState.get(room);
}

function generateContextAwareReply(text, state) {
  const t = String(text || '').toLowerCase().trim();
  const profile = state.profile;

  // Context-aware intent detection
  const isGreeting = /\b(hello|hi|hey|good\s?(morning|afternoon|evening))\b/.test(t);
  const askSymptoms = /\b(what|which|tell me about|describe|list)\s*(are\s*)?(your\s*)?(symptoms?|problems?|issues?|complaints?)\b/i.test(t);
  const askPainScale = /\b(scale|1[- ]?10|1 to 10|rate|severity|how\s*(bad|severe|intense))\b/.test(t) && /\bpain|ache|hurt|discomfort\b/.test(t);
  const askPainLocation = /\bwhere|location|locate|which\s*(area|part)\b/.test(t) && /\bpain|ache|hurt|discomfort\b/.test(t);
  const askPainDuration = /\b(how long|since when|duration|when did (it|the pain) start)\b/.test(t) && /\bpain|ache|hurt\b/.test(t);
  const askTempValue = /\b(what|which)\s*(is|was)\s*(your|the)\s*(temp|temperature)|(temp|temperature)\s*reading|(do\s*you\s*have\s*a\s*)?fever\b/i.test(t);
  const askFeverDuration = /\b(how long|since when|duration)\b/.test(t) && /\bfever|temperature|temp\b/.test(t);
  const askCough = /\bcough\b/.test(t);
  const askCoughType = /\bcough\b/.test(t) && /\b(dry|wet|productive|phlegm|mucus|type|kind)\b/.test(t);
  const askBreath = /\b(shortness of breath|breathless|wheeze|wheezing|difficulty\s*(breathing|breath))\b/i.test(t);
  const askAge = /\b(?:how\s+old|age|what\s+(?:is|was)\s+(?:your\s+)?age)\b/i.test(t);
  const askNamePattern1 = /\bwhat\s+(?:is|was)\s+(?:your\s+)?name\b/i;
  const askNamePattern2 = /\bwhats\s+(?:your\s+)?name\b/i;
  const askName = askNamePattern1.test(t) || askNamePattern2.test(t) || /\bwho\s+are\s+you\b/i.test(t);
  const askConditionPattern1 = /\bwhat\s+(?:is|was)\s+(?:wrong|the\s+problem|the\s+issue|the\s+matter|your\s+diagnosis)\b/i;
  const askConditionPattern2 = /\bwhat\s+s\s+(?:wrong|the\s+problem|the\s+issue|the\s+matter)\b/i;
  const askCondition = askConditionPattern1.test(t) || askConditionPattern2.test(t) || /\bwhats\s+(?:wrong|the\s+problem)\b/i.test(t);
  const askMedications = /\b(taken|taking|used|any\s*)?(medicines?|medications?|drugs?|pills?)\b/i.test(t);
  const adviseMedication = /\b(paracetamol|ibuprofen|antibiotic|medicin(e|es)|tablet|dose|dosage|take|prescribe)\b/.test(t);
  const adviseTests = /\b(test|blood test|scan|x-?ray|lab|investigation|cbc|rtpcr|mri|ct|ultrasound)\b/.test(t);
  const adviseRestHydrate = /\b(rest|hydrate|water|fluids|oral rehydration|ors|diet|sleep)\b/.test(t);
  const closingThanks = /\b(thanks|thank you|appreciate)\b/.test(t);
  const askAllergies = /\b(allergies?|allergic)\b/i.test(t);

  // Greeting
  if (isGreeting) {
    return `Hello doctor, I'm ${profile.name}.`;
  }

  // Ask for symptoms - context-aware: return symptoms from patient's condition
  if (askSymptoms) {
    const unmentionedSymptoms = profile.symptoms.filter(s => !state.symptomsMentioned.has(s));
    if (unmentionedSymptoms.length > 0) {
      const symptom = getRandomItem(unmentionedSymptoms);
      state.symptomsMentioned.add(symptom);
      if (state.symptomsMentioned.size === 1) {
        return `I have been experiencing ${symptom}.`;
      } else {
        const mentionedList = Array.from(state.symptomsMentioned);
        if (mentionedList.length === profile.symptoms.length) {
          return `The main symptoms I'm experiencing are ${mentionedList.slice(0, -1).join(', ')}, and ${mentionedList[mentionedList.length - 1]}.`;
        } else {
          return `I also have ${symptom}.`;
        }
      }
    } else {
      const allSymptoms = profile.symptoms.join(', ');
      return `I've been experiencing ${allSymptoms}.`;
    }
  }

  // Ask for name
  if (askName) {
    return `My name is ${profile.name}.`;
  }

  // Ask for age
  if (askAge) {
    return `I'm ${profile.age} years old.`;
  }

  // Ask about condition/what's wrong
  if (askCondition) {
    const symptomList = profile.symptoms.slice(0, 2).join(' and ');
    return `I've been having ${symptomList} for about ${profile.duration}.`;
  }

  // Pain scale - use profile data
  if (askPainScale) {
    return `I would rate the pain as ${profile.painLevel} out of 10.`;
  }

  // Pain location - use profile data
  if (askPainLocation) {
    return `The pain is mainly in the ${profile.painLocation}.`;
  }

  // Pain duration - use profile data
  if (askPainDuration) {
    return `The pain started about ${profile.duration} ago.`;
  }

  // Temperature/Fever - use profile data if available
  if (askTempValue) {
    if (profile.temperature !== null && profile.temperature !== undefined) {
      return `My temperature was around ${profile.temperature}°C.`;
    } else {
      // Condition doesn't typically involve fever
      return 'No, I don\'t have a fever.';
    }
  }

  if (askFeverDuration && profile.temperature !== null && profile.temperature !== undefined) {
    return `The fever has lasted about ${profile.duration}.`;
  }

  // Cough - context-aware based on condition
  if (askCoughType && profile.coughType) {
    return `It is a ${profile.coughType} cough.`;
  } else if (askCough) {
    if (profile.coughType) {
      return `Yes, I have a ${profile.coughType} cough.`;
    } else {
      return 'No, I don\'t have a cough.';
    }
  }

  // Breathing issues - check if condition includes this
  if (askBreath) {
    if (profile.symptoms.some(s => s.includes('breath') || s.includes('wheez'))) {
      return 'Yes, I feel slightly short of breath, especially when I exert myself.';
    } else {
      return 'No, I haven\'t noticed any breathing problems.';
    }
  }

  // Medications taken
  if (askMedications) {
    return 'No, I haven\'t taken any medications yet.';
  }

  // Allergies
  if (askAllergies) {
    return 'I don\'t have any known drug allergies.';
  }

  // Doctor advises medication
  if (adviseMedication) {
    return 'Okay doctor, I will take it as advised. Are there any side effects I should watch for?';
  }

  // Doctor orders tests
  if (adviseTests) {
    return 'Alright, I can come in for the tests. When should I schedule them?';
  }

  // Doctor advises rest/hydration
  if (adviseRestHydrate) {
    return 'Okay, I will rest and keep myself hydrated. Are there any specific foods I should avoid?';
  }

  if (closingThanks) {
    return 'Thank you, doctor. I appreciate your help.';
  }

  // Fallback: acknowledge with context
  if (t.length <= 3) {
    return 'Could you please elaborate, doctor?';
  }
  
  // Generic acknowledgment
  return 'I understand, doctor. What should I do next?';
}


