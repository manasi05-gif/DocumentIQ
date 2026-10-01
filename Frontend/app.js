/**
 * DocumentIQ Frontend Application v6.0
 * Comprehensive Document AI Platform:
 * - Ingestion, Semantic Vector Search & Resilient Gemini RAG
 * - Multi-Style Summaries & Clean Full Document Reader
 * - Interactive Practice Quiz with Live Feedback & Explanations
 * - 3D Flippable Flashcards Deck
 * - Visual Mind Map & Concept Architecture via Mermaid.js
 * - Voice Input (Speech-to-Text) & Audio Reader (Text-to-Speech)
 * - Microsoft Word (.docx) & PDF Exporters
 */

// Application State
const state = {
  activeDocId: null,
  activeDoc: null,
  documents: [],
  activeTab: 'chat',
  summaryType: 'bullet',
  readerMode: 'formatted', // 'formatted' | 'raw'
  isGenerating: false,
  activeDomain: localStorage.getItem('doc_domain') || 'general',
  activeLanguage: localStorage.getItem('doc_language') || 'auto',

  // Authentication State
  currentUser: null,
  authToken: localStorage.getItem('doc_auth_token') || null,

  // Chat Sessions State
  activeSessionId: null,
  activeSessionTitle: 'New Chat',
  sessions: [],
  sessionFilter: '',

  // Quiz & Topic Mastery State
  quizQuestions: [],
  currentQuestionIndex: 0,
  quizScore: 0,
  quizAnswered: false,
  quizSelectedTopic: 'all',
  quizCustomTopic: '',
  quizQuestionResults: [],
  docTopics: [],
  topicMastery: null,

  // Targeted Remedial Ladder Drill State
  targetedDrill: {
    topic: '',
    level: 'beginner',
    questions: [],
    currentIndex: 0,
    score: 0,
    answered: false,
    levelScores: { beginner: 0, intermediate: 0, advanced: 0 },
  },

  // Flashcards State
  flashcards: [],
  currentCardIndex: 0,
  isCardFlipped: false,

  // Cheat Sheet State
  cheatsheetData: null,
  cheatsheetFilter: '',

  // Mindmap State
  mindmap: {
    rawCode: '',
    orientation: 'LR',
    scale: 1.0,
    panX: 0,
    panY: 0,
    isDragging: false,
    dragStartX: 0,
    dragStartY: 0,
    initialPanX: 0,
    initialPanY: 0,
  },

  // Voice & Audio State
  isListening: false,
  speechRecognition: null,
  currentUtterance: null,
  isSpeechPaused: false,
  speechRate: 1.0,
};

// Academic Stream / Domain Profiles
const ACADEMIC_DOMAINS = {
  general: {
    id: 'general',
    name: 'General Academic',
    icon: '🎓',
    cheatsheetFocus: 'comprehensive',
    questions: [
      '💡 What is the main thesis or core objective?',
      '📊 What are the key findings, data points, or takeaways?',
      '⚠️ Are there common misconceptions or limitations?',
      '🚀 Give me a 5-bullet high-yield executive summary',
    ]
  },
  medical: {
    id: 'medical',
    name: 'Medical & Bio',
    icon: '🧬',
    cheatsheetFocus: 'medical',
    questions: [
      '🩺 Clinical signs, symptoms & diagnostic criteria?',
      '💊 Mechanism of action, indications & contraindications?',
      '🧬 Explain the underlying pathophysiology step-by-step',
      '🎯 High-yield exam facts, normal ranges & clinical traps',
    ]
  },
  law: {
    id: 'law',
    name: 'Law & Judiciary',
    icon: '⚖️',
    cheatsheetFocus: 'law',
    questions: [
      '⚖️ Key statutory sections & constitutional articles?',
      '🏛️ Landmark case laws, legal precedents & judicial ratios?',
      '📜 Essential legal tests, ingredients & statutory exceptions?',
      '🛡️ Rights, liabilities & procedural remedies provided?',
    ]
  },
  commerce: {
    id: 'commerce',
    name: 'Commerce & CA',
    icon: '📊',
    cheatsheetFocus: 'commerce',
    questions: [
      '📊 Relevant Accounting Standards (AS/Ind AS) & journal rules?',
      '📐 Financial ratios, formulas & balance sheet treatments?',
      '💼 Tax provisions, deductions & exemptions applicable?',
      '📈 Economic principles, market dynamics & cost curves?',
    ]
  },
  stem: {
    id: 'stem',
    name: 'STEM & Engineering',
    icon: '🔬',
    cheatsheetFocus: 'stem',
    questions: [
      '📐 Key mathematical formulas & derivations with LaTeX?',
      '💻 Algorithm logic, time/space complexity or pseudocode?',
      '🔬 Core scientific laws, physical units & assumptions?',
      '⚙️ Practical engineering trade-offs & edge cases?',
    ]
  },
  humanities: {
    id: 'humanities',
    name: 'Humanities & UPSC',
    icon: '📚',
    cheatsheetFocus: 'humanities',
    questions: [
      '⏳ Chronological timeline of key events & milestone dates?',
      '🏛️ Primary causes, consequences & historical significance?',
      '🧠 Major thinkers, philosophical doctrines & critiques?',
      '🌐 Multi-dimensional analysis (Social, Political, Economic)?',
    ]
  }
};

/**
 * Universal KaTeX Math Renderer for equations in chat, summaries, flashcards & cheat sheets
 */
function renderMath(element) {
  if (!element) return;
  if (window.renderMathInElement) {
    try {
      renderMathInElement(element, {
        delimiters: [
          { left: '$$', right: '$$', display: true },
          { left: '$', right: '$', display: false },
          { left: '\\(', right: '\\)', display: false },
          { left: '\\[', right: '\\]', display: true },
        ],
        throwOnError: false,
      });
    } catch (err) {
      console.warn('KaTeX render error:', err);
    }
  }
}


// Configure Libraries
if (window.marked) {
  marked.setOptions({ breaks: true, gfm: true });
}
if (window.mermaid) {
  mermaid.initialize({
    startOnLoad: false,
    theme: 'dark',
    flowchart: {
      useMaxWidth: false,
      htmlLabels: false, // Disables foreignObject rasterization in Chrome, enabling 100% sharp SVG vectors
      curve: 'basis',
      nodeSpacing: 45,
      rankSpacing: 60,
      padding: 16,
    },
    themeVariables: {
      darkMode: true,
      fontSize: '15px',
      fontFamily: "'Plus Jakarta Sans', system-ui, -apple-system, sans-serif",
      background: '#121826',
      primaryColor: '#161f30',
      primaryTextColor: '#f8fafc',
      primaryBorderColor: '#6366f1',
      lineColor: '#64748b',
      secondaryColor: '#0f172a',
      tertiaryColor: '#161f30',
      clusterBkg: '#0b1120',
      clusterBorder: '#334155',
      titleColor: '#c7d2fe',
      edgeLabelBackground: '#0f172a',
    },
    securityLevel: 'loose',
  });
}

// DOM Elements
const dropzone = document.getElementById('dropzone');
const fileInput = document.getElementById('fileInput');
const uploadProgress = document.getElementById('uploadProgress');
const progressBar = document.getElementById('progressBar');
const uploadStatusText = document.getElementById('uploadStatusText');
const documentList = document.getElementById('documentList');
const docCountBadge = document.getElementById('docCountBadge');
const emptyDocState = document.getElementById('emptyDocState');
const activeDocBadge = document.getElementById('activeDocBadge');
const activeDocName = document.getElementById('activeDocName');
const closeActiveDocBtn = document.getElementById('closeActiveDocBtn');
const sidebarStats = document.getElementById('sidebarStats');
const statWords = document.getElementById('statWords');
const statChunks = document.getElementById('statChunks');
const statReadTime = document.getElementById('statReadTime');
const statSize = document.getElementById('statSize');

// Tabs
const tabBtnChat = document.getElementById('tabBtnChat');
const tabBtnSummary = document.getElementById('tabBtnSummary');
const tabBtnReader = document.getElementById('tabBtnReader');
const tabBtnStudy = document.getElementById('tabBtnStudy');
const tabBtnMindmap = document.getElementById('tabBtnMindmap');

const paneChat = document.getElementById('paneChat');
const paneSummary = document.getElementById('paneSummary');
const paneReader = document.getElementById('paneReader');
const paneStudy = document.getElementById('paneStudy');
const paneMindmap = document.getElementById('paneMindmap');

// Chat & Domain Elements
const chatMessages = document.getElementById('chatMessages');
const chatWelcome = document.getElementById('chatWelcome');
const chatForm = document.getElementById('chatForm');
const chatInput = document.getElementById('chatInput');
const sendBtn = document.getElementById('sendBtn');
const voiceBtn = document.getElementById('voiceBtn');
const clearChatBtn = document.getElementById('clearChatBtn');
const quickQuestionsContainer = document.getElementById('quickQuestions');
const domainSelectorGroup = document.getElementById('domainSelectorGroup');
const activeDomainBadge = document.getElementById('activeDomainBadge');
const activeDomainIcon = document.getElementById('activeDomainIcon');
const activeDomainName = document.getElementById('activeDomainName');
const feynmanBtn = document.getElementById('feynmanBtn');
const quickBulletBtn = document.getElementById('quickBulletBtn');
const quickExamTrapsBtn = document.getElementById('quickExamTrapsBtn');
const quickQuizMeBtn = document.getElementById('quickQuizMeBtn');

// Chat Session Elements
const newChatBtn = document.getElementById('newChatBtn');
const togglePastChatsBtn = document.getElementById('togglePastChatsBtn');
const sessionCountBadge = document.getElementById('sessionCountBadge');
const activeSessionBar = document.getElementById('activeSessionBar');
const activeSessionTitle = document.getElementById('activeSessionTitle');
const renameSessionBtn = document.getElementById('renameSessionBtn');
const sessionMessageCount = document.getElementById('sessionMessageCount');
const viewAllChatsLink = document.getElementById('viewAllChatsLink');
const totalSessionsCount = document.getElementById('totalSessionsCount');
const pastChatsModal = document.getElementById('pastChatsModal');
const pastChatsDocName = document.getElementById('pastChatsDocName');
const modalNewChatBtn = document.getElementById('modalNewChatBtn');
const closePastChatsModalBtn = document.getElementById('closePastChatsModalBtn');
const sessionSearchInput = document.getElementById('sessionSearchInput');
const pastChatsList = document.getElementById('pastChatsList');


// Summary Elements
const summaryTypeButtons = document.querySelectorAll('.summary-type-btn');
const generateSummaryBtn = document.getElementById('generateSummaryBtn');
const copySummaryBtn = document.getElementById('copySummaryBtn');
const summaryContent = document.getElementById('summaryContent');
const summaryLoading = document.getElementById('summaryLoading');
const summaryPlaceholder = document.getElementById('summaryPlaceholder');
const speakSummaryBtn = document.getElementById('speakSummaryBtn');
const exportSummaryDocxBtn = document.getElementById('exportSummaryDocxBtn');
const exportSummaryPdfBtn = document.getElementById('exportSummaryPdfBtn');
const summaryExportArea = document.getElementById('summaryExportArea');

// Reader Elements
const readerDocTitle = document.getElementById('readerDocTitle');
const readerModeFormatted = document.getElementById('readerModeFormatted');
const readerModeRaw = document.getElementById('readerModeRaw');
const fullDocFormatted = document.getElementById('fullDocFormatted');
const fullDocRaw = document.getElementById('fullDocRaw');
const fullDocText = document.getElementById('fullDocText');
const docSearchInput = document.getElementById('docSearchInput');
const searchMatchCount = document.getElementById('searchMatchCount');
const copyDocTextBtn = document.getElementById('copyDocTextBtn');
const speakDocBtn = document.getElementById('speakDocBtn');
const exportDocxBtn = document.getElementById('exportDocxBtn');
const exportPdfBtn = document.getElementById('exportPdfBtn');
const viewRawTextBtn = document.getElementById('viewRawTextBtn');
const textModal = document.getElementById('textModal');
const modalBody = document.getElementById('modalBody');
const modalTitle = document.getElementById('modalTitle');
const closeModalBtn = document.getElementById('closeModalBtn');

// Study Hub Elements
const studySubTabQuiz = document.getElementById('studySubTabQuiz');
const studySubTabFlashcards = document.getElementById('studySubTabFlashcards');
const studySubTabCheatsheet = document.getElementById('studySubTabCheatsheet');
const quizControls = document.getElementById('quizControls');
const flashcardControls = document.getElementById('flashcardControls');
const cheatsheetControls = document.getElementById('cheatsheetControls');
const quizDifficulty = document.getElementById('quizDifficulty');
const quizCount = document.getElementById('quizCount');
const startQuizBtn = document.getElementById('startQuizBtn');
const flashcardCount = document.getElementById('flashcardCount');
const startFlashcardsBtn = document.getElementById('startFlashcardsBtn');
const cheatsheetFocus = document.getElementById('cheatsheetFocus');
const startCheatsheetBtn = document.getElementById('startCheatsheetBtn');
const copyCheatsheetMarkdownBtn = document.getElementById('copyCheatsheetMarkdownBtn');
const downloadCheatsheetPdfBtn = document.getElementById('downloadCheatsheetPdfBtn');
const downloadCheatsheetMdBtn = document.getElementById('downloadCheatsheetMdBtn');

const cheatsheetContainer = document.getElementById('cheatsheetContainer');
const cheatsheetEmpty = document.getElementById('cheatsheetEmpty');
const cheatsheetLoading = document.getElementById('cheatsheetLoading');
const cheatsheetActive = document.getElementById('cheatsheetActive');
const cheatsheetTitle = document.getElementById('cheatsheetTitle');
const cheatsheetOverview = document.getElementById('cheatsheetOverview');
const cheatsheetSearch = document.getElementById('cheatsheetSearch');
const cheatsheetMetrics = document.getElementById('cheatsheetMetrics');
const cheatsheetSections = document.getElementById('cheatsheetSections');

const quizContainer = document.getElementById('quizContainer');
const quizEmpty = document.getElementById('quizEmpty');
const quizLoading = document.getElementById('quizLoading');
const quizActive = document.getElementById('quizActive');
const quizResult = document.getElementById('quizResult');
const quizProgressText = document.getElementById('quizProgressText');
const quizScoreText = document.getElementById('quizScoreText');
const quizProgressBar = document.getElementById('quizProgressBar');
const quizQuestionPrompt = document.getElementById('quizQuestionPrompt');
const quizOptionsList = document.getElementById('quizOptionsList');
const quizExplanation = document.getElementById('quizExplanation');
const quizExplanationText = document.getElementById('quizExplanationText');
const nextQuestionBtn = document.getElementById('nextQuestionBtn');
const finalScoreCircle = document.getElementById('finalScoreCircle');
const quizSummaryFeedback = document.getElementById('quizSummaryFeedback');
const retakeQuizBtn = document.getElementById('retakeQuizBtn');

// Quiz Topic & Diagnostics Elements
const quizTopicSelect = document.getElementById('quizTopicSelect');
const quizCustomTopicInput = document.getElementById('quizCustomTopicInput');
const viewMasteryRadarBtn = document.getElementById('viewMasteryRadarBtn');
const quizLoadingTitle = document.getElementById('quizLoadingTitle');
const quizLoadingSubtitle = document.getElementById('quizLoadingSubtitle');
const quizQuestionTopicBadge = document.getElementById('quizQuestionTopicBadge');
const quizQuestionDifficultyBadge = document.getElementById('quizQuestionDifficultyBadge');
const quizImprovementTipBox = document.getElementById('quizImprovementTipBox');
const quizImprovementTipText = document.getElementById('quizImprovementTipText');
const topicDiagnosticsContainer = document.getElementById('topicDiagnosticsContainer');
const weakTopicsSection = document.getElementById('weakTopicsSection');
const weakTopicsCountBadge = document.getElementById('weakTopicsCountBadge');
const weakTopicsList = document.getElementById('weakTopicsList');
const masteredTopicsSection = document.getElementById('masteredTopicsSection');
const masteredTopicsCountBadge = document.getElementById('masteredTopicsCountBadge');
const masteredTopicsList = document.getElementById('masteredTopicsList');
const developingTopicsSection = document.getElementById('developingTopicsSection');
const developingTopicsList = document.getElementById('developingTopicsList');
const viewAllMasteryFromResultsBtn = document.getElementById('viewAllMasteryFromResultsBtn');

// Targeted Drill Modal Elements
const targetedDrillModal = document.getElementById('targetedDrillModal');
const closeDrillModalBtn = document.getElementById('closeDrillModalBtn');
const drillLevelBadge = document.getElementById('drillLevelBadge');
const drillTopicTitle = document.getElementById('drillTopicTitle');
const ladderStep1 = document.getElementById('ladderStep1');
const ladderStep2 = document.getElementById('ladderStep2');
const ladderStep3 = document.getElementById('ladderStep3');
const drillLoading = document.getElementById('drillLoading');
const drillLoadingText = document.getElementById('drillLoadingText');
const drillActive = document.getElementById('drillActive');
const drillProgressText = document.getElementById('drillProgressText');
const drillScoreText = document.getElementById('drillScoreText');
const drillProgressBar = document.getElementById('drillProgressBar');
const drillQuestionPrompt = document.getElementById('drillQuestionPrompt');
const drillOptionsList = document.getElementById('drillOptionsList');
const drillExplanationBox = document.getElementById('drillExplanationBox');
const drillExplanationText = document.getElementById('drillExplanationText');
const drillTipBox = document.getElementById('drillTipBox');
const drillTipText = document.getElementById('drillTipText');
const drillNextBtn = document.getElementById('drillNextBtn');
const drillLevelClearedScreen = document.getElementById('drillLevelClearedScreen');
const drillLevelClearedTitle = document.getElementById('drillLevelClearedTitle');
const drillLevelClearedMsg = document.getElementById('drillLevelClearedMsg');
const drillAdvanceLevelBtn = document.getElementById('drillAdvanceLevelBtn');
const drillMasteredCelebrationScreen = document.getElementById('drillMasteredCelebrationScreen');
const drillMasteredTopicTitle = document.getElementById('drillMasteredTopicTitle');
const closeDrillAfterMasteryBtn = document.getElementById('closeDrillAfterMasteryBtn');

// Topic Radar Modal Elements
const topicRadarModal = document.getElementById('topicRadarModal');
const closeRadarModalBtn = document.getElementById('closeRadarModalBtn');
const radarDocName = document.getElementById('radarDocName');
const radarOverallAcc = document.getElementById('radarOverallAcc');
const radarWeakCount = document.getElementById('radarWeakCount');
const radarLearningCount = document.getElementById('radarLearningCount');
const radarMasteredCount = document.getElementById('radarMasteredCount');
const radarWeakList = document.getElementById('radarWeakList');
const radarMasteredList = document.getElementById('radarMasteredList');
const radarAllTopicsList = document.getElementById('radarAllTopicsList');

const flashcardsContainer = document.getElementById('flashcardsContainer');
const flashcardsEmpty = document.getElementById('flashcardsEmpty');
const flashcardsLoading = document.getElementById('flashcardsLoading');
const flashcardActive = document.getElementById('flashcardActive');
const flashcardCounter = document.getElementById('flashcardCounter');
const flashcardElement = document.getElementById('flashcardElement');
const flashcardCategory = document.getElementById('flashcardCategory');
const flashcardFront = document.getElementById('flashcardFront');
const flashcardBack = document.getElementById('flashcardBack');
const prevCardBtn = document.getElementById('prevCardBtn');
const flipCardBtn = document.getElementById('flipCardBtn');
const nextCardBtn = document.getElementById('nextCardBtn');

// Mind Map Elements
const generateMindmapBtn = document.getElementById('generateMindmapBtn');
const mindmapEmpty = document.getElementById('mindmapEmpty');
const mindmapLoading = document.getElementById('mindmapLoading');
const mindmapContainer = document.getElementById('mindmapContainer');
const mindmapViewportArea = document.getElementById('mindmapViewportArea');
const mindmapTransformLayer = document.getElementById('mindmapTransformLayer');
const zoomInBtn = document.getElementById('zoomInBtn');
const zoomOutBtn = document.getElementById('zoomOutBtn');
const resetZoomBtn = document.getElementById('resetZoomBtn');
const zoomLevelText = document.getElementById('zoomLevelText');
const toggleOrientationBtn = document.getElementById('toggleOrientationBtn');
const orientationLabel = document.getElementById('orientationLabel');
const theaterMindmapBtn = document.getElementById('theaterMindmapBtn');
const theaterIcon = document.getElementById('theaterIcon');
const theaterText = document.getElementById('theaterText');
const viewMermaidCodeBtn = document.getElementById('viewMermaidCodeBtn');
const mermaidCodeModal = document.getElementById('mermaidCodeModal');
const closeMermaidModalBtn = document.getElementById('closeMermaidModalBtn');
const mermaidCodeInput = document.getElementById('mermaidCodeInput');
const copyMermaidCodeBtn = document.getElementById('copyMermaidCodeBtn');
const applyMermaidCodeBtn = document.getElementById('applyMermaidCodeBtn');
const downloadSvgBtn = document.getElementById('downloadSvgBtn');

// Audio Player Bar Elements
const audioPlayerBar = document.getElementById('audioPlayerBar');
const audioPlayerTitle = document.getElementById('audioPlayerTitle');
const audioPlayerStatus = document.getElementById('audioPlayerStatus');
const audioPauseBtn = document.getElementById('audioPauseBtn');
const audioPauseIcon = document.getElementById('audioPauseIcon');
const audioStopBtn = document.getElementById('audioStopBtn');
const audioRateSelect = document.getElementById('audioRateSelect');

// Toast
const toast = document.getElementById('toast');
const toastMsg = document.getElementById('toastMsg');
const toastIcon = document.getElementById('toastIcon');

// Auth DOM Elements
const authModal = document.getElementById('authModal');
const authTabLogin = document.getElementById('authTabLogin');
const authTabRegister = document.getElementById('authTabRegister');
const loginForm = document.getElementById('loginForm');
const registerForm = document.getElementById('registerForm');
const loginError = document.getElementById('loginError');
const loginErrorText = document.getElementById('loginErrorText');
const registerError = document.getElementById('registerError');
const registerErrorText = document.getElementById('registerErrorText');
const loginEmail = document.getElementById('loginEmail');
const loginPassword = document.getElementById('loginPassword');
const registerName = document.getElementById('registerName');
const registerEmail = document.getElementById('registerEmail');
const registerPassword = document.getElementById('registerPassword');
const registerPasswordConfirm = document.getElementById('registerPasswordConfirm');
const loginSubmitBtn = document.getElementById('loginSubmitBtn');
const loginBtnText = document.getElementById('loginBtnText');
const loginBtnIcon = document.getElementById('loginBtnIcon');
const loginBtnSpinner = document.getElementById('loginBtnSpinner');
const registerSubmitBtn = document.getElementById('registerSubmitBtn');
const registerBtnText = document.getElementById('registerBtnText');
const registerBtnIcon = document.getElementById('registerBtnIcon');
const registerBtnSpinner = document.getElementById('registerBtnSpinner');
const userProfileArea = document.getElementById('userProfileArea');
const userAvatar = document.getElementById('userAvatar');
const userNameDisplay = document.getElementById('userNameDisplay');
const logoutBtn = document.getElementById('logoutBtn');
const openAuthModalBtn = document.getElementById('openAuthModalBtn');
const switchToRegister = document.getElementById('switchToRegister');
const switchToLogin = document.getElementById('switchToLogin');
const toggleLoginPassword = document.getElementById('toggleLoginPassword');
const toggleRegisterPassword = document.getElementById('toggleRegisterPassword');
const rememberMeCheckbox = document.getElementById('rememberMeCheckbox');
const closeAuthModalBtn = document.getElementById('closeAuthModalBtn');
const guestModeBtn = document.getElementById('guestModeBtn');

// Sidebar Responsive DOM Elements
const sidebar = document.getElementById('sidebar');
const toggleSidebarBtn = document.getElementById('toggleSidebarBtn');
const closeSidebarBtn = document.getElementById('closeSidebarBtn');
const sidebarBackdrop = document.getElementById('sidebarBackdrop');
const sidebarToggleIcon = document.getElementById('sidebarToggleIcon');

// Sidebar Responsive Controls
function toggleSidebar() {
  const isMobile = window.innerWidth < 768;
  if (isMobile) {
    if (sidebar && sidebar.classList.contains('open')) {
      closeMobileSidebar();
    } else {
      openMobileSidebar();
    }
  } else {
    if (sidebar) {
      sidebar.classList.toggle('collapsed');
      updateSidebarToggleIcon();
    }
  }
}

function openMobileSidebar() {
  if (!sidebar) return;
  sidebar.classList.add('open');
  if (sidebarBackdrop) {
    sidebarBackdrop.classList.remove('hidden');
  }
  updateSidebarToggleIcon();
}

function closeMobileSidebar() {
  if (!sidebar) return;
  sidebar.classList.remove('open');
  if (sidebarBackdrop) {
    sidebarBackdrop.classList.add('hidden');
  }
  updateSidebarToggleIcon();
}

function closeSidebar() {
  const isMobile = window.innerWidth < 768;
  if (isMobile) {
    closeMobileSidebar();
  } else {
    if (sidebar) {
      sidebar.classList.add('collapsed');
      updateSidebarToggleIcon();
    }
  }
}

function updateSidebarToggleIcon() {
  if (!sidebarToggleIcon || !sidebar) return;
  const isMobile = window.innerWidth < 768;
  if (isMobile) {
    const isOpen = sidebar.classList.contains('open');
    sidebarToggleIcon.setAttribute('data-lucide', isOpen ? 'x' : 'panel-left');
  } else {
    const isCollapsed = sidebar.classList.contains('collapsed');
    sidebarToggleIcon.setAttribute('data-lucide', isCollapsed ? 'panel-left-open' : 'panel-left');
  }
  if (window.lucide) {
    lucide.createIcons();
  }
}

// Helper to get auth header
function getAuthHeaders(headers = {}) {
  if (state.authToken) {
    headers['Authorization'] = `Bearer ${state.authToken}`;
  }
  return headers;
}

// ==========================================
// Persistent Local Storage (IndexedDB)
// Ensures documents and chat history are NEVER lost across
// server restarts, redeployments, or logout/sign-in cycles.
// ==========================================
const IDB_NAME = 'DocumentIQ_OfflineStore';
const IDB_VERSION = 1;
let idbInstance = null;

function getIDB() {
  if (idbInstance) return Promise.resolve(idbInstance);
  return new Promise((resolve) => {
    if (!window.indexedDB) {
      console.warn('IndexedDB not supported in this browser.');
      return resolve(null);
    }
    const req = indexedDB.open(IDB_NAME, IDB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('documents')) {
        const store = db.createObjectStore('documents', { keyPath: 'id' });
        store.createIndex('user_email', 'user_email', { unique: false });
      }
      if (!db.objectStoreNames.contains('sessions')) {
        const store = db.createObjectStore('sessions', { keyPath: 'id' });
        store.createIndex('doc_id', 'doc_id', { unique: false });
      }
      if (!db.objectStoreNames.contains('messages')) {
        const store = db.createObjectStore('messages', { keyPath: 'id' });
        store.createIndex('session_id', 'session_id', { unique: false });
        store.createIndex('doc_id', 'doc_id', { unique: false });
      }
    };
    req.onsuccess = () => {
      idbInstance = req.result;
      resolve(idbInstance);
    };
    req.onerror = () => {
      console.warn('IndexedDB open error:', req.error);
      resolve(null);
    };
  });
}

async function idbSaveDocument(doc, userEmail = null) {
  try {
    const db = await getIDB();
    if (!db || !doc || !doc.id) return;
    const email = (userEmail || (state.currentUser ? state.currentUser.email : localStorage.getItem('doc_saved_email')) || 'guest').toLowerCase().trim();
    const tx = db.transaction('documents', 'readwrite');
    const store = tx.objectStore('documents');

    const getReq = store.get(doc.id);
    getReq.onsuccess = () => {
      const existing = getReq.result;
      const merged = {
        ...existing,
        ...doc,
        content: doc.content || (existing ? existing.content : '') || doc.preview || '',
        user_email: email !== 'guest' ? email : (existing && existing.user_email !== 'guest' ? existing.user_email : 'guest'),
        cached_at: new Date().toISOString(),
      };
      store.put(merged);
    };
  } catch (err) {
    console.warn('idbSaveDocument error:', err);
  }
}

async function idbGetDocuments(userEmail = null) {
  try {
    const db = await getIDB();
    if (!db) return [];
    const email = (userEmail || (state.currentUser ? state.currentUser.email : localStorage.getItem('doc_saved_email')) || 'guest').toLowerCase().trim();
    return new Promise((resolve) => {
      const tx = db.transaction('documents', 'readonly');
      const store = tx.objectStore('documents');
      const req = store.getAll();
      req.onsuccess = () => {
        const all = req.result || [];
        const filtered = all.filter(d => !d.user_email || d.user_email === email || d.user_email === 'guest' || email === 'guest');
        filtered.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
        resolve(filtered);
      };
      req.onerror = () => resolve([]);
    });
  } catch (err) {
    console.warn('idbGetDocuments error:', err);
    return [];
  }
}

async function idbClaimGuestDocuments(userEmail) {
  try {
    const db = await getIDB();
    if (!db || !userEmail) return;
    const cleanEmail = userEmail.toLowerCase().trim();
    const tx = db.transaction('documents', 'readwrite');
    const store = tx.objectStore('documents');
    const req = store.getAll();
    req.onsuccess = () => {
      const all = req.result || [];
      for (const doc of all) {
        if (!doc.user_email || doc.user_email === 'guest') {
          doc.user_email = cleanEmail;
          store.put(doc);
        }
      }
    };
  } catch (err) {
    console.warn('idbClaimGuestDocuments error:', err);
  }
}

async function idbDeleteDocument(docId) {
  try {
    const db = await getIDB();
    if (!db || !docId) return;
    const tx = db.transaction(['documents', 'sessions', 'messages'], 'readwrite');
    tx.objectStore('documents').delete(docId);
    const sessStore = tx.objectStore('sessions');
    const sessIdx = sessStore.index('doc_id');
    const sessReq = sessIdx.getAllKeys(docId);
    sessReq.onsuccess = () => {
      (sessReq.result || []).forEach(k => sessStore.delete(k));
    };
    const msgStore = tx.objectStore('messages');
    const msgIdx = msgStore.index('doc_id');
    const msgReq = msgIdx.getAllKeys(docId);
    msgReq.onsuccess = () => {
      (msgReq.result || []).forEach(k => msgStore.delete(k));
    };
  } catch (err) {
    console.warn('idbDeleteDocument error:', err);
  }
}

async function idbSaveSession(session) {
  try {
    const db = await getIDB();
    if (!db || !session || !session.id) return;
    const tx = db.transaction('sessions', 'readwrite');
    tx.objectStore('sessions').put(session);
  } catch (err) {
    console.warn('idbSaveSession error:', err);
  }
}

async function idbGetSessions(docId) {
  try {
    const db = await getIDB();
    if (!db || !docId) return [];
    return new Promise((resolve) => {
      const tx = db.transaction('sessions', 'readonly');
      const store = tx.objectStore('sessions');
      const idx = store.index('doc_id');
      const req = idx.getAll(docId);
      req.onsuccess = () => {
        const list = req.result || [];
        list.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
        resolve(list);
      };
      req.onerror = () => resolve([]);
    });
  } catch (err) {
    console.warn('idbGetSessions error:', err);
    return [];
  }
}

async function idbDeleteSession(sessionId) {
  try {
    const db = await getIDB();
    if (!db || !sessionId) return;
    const tx = db.transaction(['sessions', 'messages'], 'readwrite');
    tx.objectStore('sessions').delete(sessionId);
    const msgStore = tx.objectStore('messages');
    const msgIdx = msgStore.index('session_id');
    const msgReq = msgIdx.getAllKeys(sessionId);
    msgReq.onsuccess = () => {
      (msgReq.result || []).forEach(k => msgStore.delete(k));
    };
  } catch (err) {
    console.warn('idbDeleteSession error:', err);
  }
}

async function idbSaveMessage(msg, docId, sessionId) {
  try {
    const db = await getIDB();
    if (!db || !docId || !sessionId) return;
    const tx = db.transaction('messages', 'readwrite');
    tx.objectStore('messages').put({
      id: msg.id || ('loc_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6)),
      doc_id: docId,
      session_id: sessionId,
      role: msg.role,
      message: msg.message,
      sources: msg.sources || null,
      created_at: msg.created_at || new Date().toISOString(),
    });
  } catch (err) {
    console.warn('idbSaveMessage error:', err);
  }
}

async function idbGetMessages(sessionId) {
  try {
    const db = await getIDB();
    if (!db || !sessionId) return [];
    return new Promise((resolve) => {
      const tx = db.transaction('messages', 'readonly');
      const store = tx.objectStore('messages');
      const idx = store.index('session_id');
      const req = idx.getAll(sessionId);
      req.onsuccess = () => {
        const msgs = req.result || [];
        msgs.sort((a, b) => (a.created_at || '').localeCompare(b.created_at || ''));
        resolve(msgs);
      };
      req.onerror = () => resolve([]);
    });
  } catch (err) {
    console.warn('idbGetMessages error:', err);
    return [];
  }
}

async function autoRestoreDocumentsToBackend(cachedDocs) {
  if (!cachedDocs || cachedDocs.length === 0) return;

  try {
    const payload = [];
    for (const doc of cachedDocs) {
      if (!doc || !doc.id) continue;
      const textContent = doc.content || doc.preview || '';
      if (!textContent) continue;

      const sessions = await idbGetSessions(doc.id);
      let messages = [];
      if (sessions && sessions.length > 0) {
        for (const s of sessions) {
          const sMsgs = await idbGetMessages(s.id);
          if (sMsgs && sMsgs.length > 0) {
            messages = messages.concat(sMsgs);
          }
        }
      }

      payload.push({
        id: doc.id,
        filename: doc.filename,
        file_type: doc.file_type || '.txt',
        file_size: doc.file_size || textContent.length,
        content: textContent,
        chunk_count: doc.chunk_count || 1,
        page_count: doc.page_count || 1,
        summary: doc.summary || null,
        summary_type: doc.summary_type || 'bullet',
        created_at: doc.created_at || new Date().toISOString(),
        sessions: sessions && sessions.length > 0 ? sessions : null,
        messages: messages && messages.length > 0 ? messages : null,
      });
    }

    if (payload.length === 0) return;

    const res = await fetch('/api/documents/restore', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders(),
      },
      body: JSON.stringify({ documents: payload }),
    });

    if (res.ok) {
      const data = await res.json();
      console.log(`Auto-restored ${data.restored_documents || 0} documents to backend.`);
    }
  } catch (err) {
    console.warn('Auto-restore to backend warning:', err);
  }
}

// Authentication Logic
async function initAuth() {
  // Pre-fill remembered email
  const savedEmail = localStorage.getItem('doc_saved_email');
  if (savedEmail && loginEmail) {
    loginEmail.value = savedEmail;
  }

  if (state.authToken) {
    try {
      const res = await fetch('/api/auth/me', {
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        state.currentUser = data.user;
        updateUserUI();
        return true;
      } else if (res.status === 401) {
        // Only invalidate if backend explicitly reports expired or invalid token
        state.authToken = null;
        state.currentUser = null;
        localStorage.removeItem('doc_auth_token');
      }
    } catch (err) {
      console.warn('Backend server not ready yet or network warning (keeping token):', err);
      // DO NOT erase token on temporary network error or server startup delay!
    }
  }

  updateUserUI();
  return Boolean(state.currentUser);
}

function updateUserUI() {
  if (state.currentUser) {
    if (userProfileArea) {
      userProfileArea.classList.remove('hidden');
      userProfileArea.classList.add('flex');
    }
    if (openAuthModalBtn) openAuthModalBtn.classList.add('hidden');
    if (userNameDisplay) userNameDisplay.textContent = state.currentUser.name || 'User';
    if (userAvatar) {
      const initial = (state.currentUser.name || 'U').trim().charAt(0).toUpperCase();
      userAvatar.textContent = initial || 'U';
    }
    if (authModal) authModal.classList.add('hidden');
  } else {
    if (userProfileArea) {
      userProfileArea.classList.add('hidden');
      userProfileArea.classList.remove('flex');
    }
    if (openAuthModalBtn) openAuthModalBtn.classList.remove('hidden');
    if (authModal && !state.guestMode) {
      authModal.classList.remove('hidden');
    }
  }
}

function handleGuestMode() {
  state.guestMode = true;
  if (authModal) authModal.classList.add('hidden');
  fetchDocuments();
  showToast('Continuing in Guest Mode. You can sign in anytime from the top bar.', 'info');
}

function switchAuthTab(tab) {
  if (tab === 'login') {
    if (authTabLogin) {
      authTabLogin.className = 'flex-1 py-2 text-xs font-semibold rounded-lg transition-all bg-brand-600 text-white shadow-sm';
    }
    if (authTabRegister) {
      authTabRegister.className = 'flex-1 py-2 text-xs font-semibold rounded-lg transition-all text-slate-400 hover:text-white';
    }
    if (loginForm) loginForm.classList.remove('hidden');
    if (registerForm) registerForm.classList.add('hidden');
  } else {
    if (authTabRegister) {
      authTabRegister.className = 'flex-1 py-2 text-xs font-semibold rounded-lg transition-all bg-brand-600 text-white shadow-sm';
    }
    if (authTabLogin) {
      authTabLogin.className = 'flex-1 py-2 text-xs font-semibold rounded-lg transition-all text-slate-400 hover:text-white';
    }
    if (registerForm) registerForm.classList.remove('hidden');
    if (loginForm) loginForm.classList.add('hidden');
  }

  if (loginError) loginError.classList.add('hidden');
  if (registerError) registerError.classList.add('hidden');
}

function togglePassword(inputEl, btnEl) {
  if (!inputEl) return;
  const isPass = inputEl.type === 'password';
  inputEl.type = isPass ? 'text' : 'password';
  if (btnEl) {
    btnEl.innerHTML = isPass ? '<i data-lucide="eye-off" class="w-4 h-4"></i>' : '<i data-lucide="eye" class="w-4 h-4"></i>';
    if (window.lucide) lucide.createIcons({ root: btnEl });
  }
}

async function handleLogin(e) {
  e.preventDefault();
  const email = loginEmail ? loginEmail.value.trim() : '';
  const password = loginPassword ? loginPassword.value : '';

  if (!email || !password) return;

  if (loginBtnSpinner) loginBtnSpinner.classList.remove('hidden');
  if (loginBtnIcon) loginBtnIcon.classList.add('hidden');
  if (loginSubmitBtn) loginSubmitBtn.disabled = true;
  if (loginError) loginError.classList.add('hidden');

  const savedName = localStorage.getItem('doc_saved_name') || '';

  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, name: savedName }),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.detail || 'Sign in failed');
    }

    state.authToken = data.token;
    state.currentUser = data.user;
    state.guestMode = false;
    localStorage.setItem('doc_auth_token', data.token);
    localStorage.setItem('doc_saved_name', data.user.name);
    localStorage.setItem('doc_saved_email', email);

    await idbClaimGuestDocuments(email);
    updateUserUI();
    showToast(`Welcome back, ${data.user.name}!`, 'success');
    await fetchDocuments();
  } catch (err) {
    if (loginError && loginErrorText) {
      loginErrorText.textContent = err.message;
      loginError.classList.remove('hidden');
    }
  } finally {
    if (loginBtnSpinner) loginBtnSpinner.classList.add('hidden');
    if (loginBtnIcon) loginBtnIcon.classList.remove('hidden');
    if (loginSubmitBtn) loginSubmitBtn.disabled = false;
  }
}

async function handleRegister(e) {
  e.preventDefault();
  const name = registerName ? registerName.value.trim() : '';
  const email = registerEmail ? registerEmail.value.trim() : '';
  const password = registerPassword ? registerPassword.value : '';
  const confirmPassword = registerPasswordConfirm ? registerPasswordConfirm.value : '';

  if (registerError) registerError.classList.add('hidden');

  if (password !== confirmPassword) {
    if (registerError && registerErrorText) {
      registerErrorText.textContent = 'Passwords do not match.';
      registerError.classList.remove('hidden');
    }
    return;
  }

  if (password.length < 6) {
    if (registerError && registerErrorText) {
      registerErrorText.textContent = 'Password must be at least 6 characters.';
      registerError.classList.remove('hidden');
    }
    return;
  }

  if (registerBtnSpinner) registerBtnSpinner.classList.remove('hidden');
  if (registerBtnIcon) registerBtnIcon.classList.add('hidden');
  if (registerSubmitBtn) registerSubmitBtn.disabled = true;

  try {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password }),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.detail || 'Registration failed');
    }

    state.authToken = data.token;
    state.currentUser = data.user;
    state.guestMode = false;
    localStorage.setItem('doc_auth_token', data.token);
    localStorage.setItem('doc_saved_name', data.user.name);
    localStorage.setItem('doc_saved_email', email);

    await idbClaimGuestDocuments(email);
    updateUserUI();
    showToast(`Welcome to DocumentIQ, ${data.user.name}!`, 'success');
    await fetchDocuments();
  } catch (err) {
    if (registerError && registerErrorText) {
      registerErrorText.textContent = err.message;
      registerError.classList.remove('hidden');
    }
  } finally {
    if (registerBtnSpinner) registerBtnSpinner.classList.add('hidden');
    if (registerBtnIcon) registerBtnIcon.classList.remove('hidden');
    if (registerSubmitBtn) registerSubmitBtn.disabled = false;
  }
}

async function handleLogout() {
  if (!confirm('Are you sure you want to sign out?')) return;

  try {
    if (state.authToken) {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: getAuthHeaders(),
      });
    }
  } catch (err) {
    console.warn('Logout notification error:', err);
  }

  state.authToken = null;
  state.currentUser = null;
  state.documents = [];
  state.activeDocId = null;
  state.activeDoc = null;
  localStorage.removeItem('doc_auth_token');

  renderDocumentList();
  selectDocument(null);
  updateUserUI();
  showToast('Signed out successfully.', 'info');
}

// ==========================================
// Initialization & Startup
// ==========================================
document.addEventListener('DOMContentLoaded', async () => {
  initIcons();
  initAcademicDomain();
  initLanguageSelector();
  setupEventListeners();
  setupVoiceRecognition();
  checkHealth();
  await initAuth();
  await fetchDocuments();
});


function initLanguageSelector() {
  const langBtns = document.querySelectorAll('.lang-btn');
  if (!langBtns.length) return;

  function updateLangUI(currentLang) {
    langBtns.forEach(btn => {
      if (btn.dataset.lang === currentLang) {
        btn.classList.add('bg-brand-600', 'text-white', 'shadow-sm');
        btn.classList.remove('text-slate-400', 'hover:text-slate-200');
      } else {
        btn.classList.remove('bg-brand-600', 'text-white', 'shadow-sm');
        btn.classList.add('text-slate-400', 'hover:text-slate-200');
      }
    });
  }

  updateLangUI(state.activeLanguage);

  langBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const selected = btn.dataset.lang || 'auto';
      state.activeLanguage = selected;
      localStorage.setItem('doc_language', selected);
      updateLangUI(selected);
      const label = selected === 'hi' ? 'हिन्दी (Hindi)' : selected === 'mr' ? 'मराठी (Marathi)' : selected === 'en' ? 'English' : 'Auto-Detect (स्वचालित)';
      showToast(`Language set to ${label}`, 'info');
    });
  });
}


function initIcons() {
  if (window.lucide) {
    lucide.createIcons();
  }
}

async function checkHealth() {
  try {
    const res = await fetch('/api/health');
    const data = await res.json();
    if (data.status === 'ok') {
      const statusEl = document.getElementById('systemStatus');
      if (statusEl) {
        statusEl.textContent = data.gemini_configured ? 'Gemini 3.8 / Flash' : 'API Key Missing';
      }
    }
  } catch (err) {
    console.warn('Backend health check error:', err);
  }
}

// ==========================================
// Academic Domain & Stream Handling
// ==========================================
function initAcademicDomain() {
  const saved = localStorage.getItem('doc_domain') || 'general';
  switchAcademicDomain(saved, false);
}

function switchAcademicDomain(domainId, showNotification = true) {
  if (!ACADEMIC_DOMAINS[domainId]) domainId = 'general';
  state.activeDomain = domainId;
  localStorage.setItem('doc_domain', domainId);

  const domain = ACADEMIC_DOMAINS[domainId];

  // Update pills in #domainSelectorGroup
  if (domainSelectorGroup) {
    const pills = domainSelectorGroup.querySelectorAll('.domain-pill-btn');
    pills.forEach((p) => {
      const match = p.dataset.domain === domainId;
      p.className = `domain-pill-btn px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all flex items-center space-x-1.5 ${
        match
          ? 'active bg-gradient-to-r from-brand-600 to-indigo-600 text-white border-brand-500 shadow-sm'
          : 'bg-dark-surface hover:bg-dark-hover text-slate-300 border-dark-border'
      }`;
    });
  }

  // Update activeDomainBadge
  if (activeDomainIcon) activeDomainIcon.textContent = domain.icon;
  if (activeDomainName) activeDomainName.textContent = domain.name;

  // Sync cheatsheet focus if select exists
  if (cheatsheetFocus && domain.cheatsheetFocus) {
    cheatsheetFocus.value = domain.cheatsheetFocus;
  }

  // Render quick prompts
  renderQuickQuestions(domainId);

  if (showNotification) {
    showToast(`Switched stream to ${domain.icon} ${domain.name}`, 'info');
  }
}

function renderQuickQuestions(domainId) {
  if (!quickQuestionsContainer) return;
  quickQuestionsContainer.innerHTML = '';

  const defaultPrompts = [
    { title: 'Summarize Key Takeaways', prompt: 'Give me a 5-bullet high-yield summary of this document.', icon: 'sparkles' },
    { title: 'Explain Core Concepts', prompt: 'Explain the most important concepts from this document in simple terms.', icon: 'help-circle' },
    { title: 'Important Exam Questions', prompt: 'What are the most likely questions and answers from this document?', icon: 'check-circle-2' },
    { title: 'Key Definitions & Terms', prompt: 'List all major terms and their definitions found in these notes.', icon: 'bookmark' },
  ];

  defaultPrompts.forEach((p) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className =
      'quick-q-btn p-3 rounded-xl bg-dark-surface/50 hover:bg-dark-hover border border-dark-border/80 hover:border-brand-500/40 text-left transition-all group flex items-start space-x-2.5';
    btn.innerHTML = `
      <div class="w-7 h-7 rounded-lg bg-dark-bg flex items-center justify-center flex-shrink-0 text-brand-400 group-hover:scale-105 transition-transform mt-0.5">
        <i data-lucide="${p.icon}" class="w-3.5 h-3.5"></i>
      </div>
      <div>
        <p class="text-xs font-semibold text-slate-200 group-hover:text-brand-300 transition-colors">${escapeHtml(p.title)}</p>
        <p class="text-[11px] text-slate-400 mt-0.5 line-clamp-1">${escapeHtml(p.prompt)}</p>
      </div>
    `;
    btn.addEventListener('click', () => {
      if (chatInput) {
        chatInput.value = p.prompt;
        chatInput.focus();
      }
      handleSendMessage();
    });
    quickQuestionsContainer.appendChild(btn);
  });
  initIcons();
}

// ==========================================
// Event Listeners Setup
// ==========================================
function setupEventListeners() {
  // Authentication Event Listeners
  if (authTabLogin) authTabLogin.addEventListener('click', () => switchAuthTab('login'));
  if (authTabRegister) authTabRegister.addEventListener('click', () => switchAuthTab('register'));
  if (switchToRegister) switchToRegister.addEventListener('click', () => switchAuthTab('register'));
  if (switchToLogin) switchToLogin.addEventListener('click', () => switchAuthTab('login'));
  if (loginForm) loginForm.addEventListener('submit', handleLogin);
  if (registerForm) registerForm.addEventListener('submit', handleRegister);
  if (logoutBtn) logoutBtn.addEventListener('click', handleLogout);
  if (closeAuthModalBtn) closeAuthModalBtn.addEventListener('click', handleGuestMode);
  if (guestModeBtn) guestModeBtn.addEventListener('click', handleGuestMode);
  if (openAuthModalBtn) openAuthModalBtn.addEventListener('click', () => {
    state.guestMode = false;
    if (authModal) authModal.classList.remove('hidden');
  });
  if (toggleLoginPassword) {
    toggleLoginPassword.addEventListener('click', () => togglePassword(loginPassword, toggleLoginPassword));
  }
  if (toggleRegisterPassword) {
    toggleRegisterPassword.addEventListener('click', () => togglePassword(registerPassword, toggleRegisterPassword));
  }

  // Sidebar Responsive Toggles
  if (toggleSidebarBtn) toggleSidebarBtn.addEventListener('click', toggleSidebar);
  if (closeSidebarBtn) closeSidebarBtn.addEventListener('click', closeSidebar);
  if (sidebarBackdrop) sidebarBackdrop.addEventListener('click', closeMobileSidebar);

  // Close mobile sidebar on Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (window.innerWidth < 768 && sidebar && sidebar.classList.contains('open')) {
        closeMobileSidebar();
      }
    }
  });

  // Handle window resize
  window.addEventListener('resize', () => {
    if (window.innerWidth >= 768) {
      if (sidebarBackdrop) sidebarBackdrop.classList.add('hidden');
      if (sidebar) sidebar.classList.remove('open');
    }
    updateSidebarToggleIcon();
  });

  // Dropzone
  if (dropzone) {
    dropzone.addEventListener('click', () => fileInput && fileInput.click());
    dropzone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropzone.classList.add('drag-over');
    });
    dropzone.addEventListener('dragleave', () => dropzone.classList.remove('drag-over'));
    dropzone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropzone.classList.remove('drag-over');
      if (e.dataTransfer && e.dataTransfer.files.length) {
        uploadFile(e.dataTransfer.files[0]);
      }
    });
  }

  if (fileInput) {
    fileInput.addEventListener('click', (e) => e.stopPropagation());
    fileInput.addEventListener('change', handleFileSelect);
  }

  // Tabs
  if (tabBtnChat) tabBtnChat.addEventListener('click', () => switchTab('chat'));
  if (tabBtnSummary) tabBtnSummary.addEventListener('click', () => switchTab('summary'));
  if (tabBtnReader) tabBtnReader.addEventListener('click', () => switchTab('reader'));
  if (tabBtnStudy) tabBtnStudy.addEventListener('click', () => switchTab('study'));
  if (tabBtnMindmap) tabBtnMindmap.addEventListener('click', () => switchTab('mindmap'));

  // Chat Form & Auto-resize
  if (chatForm) chatForm.addEventListener('submit', handleSendMessage);
  if (chatInput) {
    chatInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSendMessage(e);
      }
    });
    chatInput.addEventListener('input', () => {
      chatInput.style.height = 'auto';
      chatInput.style.height = Math.min(chatInput.scrollHeight, 150) + 'px';
    });
  }

  // Clear / Delete Current Chat
  if (clearChatBtn) clearChatBtn.addEventListener('click', handleClearChat);

  // Chat Sessions Controls & Drawer
  if (newChatBtn) newChatBtn.addEventListener('click', () => handleNewChat(true));
  if (modalNewChatBtn) modalNewChatBtn.addEventListener('click', () => handleNewChat(true));
  if (togglePastChatsBtn) togglePastChatsBtn.addEventListener('click', openPastChatsModal);
  if (viewAllChatsLink) viewAllChatsLink.addEventListener('click', openPastChatsModal);
  if (closePastChatsModalBtn) closePastChatsModalBtn.addEventListener('click', closePastChatsModal);
  if (renameSessionBtn) renameSessionBtn.addEventListener('click', () => handleRenameSession(state.activeSessionId, state.activeSessionTitle));
  if (activeSessionTitle) activeSessionTitle.addEventListener('click', () => handleRenameSession(state.activeSessionId, state.activeSessionTitle));
  if (sessionSearchInput) {
    sessionSearchInput.addEventListener('input', (e) => {
      state.sessionFilter = e.target.value.trim().toLowerCase();
      renderPastChatsList();
    });
  }
  if (pastChatsModal) {
    pastChatsModal.addEventListener('click', (e) => {
      if (e.target === pastChatsModal) closePastChatsModal();
    });
  }

  // Academic Domain Selector Buttons
  if (domainSelectorGroup) {
    domainSelectorGroup.addEventListener('click', (e) => {
      const btn = e.target.closest('.domain-pill-btn');
      if (btn && btn.dataset.domain) {
        switchAcademicDomain(btn.dataset.domain, true);
      }
    });
  }

  // Active Domain Badge Click -> Switch tab to chat & scroll to welcome / focus
  if (activeDomainBadge) {
    activeDomainBadge.addEventListener('click', () => {
      switchTab('chat');
      if (chatWelcome && !chatWelcome.classList.contains('hidden')) {
        chatWelcome.scrollIntoView({ behavior: 'smooth' });
      } else {
        const domain = ACADEMIC_DOMAINS[state.activeDomain];
        showToast(`Current Stream: ${domain.icon} ${domain.name}. Reset chat to change stream.`, 'info');
      }
    });
  }

  // Quick Study Helper: Feynman Technique (Explain Simply)
  if (feynmanBtn) {
    feynmanBtn.addEventListener('click', () => {
      if (!state.activeDocId) {
        showToast('Please select a document first!', 'error');
        return;
      }
      const current = chatInput ? chatInput.value.trim() : '';
      if (current) {
        chatInput.value = `${current}\n\nExplain this in simple terms with everyday analogies (Feynman technique).`;
      } else {
        chatInput.value = 'Explain the central concept of this document in simple terms with intuitive real-world analogies (Feynman technique).';
      }
      handleSendMessage();
    });
  }

  // Quick Study Helper: 3-Bullet Takeaways
  if (quickBulletBtn) {
    quickBulletBtn.addEventListener('click', () => {
      if (!state.activeDocId) {
        showToast('Please select a document first!', 'error');
        return;
      }
      const current = chatInput ? chatInput.value.trim() : '';
      if (current) {
        chatInput.value = `${current}\n\nSummarize the key takeaways in 3 crisp bullet points.`;
      } else {
        chatInput.value = 'Summarize the 3 most important takeaways from this document in crisp bullets.';
      }
      handleSendMessage();
    });
  }

  // Quick Study Helper: Exam Traps & Gotchas
  if (quickExamTrapsBtn) {
    quickExamTrapsBtn.addEventListener('click', () => {
      if (!state.activeDocId) {
        showToast('Please select a document first!', 'error');
        return;
      }
      const current = chatInput ? chatInput.value.trim() : '';
      if (current) {
        chatInput.value = `${current}\n\nWhat are the most common exam traps, trick questions, or confusing gotchas regarding this?`;
      } else {
        chatInput.value = 'What are the most common exam traps, tricky questions, or confusing gotchas in this document?';
      }
      handleSendMessage();
    });
  }

  // Quick Study Helper: Test Me with 1 Question
  if (quickQuizMeBtn) {
    quickQuizMeBtn.addEventListener('click', () => {
      if (!state.activeDocId) {
        showToast('Please select a document first!', 'error');
        return;
      }
      const current = chatInput ? chatInput.value.trim() : '';
      if (current) {
        chatInput.value = `${current}\n\nTest me with 1 challenging practice MCQ on this topic, with 4 options and the correct answer explained below.`;
      } else {
        chatInput.value = 'Test my understanding with 1 challenging practice MCQ on this document, with 4 options and detailed explanation.';
      }
      handleSendMessage();
    });
  }


  // Summary Controls
  summaryTypeButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      summaryTypeButtons.forEach((b) => {
        b.classList.remove('active', 'text-white');
        b.classList.add('text-slate-400');
      });
      btn.classList.add('active', 'text-white');
      btn.classList.remove('text-slate-400');
      state.summaryType = btn.dataset.type;
    });
  });

  if (generateSummaryBtn) generateSummaryBtn.addEventListener('click', handleGenerateSummary);
  if (copySummaryBtn) copySummaryBtn.addEventListener('click', copySummaryToClipboard);
  if (speakSummaryBtn) speakSummaryBtn.addEventListener('click', handleSpeakSummary);
  if (exportSummaryDocxBtn) exportSummaryDocxBtn.addEventListener('click', () => handleExportDocx('summary'));
  if (exportSummaryPdfBtn) exportSummaryPdfBtn.addEventListener('click', () => handleExportPdf('summary'));

  // Deselect Doc
  if (closeActiveDocBtn) closeActiveDocBtn.addEventListener('click', () => selectDocument(null));

  // Reader Mode Toggles
  if (readerModeFormatted) readerModeFormatted.addEventListener('click', () => switchReaderMode('formatted'));
  if (readerModeRaw) readerModeRaw.addEventListener('click', () => switchReaderMode('raw'));

  // Copy Document Content
  if (copyDocTextBtn) {
    copyDocTextBtn.addEventListener('click', () => {
      if (!state.activeDoc || !state.activeDoc.content) {
        showToast('No document selected to copy', 'error');
        return;
      }
      navigator.clipboard.writeText(state.activeDoc.content);
      showToast('Document notes copied to clipboard!', 'success');
    });
  }

  if (speakDocBtn) speakDocBtn.addEventListener('click', handleSpeakDocument);
  if (exportDocxBtn) exportDocxBtn.addEventListener('click', () => handleExportDocx('notes'));
  if (exportPdfBtn) exportPdfBtn.addEventListener('click', () => handleExportPdf('notes'));

  // View Raw Text from Sidebar -> switch to reader tab
  if (viewRawTextBtn) {
    viewRawTextBtn.addEventListener('click', () => {
      if (window.innerWidth < 768) {
        closeMobileSidebar();
      }
      switchTab('reader');
    });
  }

  if (closeModalBtn && textModal) {
    closeModalBtn.addEventListener('click', () => textModal.classList.add('hidden'));
    textModal.addEventListener('click', (e) => {
      if (e.target === textModal) textModal.classList.add('hidden');
    });
  }

  // Doc Reader Search Filter & Highlighting
  if (docSearchInput) docSearchInput.addEventListener('input', handleDocumentSearch);

  // Study Hub Sub-Tabs
  if (studySubTabQuiz) {
    studySubTabQuiz.addEventListener('click', () => switchStudySubTab('quiz'));
  }
  if (studySubTabFlashcards) {
    studySubTabFlashcards.addEventListener('click', () => switchStudySubTab('flashcards'));
  }
  if (studySubTabCheatsheet) {
    studySubTabCheatsheet.addEventListener('click', () => switchStudySubTab('cheatsheet'));
  }

  // Quiz Actions
  if (startQuizBtn) startQuizBtn.addEventListener('click', handleStartQuiz);
  if (nextQuestionBtn) nextQuestionBtn.addEventListener('click', handleNextQuestion);
  if (retakeQuizBtn) retakeQuizBtn.addEventListener('click', handleStartQuiz);

  // Topic Selector & Custom Input Toggle
  if (quizTopicSelect) {
    quizTopicSelect.addEventListener('change', (e) => {
      state.quizSelectedTopic = e.target.value;
      if (e.target.value === 'custom') {
        if (quizCustomTopicInput) {
          quizCustomTopicInput.classList.remove('hidden');
          quizCustomTopicInput.focus();
        }
      } else {
        if (quizCustomTopicInput) {
          quizCustomTopicInput.classList.add('hidden');
        }
      }
    });
  }

  // Topic Radar Modal Actions
  if (viewMasteryRadarBtn) viewMasteryRadarBtn.addEventListener('click', openTopicRadarModal);
  if (viewAllMasteryFromResultsBtn) viewAllMasteryFromResultsBtn.addEventListener('click', openTopicRadarModal);
  if (closeRadarModalBtn) closeRadarModalBtn.addEventListener('click', closeTopicRadarModal);
  if (topicRadarModal) {
    topicRadarModal.addEventListener('click', (e) => {
      if (e.target === topicRadarModal) closeTopicRadarModal();
    });
  }

  // Targeted Drill Modal Actions
  if (closeDrillModalBtn) closeDrillModalBtn.addEventListener('click', closeTargetedDrillModal);
  if (closeDrillAfterMasteryBtn) closeDrillAfterMasteryBtn.addEventListener('click', closeTargetedDrillModal);
  if (drillNextBtn) drillNextBtn.addEventListener('click', handleDrillNextQuestion);
  if (drillAdvanceLevelBtn) drillAdvanceLevelBtn.addEventListener('click', advanceDrillLevel);
  if (targetedDrillModal) {
    targetedDrillModal.addEventListener('click', (e) => {
      if (e.target === targetedDrillModal) closeTargetedDrillModal();
    });
  }

  // Flashcards Actions
  if (startFlashcardsBtn) startFlashcardsBtn.addEventListener('click', handleStartFlashcards);
  if (flipCardBtn) flipCardBtn.addEventListener('click', toggleCardFlip);
  if (flashcardElement) flashcardElement.addEventListener('click', toggleCardFlip);
  if (nextCardBtn) nextCardBtn.addEventListener('click', () => navigateFlashcard(1));
  if (prevCardBtn) prevCardBtn.addEventListener('click', () => navigateFlashcard(-1));

  // Cheat Sheet Actions
  if (startCheatsheetBtn) startCheatsheetBtn.addEventListener('click', handleStartCheatsheet);
  if (downloadCheatsheetPdfBtn) downloadCheatsheetPdfBtn.addEventListener('click', downloadCheatsheetPdf);
  if (downloadCheatsheetMdBtn) downloadCheatsheetMdBtn.addEventListener('click', downloadCheatsheetMd);
  if (copyCheatsheetMarkdownBtn) copyCheatsheetMarkdownBtn.addEventListener('click', copyCheatsheetMarkdown);
  if (cheatsheetSearch) cheatsheetSearch.addEventListener('input', handleCheatsheetSearch);

  // Mind Map Actions
  if (generateMindmapBtn) generateMindmapBtn.addEventListener('click', handleGenerateMindmap);
  if (zoomInBtn) zoomInBtn.addEventListener('click', () => setMindmapZoom(1.2));
  if (zoomOutBtn) zoomOutBtn.addEventListener('click', () => setMindmapZoom(0.83));
  if (resetZoomBtn) resetZoomBtn.addEventListener('click', () => fitMindmapToScreen(true));
  if (zoomLevelText) {
    zoomLevelText.addEventListener('click', () => {
      state.mindmap.scale = 1.0;
      state.mindmap.panX = 40;
      state.mindmap.panY = 40;
      applyMindmapTransform();
      showToast('Zoom set to 100% (Native 1:1 Scale)', 'success');
    });
  }
  if (toggleOrientationBtn) toggleOrientationBtn.addEventListener('click', toggleMindmapOrientation);
  if (theaterMindmapBtn) theaterMindmapBtn.addEventListener('click', toggleMindmapTheater);
  if (viewMermaidCodeBtn) viewMermaidCodeBtn.addEventListener('click', openMermaidCodeModal);
  if (closeMermaidModalBtn) closeMermaidModalBtn.addEventListener('click', closeMermaidCodeModal);
  if (mermaidCodeModal) {
    mermaidCodeModal.addEventListener('click', (e) => {
      if (e.target === mermaidCodeModal) closeMermaidCodeModal();
    });
  }
  if (copyMermaidCodeBtn) copyMermaidCodeBtn.addEventListener('click', copyMermaidCode);
  if (applyMermaidCodeBtn) applyMermaidCodeBtn.addEventListener('click', applyCustomMermaidCode);
  if (downloadSvgBtn) downloadSvgBtn.addEventListener('click', downloadMindmapSvg);
  setupMindmapPanZoom();

  // Audio Player Bar Controls
  if (audioPauseBtn) audioPauseBtn.addEventListener('click', toggleAudioPause);
  if (audioStopBtn) audioStopBtn.addEventListener('click', stopAudio);
  if (audioRateSelect) {
    audioRateSelect.addEventListener('change', (e) => {
      state.speechRate = parseFloat(e.target.value) || 1.0;
      if (state.currentUtterance && window.speechSynthesis.speaking) {
        // Restart speech with new rate
        const text = state.currentUtterance.text;
        const title = audioPlayerTitle.textContent;
        stopAudio();
        playAudio(text, title);
      }
    });
  }
}

// ==========================================
// Tabs Switching
// ==========================================
async function switchTab(tab) {
  state.activeTab = tab;
  [tabBtnChat, tabBtnSummary, tabBtnReader, tabBtnStudy, tabBtnMindmap].forEach((btn) => {
    if (btn) {
      btn.classList.remove('active');
      btn.classList.add('text-slate-400');
    }
  });
  [paneChat, paneSummary, paneReader, paneStudy, paneMindmap].forEach((pane) => {
    if (pane) pane.classList.add('hidden');
  });

  if (tab === 'chat') {
    if (tabBtnChat) {
      tabBtnChat.classList.add('active');
      tabBtnChat.classList.remove('text-slate-400');
    }
    if (paneChat) paneChat.classList.remove('hidden');
    if (chatInput) chatInput.focus();
  } else if (tab === 'summary') {
    if (tabBtnSummary) {
      tabBtnSummary.classList.add('active');
      tabBtnSummary.classList.remove('text-slate-400');
    }
    if (paneSummary) paneSummary.classList.remove('hidden');
  } else if (tab === 'reader') {
    if (tabBtnReader) {
      tabBtnReader.classList.add('active');
      tabBtnReader.classList.remove('text-slate-400');
    }
    if (paneReader) paneReader.classList.remove('hidden');

    if (state.activeDoc && state.activeDoc.content) {
      if (readerDocTitle) readerDocTitle.textContent = state.activeDoc.filename;
      renderFullDocument(state.activeDoc.content);
    } else if (state.documents && state.documents.length > 0) {
      await selectDocument(state.documents[0].id);
    } else {
      renderFullDocument(null);
    }
  } else if (tab === 'study') {
    if (tabBtnStudy) {
      tabBtnStudy.classList.add('active');
      tabBtnStudy.classList.remove('text-slate-400');
    }
    if (paneStudy) paneStudy.classList.remove('hidden');
  } else if (tab === 'mindmap') {
    if (tabBtnMindmap) {
      tabBtnMindmap.classList.add('active');
      tabBtnMindmap.classList.remove('text-slate-400');
    }
    if (paneMindmap) paneMindmap.classList.remove('hidden');
  }
}

// Reader Mode (Formatted vs Raw)
function switchReaderMode(mode) {
  state.readerMode = mode;
  const targetFormatted = document.getElementById('fullDocFormatted') || document.getElementById('fullDocText');
  const targetRaw = document.getElementById('fullDocRaw');

  if (mode === 'formatted') {
    if (readerModeFormatted) {
      readerModeFormatted.className = 'px-3 py-1 rounded-md font-medium text-white bg-brand-600 transition-all shadow-sm';
    }
    if (readerModeRaw) {
      readerModeRaw.className = 'px-3 py-1 rounded-md font-medium text-slate-400 hover:text-white transition-all';
    }
    if (targetFormatted) targetFormatted.classList.remove('hidden');
    if (targetRaw) targetRaw.classList.add('hidden');
  } else {
    if (readerModeRaw) {
      readerModeRaw.className = 'px-3 py-1 rounded-md font-medium text-white bg-brand-600 transition-all shadow-sm';
    }
    if (readerModeFormatted) {
      readerModeFormatted.className = 'px-3 py-1 rounded-md font-medium text-slate-400 hover:text-white transition-all';
    }
    if (targetRaw) targetRaw.classList.remove('hidden');
    if (targetFormatted) targetFormatted.classList.add('hidden');
  }
}

function handleDocumentSearch(e) {
  const query = e.target.value.trim();
  if (!state.activeDoc || !state.activeDoc.content) return;

  const raw = state.activeDoc.content;
  const targetFormatted = document.getElementById('fullDocFormatted') || document.getElementById('fullDocText');

  if (!query) {
    if (searchMatchCount) {
      searchMatchCount.classList.add('hidden');
      searchMatchCount.textContent = '';
    }
    renderFullDocument(raw);
    return;
  }

  const regex = new RegExp(escapeRegExp(query), 'gi');
  const matches = raw.match(regex);
  const count = matches ? matches.length : 0;

  if (searchMatchCount) {
    searchMatchCount.textContent = `${count} match${count === 1 ? '' : 'es'}`;
    searchMatchCount.classList.remove('hidden');

    if (count === 0) {
      searchMatchCount.classList.add('text-slate-400');
      searchMatchCount.classList.remove('text-amber-400');
    } else {
      searchMatchCount.classList.remove('text-slate-400');
      searchMatchCount.classList.add('text-amber-400');
    }
  }

  const baseHtml = window.marked ? marked.parse(raw) : escapeHtml(raw);
  const highlightedHtml = baseHtml.replace(
    new RegExp(`(${escapeRegExp(query)})`, 'gi'),
    '<mark class="search-highlight">$1</mark>'
  );
  if (targetFormatted) {
    targetFormatted.innerHTML = highlightedHtml;
    const firstMatch = targetFormatted.querySelector('mark.search-highlight');
    if (firstMatch) {
      firstMatch.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }
}

function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ==========================================
// File Upload & Document Management
// ==========================================
function handleFileSelect(e) {
  if (e.target.files && e.target.files.length) {
    uploadFile(e.target.files[0]);
    e.target.value = '';
  }
}

async function uploadFile(file) {
  if (!file) return;

  const formData = new FormData();
  formData.append('file', file);

  if (uploadProgress) uploadProgress.classList.remove('hidden');
  if (progressBar) progressBar.style.width = '35%';
  if (uploadStatusText) uploadStatusText.textContent = `Uploading ${file.name}...`;

  try {
    if (progressBar) progressBar.style.width = '65%';
    if (uploadStatusText) uploadStatusText.textContent = `Extracting & indexing document notes...`;

    const res = await fetch('/upload', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: formData,
    });

    if (!res.ok) {
      let msg = 'Upload failed';
      try {
        const err = await res.json();
        msg = err.detail || msg;
      } catch (e) {}
      throw new Error(msg);
    }

    if (progressBar) progressBar.style.width = '100%';
    if (uploadStatusText) uploadStatusText.textContent = `Document indexed successfully!`;

    const newDoc = await res.json();
    showToast(`Successfully indexed "${file.name}"!`, 'success');

    // Immediately cache in IndexedDB with full content so it survives any server restart or logout
    try {
      const detailRes = await fetch(`/api/documents/${newDoc.id}`);
      if (detailRes.ok) {
        const fullDoc = await detailRes.json();
        await idbSaveDocument(fullDoc);
      } else {
        await idbSaveDocument(newDoc);
      }
    } catch (e) {
      await idbSaveDocument(newDoc);
    }

    state.activeDocId = newDoc.id;
    await fetchDocuments();
    await selectDocument(newDoc.id);

    setTimeout(() => {
      if (uploadProgress) uploadProgress.classList.add('hidden');
      if (progressBar) progressBar.style.width = '0%';
    }, 1500);

  } catch (error) {
    console.error('Upload error:', error);
    showToast(error.message, 'error');
    if (uploadStatusText) uploadStatusText.textContent = 'Upload failed: ' + error.message;
    setTimeout(() => {
      if (uploadProgress) uploadProgress.classList.add('hidden');
      if (progressBar) progressBar.style.width = '0%';
    }, 3000);
  }
}

async function fetchDocuments() {
  // 1. Immediately read from IndexedDB to show documents with 0ms delay!
  const localCachedDocs = await idbGetDocuments();
  if (localCachedDocs && localCachedDocs.length > 0 && state.documents.length === 0) {
    state.documents = localCachedDocs;
    renderDocumentList();
    const targetDoc = state.activeDocId && localCachedDocs.find((d) => d.id === state.activeDocId);
    const docIdToSelect = targetDoc ? targetDoc.id : localCachedDocs[0].id;
    selectDocument(docIdToSelect);
  }

  try {
    const res = await fetch('/api/documents', {
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Failed to load documents');
    let docs = await res.json();

    // 2. If backend has fewer documents than local cache (e.g. server restart or container wipe), auto-restore to backend!
    if (localCachedDocs && localCachedDocs.length > 0) {
      const serverDocIds = new Set((docs || []).map(d => d.id));
      const missingOnServer = localCachedDocs.filter(d => !serverDocIds.has(d.id));

      if (missingOnServer.length > 0) {
        console.log(`Auto-restoring ${missingOnServer.length} cached documents to backend...`);
        await autoRestoreDocumentsToBackend(missingOnServer);

        // Refetch from server after restore completes
        const refetchRes = await fetch('/api/documents', { headers: getAuthHeaders() });
        if (refetchRes.ok) {
          docs = await refetchRes.json();
        }
      }
    }

    state.documents = (docs && docs.length > 0) ? docs : (localCachedDocs || []);
    renderDocumentList();

    // 3. Cache documents into IndexedDB
    for (const doc of state.documents) {
      idbSaveDocument(doc);
    }

    if (state.documents.length > 0) {
      const targetDoc = state.activeDocId && state.documents.find((d) => d.id === state.activeDocId);
      const docIdToSelect = targetDoc ? targetDoc.id : state.documents[0].id;
      await selectDocument(docIdToSelect);
    } else {
      await selectDocument(null);
    }
  } catch (err) {
    console.error('Fetch docs error:', err);
    if (localCachedDocs && localCachedDocs.length > 0) {
      state.documents = localCachedDocs;
      renderDocumentList();
      const targetDoc = state.activeDocId && localCachedDocs.find((d) => d.id === state.activeDocId);
      const docIdToSelect = targetDoc ? targetDoc.id : localCachedDocs[0].id;
      await selectDocument(docIdToSelect);
    }
  }
}

function renderDocumentList() {
  if (docCountBadge) docCountBadge.textContent = `${state.documents.length} docs`;

  if (state.documents.length === 0) {
    if (emptyDocState) emptyDocState.classList.remove('hidden');
    if (sidebarStats) sidebarStats.classList.add('hidden');
    if (documentList) documentList.innerHTML = '';
    return;
  }

  if (emptyDocState) emptyDocState.classList.add('hidden');
  if (!documentList) return;
  documentList.innerHTML = '';

  state.documents.forEach((doc) => {
    const isActive = doc.id === state.activeDocId;
    const item = document.createElement('div');
    item.className = `p-3 rounded-xl border cursor-pointer transition-all duration-150 flex items-center justify-between group ${
      isActive
        ? 'bg-brand-500/10 border-brand-500/40 text-white shadow-sm'
        : 'bg-dark-surface/40 hover:bg-dark-hover border-dark-border/60 text-slate-300'
    }`;

    const ext = (doc.file_type || '').toLowerCase();
    let iconClass = 'text-slate-400';
    let iconName = 'file-text';
    if (ext === '.pdf') {
      iconClass = 'text-rose-400';
    } else if (ext === '.docx') {
      iconClass = 'text-blue-400';
    } else if (ext === '.csv') {
      iconClass = 'text-emerald-400';
    } else if (ext === '.json') {
      iconClass = 'text-amber-400';
    }

    item.innerHTML = `
      <div class="flex items-center space-x-3 overflow-hidden mr-2">
        <div class="w-8 h-8 rounded-lg bg-dark-bg/60 flex items-center justify-center flex-shrink-0 ${iconClass}">
          <i data-lucide="${iconName}" class="w-4 h-4"></i>
        </div>
        <div class="overflow-hidden">
          <p class="text-xs font-semibold truncate ${isActive ? 'text-white' : 'text-slate-200'}">${escapeHtml(doc.filename)}</p>
          <div class="flex items-center space-x-1.5 text-[10px] text-slate-500 mt-0.5">
            <span>${formatBytes(doc.file_size)}</span>
            ${doc.word_count ? `<span>•</span><span>${(doc.word_count).toLocaleString()} words</span>` : ''}
          </div>
        </div>
      </div>
      <button class="delete-doc-btn opacity-0 group-hover:opacity-100 hover:text-red-400 p-1 rounded-md hover:bg-red-500/10 transition-all text-slate-500 flex-shrink-0" title="Delete document">
        <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
      </button>
    `;

    item.addEventListener('click', (e) => {
      if (e.target.closest('.delete-doc-btn')) return;
      selectDocument(doc.id);
    });

    const delBtn = item.querySelector('.delete-doc-btn');
    if (delBtn) {
      delBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        deleteDocument(doc.id, doc.filename);
      });
    }

    documentList.appendChild(item);
  });

  initIcons();
}

async function selectDocument(docId) {
  // If on mobile, auto-close the drawer so the user immediately sees the active document & chat
  if (window.innerWidth < 768) {
    closeMobileSidebar();
  }

  if (!docId) {
    state.activeDocId = null;
    state.activeDoc = null;
    state.sessions = [];
    state.activeSessionId = null;
    state.activeSessionTitle = 'New Chat';
    if (activeDocBadge) {
      activeDocBadge.classList.add('hidden');
      activeDocBadge.classList.remove('flex');
    }
    if (sidebarStats) sidebarStats.classList.add('hidden');
    if (activeSessionBar) activeSessionBar.classList.add('hidden');
    if (sessionCountBadge) sessionCountBadge.textContent = '0';
    if (totalSessionsCount) totalSessionsCount.textContent = '0';
    renderDocumentList();
    resetChatView();
    resetSummaryView();
    renderFullDocument(null);
    return;
  }

  state.activeDocId = docId;

  try {
    let doc = null;
    try {
      const res = await fetch(`/api/documents/${docId}`);
      if (res.ok) {
        doc = await res.json();
      }
    } catch (e) {
      console.warn('Network issue fetching document details, will check local storage:', e);
    }

    if (!doc) {
      const localDocs = await idbGetDocuments();
      doc = (localDocs || []).find((d) => d.id === docId);
    }
    if (!doc) throw new Error('Document details not found');

    state.activeDoc = doc;
    idbSaveDocument(doc);

    // Update active badge in navbar
    if (activeDocName) activeDocName.textContent = doc.filename;
    if (activeDocBadge) {
      activeDocBadge.classList.remove('hidden');
      activeDocBadge.classList.add('flex');
    }

    // Update sidebar stats
    if (statWords) statWords.textContent = (doc.word_count || 0).toLocaleString();
    if (statChunks) statChunks.textContent = doc.chunk_count || 0;
    const readMin = Math.max(1, Math.round((doc.word_count || 0) / 200));
    if (statReadTime) statReadTime.textContent = `${readMin}m`;
    if (statSize) statSize.textContent = formatBytes(doc.file_size || 0);
    if (sidebarStats) sidebarStats.classList.remove('hidden');

    // Update reader pane
    if (readerDocTitle) readerDocTitle.textContent = doc.filename;
    renderFullDocument(doc.content);

    // Refresh list styling
    renderDocumentList();

    // Show active session bar
    if (activeSessionBar) activeSessionBar.classList.remove('hidden');

    // Fetch and load chat sessions for this document
    await fetchChatSessions(docId);

    // Fetch document topics & mastery profile for quizzes
    fetchDocumentTopics(docId);
    fetchTopicMastery(docId);

    // If document already has a summary, display it
    if (doc.summary) {
      displaySummary(doc.summary, doc.summary_type || 'bullet');
    } else {
      resetSummaryView();
    }
  } catch (err) {
    console.error('Error selecting doc:', err);
    showToast('Failed to select document: ' + err.message, 'error');
  }
}

function renderFullDocument(content) {
  const formattedEl = document.getElementById('fullDocFormatted') || document.getElementById('fullDocText');
  const rawEl = document.getElementById('fullDocRaw');
  const legacyEl = document.getElementById('fullDocText');

  if (!content) {
    const emptyHtml = `
      <div class="text-center py-16 text-slate-400">
        <div class="w-12 h-12 rounded-xl bg-dark-surface border border-dark-border flex items-center justify-center mx-auto mb-3 text-brand-400">
          <i data-lucide="file-question" class="w-6 h-6"></i>
        </div>
        <p class="text-base font-semibold text-slate-200">No Document Selected</p>
        <p class="text-xs text-slate-400 mt-1 max-w-sm mx-auto">Please click a document from the left library to view its notes.</p>
      </div>
    `;
    if (formattedEl) formattedEl.innerHTML = emptyHtml;
    if (legacyEl && legacyEl !== formattedEl) legacyEl.innerHTML = emptyHtml;
    if (rawEl) rawEl.textContent = 'No document selected.';
    initIcons();
    return;
  }

  // Render Formatted Notes view
  const parsedHtml = window.marked ? marked.parse(content) : escapeHtml(content);
  if (formattedEl) {
    formattedEl.innerHTML = parsedHtml;
    renderMath(formattedEl);
  }
  if (legacyEl && legacyEl !== formattedEl) {
    legacyEl.innerHTML = parsedHtml;
    renderMath(legacyEl);
  }

  // Render Plain Text view
  if (rawEl) rawEl.textContent = content;

  // Clear search input on document switch
  if (docSearchInput) docSearchInput.value = '';
  if (searchMatchCount) searchMatchCount.classList.add('hidden');
}

async function deleteDocument(docId, filename) {
  if (!confirm(`Are you sure you want to delete "${filename}"? All vectors and chat history will be removed.`)) {
    return;
  }

  try {
    await idbDeleteDocument(docId);
    const res = await fetch(`/api/documents/${docId}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Delete failed');
    showToast(`Deleted "${filename}"`, 'success');
    if (state.activeDocId === docId) {
      state.activeDocId = null;
      state.activeDoc = null;
    }
    await fetchDocuments();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ==========================================
// Q&A / Chat & Session Implementation
// ==========================================
async function fetchChatSessions(docId, preferredSessionId = null) {
  if (!docId) return;

  // Check local cache first for instant display
  const localSessions = await idbGetSessions(docId);
  if (localSessions && localSessions.length > 0 && state.sessions.length === 0) {
    state.sessions = localSessions;
    const count = state.sessions.length;
    if (sessionCountBadge) sessionCountBadge.textContent = count;
    if (totalSessionsCount) totalSessionsCount.textContent = count;
    const targetSession = preferredSessionId
      ? state.sessions.find((s) => s.id === preferredSessionId) || state.sessions[0]
      : state.sessions[0];
    state.activeSessionId = targetSession.id;
    state.activeSessionTitle = targetSession.title || 'New Chat';
    if (activeSessionTitle) activeSessionTitle.textContent = state.activeSessionTitle;
    await loadChatHistory(docId, targetSession.id);
  }

  try {
    const res = await fetch(`/api/documents/${docId}/sessions`);
    if (!res.ok) throw new Error('Failed to load chat sessions');
    const sessions = await res.json();

    if (sessions && sessions.length > 0) {
      for (const s of sessions) {
        idbSaveSession({ ...s, doc_id: docId });
      }
      state.sessions = sessions;
    } else if (localSessions && localSessions.length > 0) {
      state.sessions = localSessions;
    } else {
      state.sessions = [];
    }

    // Update count badges
    const count = state.sessions.length;
    if (sessionCountBadge) sessionCountBadge.textContent = count;
    if (totalSessionsCount) totalSessionsCount.textContent = count;

    if (state.sessions.length === 0) {
      // If no session exists yet for this doc, start one
      await handleNewChat(false);
      return;
    }

    // Determine target session to activate
    let targetSession = null;
    if (preferredSessionId) {
      targetSession = state.sessions.find((s) => s.id === preferredSessionId);
    }
    if (!targetSession) {
      targetSession = state.sessions[0];
    }

    state.activeSessionId = targetSession.id;
    state.activeSessionTitle = targetSession.title || 'New Chat';

    // Update session banner
    if (activeSessionTitle) activeSessionTitle.textContent = state.activeSessionTitle;
    if (sessionMessageCount) sessionMessageCount.textContent = `${targetSession.message_count || 0} msgs`;

    // Load messages for this active session
    await loadChatHistory(docId, targetSession.id);
  } catch (err) {
    console.error('Error fetching chat sessions:', err);
    if (localSessions && localSessions.length > 0) {
      state.sessions = localSessions;
      const targetSession = localSessions[0];
      state.activeSessionId = targetSession.id;
      state.activeSessionTitle = targetSession.title || 'New Chat';
      if (activeSessionTitle) activeSessionTitle.textContent = state.activeSessionTitle;
      await loadChatHistory(docId, targetSession.id);
    }
  }
}

async function handleNewChat(showToastNotification = true) {
  if (!state.activeDocId) {
    showToast('Please upload or select a document first!', 'error');
    return;
  }

  try {
    const res = await fetch(`/api/documents/${state.activeDocId}/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'New Chat' }),
    });

    if (!res.ok) throw new Error('Failed to create new chat session');
    const newSession = await res.json();
    idbSaveSession({ ...newSession, doc_id: state.activeDocId });

    // Insert at front of sessions array
    state.sessions.unshift(newSession);
    state.activeSessionId = newSession.id;
    state.activeSessionTitle = newSession.title || 'New Chat';

    // Update UI elements
    if (activeSessionTitle) activeSessionTitle.textContent = state.activeSessionTitle;
    if (sessionMessageCount) sessionMessageCount.textContent = '0 msgs';
    const count = state.sessions.length;
    if (sessionCountBadge) sessionCountBadge.textContent = count;
    if (totalSessionsCount) totalSessionsCount.textContent = count;

    // Reset chat viewport to initial welcome state
    resetChatView();

    // Close past chats modal if open
    closePastChatsModal();

    if (showToastNotification) {
      showToast('Started a fresh conversation session!', 'success');
    }

    if (chatInput) {
      chatInput.value = '';
      chatInput.focus();
    }
  } catch (err) {
    console.error('Error starting new chat:', err);
    showToast('Failed to start new chat: ' + err.message, 'error');
  }
}

async function selectChatSession(sessionId) {
  if (!state.activeDocId || !sessionId) return;
  const session = state.sessions.find((s) => s.id === sessionId);
  if (!session) return;

  state.activeSessionId = session.id;
  state.activeSessionTitle = session.title || 'New Chat';

  if (activeSessionTitle) activeSessionTitle.textContent = state.activeSessionTitle;
  if (sessionMessageCount) sessionMessageCount.textContent = `${session.message_count || 0} msgs`;

  closePastChatsModal();
  await loadChatHistory(state.activeDocId, session.id);
  if (chatInput) chatInput.focus();
}

async function openPastChatsModal() {
  if (!state.activeDocId) {
    if (state.documents && state.documents.length > 0) {
      await selectDocument(state.documents[0].id);
    } else {
      showToast('Please upload or select a document first!', 'error');
      return;
    }
  }

  if (pastChatsDocName) {
    pastChatsDocName.textContent = state.activeDoc ? state.activeDoc.filename : 'Document Notes';
  }
  if (sessionSearchInput) sessionSearchInput.value = '';
  state.sessionFilter = '';
  renderPastChatsList();

  if (pastChatsModal) {
    pastChatsModal.classList.remove('hidden');
    pastChatsModal.classList.add('flex');
    initIcons();
  }
  if (sessionSearchInput) sessionSearchInput.focus();
}

function closePastChatsModal() {
  if (pastChatsModal) {
    pastChatsModal.classList.add('hidden');
    pastChatsModal.classList.remove('flex');
  }
  if (sessionSearchInput) sessionSearchInput.value = '';
  state.sessionFilter = '';
}

function renderPastChatsList() {
  if (!pastChatsList) return;
  pastChatsList.innerHTML = '';

  const filter = (state.sessionFilter || '').toLowerCase();
  const filtered = state.sessions.filter((s) => {
    if (!filter) return true;
    return (s.title || '').toLowerCase().includes(filter);
  });

  if (filtered.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'text-center py-10 text-slate-400';
    empty.innerHTML = `
      <div class="w-10 h-10 rounded-xl bg-dark-surface border border-dark-border flex items-center justify-center mx-auto mb-2 text-slate-500">
        <i data-lucide="message-square-off" class="w-5 h-5"></i>
      </div>
      <p class="text-xs font-semibold text-slate-300">${filter ? 'No matching chats found' : 'No saved conversations yet'}</p>
      <p class="text-[11px] text-slate-500 mt-1">${filter ? 'Try a different search keyword' : 'Click "+ New Chat" to start a fresh discussion'}</p>
    `;
    pastChatsList.appendChild(empty);
    initIcons();
    return;
  }

  filtered.forEach((session) => {
    const isActive = session.id === state.activeSessionId;
    const card = document.createElement('div');
    card.className = `p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between group ${
      isActive
        ? 'bg-brand-500/10 border-brand-500/50 shadow-sm text-white'
        : 'bg-dark-surface/50 hover:bg-dark-hover border-dark-border/70 text-slate-200'
    }`;

    // Format relative date
    let dateStr = '';
    if (session.updated_at || session.created_at) {
      try {
        const d = new Date(session.updated_at || session.created_at);
        dateStr =
          d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) +
          ' ' +
          d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
      } catch (e) {
        dateStr = '';
      }
    }

    card.innerHTML = `
      <div class="flex items-center space-x-3 overflow-hidden mr-2 flex-1">
        <div class="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
          isActive ? 'bg-brand-500/20 text-brand-400' : 'bg-dark-bg/60 text-slate-400 group-hover:text-slate-300'
        }">
          <i data-lucide="${isActive ? 'message-circle' : 'message-square'}" class="w-4 h-4"></i>
        </div>
        <div class="overflow-hidden flex-1">
          <div class="flex items-center space-x-2">
            <span class="text-xs font-semibold truncate ${isActive ? 'text-brand-300' : 'text-slate-200'}">${escapeHtml(session.title || 'New Chat')}</span>
            ${isActive ? '<span class="px-1.5 py-0.2 rounded-full bg-brand-500/20 text-brand-300 text-[9px] font-semibold border border-brand-500/40">Active</span>' : ''}
          </div>
          <div class="flex items-center space-x-2 text-[10px] text-slate-500 mt-0.5">
            <span>${session.message_count || 0} messages</span>
            ${dateStr ? `<span>•</span><span>${dateStr}</span>` : ''}
          </div>
        </div>
      </div>
      <div class="flex items-center space-x-1 flex-shrink-0">
        <button class="rename-session-btn p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-dark-surface transition-colors" title="Rename conversation">
          <i data-lucide="pencil" class="w-3.5 h-3.5"></i>
        </button>
        <button class="delete-session-btn p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors" title="Delete conversation">
          <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
        </button>
      </div>
    `;

    // Click card -> select session
    card.addEventListener('click', (e) => {
      if (e.target.closest('.rename-session-btn') || e.target.closest('.delete-session-btn')) return;
      selectChatSession(session.id);
    });

    // Rename button
    const rBtn = card.querySelector('.rename-session-btn');
    if (rBtn) {
      rBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        handleRenameSession(session.id, session.title);
      });
    }

    // Delete button
    const dBtn = card.querySelector('.delete-session-btn');
    if (dBtn) {
      dBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        handleDeleteSession(session.id, session.title);
      });
    }

    pastChatsList.appendChild(card);
  });

  initIcons();
}

async function handleRenameSession(sessionId, currentTitle) {
  if (!sessionId) return;
  const current = currentTitle || state.activeSessionTitle || 'New Chat';
  const newTitle = prompt('Enter a new title for this conversation:', current);
  if (!newTitle || !newTitle.trim() || newTitle.trim() === current) return;

  try {
    const res = await fetch(`/api/sessions/${sessionId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: newTitle.trim() }),
    });

    if (!res.ok) throw new Error('Failed to rename session');
    const updated = await res.json();
    const cleanTitle = updated.title || newTitle.trim();

    // Update in state.sessions
    const s = state.sessions.find((x) => x.id === sessionId);
    if (s) {
      s.title = cleanTitle;
      idbSaveSession(s);
    }

    // If active session was renamed
    if (state.activeSessionId === sessionId) {
      state.activeSessionTitle = cleanTitle;
      if (activeSessionTitle) activeSessionTitle.textContent = cleanTitle;
    }

    renderPastChatsList();
    showToast('Conversation renamed!', 'success');
  } catch (err) {
    console.error('Error renaming session:', err);
    showToast('Failed to rename: ' + err.message, 'error');
  }
}

async function handleDeleteSession(sessionId, title) {
  if (!sessionId) return;
  const displayTitle = title || 'this conversation';
  if (!confirm(`Are you sure you want to delete "${displayTitle}"?\nAll messages in this conversation will be permanently removed.`)) {
    return;
  }

  try {
    await idbDeleteSession(sessionId);
    const res = await fetch(`/api/sessions/${sessionId}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete conversation');

    // Remove from state.sessions
    state.sessions = state.sessions.filter((s) => s.id !== sessionId);

    // Update badge counts
    const count = state.sessions.length;
    if (sessionCountBadge) sessionCountBadge.textContent = count;
    if (totalSessionsCount) totalSessionsCount.textContent = count;

    showToast('Conversation deleted', 'success');

    // If deleted session was the currently active one
    if (state.activeSessionId === sessionId) {
      if (state.sessions.length > 0) {
        await selectChatSession(state.sessions[0].id);
      } else {
        await handleNewChat(false);
      }
    } else {
      renderPastChatsList();
    }
  } catch (err) {
    console.error('Error deleting session:', err);
    showToast('Failed to delete conversation: ' + err.message, 'error');
  }
}

async function loadChatHistory(docId, sessionId = null) {
  if (!chatMessages) return;
  const sid = sessionId || state.activeSessionId;

  // 1. Immediately load and render from IndexedDB for instant 0ms UI display
  let localMsgs = [];
  if (sid) {
    localMsgs = await idbGetMessages(sid);
    if (localMsgs && localMsgs.length > 0) {
      chatMessages.innerHTML = '';
      if (chatWelcome) chatWelcome.classList.add('hidden');
      localMsgs.forEach((msg) => {
        appendMessageToChat(msg.role, msg.message);
      });
      if (sessionMessageCount) sessionMessageCount.textContent = `${localMsgs.length} msgs`;
      scrollChatToBottom();
    }
  }

  const url = sid
    ? `/api/documents/${docId}/chat?session_id=${encodeURIComponent(sid)}`
    : `/api/documents/${docId}/chat`;

  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error('Failed to load chat history');
    const messages = await res.json();

    if (messages && messages.length > 0) {
      chatMessages.innerHTML = '';
      if (chatWelcome) chatWelcome.classList.add('hidden');
      for (const msg of messages) {
        appendMessageToChat(msg.role, msg.message);
        idbSaveMessage(msg, docId, sid);
      }
      if (sessionMessageCount) {
        sessionMessageCount.textContent = `${messages.length} msgs`;
      }
      if (sid) {
        const s = state.sessions.find((x) => x.id === sid);
        if (s) s.message_count = messages.length;
      }
      scrollChatToBottom();
    } else if (localMsgs && localMsgs.length > 0) {
      if (sessionMessageCount) sessionMessageCount.textContent = `${localMsgs.length} msgs`;
    } else {
      chatMessages.innerHTML = '';
      if (sessionMessageCount) sessionMessageCount.textContent = `0 msgs`;
      if (chatWelcome) {
        chatMessages.appendChild(chatWelcome);
        chatWelcome.classList.remove('hidden');
      }
    }
  } catch (err) {
    console.error('Error loading chat:', err);
    if (!localMsgs || localMsgs.length === 0) {
      if (chatWelcome) {
        chatMessages.appendChild(chatWelcome);
        chatWelcome.classList.remove('hidden');
      }
    }
  }
}

function resetChatView() {
  if (!chatMessages) return;
  chatMessages.innerHTML = '';
  if (chatWelcome) {
    chatMessages.appendChild(chatWelcome);
    chatWelcome.classList.remove('hidden');
  }
}

async function handleSendMessage(e) {
  if (e) e.preventDefault();
  if (!state.activeDocId) {
    showToast('Please upload or select a document first!', 'error');
    return;
  }

  const question = chatInput ? chatInput.value.trim() : '';
  if (!question || state.isGenerating) return;

  if (chatWelcome) chatWelcome.classList.add('hidden');

  // Append User Message
  appendMessageToChat('user', question);
  const userMsg = { id: 'u_' + Date.now(), role: 'user', message: question, created_at: new Date().toISOString() };
  if (state.activeDocId && state.activeSessionId) {
    idbSaveMessage(userMsg, state.activeDocId, state.activeSessionId);
  }

  if (chatInput) {
    chatInput.value = '';
    chatInput.style.height = 'auto';
  }
  scrollChatToBottom();

  // Create thinking assistant placeholder
  const placeholder = createAssistantPlaceholder();
  chatMessages.appendChild(placeholder);
  scrollChatToBottom();

  state.isGenerating = true;
  if (sendBtn) sendBtn.disabled = true;

  try {
    const res = await fetch('/api/ask', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        doc_id: state.activeDocId,
        session_id: state.activeSessionId,
        question: question,
        top_k: 4,
        language: state.activeLanguage,
      }),
    });

    if (!res.ok) {
      let errorMsg = `Server error (${res.status})`;
      try {
        const err = await res.json();
        errorMsg = err.detail || err.message || errorMsg;
      } catch (e) {
        if (res.status === 504) {
          errorMsg = 'Request timed out on server. Please try asking again.';
        } else if (res.status === 502) {
          errorMsg = 'Server is waking up. Please wait 10 seconds and ask again.';
        }
      }
      throw new Error(errorMsg);
    }

    const data = await res.json();
    placeholder.remove();
    appendMessageToChat('assistant', data.answer);
    scrollChatToBottom();

    // If backend returned session_id or updated title
    if (data.session_id) {
      state.activeSessionId = data.session_id;
    }
    if (data.session_title) {
      state.activeSessionTitle = data.session_title;
      if (activeSessionTitle) activeSessionTitle.textContent = data.session_title;
    }

    const assistantMsg = { id: 'a_' + Date.now(), role: 'assistant', message: data.answer, created_at: new Date().toISOString() };
    if (state.activeDocId && state.activeSessionId) {
      idbSaveMessage(assistantMsg, state.activeDocId, state.activeSessionId);
      idbSaveMessage({ ...userMsg, session_id: state.activeSessionId }, state.activeDocId, state.activeSessionId);
    }

    // Update active session in state.sessions
    let target = state.sessions.find((s) => s.id === state.activeSessionId);
    if (target) {
      target.message_count = (target.message_count || 0) + 2;
      if (data.session_title) target.title = data.session_title;
      if (sessionMessageCount) sessionMessageCount.textContent = `${target.message_count} msgs`;
      idbSaveSession({ ...target, doc_id: state.activeDocId });
    } else if (data.session_id) {
      const newSessObj = {
        id: data.session_id,
        doc_id: state.activeDocId,
        title: data.session_title || 'New Chat',
        message_count: 2,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      state.sessions.unshift(newSessObj);
      idbSaveSession(newSessObj);
      const count = state.sessions.length;
      if (sessionCountBadge) sessionCountBadge.textContent = count;
      if (totalSessionsCount) totalSessionsCount.textContent = count;
      if (sessionMessageCount) sessionMessageCount.textContent = '2 msgs';
    }
  } catch (err) {
    console.error('Q&A error:', err);
    placeholder.remove();
    appendMessageToChat('assistant', `⚠️ **Error:** ${err.message}`);
    scrollChatToBottom();
  } finally {
    state.isGenerating = false;
    if (sendBtn) sendBtn.disabled = false;
    if (chatInput) chatInput.focus();
  }
}

function appendMessageToChat(role, text) {
  if (!chatMessages) return;
  const isUser = role === 'user';
  const row = document.createElement('div');
  row.className = `flex ${isUser ? 'justify-end' : 'justify-start'} animate-fade-in`;

  if (isUser) {
    row.innerHTML = `
      <div class="max-w-[80%] rounded-2xl px-4 py-3 bg-brand-600 text-white text-sm shadow-md rounded-br-sm">
        ${escapeHtml(text)}
      </div>
    `;
  } else {
    const formattedHtml = window.marked ? marked.parse(text) : escapeHtml(text);

    row.innerHTML = `
      <div class="flex space-x-3 max-w-[85%]">
        <div class="w-8 h-8 rounded-xl bg-dark-surface border border-dark-border flex items-center justify-center flex-shrink-0 text-brand-400 mt-1">
          <i data-lucide="sparkles" class="w-4 h-4"></i>
        </div>
        <div class="flex-1 bg-dark-card border border-dark-border rounded-2xl p-4 shadow-sm text-sm">
          <div class="prose text-slate-200 text-sm">
            ${formattedHtml}
          </div>
          <div class="mt-3 pt-2 border-t border-dark-border/40 flex items-center justify-between text-[11px] text-slate-500">
            <span>Grounded in document context</span>
            <div class="flex items-center space-x-2">
              <button class="speak-answer-btn hover:text-purple-400 flex items-center space-x-1 p-1 rounded hover:bg-dark-hover transition-colors" title="Listen to response">
                <i data-lucide="volume-2" class="w-3.5 h-3.5"></i>
                <span>Listen</span>
              </button>
              <button class="copy-answer-btn hover:text-slate-300 flex items-center space-x-1 p-1 rounded hover:bg-dark-hover transition-colors" title="Copy answer">
                <i data-lucide="copy" class="w-3.5 h-3.5"></i>
                <span>Copy</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    `;

    // Copy action
    const copyBtn = row.querySelector('.copy-answer-btn');
    if (copyBtn) {
      copyBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(text);
        showToast('Answer copied to clipboard!', 'success');
      });
    }

    // Speak action
    const speakBtn = row.querySelector('.speak-answer-btn');
    if (speakBtn) {
      speakBtn.addEventListener('click', () => {
        playAudio(text, 'Answer');
      });
    }
  }

  chatMessages.appendChild(row);
  initIcons();
  renderMath(row);
}

function createAssistantPlaceholder() {
  const row = document.createElement('div');
  row.className = 'flex justify-start animate-fade-in';
  row.innerHTML = `
    <div class="flex space-x-3 max-w-[85%]">
      <div class="w-8 h-8 rounded-xl bg-dark-surface border border-dark-border flex items-center justify-center flex-shrink-0 text-brand-400 mt-1">
        <i data-lucide="sparkles" class="w-4 h-4 animate-spin"></i>
      </div>
      <div class="bg-dark-card border border-dark-border rounded-2xl px-5 py-4 flex items-center space-x-2 text-slate-400 text-xs">
        <span class="w-2 h-2 rounded-full bg-brand-500 animate-ping"></span>
        <span>Searching document context & reasoning...</span>
      </div>
    </div>
  `;
  initIcons();
  return row;
}

async function handleClearChat() {
  if (!state.activeDocId || !state.activeSessionId) return;
  const currentTitle = state.activeSessionTitle || 'this conversation';
  if (!confirm(`Are you sure you want to delete "${currentTitle}"?\nYour other saved conversations for this document will remain safe.`)) {
    return;
  }

  await handleDeleteSession(state.activeSessionId, currentTitle);
}

function scrollChatToBottom() {
  if (chatMessages) chatMessages.scrollTop = chatMessages.scrollHeight;
}

// ==========================================
// Smart Summaries Implementation
// ==========================================
async function handleGenerateSummary() {
  if (!state.activeDocId) {
    showToast('Please upload or select a document first!', 'error');
    return;
  }

  if (summaryPlaceholder) summaryPlaceholder.classList.add('hidden');
  if (summaryContent) summaryContent.classList.add('hidden');
  if (summaryLoading) summaryLoading.classList.remove('hidden');
  if (generateSummaryBtn) generateSummaryBtn.disabled = true;

  try {
    const res = await fetch('/api/summarize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        doc_id: state.activeDocId,
        summary_type: state.summaryType,
        language: state.activeLanguage,
      }),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || 'Summarization failed');
    }

    const data = await res.json();
    displaySummary(data.summary, data.summary_type);
    showToast('Summary generated successfully!', 'success');

    if (state.activeDoc) {
      state.activeDoc.summary = data.summary;
      state.activeDoc.summary_type = data.summary_type;
      idbSaveDocument(state.activeDoc);
    }
  } catch (err) {
    console.error('Summary error:', err);
    showToast(err.message, 'error');
    if (summaryPlaceholder) summaryPlaceholder.classList.remove('hidden');
  } finally {
    if (summaryLoading) summaryLoading.classList.add('hidden');
    if (generateSummaryBtn) generateSummaryBtn.disabled = false;
  }
}

function displaySummary(summaryText, summaryType = 'bullet') {
  if (summaryPlaceholder) summaryPlaceholder.classList.add('hidden');
  if (summaryLoading) summaryLoading.classList.add('hidden');
  if (summaryContent) {
    summaryContent.classList.remove('hidden');
    const formatted = window.marked ? marked.parse(summaryText) : escapeHtml(summaryText);
    summaryContent.innerHTML = formatted;
    renderMath(summaryContent);
  }

  summaryTypeButtons.forEach((btn) => {
    if (btn.dataset.type === summaryType) {
      btn.classList.add('active', 'text-white');
      btn.classList.remove('text-slate-400');
      state.summaryType = summaryType;
    } else {
      btn.classList.remove('active', 'text-white');
      btn.classList.add('text-slate-400');
    }
  });
}

function resetSummaryView() {
  if (summaryContent) {
    summaryContent.classList.add('hidden');
    summaryContent.innerHTML = '';
  }
  if (summaryLoading) summaryLoading.classList.add('hidden');
  if (summaryPlaceholder) summaryPlaceholder.classList.remove('hidden');
}

function copySummaryToClipboard() {
  if (!state.activeDoc || !state.activeDoc.summary) {
    showToast('No summary to copy', 'error');
    return;
  }
  navigator.clipboard.writeText(state.activeDoc.summary);
  showToast('Summary copied to clipboard!', 'success');
}

function handleSpeakSummary() {
  if (!state.activeDoc || !state.activeDoc.summary) {
    showToast('Generate a summary first to listen!', 'error');
    return;
  }
  playAudio(state.activeDoc.summary, `${state.activeDoc.filename} Summary`);
}

function handleSpeakDocument() {
  if (!state.activeDoc || !state.activeDoc.content) {
    showToast('Please select a document first!', 'error');
    return;
  }
  playAudio(state.activeDoc.content.slice(0, 15000), state.activeDoc.filename);
}

// ==========================================
// Feature 1: Study Hub (Quiz & Flashcards)
// ==========================================
function switchStudySubTab(subTab) {
  [studySubTabQuiz, studySubTabFlashcards, studySubTabCheatsheet].forEach((btn) => {
    if (btn) {
      btn.classList.remove('active', 'text-white');
      btn.classList.add('text-slate-400');
    }
  });
  [quizControls, flashcardControls, cheatsheetControls].forEach((ctrl) => {
    if (ctrl) ctrl.classList.add('hidden');
  });
  [quizContainer, flashcardsContainer, cheatsheetContainer].forEach((cont) => {
    if (cont) cont.classList.add('hidden');
  });

  if (subTab === 'quiz') {
    if (studySubTabQuiz) studySubTabQuiz.classList.add('active', 'text-white');
    if (quizControls) quizControls.classList.remove('hidden');
    if (quizContainer) quizContainer.classList.remove('hidden');
  } else if (subTab === 'flashcards') {
    if (studySubTabFlashcards) studySubTabFlashcards.classList.add('active', 'text-white');
    if (flashcardControls) flashcardControls.classList.remove('hidden');
    if (flashcardsContainer) flashcardsContainer.classList.remove('hidden');
  } else if (subTab === 'cheatsheet') {
    if (studySubTabCheatsheet) studySubTabCheatsheet.classList.add('active', 'text-white');
    if (cheatsheetControls) cheatsheetControls.classList.remove('hidden');
    if (cheatsheetContainer) cheatsheetContainer.classList.remove('hidden');
  }
}

// ==========================================
// Interactive Quiz, Topic Weakness & Mastery System
// ==========================================
async function fetchDocumentTopics(docId) {
  if (!docId || !quizTopicSelect) return;
  try {
    const res = await fetch(`/api/documents/${docId}/topics`);
    if (!res.ok) return;
    const data = await res.json();
    const topics = data.topics || [];
    state.docTopics = topics;

    // Reset and populate quizTopicSelect
    quizTopicSelect.innerHTML = '<option value="all">🎯 All Topics (Full Coverage)</option>';
    topics.forEach((t) => {
      const opt = document.createElement('option');
      opt.value = t;
      opt.textContent = `🏷️ ${t}`;
      quizTopicSelect.appendChild(opt);
    });
    const customOpt = document.createElement('option');
    customOpt.value = 'custom';
    customOpt.textContent = '✏️ Enter Custom Topic...';
    quizTopicSelect.appendChild(customOpt);

    if (quizCustomTopicInput) {
      quizCustomTopicInput.classList.add('hidden');
      quizCustomTopicInput.value = '';
    }
  } catch (err) {
    console.warn('Failed to load document topics:', err);
  }
}

async function fetchTopicMastery(docId) {
  if (!docId) return;
  try {
    const res = await fetch(`/api/documents/${docId}/mastery`);
    if (!res.ok) return;
    const data = await res.json();
    state.topicMastery = data;
  } catch (err) {
    console.warn('Failed to load topic mastery:', err);
  }
}

async function handleStartQuiz() {
  if (!state.activeDocId) {
    showToast('Please select a document from the left library first!', 'error');
    return;
  }

  const numQ = parseInt(quizCount ? quizCount.value : '5') || 5;
  const diff = quizDifficulty ? quizDifficulty.value : 'medium';

  // Determine selected topic
  let selectedTopic = null;
  if (quizTopicSelect) {
    if (quizTopicSelect.value === 'custom') {
      const customVal = quizCustomTopicInput ? quizCustomTopicInput.value.trim() : '';
      selectedTopic = customVal || null;
    } else if (quizTopicSelect.value !== 'all') {
      selectedTopic = quizTopicSelect.value;
    }
  }
  state.quizSelectedTopic = selectedTopic || 'all';
  state.quizQuestionResults = [];

  if (quizEmpty) quizEmpty.classList.add('hidden');
  if (quizResult) quizResult.classList.add('hidden');
  if (quizActive) quizActive.classList.add('hidden');
  if (quizLoading) {
    if (quizLoadingTitle) {
      quizLoadingTitle.textContent = selectedTopic
        ? `Generating Quiz on "${selectedTopic}"...`
        : 'Generating Diagnostic Practice Quiz...';
    }
    quizLoading.classList.remove('hidden');
  }
  if (startQuizBtn) startQuizBtn.disabled = true;

  try {
    const res = await fetch('/api/quiz', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        doc_id: state.activeDocId,
        num_questions: numQ,
        difficulty: diff,
        topic: selectedTopic,
        language: state.activeLanguage,
      }),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || 'Quiz generation failed');
    }

    const data = await res.json();
    state.quizQuestions = data.questions || [];
    state.currentQuestionIndex = 0;
    state.quizScore = 0;

    if (state.quizQuestions.length === 0) {
      throw new Error('No questions could be extracted from this document.');
    }

    renderCurrentQuestion();
    if (quizLoading) quizLoading.classList.add('hidden');
    if (quizActive) quizActive.classList.remove('hidden');

    const topicLabel = selectedTopic ? ` for "${selectedTopic}"` : '';
    showToast(`Generated ${state.quizQuestions.length} practice questions${topicLabel}!`, 'success');
  } catch (err) {
    console.error('Quiz error:', err);
    showToast(err.message, 'error');
    if (quizLoading) quizLoading.classList.add('hidden');
    if (quizEmpty) quizEmpty.classList.remove('hidden');
  } finally {
    if (startQuizBtn) startQuizBtn.disabled = false;
  }
}

function renderCurrentQuestion() {
  const q = state.quizQuestions[state.currentQuestionIndex];
  if (!q) return;

  state.quizAnswered = false;

  // Header & progress
  const total = state.quizQuestions.length;
  const currentNum = state.currentQuestionIndex + 1;
  if (quizProgressText) quizProgressText.textContent = `Question ${currentNum} of ${total}`;
  if (quizScoreText) quizScoreText.textContent = `Score: ${state.quizScore}`;
  if (quizProgressBar) quizProgressBar.style.width = `${((currentNum - 1) / total) * 100}%`;

  // Topic Badge
  if (quizQuestionTopicBadge) {
    quizQuestionTopicBadge.textContent = q.topic ? `🏷️ ${q.topic}` : 'Core Concepts';
  }

  // Difficulty Badge
  if (quizQuestionDifficultyBadge) {
    const diff = (q.difficulty || state.quizDifficulty || 'medium').toLowerCase();
    quizQuestionDifficultyBadge.textContent = diff.charAt(0).toUpperCase() + diff.slice(1);
    if (diff.includes('begin') || diff.includes('easy')) {
      quizQuestionDifficultyBadge.className =
        'px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-300 border border-emerald-500/30';
    } else if (diff.includes('hard') || diff.includes('adv')) {
      quizQuestionDifficultyBadge.className =
        'px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-500/10 text-red-300 border border-red-500/30';
    } else {
      quizQuestionDifficultyBadge.className =
        'px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/10 text-amber-300 border border-amber-500/30';
    }
  }

  // Question Prompt
  if (quizQuestionPrompt) {
    quizQuestionPrompt.textContent = q.question;
    renderMath(quizQuestionPrompt);
  }

  // Explanation reset
  if (quizExplanation) quizExplanation.classList.add('hidden');
  if (quizImprovementTipBox) quizImprovementTipBox.classList.add('hidden');
  if (nextQuestionBtn) nextQuestionBtn.classList.add('hidden');

  // Render Options
  if (!quizOptionsList) return;
  quizOptionsList.innerHTML = '';

  const labels = ['A', 'B', 'C', 'D', 'E'];
  (q.options || []).forEach((opt, idx) => {
    const btn = document.createElement('button');
    btn.className =
      'w-full text-left p-3.5 rounded-xl border border-dark-border bg-dark-surface hover:bg-dark-hover text-xs font-medium text-slate-200 transition-all flex items-center space-x-3 group';

    btn.innerHTML = `
      <span class="w-6 h-6 rounded-lg bg-dark-card border border-dark-border text-slate-400 group-hover:text-brand-400 flex items-center justify-center font-mono text-[11px] font-semibold flex-shrink-0">${labels[idx] || idx + 1}</span>
      <span class="flex-1">${escapeHtml(opt)}</span>
      <span class="opt-icon hidden"></span>
    `;

    btn.addEventListener('click', () => handleSelectOption(idx, q.answer_index, q.explanation));
    quizOptionsList.appendChild(btn);
  });
  renderMath(quizOptionsList);
}

function handleSelectOption(selectedIdx, correctIdx, explanation) {
  if (state.quizAnswered) return;
  state.quizAnswered = true;

  const q = state.quizQuestions[state.currentQuestionIndex];
  const optionButtons = quizOptionsList.querySelectorAll('button');
  const isCorrect = selectedIdx === correctIdx;

  if (isCorrect) {
    state.quizScore += 1;
    if (quizScoreText) quizScoreText.textContent = `Score: ${state.quizScore}`;
  }

  // Track question outcome for topic mastery analytics
  state.quizQuestionResults.push({
    topic: q.topic || 'Core Concepts',
    is_correct: isCorrect,
    improvement_tip: q.improvement_tip || '',
    level: q.difficulty || state.quizDifficulty || 'medium',
    question: q.question,
  });

  optionButtons.forEach((btn, idx) => {
    btn.disabled = true;
    btn.classList.remove('hover:bg-dark-hover');

    if (idx === correctIdx) {
      btn.className =
        'w-full text-left p-3.5 rounded-xl border border-emerald-500/50 bg-emerald-500/10 text-emerald-200 text-xs font-medium flex items-center space-x-3';
      const iconSpan = btn.querySelector('.opt-icon');
      if (iconSpan) {
        iconSpan.innerHTML = '<i data-lucide="check-circle" class="w-4 h-4 text-emerald-400"></i>';
        iconSpan.classList.remove('hidden');
      }
    } else if (idx === selectedIdx && !isCorrect) {
      btn.className =
        'w-full text-left p-3.5 rounded-xl border border-red-500/50 bg-red-500/10 text-red-200 text-xs font-medium flex items-center space-x-3';
      const iconSpan = btn.querySelector('.opt-icon');
      if (iconSpan) {
        iconSpan.innerHTML = '<i data-lucide="x-circle" class="w-4 h-4 text-red-400"></i>';
        iconSpan.classList.remove('hidden');
      }
    } else {
      btn.classList.add('opacity-40');
    }
  });

  // Reveal Explanation
  if (quizExplanation && explanation) {
    if (quizExplanationText) {
      quizExplanationText.textContent = explanation;
      renderMath(quizExplanationText);
    }
    // Show improvement tip if incorrect
    if (quizImprovementTipBox) {
      if (!isCorrect && q.improvement_tip) {
        if (quizImprovementTipText) quizImprovementTipText.textContent = q.improvement_tip;
        quizImprovementTipBox.classList.remove('hidden');
      } else {
        quizImprovementTipBox.classList.add('hidden');
      }
    }
    quizExplanation.classList.remove('hidden');
  }

  // Show Next Button
  if (nextQuestionBtn) {
    const isLast = state.currentQuestionIndex === state.quizQuestions.length - 1;
    nextQuestionBtn.querySelector('span').textContent = isLast ? 'View AI Diagnostics & Results' : 'Next Question';
    nextQuestionBtn.classList.remove('hidden');
  }

  initIcons();
}

async function handleNextQuestion() {
  if (state.currentQuestionIndex < state.quizQuestions.length - 1) {
    state.currentQuestionIndex += 1;
    renderCurrentQuestion();
  } else {
    // Show Results & Diagnostics
    await finishQuizAndShowDiagnostics();
  }
}

async function finishQuizAndShowDiagnostics() {
  if (quizActive) quizActive.classList.add('hidden');
  if (quizResult) quizResult.classList.remove('hidden');

  const total = state.quizQuestions.length;
  const pct = Math.round((state.quizScore / total) * 100);
  if (finalScoreCircle) finalScoreCircle.textContent = `${pct}%`;

  if (quizSummaryFeedback) {
    if (pct >= 85) {
      quizSummaryFeedback.textContent = '🌟 Master Level! Aapne core concepts aur tricky points dono ko bahut acchi tarah grasp kiya hai.';
    } else if (pct >= 60) {
      quizSummaryFeedback.textContent = '👍 Good Effort! Kuch specific topics me doubts hain. Niche diye gaye weak topics par targeted drill lein.';
    } else {
      quizSummaryFeedback.textContent = '⚠️ Attention Needed! Niche identify kiye gaye weak topics par step-by-step beginner drill attempt karein.';
    }
  }

  // Post results to backend to update mastery profile in SQLite
  try {
    const payload = state.quizQuestionResults.map((r) => ({
      topic: r.topic,
      is_correct: r.is_correct,
      improvement_tip: r.improvement_tip,
      level: r.level,
    }));

    const res = await fetch(`/api/documents/${state.activeDocId}/mastery/record`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ results: payload }),
    });

    if (res.ok) {
      const data = await res.json();
      state.topicMastery = data.mastery_profile;
      renderQuizDiagnostics(data.mastery_profile, state.quizQuestionResults);
    } else {
      renderQuizDiagnosticsFallback(state.quizQuestionResults);
    }
  } catch (err) {
    console.error('Failed to record mastery results:', err);
    renderQuizDiagnosticsFallback(state.quizQuestionResults);
  }
}

function renderQuizDiagnostics(masteryProfile, currentResults) {
  // Aggregate current quiz by topic
  const quizTopicMap = {};
  currentResults.forEach((r) => {
    if (!quizTopicMap[r.topic]) {
      quizTopicMap[r.topic] = { total: 0, correct: 0, tips: [] };
    }
    quizTopicMap[r.topic].total += 1;
    if (r.is_correct) quizTopicMap[r.topic].correct += 1;
    if (!r.is_correct && r.improvement_tip) quizTopicMap[r.topic].tips.push(r.improvement_tip);
  });

  const weakTopics = [];
  const masteredTopics = [];
  const developingTopics = [];

  Object.entries(quizTopicMap).forEach(([topic, stat]) => {
    const acc = Math.round((stat.correct / stat.total) * 100);
    const item = {
      topic,
      total: stat.total,
      correct: stat.correct,
      accuracy: acc,
      tip: stat.tips[0] || `Focus on understanding the definitions and core rules of ${topic}.`,
    };

    if (acc < 60) {
      weakTopics.push(item);
    } else if (acc >= 85) {
      masteredTopics.push(item);
    } else {
      developingTopics.push(item);
    }
  });

  // Render Section 1: Weak Topics
  if (weakTopicsSection && weakTopicsList) {
    if (weakTopics.length > 0) {
      weakTopicsSection.classList.remove('hidden');
      if (weakTopicsCountBadge) weakTopicsCountBadge.textContent = `${weakTopics.length} Weak Topics`;
      weakTopicsList.innerHTML = '';

      weakTopics.forEach((w) => {
        const card = document.createElement('div');
        card.className =
          'p-3.5 rounded-xl border border-red-500/30 bg-dark-surface/90 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm';
        card.innerHTML = `
          <div class="space-y-1">
            <div class="flex items-center space-x-2">
              <span class="text-xs font-bold text-red-300">🏷️ ${escapeHtml(w.topic)}</span>
              <span class="px-2 py-0.2 rounded-full text-[10px] font-mono font-bold bg-red-500/20 text-red-300 border border-red-500/40">${w.correct}/${w.total} (${w.accuracy}%)</span>
            </div>
            <p class="text-[11px] text-slate-300 flex items-start space-x-1.5">
              <span class="text-amber-400 font-bold flex-shrink-0">💡 Advice:</span>
              <span>${escapeHtml(w.tip)}</span>
            </p>
          </div>
          <button class="master-topic-btn flex-shrink-0 px-3.5 py-2 rounded-xl bg-gradient-to-r from-red-600 to-amber-600 hover:from-red-500 hover:to-amber-500 text-white text-xs font-bold flex items-center space-x-1.5 transition-all shadow-md shadow-red-500/20" title="Start progressive Beginner -> Advanced ladder for this topic">
            <i data-lucide="zap" class="w-3.5 h-3.5"></i>
            <span>Master This Topic</span>
          </button>
        `;

        const btn = card.querySelector('.master-topic-btn');
        if (btn) {
          btn.addEventListener('click', () => {
            startTargetedDrill(w.topic, 'beginner');
          });
        }
        weakTopicsList.appendChild(card);
      });
    } else {
      weakTopicsSection.classList.add('hidden');
    }
  }

  // Render Section 2: Mastered Topics
  if (masteredTopicsSection && masteredTopicsList) {
    if (masteredTopics.length > 0) {
      masteredTopicsSection.classList.remove('hidden');
      if (masteredTopicsCountBadge) masteredTopicsCountBadge.textContent = `${masteredTopics.length} Mastered`;
      masteredTopicsList.innerHTML = '';

      masteredTopics.forEach((m) => {
        const badge = document.createElement('div');
        badge.className =
          'p-2.5 rounded-xl border border-emerald-500/40 bg-dark-surface/80 flex items-center justify-between text-xs text-emerald-200';
        badge.innerHTML = `
          <div class="flex items-center space-x-2 truncate mr-2">
            <span class="w-5 h-5 rounded-md bg-emerald-500/20 text-emerald-400 flex items-center justify-center flex-shrink-0 text-xs">✓</span>
            <span class="font-bold truncate">${escapeHtml(m.topic)}</span>
          </div>
          <span class="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex-shrink-0">${m.accuracy}%</span>
        `;
        masteredTopicsList.appendChild(badge);
      });
    } else {
      masteredTopicsSection.classList.add('hidden');
    }
  }

  // Render Section 3: Developing Topics
  if (developingTopicsSection && developingTopicsList) {
    if (developingTopics.length > 0) {
      developingTopicsSection.classList.remove('hidden');
      developingTopicsList.innerHTML = '';
      developingTopics.forEach((d) => {
        const row = document.createElement('div');
        row.className = 'flex items-center justify-between p-2 rounded-lg bg-dark-surface/60 border border-dark-border text-xs';
        row.innerHTML = `
          <div class="flex items-center space-x-2">
            <span class="text-amber-400 font-semibold">• ${escapeHtml(d.topic)}</span>
            <span class="text-slate-400 font-mono text-[10px]">(${d.accuracy}% accuracy)</span>
          </div>
          <button class="practice-dev-btn text-[11px] text-amber-300 hover:text-white font-semibold flex items-center space-x-1 hover:underline">
            <span>Drill ➔</span>
          </button>
        `;
        const pBtn = row.querySelector('.practice-dev-btn');
        if (pBtn) {
          pBtn.addEventListener('click', () => startTargetedDrill(d.topic, 'intermediate'));
        }
        developingTopicsList.appendChild(row);
      });
    } else {
      developingTopicsSection.classList.add('hidden');
    }
  }

  initIcons();
}

function renderQuizDiagnosticsFallback(currentResults) {
  renderQuizDiagnostics({}, currentResults);
}

// ==========================================
// Targeted Remedial Drill Ladder
// (Beginner -> Intermediate -> Advanced -> Mastered)
// ==========================================
async function startTargetedDrill(topic, level = 'beginner') {
  if (!state.activeDocId || !topic) return;

  state.targetedDrill = {
    topic: topic,
    level: level,
    questions: [],
    currentIndex: 0,
    score: 0,
    answered: false,
    levelScores: state.targetedDrill ? state.targetedDrill.levelScores : { beginner: 0, intermediate: 0, advanced: 0 },
  };

  // Open modal
  if (targetedDrillModal) {
    targetedDrillModal.classList.remove('hidden');
    targetedDrillModal.classList.add('flex');
  }

  // Update headers
  if (drillTopicTitle) drillTopicTitle.textContent = topic;
  updateLadderStepIndicators(level);

  // Hide screens & show loading
  if (drillLevelClearedScreen) drillLevelClearedScreen.classList.add('hidden');
  if (drillMasteredCelebrationScreen) drillMasteredCelebrationScreen.classList.add('hidden');
  if (drillActive) drillActive.classList.add('hidden');
  if (drillLoading) {
    if (drillLoadingText) {
      drillLoadingText.textContent = `Preparing ${level.toUpperCase()} questions for "${topic}"...`;
    }
    drillLoading.classList.remove('hidden');
  }

  try {
    const res = await fetch('/api/quiz/targeted-drill', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        doc_id: state.activeDocId,
        topic: topic,
        level: level,
        num_questions: 3,
        language: state.activeLanguage,
      }),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || 'Failed to generate targeted drill');
    }

    const data = await res.json();
    state.targetedDrill.questions = data.questions || [];
    state.targetedDrill.currentIndex = 0;
    state.targetedDrill.score = 0;

    if (state.targetedDrill.questions.length === 0) {
      throw new Error('No targeted questions could be generated.');
    }

    renderCurrentDrillQuestion();
    if (drillLoading) drillLoading.classList.add('hidden');
    if (drillActive) drillActive.classList.remove('hidden');
  } catch (err) {
    console.error('Targeted drill error:', err);
    showToast(err.message, 'error');
    closeTargetedDrillModal();
  }
}

function updateLadderStepIndicators(currentLevel) {
  const steps = [
    { el: ladderStep1, id: 'beginner' },
    { el: ladderStep2, id: 'intermediate' },
    { el: ladderStep3, id: 'advanced' },
  ];

  const levelsOrder = ['beginner', 'intermediate', 'advanced'];
  const currentIdx = levelsOrder.indexOf(currentLevel.toLowerCase());

  steps.forEach((step, idx) => {
    if (!step.el) return;
    if (idx === currentIdx) {
      // Current active level
      step.el.className =
        'flex-1 flex items-center space-x-1.5 p-1.5 rounded-lg bg-amber-500/20 border border-amber-500/50 text-amber-300 text-[11px] font-bold shadow-sm';
    } else if (idx < currentIdx) {
      // Completed level
      step.el.className =
        'flex-1 flex items-center space-x-1.5 p-1.5 rounded-lg bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-[11px] font-medium';
    } else {
      // Upcoming level
      step.el.className =
        'flex-1 flex items-center space-x-1.5 p-1.5 rounded-lg bg-dark-surface border border-dark-border text-slate-500 text-[11px] font-medium';
    }
  });

  if (drillLevelBadge) {
    drillLevelBadge.textContent = `Level: ${currentLevel.toUpperCase()}`;
  }
  initIcons();
}

function renderCurrentDrillQuestion() {
  const drill = state.targetedDrill;
  if (!drill || !drill.questions || drill.questions.length === 0) return;

  const q = drill.questions[drill.currentIndex];
  if (!q) return;

  drill.answered = false;

  const total = drill.questions.length;
  const currentNum = drill.currentIndex + 1;
  if (drillProgressText) drillProgressText.textContent = `Question ${currentNum} of ${total}`;
  if (drillScoreText) drillScoreText.textContent = `Correct: ${drill.score}/${drill.currentIndex}`;
  if (drillProgressBar) drillProgressBar.style.width = `${((currentNum - 1) / total) * 100}%`;

  if (drillQuestionPrompt) {
    drillQuestionPrompt.textContent = q.question;
    renderMath(drillQuestionPrompt);
  }

  if (drillExplanationBox) drillExplanationBox.classList.add('hidden');
  if (drillNextBtn) drillNextBtn.classList.add('hidden');

  if (!drillOptionsList) return;
  drillOptionsList.innerHTML = '';

  const labels = ['A', 'B', 'C', 'D'];
  (q.options || []).forEach((opt, idx) => {
    const btn = document.createElement('button');
    btn.className =
      'w-full text-left p-3.5 rounded-xl border border-dark-border bg-dark-surface hover:bg-dark-hover text-xs font-medium text-slate-200 transition-all flex items-center space-x-3 group';

    btn.innerHTML = `
      <span class="w-6 h-6 rounded-lg bg-dark-card border border-dark-border text-slate-400 group-hover:text-amber-400 flex items-center justify-center font-mono text-[11px] font-semibold flex-shrink-0">${labels[idx] || idx + 1}</span>
      <span class="flex-1">${escapeHtml(opt)}</span>
      <span class="drill-opt-icon hidden"></span>
    `;

    btn.addEventListener('click', () => handleSelectDrillOption(idx, q.answer_index, q.explanation, q.improvement_tip));
    drillOptionsList.appendChild(btn);
  });
  renderMath(drillOptionsList);
}

function handleSelectDrillOption(selectedIdx, correctIdx, explanation, tip) {
  const drill = state.targetedDrill;
  if (drill.answered) return;
  drill.answered = true;

  const isCorrect = selectedIdx === correctIdx;
  if (isCorrect) {
    drill.score += 1;
  }
  if (drillScoreText) {
    drillScoreText.textContent = `Correct: ${drill.score}/${drill.currentIndex + 1}`;
  }

  const optionButtons = drillOptionsList.querySelectorAll('button');
  optionButtons.forEach((btn, idx) => {
    btn.disabled = true;
    btn.classList.remove('hover:bg-dark-hover');

    if (idx === correctIdx) {
      btn.className =
        'w-full text-left p-3.5 rounded-xl border border-emerald-500/50 bg-emerald-500/10 text-emerald-200 text-xs font-medium flex items-center space-x-3';
      const iconSpan = btn.querySelector('.drill-opt-icon');
      if (iconSpan) {
        iconSpan.innerHTML = '<i data-lucide="check-circle" class="w-4 h-4 text-emerald-400"></i>';
        iconSpan.classList.remove('hidden');
      }
    } else if (idx === selectedIdx && !isCorrect) {
      btn.className =
        'w-full text-left p-3.5 rounded-xl border border-red-500/50 bg-red-500/10 text-red-200 text-xs font-medium flex items-center space-x-3';
      const iconSpan = btn.querySelector('.drill-opt-icon');
      if (iconSpan) {
        iconSpan.innerHTML = '<i data-lucide="x-circle" class="w-4 h-4 text-red-400"></i>';
        iconSpan.classList.remove('hidden');
      }
    } else {
      btn.classList.add('opacity-40');
    }
  });

  // Reveal Explanation & Key Takeaway
  if (drillExplanationBox && explanation) {
    if (drillExplanationText) {
      drillExplanationText.textContent = explanation;
      renderMath(drillExplanationText);
    }
    if (drillTipBox && tip) {
      if (drillTipText) drillTipText.textContent = tip;
      drillTipBox.classList.remove('hidden');
    }
    drillExplanationBox.classList.remove('hidden');
  }

  // Show Next Button
  if (drillNextBtn) {
    const isLast = drill.currentIndex === drill.questions.length - 1;
    drillNextBtn.querySelector('span').textContent = isLast ? 'Evaluate Level' : 'Next Question';
    drillNextBtn.classList.remove('hidden');
  }

  initIcons();
}

async function handleDrillNextQuestion() {
  const drill = state.targetedDrill;
  if (drill.currentIndex < drill.questions.length - 1) {
    drill.currentIndex += 1;
    renderCurrentDrillQuestion();
  } else {
    // Level completed!
    await evaluateDrillLevelCompletion();
  }
}

async function evaluateDrillLevelCompletion() {
  const drill = state.targetedDrill;
  if (drillActive) drillActive.classList.add('hidden');

  // Record this level's results to backend
  try {
    await fetch(`/api/documents/${state.activeDocId}/mastery/record`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        results: [
          {
            topic: drill.topic,
            is_correct: drill.score >= 2,
            level: drill.level,
            improvement_tip: `Scored ${drill.score}/3 at ${drill.level} level.`,
          },
        ],
      }),
    });
  } catch (err) {
    console.warn('Failed to record drill result:', err);
  }

  const passed = drill.score >= 2; // At least 2 out of 3 correct

  if (passed) {
    if (drill.level === 'beginner') {
      if (drillLevelClearedScreen) {
        drillLevelClearedScreen.classList.remove('hidden');
        if (drillLevelClearedTitle) drillLevelClearedTitle.textContent = '🎉 Beginner Level Conquered!';
        if (drillLevelClearedMsg) {
          drillLevelClearedMsg.textContent = `Aapne "${drill.topic}" ke foundational concepts clear kar liye (${drill.score}/3)! Ready to step up to Intermediate level?`;
        }
        if (drillAdvanceLevelBtn) {
          drillAdvanceLevelBtn.querySelector('span').textContent = 'Advance to Intermediate Level';
        }
      }
    } else if (drill.level === 'intermediate') {
      if (drillLevelClearedScreen) {
        drillLevelClearedScreen.classList.remove('hidden');
        if (drillLevelClearedTitle) drillLevelClearedTitle.textContent = '🌟 Intermediate Level Conquered!';
        if (drillLevelClearedMsg) {
          drillLevelClearedMsg.textContent = `Shabash! Practical application test bhi clear ho gaya (${drill.score}/3). Ab final challenge: Advanced Level!`;
        }
        if (drillAdvanceLevelBtn) {
          drillAdvanceLevelBtn.querySelector('span').textContent = 'Advance to Advanced (Mastery) Level';
        }
      }
    } else if (drill.level === 'advanced') {
      // FULLY MASTERED CELEBRATION!
      if (drillMasteredCelebrationScreen) {
        drillMasteredCelebrationScreen.classList.remove('hidden');
        if (drillMasteredTopicTitle) drillMasteredTopicTitle.textContent = `Topic: "${drill.topic}"`;
      }
      showToast(`🏆 Congratulations! You have fully mastered "${drill.topic}"!`, 'success');
      // Refresh topic mastery profile
      fetchTopicMastery(state.activeDocId);
    }
  } else {
    // Did not pass this level, allow retry
    if (drillLevelClearedScreen) {
      drillLevelClearedScreen.classList.remove('hidden');
      if (drillLevelClearedTitle) drillLevelClearedTitle.textContent = 'Keep Going! Thoda Aur Revision Chahiye';
      if (drillLevelClearedMsg) {
        drillLevelClearedMsg.textContent = `Aapne ${drill.score}/3 score kiya. Is level ko solidify karne ke liye ek baar dobara try karein.`;
      }
      if (drillAdvanceLevelBtn) {
        drillAdvanceLevelBtn.querySelector('span').textContent = `Retry ${drill.level.toUpperCase()} Level`;
      }
    }
  }

  initIcons();
}

function advanceDrillLevel() {
  const drill = state.targetedDrill;
  if (!drill) return;

  const passed = drill.score >= 2;
  if (!passed) {
    // Retry same level
    startTargetedDrill(drill.topic, drill.level);
    return;
  }

  if (drill.level === 'beginner') {
    startTargetedDrill(drill.topic, 'intermediate');
  } else if (drill.level === 'intermediate') {
    startTargetedDrill(drill.topic, 'advanced');
  }
}

function closeTargetedDrillModal() {
  if (targetedDrillModal) {
    targetedDrillModal.classList.add('hidden');
    targetedDrillModal.classList.remove('flex');
  }
}

// ==========================================
// Knowledge Radar & Topic Mastery Modal
// ==========================================
async function openTopicRadarModal() {
  if (!state.activeDocId) {
    showToast('Please select a document first!', 'error');
    return;
  }

  if (radarDocName) {
    radarDocName.textContent = state.activeDoc ? state.activeDoc.filename : 'Document Notes';
  }

  if (topicRadarModal) {
    topicRadarModal.classList.remove('hidden');
    topicRadarModal.classList.add('flex');
    initIcons();
  }

  // Fetch fresh mastery
  try {
    const res = await fetch(`/api/documents/${state.activeDocId}/mastery`);
    if (!res.ok) throw new Error('Failed to load mastery data');
    const profile = await res.json();
    state.topicMastery = profile;

    // Render stats
    if (radarOverallAcc) radarOverallAcc.textContent = `${profile.overall_accuracy || 0}%`;
    if (radarWeakCount) radarWeakCount.textContent = (profile.weak_topics || []).length;
    if (radarLearningCount) radarLearningCount.textContent = (profile.learning_topics || []).length;
    if (radarMasteredCount) radarMasteredCount.textContent = (profile.mastered_topics || []).length;

    // Render Weak Topics
    if (radarWeakList) {
      radarWeakList.innerHTML = '';
      if ((profile.weak_topics || []).length === 0) {
        radarWeakList.innerHTML =
          '<p class="text-[11px] text-slate-500 py-1">No weak topics diagnosed yet! Keep taking quizzes to identify gaps.</p>';
      } else {
        profile.weak_topics.forEach((w) => {
          const item = document.createElement('div');
          item.className =
            'p-3 rounded-xl border border-red-500/30 bg-red-950/20 flex items-center justify-between gap-3 text-xs';
          item.innerHTML = `
            <div class="overflow-hidden">
              <div class="flex items-center space-x-2">
                <span class="font-bold text-red-300 truncate">${escapeHtml(w.topic)}</span>
                <span class="px-1.5 py-0.2 rounded-full text-[9px] font-mono font-bold bg-red-500/30 text-red-200 border border-red-500/40">${w.accuracy}%</span>
              </div>
              <p class="text-[10px] text-slate-400 truncate mt-0.5">${escapeHtml(w.last_improvement_tip || 'Needs revision')}</p>
            </div>
            <button class="radar-drill-btn flex-shrink-0 px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white text-[11px] font-bold flex items-center space-x-1 shadow-sm">
              <i data-lucide="zap" class="w-3 h-3"></i>
              <span>Master Topic</span>
            </button>
          `;
          const btn = item.querySelector('.radar-drill-btn');
          if (btn) {
            btn.addEventListener('click', () => {
              closeTopicRadarModal();
              startTargetedDrill(w.topic, 'beginner');
            });
          }
          radarWeakList.appendChild(item);
        });
      }
    }

    // Render Mastered Topics
    if (radarMasteredList) {
      radarMasteredList.innerHTML = '';
      if ((profile.mastered_topics || []).length === 0) {
        radarMasteredList.innerHTML =
          '<p class="text-[11px] text-slate-500 py-1">Conquer your weak topics with targeted drills to earn mastery badges!</p>';
      } else {
        profile.mastered_topics.forEach((m) => {
          const badge = document.createElement('div');
          badge.className =
            'p-2.5 rounded-xl border border-emerald-500/30 bg-emerald-950/20 flex items-center justify-between text-xs text-emerald-200';
          badge.innerHTML = `
            <div class="flex items-center space-x-2 truncate mr-2">
              <span class="w-5 h-5 rounded-md bg-emerald-500/30 text-emerald-300 flex items-center justify-center flex-shrink-0 text-xs font-bold">✓</span>
              <span class="font-bold truncate">${escapeHtml(m.topic)}</span>
            </div>
            <span class="text-[10px] text-emerald-400 font-mono font-bold">${m.accuracy}%</span>
          `;
          radarMasteredList.appendChild(badge);
        });
      }
    }

    // Render All Document Topics (Available to quiz)
    if (radarAllTopicsList) {
      radarAllTopicsList.innerHTML = '';
      const topics = state.docTopics || [];
      if (topics.length === 0) {
        radarAllTopicsList.innerHTML = '<p class="text-[11px] text-slate-500 py-1">Extracting document topics...</p>';
      } else {
        topics.forEach((t) => {
          const card = document.createElement('div');
          card.className =
            'p-2.5 rounded-xl border border-dark-border bg-dark-surface/60 hover:bg-dark-hover flex items-center justify-between text-xs text-slate-300 transition-colors cursor-pointer group';
          card.innerHTML = `
            <span class="font-medium truncate mr-2 group-hover:text-white">🏷️ ${escapeHtml(t)}</span>
            <button class="topic-quick-quiz-btn text-[10px] text-brand-400 group-hover:text-brand-300 font-bold flex-shrink-0">
              Quiz ➔
            </button>
          `;
          card.addEventListener('click', () => {
            closeTopicRadarModal();
            if (quizTopicSelect) quizTopicSelect.value = t;
            handleStartQuiz();
          });
          radarAllTopicsList.appendChild(card);
        });
      }
    }

    initIcons();
  } catch (err) {
    console.error('Topic radar error:', err);
    showToast(err.message, 'error');
  }
}

function closeTopicRadarModal() {
  if (topicRadarModal) {
    topicRadarModal.classList.add('hidden');
    topicRadarModal.classList.remove('flex');
  }
}

// Flashcards Implementation
async function handleStartFlashcards() {
  if (!state.activeDocId) {
    showToast('Please select a document from the left library first!', 'error');
    return;
  }

  const count = parseInt(flashcardCount ? flashcardCount.value : '8') || 8;

  if (flashcardsEmpty) flashcardsEmpty.classList.add('hidden');
  if (flashcardActive) flashcardActive.classList.add('hidden');
  if (flashcardsLoading) flashcardsLoading.classList.remove('hidden');
  if (startFlashcardsBtn) startFlashcardsBtn.disabled = true;

  try {
    const res = await fetch('/api/flashcards', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        doc_id: state.activeDocId,
        count: count,
        language: state.activeLanguage,
      }),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || 'Flashcard generation failed');
    }

    const data = await res.json();
    state.flashcards = data.flashcards || [];
    state.currentCardIndex = 0;
    state.isCardFlipped = false;

    if (state.flashcards.length === 0) {
      throw new Error('No flashcards could be generated from this document.');
    }

    renderCurrentFlashcard();
    if (flashcardsLoading) flashcardsLoading.classList.add('hidden');
    if (flashcardActive) flashcardActive.classList.remove('hidden');
    showToast(`Loaded ${state.flashcards.length} revision cards!`, 'success');

  } catch (err) {
    console.error('Flashcard error:', err);
    showToast(err.message, 'error');
    if (flashcardsLoading) flashcardsLoading.classList.add('hidden');
    if (flashcardsEmpty) flashcardsEmpty.classList.remove('hidden');
  } finally {
    if (startFlashcardsBtn) startFlashcardsBtn.disabled = false;
  }
}

function renderCurrentFlashcard() {
  const card = state.flashcards[state.currentCardIndex];
  if (!card) return;

  state.isCardFlipped = false;
  if (flashcardElement) flashcardElement.classList.remove('flipped');

  if (flashcardCounter) {
    flashcardCounter.textContent = `Card ${state.currentCardIndex + 1} of ${state.flashcards.length}`;
  }
  if (flashcardCategory) flashcardCategory.textContent = card.category || 'Concept';
  if (flashcardFront) {
    flashcardFront.textContent = card.front || '';
    renderMath(flashcardFront);
  }
  if (flashcardBack) {
    flashcardBack.textContent = card.back || '';
    renderMath(flashcardBack);
  }

  initIcons();
}

function toggleCardFlip() {
  state.isCardFlipped = !state.isCardFlipped;
  if (flashcardElement) {
    flashcardElement.classList.toggle('flipped', state.isCardFlipped);
  }
}

function navigateFlashcard(direction) {
  const total = state.flashcards.length;
  if (total === 0) return;

  state.currentCardIndex = (state.currentCardIndex + direction + total) % total;
  renderCurrentFlashcard();
}

// ==========================================
// Feature: Cheat Sheet Generator
// ==========================================
async function handleStartCheatsheet() {
  if (!state.activeDocId) {
    showToast('Please select a document from the left library first!', 'error');
    return;
  }

  const focus = cheatsheetFocus ? cheatsheetFocus.value : 'comprehensive';

  if (cheatsheetEmpty) cheatsheetEmpty.classList.add('hidden');
  if (cheatsheetActive) cheatsheetActive.classList.add('hidden');
  if (cheatsheetLoading) cheatsheetLoading.classList.remove('hidden');
  if (startCheatsheetBtn) startCheatsheetBtn.disabled = true;

  try {
    const res = await fetch('/api/cheatsheet', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        doc_id: state.activeDocId,
        focus: focus,
        language: state.activeLanguage,
      }),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || 'Cheat sheet generation failed');
    }

    const data = await res.json();
    state.cheatsheetData = data.cheatsheet;

    renderCheatsheet();
    if (cheatsheetLoading) cheatsheetLoading.classList.add('hidden');
    if (cheatsheetActive) cheatsheetActive.classList.remove('hidden');
    showToast('Cheat Sheet generated successfully!', 'success');

  } catch (err) {
    console.error('Cheatsheet error:', err);
    showToast(err.message, 'error');
    if (cheatsheetLoading) cheatsheetLoading.classList.add('hidden');
    if (cheatsheetEmpty) cheatsheetEmpty.classList.remove('hidden');
  } finally {
    if (startCheatsheetBtn) startCheatsheetBtn.disabled = false;
  }
}

function renderCheatsheet() {
  const data = state.cheatsheetData;
  if (!data) return;

  if (cheatsheetTitle) cheatsheetTitle.textContent = data.title || (state.activeDoc ? `${state.activeDoc.filename} Cheat Sheet` : 'Quick Reference Cheat Sheet');
  if (cheatsheetOverview) cheatsheetOverview.textContent = data.overview || 'Essential reference points, commands, and rules.';

  // Render Key Metrics Badges
  if (cheatsheetMetrics) {
    cheatsheetMetrics.innerHTML = '';
    if (Array.isArray(data.key_metrics) && data.key_metrics.length > 0) {
      data.key_metrics.forEach((m) => {
        const badge = document.createElement('span');
        badge.className = 'px-2 py-0.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20';
        badge.textContent = `${m.label}: ${m.value}`;
        cheatsheetMetrics.appendChild(badge);
      });
      cheatsheetMetrics.classList.remove('hidden');
    } else {
      cheatsheetMetrics.classList.add('hidden');
    }
  }

  // Unhide download and copy buttons
  if (downloadCheatsheetPdfBtn) downloadCheatsheetPdfBtn.classList.remove('hidden');
  if (downloadCheatsheetMdBtn) downloadCheatsheetMdBtn.classList.remove('hidden');
  if (copyCheatsheetMarkdownBtn) copyCheatsheetMarkdownBtn.classList.remove('hidden');

  // Render Sections
  if (!cheatsheetSections) return;
  cheatsheetSections.innerHTML = '';

  const sections = data.sections || [];
  if (sections.length === 0) {
    cheatsheetSections.innerHTML = '<div class="text-center py-8 text-slate-400 text-xs">No sections extracted.</div>';
    return;
  }

  sections.forEach((sec) => {
    const secBox = document.createElement('div');
    secBox.className = 'cheatsheet-section bg-dark-surface/30 border border-dark-border/60 rounded-xl p-4 sm:p-5 space-y-3.5';
    secBox.dataset.sectionTitle = sec.title || '';

    // Section Header
    let iconName = 'bookmark';
    let iconColor = 'text-emerald-400';
    if (sec.type === 'code_cards') {
      iconName = 'terminal';
      iconColor = 'text-blue-400';
    } else if (sec.type === 'table') {
      iconName = 'table';
      iconColor = 'text-purple-400';
    } else if (sec.type === 'warnings') {
      iconName = 'alert-triangle';
      iconColor = 'text-amber-400';
    } else if (sec.type === 'key_value') {
      iconName = 'book-open';
      iconColor = 'text-teal-400';
    }

    const header = document.createElement('div');
    header.className = 'flex items-center space-x-2 border-b border-dark-border/60 pb-2.5';
    header.innerHTML = `
      <i data-lucide="${iconName}" class="w-4 h-4 ${iconColor}"></i>
      <h4 class="text-xs sm:text-sm font-bold text-slate-100 uppercase tracking-wider">${escapeHtml(sec.title || 'Section')}</h4>
    `;
    secBox.appendChild(header);

    // Section Items by Type
    if (sec.type === 'code_cards') {
      const list = document.createElement('div');
      list.className = 'space-y-3.5 divide-y divide-dark-border/40';

      (sec.items || []).forEach((item, idx) => {
        const point = document.createElement('div');
        point.className = 'cheatsheet-item pt-3 first:pt-0 space-y-1.5';
        point.dataset.searchText = `${item.name || ''} ${item.description || ''} ${item.code || ''} ${item.tip || ''}`.toLowerCase();

        point.innerHTML = `
          <div class="flex items-center justify-between">
            <div class="flex items-center space-x-2">
              <span class="w-1.5 h-1.5 rounded-full bg-blue-400 flex-shrink-0"></span>
              <span class="text-xs font-bold text-slate-100 font-mono">${escapeHtml(item.name || `Point ${idx + 1}`)}</span>
            </div>
            ${item.code ? `
              <button class="copy-snippet-btn text-slate-400 hover:text-white p-1 rounded hover:bg-dark-hover transition-colors" title="Copy code">
                <i data-lucide="copy" class="w-3.5 h-3.5"></i>
              </button>
            ` : ''}
          </div>
          ${item.description ? `<p class="text-xs text-slate-300 leading-relaxed pl-3.5">${escapeHtml(item.description)}</p>` : ''}
          ${item.code ? `
            <pre class="bg-dark-bg p-2.5 rounded-lg border border-dark-border/80 text-xs font-mono text-emerald-300 overflow-x-auto select-text leading-relaxed ml-3.5 my-1"><code>${escapeHtml(item.code)}</code></pre>
          ` : ''}
          ${item.tip ? `
            <div class="flex items-center space-x-1.5 text-[11px] text-amber-300/90 pl-3.5 pt-0.5">
              <i data-lucide="lightbulb" class="w-3 h-3 text-amber-400 flex-shrink-0"></i>
              <span>${escapeHtml(item.tip)}</span>
            </div>
          ` : ''}
        `;

        const copyBtn = point.querySelector('.copy-snippet-btn');
        if (copyBtn && item.code) {
          copyBtn.addEventListener('click', () => {
            navigator.clipboard.writeText(item.code)
              .then(() => showToast(`Copied to clipboard!`, 'success'))
              .catch(() => showToast('Failed to copy', 'error'));
          });
        }

        list.appendChild(point);
      });
      secBox.appendChild(list);

    } else if (sec.type === 'key_value') {
      const list = document.createElement('ul');
      list.className = 'space-y-2.5 my-1';

      (sec.items || []).forEach((item) => {
        const li = document.createElement('li');
        li.className = 'cheatsheet-item flex items-start space-x-2.5 text-xs text-slate-200 leading-relaxed';
        li.dataset.searchText = `${item.term || ''} ${item.definition || ''}`.toLowerCase();

        li.innerHTML = `
          <span class="inline-block w-1.5 h-1.5 rounded-full bg-teal-400 mt-1.5 flex-shrink-0"></span>
          <div class="space-y-0.5">
            <strong class="font-bold text-teal-300 text-xs font-mono mr-1.5">${escapeHtml(item.term || '')}:</strong>
            <span class="text-slate-300">${escapeHtml(item.definition || '')}</span>
          </div>
        `;
        list.appendChild(li);
      });
      secBox.appendChild(list);

    } else if (sec.type === 'table') {
      const tableWrap = document.createElement('div');
      tableWrap.className = 'cheatsheet-item bg-dark-surface/40 border border-dark-border rounded-xl overflow-x-auto';
      tableWrap.dataset.searchText = `${(sec.headers || []).join(' ')} ${(sec.rows || []).map(r => r.join(' ')).join(' ')}`.toLowerCase();

      const headersHtml = (sec.headers || []).map(h => `<th class="px-4 py-2.5 text-left text-xs font-bold text-slate-200 uppercase tracking-wider bg-dark-surface/80 border-b border-dark-border">${escapeHtml(h)}</th>`).join('');
      const rowsHtml = (sec.rows || []).map(row => {
        const cells = (row || []).map((c, i) => `<td class="px-4 py-2 text-xs text-slate-300 border-b border-dark-border/40 ${i === 0 ? 'font-mono font-semibold text-slate-100' : ''}">${escapeHtml(c)}</td>`).join('');
        return `<tr class="hover:bg-dark-hover/50 transition-colors">${cells}</tr>`;
      }).join('');

      tableWrap.innerHTML = `
        <table class="w-full text-left border-collapse">
          <thead><tr>${headersHtml}</tr></thead>
          <tbody>${rowsHtml}</tbody>
        </table>
      `;
      secBox.appendChild(tableWrap);

    } else if (sec.type === 'warnings') {
      const list = document.createElement('div');
      list.className = 'space-y-2.5 my-1';

      (sec.items || []).forEach((item) => {
        const callout = document.createElement('div');
        callout.className = 'cheatsheet-item p-3.5 rounded-xl bg-amber-500/5 border-l-4 border-amber-500 text-xs text-slate-300 space-y-1';
        callout.dataset.searchText = `${item.title || ''} ${item.detail || ''}`.toLowerCase();

        callout.innerHTML = `
          <div class="flex items-center space-x-2 text-amber-300 font-semibold">
            <i data-lucide="alert-triangle" class="w-3.5 h-3.5 text-amber-400 flex-shrink-0"></i>
            <span>${escapeHtml(item.title || 'Important Notice')}</span>
          </div>
          <p class="text-xs text-slate-300 leading-relaxed pl-5">${escapeHtml(item.detail || '')}</p>
        `;
        list.appendChild(callout);
      });
      secBox.appendChild(list);
    }

    cheatsheetSections.appendChild(secBox);
  });

  initIcons();
  renderMath(cheatsheetSections);
}

function handleCheatsheetSearch(e) {
  const query = (e.target.value || '').trim().toLowerCase();
  state.cheatsheetFilter = query;

  const items = document.querySelectorAll('.cheatsheet-item, .cheatsheet-card');
  items.forEach((item) => {
    const text = item.dataset.searchText || '';
    if (!query || text.includes(query)) {
      item.classList.remove('hidden');
    } else {
      item.classList.add('hidden');
    }
  });

  const sections = document.querySelectorAll('.cheatsheet-section');
  sections.forEach((sec) => {
    const visibleItems = sec.querySelectorAll('.cheatsheet-item:not(.hidden), .cheatsheet-card:not(.hidden)');
    if (visibleItems.length === 0 && query) {
      sec.classList.add('hidden');
    } else {
      sec.classList.remove('hidden');
    }
  });
}

function getCheatsheetMarkdown() {
  const data = state.cheatsheetData;
  if (!data) return '';

  let md = `# ${data.title || 'Cheat Sheet'}\n\n`;
  if (data.overview) md += `> ${data.overview}\n\n`;

  (data.sections || []).forEach((sec) => {
    md += `## ${sec.title || 'Section'}\n\n`;
    if (sec.type === 'code_cards') {
      (sec.items || []).forEach((item) => {
        md += `### ${item.name}\n`;
        if (item.description) md += `${item.description}\n\n`;
        if (item.code) md += `\`\`\`\n${item.code}\n\`\`\`\n\n`;
        if (item.tip) md += `*Tip: ${item.tip}*\n\n`;
      });
    } else if (sec.type === 'key_value') {
      (sec.items || []).forEach((item) => {
        md += `- **${item.term}**: ${item.definition}\n`;
      });
      md += '\n';
    } else if (sec.type === 'table') {
      if (sec.headers) {
        md += `| ${sec.headers.join(' | ')} |\n`;
        md += `| ${sec.headers.map(() => '---').join(' | ')} |\n`;
        (sec.rows || []).forEach((row) => {
          md += `| ${row.join(' | ')} |\n`;
        });
        md += '\n';
      }
    } else if (sec.type === 'warnings') {
      (sec.items || []).forEach((item) => {
        md += `> ⚠️ **${item.title}**: ${item.detail}\n\n`;
      });
    }
  });
  return md;
}

function copyCheatsheetMarkdown() {
  const md = getCheatsheetMarkdown();
  if (!md) {
    showToast('Generate a cheat sheet first!', 'error');
    return;
  }
  navigator.clipboard.writeText(md)
    .then(() => showToast('Cheat Sheet Markdown copied to clipboard!', 'success'))
    .catch(() => showToast('Failed to copy markdown', 'error'));
}

function downloadCheatsheetMd() {
  const md = getCheatsheetMarkdown();
  if (!md) {
    showToast('Generate a cheat sheet first!', 'error');
    return;
  }
  const baseName = state.activeDoc ? state.activeDoc.filename.replace(/\.[^/.]+$/, "") : 'Document';
  const filename = `${baseName}_CheatSheet.md`;
  const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast('Cheat Sheet (.MD) downloaded!', 'success');
}

function downloadCheatsheetPdf() {
  if (!window.html2pdf) {
    showToast('PDF library loading...', 'error');
    return;
  }
  const el = document.getElementById('cheatsheetActive');
  if (!el || el.classList.contains('hidden')) {
    showToast('Generate a cheat sheet first!', 'error');
    return;
  }

  showToast('Preparing Cheat Sheet PDF...', 'success');
  const baseName = state.activeDoc ? state.activeDoc.filename.replace(/\.[^/.]+$/, "") : 'Document';
  const filename = `${baseName}_CheatSheet.pdf`;

  // Clone element for pristine PDF export without search bar and expanded content
  const clone = el.cloneNode(true);
  const searchInput = clone.querySelector('#cheatsheetSearch');
  if (searchInput && searchInput.parentElement) {
    searchInput.parentElement.remove();
  }
  const sectionsEl = clone.querySelector('#cheatsheetSections');
  if (sectionsEl) {
    sectionsEl.style.overflow = 'visible';
    sectionsEl.style.height = 'auto';
    sectionsEl.style.maxHeight = 'none';
  }

  const opt = {
    margin: [10, 10, 10, 10],
    filename: filename,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true, backgroundColor: '#0b0f19' },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
    pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
  };

  html2pdf().set(opt).from(clone).save().then(() => {
    showToast('Cheat Sheet PDF downloaded successfully!', 'success');
  }).catch((err) => {
    console.error('PDF error:', err);
    showToast('PDF download failed: ' + err.message, 'error');
  });
}

// ==========================================
// Feature 2: Visual Mind Map (Mermaid.js)
// ==========================================
async function handleGenerateMindmap() {
  if (!state.activeDocId) {
    showToast('Please select a document from the left library first!', 'error');
    return;
  }

  if (mindmapEmpty) mindmapEmpty.classList.add('hidden');
  if (mindmapViewportArea) mindmapViewportArea.classList.add('hidden');
  if (mindmapLoading) mindmapLoading.classList.remove('hidden');
  if (generateMindmapBtn) generateMindmapBtn.disabled = true;

  try {
    const res = await fetch('/api/mindmap', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        doc_id: state.activeDocId,
        language: state.activeLanguage,
      }),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || 'Mind map generation failed');
    }

    const data = await res.json();
    await renderMermaidDiagram(data.mermaid);
    showToast('Mind Map generated! Drag to pan, scroll to zoom.', 'success');

  } catch (err) {
    console.error('Mindmap error:', err);
    showToast('Failed to render mind map: ' + err.message, 'error');
    if (mindmapEmpty) mindmapEmpty.classList.remove('hidden');
  } finally {
    if (mindmapLoading) mindmapLoading.classList.add('hidden');
    if (generateMindmapBtn) generateMindmapBtn.disabled = false;
  }
}

async function renderMermaidDiagram(rawCode) {
  if (!rawCode || !window.mermaid) return;

  state.mindmap.rawCode = rawCode.trim();

  // Determine current orientation and update button label
  const isTD = /^(flowchart|graph)\s+(TD|TB)/i.test(state.mindmap.rawCode);
  state.mindmap.orientation = isTD ? 'TD' : 'LR';
  if (orientationLabel) {
    orientationLabel.textContent = isTD ? 'Vertical (TD)' : 'Horizontal (LR)';
  }

  // Generate unique render ID
  const renderId = 'mm_' + Date.now();
  if (mindmapContainer) mindmapContainer.innerHTML = '';

  try {
    const { svg } = await mermaid.render(renderId, state.mindmap.rawCode);
    if (mindmapContainer) {
      mindmapContainer.innerHTML = svg;
      
      const svgEl = mindmapContainer.querySelector('svg');
      if (svgEl) {
        // Strip downsampling constraints
        svgEl.removeAttribute('width');
        svgEl.removeAttribute('height');
        svgEl.style.maxWidth = 'none';
        svgEl.style.overflow = 'visible';

        // Extract native viewBox dimensions from Mermaid
        const vb = svgEl.viewBox?.baseVal;
        if (vb && vb.width > 0 && vb.height > 0) {
          const nw = Math.round(vb.width);
          const nh = Math.round(vb.height);
          svgEl.style.width = nw + 'px';
          svgEl.style.height = nh + 'px';
          svgEl.setAttribute('width', nw);
          svgEl.setAttribute('height', nh);
        } else {
          svgEl.style.width = '100%';
          svgEl.style.height = 'auto';
        }
      }
    }

    if (mindmapViewportArea) mindmapViewportArea.classList.remove('hidden');
    if (mindmapLoading) mindmapLoading.classList.add('hidden');
    if (mindmapEmpty) mindmapEmpty.classList.add('hidden');

    // Automatically fit to screen with smooth centering
    setTimeout(() => {
      fitMindmapToScreen(false);
    }, 60);

  } catch (renderErr) {
    console.error('Mermaid render error:', renderErr);
    // Cleanup any orphaned error DOM nodes created by mermaid
    const strayNodes = document.querySelectorAll(`[id^="d${renderId}"], [id^="${renderId}"]`);
    strayNodes.forEach(node => node.remove());
    throw new Error('Diagram syntax could not be rendered: ' + renderErr.message);
  }
}

function fitMindmapToScreen(forceFullFit = false) {
  const svgEl = mindmapContainer ? mindmapContainer.querySelector('svg') : null;
  if (!svgEl || !mindmapViewportArea) return;

  const vRect = mindmapViewportArea.getBoundingClientRect();
  const vWidth = Math.max(300, vRect.width || 800);
  const vHeight = Math.max(300, vRect.height || 500);

  // Measure true SVG bounds
  let bbox = null;
  try {
    bbox = svgEl.getBBox();
  } catch (e) {
    bbox = {
      width: svgEl.clientWidth || svgEl.viewBox?.baseVal?.width || 800,
      height: svgEl.clientHeight || svgEl.viewBox?.baseVal?.height || 600,
    };
  }

  const svgW = Math.max(250, bbox.width || 800);
  const svgH = Math.max(250, bbox.height || 600);

  const padding = 50;
  const scaleX = (vWidth - padding * 2) / svgW;
  const scaleY = (vHeight - padding * 2) / svgH;
  const fullFitScale = Math.min(scaleX, scaleY);

  if (forceFullFit) {
    // User explicitly clicked "Fit": scale to fit the whole diagram on screen
    state.mindmap.scale = Math.max(0.2, Math.min(1.2, fullFitScale));
    state.mindmap.panX = Math.round((vWidth - svgW * state.mindmap.scale) / 2);
    state.mindmap.panY = Math.max(20, Math.round((vHeight - svgH * state.mindmap.scale) / 2));
  } else {
    // Initial render: prioritize sharp, readable text!
    // In horizontal view (LR), wide trees should not be squeezed into an unreadable scale
    const isLR = state.mindmap.orientation === 'LR';
    
    if (isLR && fullFitScale < 0.75) {
      // Set comfortable readable scale of 0.82x and start aligned to left so nodes are crystal-clear
      state.mindmap.scale = 0.82;
      state.mindmap.panX = 40;
      state.mindmap.panY = Math.max(25, Math.round((vHeight - svgH * 0.82) / 2));
    } else {
      state.mindmap.scale = Math.max(0.45, Math.min(1.15, fullFitScale));
      state.mindmap.panX = Math.round((vWidth - svgW * state.mindmap.scale) / 2);
      state.mindmap.panY = Math.max(24, Math.round((vHeight - svgH * state.mindmap.scale) / 2));
    }
  }

  applyMindmapTransform();
}

function setMindmapZoom(factor) {
  const oldScale = state.mindmap.scale;
  const newScale = Math.max(0.2, Math.min(3.5, oldScale * factor));
  if (newScale === oldScale) return;

  // Zoom relative to viewport center
  if (mindmapViewportArea) {
    const rect = mindmapViewportArea.getBoundingClientRect();
    const cx = rect.width / 2;
    const cy = rect.height / 2;
    const ratio = newScale / oldScale;
    state.mindmap.panX = cx - (cx - state.mindmap.panX) * ratio;
    state.mindmap.panY = cy - (cy - state.mindmap.panY) * ratio;
  }

  state.mindmap.scale = newScale;
  applyMindmapTransform();
}

function applyMindmapTransform() {
  if (mindmapTransformLayer) {
    mindmapTransformLayer.style.transform = `translate(${state.mindmap.panX}px, ${state.mindmap.panY}px) scale(${state.mindmap.scale})`;
  }
  if (zoomLevelText) {
    zoomLevelText.textContent = `${Math.round(state.mindmap.scale * 100)}%`;
  }
}

function setupMindmapPanZoom() {
  if (!mindmapViewportArea) return;

  // Mouse drag panning
  mindmapViewportArea.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;
    state.mindmap.isDragging = true;
    state.mindmap.dragStartX = e.clientX;
    state.mindmap.dragStartY = e.clientY;
    state.mindmap.initialPanX = state.mindmap.panX;
    state.mindmap.initialPanY = state.mindmap.panY;
    mindmapViewportArea.style.cursor = 'grabbing';
  });

  window.addEventListener('mousemove', (e) => {
    if (!state.mindmap.isDragging) return;
    const dx = e.clientX - state.mindmap.dragStartX;
    const dy = e.clientY - state.mindmap.dragStartY;
    state.mindmap.panX = state.mindmap.initialPanX + dx;
    state.mindmap.panY = state.mindmap.initialPanY + dy;
    applyMindmapTransform();
  });

  window.addEventListener('mouseup', () => {
    if (state.mindmap.isDragging) {
      state.mindmap.isDragging = false;
      if (mindmapViewportArea) mindmapViewportArea.style.cursor = 'grab';
    }
  });

  // Mouse wheel zoom towards cursor
  mindmapViewportArea.addEventListener('wheel', (e) => {
    e.preventDefault();
    const rect = mindmapViewportArea.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const factor = e.deltaY < 0 ? 1.15 : 0.87;
    const oldScale = state.mindmap.scale;
    const newScale = Math.max(0.2, Math.min(3.5, oldScale * factor));
    if (newScale === oldScale) return;

    const ratio = newScale / oldScale;
    state.mindmap.panX = mouseX - (mouseX - state.mindmap.panX) * ratio;
    state.mindmap.panY = mouseY - (mouseY - state.mindmap.panY) * ratio;
    state.mindmap.scale = newScale;

    applyMindmapTransform();
  }, { passive: false });

  // Touch Support (Mobile & Trackpad)
  let touchStartDist = 0;
  let initialTouchScale = 1.0;

  mindmapViewportArea.addEventListener('touchstart', (e) => {
    if (e.touches.length === 1) {
      state.mindmap.isDragging = true;
      state.mindmap.dragStartX = e.touches[0].clientX;
      state.mindmap.dragStartY = e.touches[0].clientY;
      state.mindmap.initialPanX = state.mindmap.panX;
      state.mindmap.initialPanY = state.mindmap.panY;
    } else if (e.touches.length === 2) {
      state.mindmap.isDragging = false;
      touchStartDist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      initialTouchScale = state.mindmap.scale;
    }
  }, { passive: true });

  mindmapViewportArea.addEventListener('touchmove', (e) => {
    if (e.touches.length === 1 && state.mindmap.isDragging) {
      const dx = e.touches[0].clientX - state.mindmap.dragStartX;
      const dy = e.touches[0].clientY - state.mindmap.dragStartY;
      state.mindmap.panX = state.mindmap.initialPanX + dx;
      state.mindmap.panY = state.mindmap.initialPanY + dy;
      applyMindmapTransform();
    } else if (e.touches.length === 2 && touchStartDist > 0) {
      const currentDist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const factor = currentDist / touchStartDist;
      state.mindmap.scale = Math.max(0.2, Math.min(3.5, initialTouchScale * factor));
      applyMindmapTransform();
    }
  }, { passive: true });

  mindmapViewportArea.addEventListener('touchend', () => {
    state.mindmap.isDragging = false;
    touchStartDist = 0;
  });
}

function toggleMindmapOrientation() {
  if (!state.mindmap.rawCode) {
    showToast('Generate a mind map first!', 'error');
    return;
  }

  const isTD = /^(flowchart|graph)\s+(TD|TB)/i.test(state.mindmap.rawCode.trim());
  const newOrientation = isTD ? 'LR' : 'TD';

  let updatedCode = state.mindmap.rawCode.trim();
  if (/^(flowchart|graph)\s+[A-Z]{2}/i.test(updatedCode)) {
    updatedCode = updatedCode.replace(/^(flowchart|graph)\s+[A-Z]{2}/i, `$1 ${newOrientation}`);
  } else {
    updatedCode = `flowchart ${newOrientation}\n` + updatedCode;
  }

  renderMermaidDiagram(updatedCode)
    .then(() => {
      showToast(`Switched layout to ${newOrientation === 'LR' ? 'Horizontal (LR)' : 'Vertical (TD)'}`, 'success');
    })
    .catch((err) => {
      showToast('Failed to switch orientation: ' + err.message, 'error');
    });
}

function toggleMindmapTheater() {
  const pane = document.getElementById('paneMindmap');
  if (!pane) return;

  const isFullscreen = pane.classList.toggle('mindmap-fullscreen');
  if (theaterIcon) theaterIcon.setAttribute('data-lucide', isFullscreen ? 'minimize' : 'expand');
  if (theaterText) theaterText.textContent = isFullscreen ? 'Exit' : 'Fullscreen';
  initIcons();

  setTimeout(() => {
    fitMindmapToScreen();
  }, 100);
}

// Escape key to exit fullscreen and close modals
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    const pane = document.getElementById('paneMindmap');
    if (pane && pane.classList.contains('mindmap-fullscreen')) {
      toggleMindmapTheater();
    }
    if (mermaidCodeModal && !mermaidCodeModal.classList.contains('hidden')) {
      closeMermaidCodeModal();
    }
    if (pastChatsModal && !pastChatsModal.classList.contains('hidden')) {
      closePastChatsModal();
    }
    if (textModal && !textModal.classList.contains('hidden')) {
      textModal.classList.add('hidden');
    }
  }
});

function openMermaidCodeModal() {
  if (!state.mindmap.rawCode) {
    showToast('No diagram code available yet. Generate a mind map first!', 'error');
    return;
  }
  if (mermaidCodeInput) {
    mermaidCodeInput.value = state.mindmap.rawCode;
  }
  if (mermaidCodeModal) {
    mermaidCodeModal.classList.remove('hidden');
  }
}

function closeMermaidCodeModal() {
  if (mermaidCodeModal) {
    mermaidCodeModal.classList.add('hidden');
  }
}

function copyMermaidCode() {
  if (!mermaidCodeInput) return;
  navigator.clipboard.writeText(mermaidCodeInput.value)
    .then(() => showToast('Mermaid code copied to clipboard!', 'success'))
    .catch(() => showToast('Failed to copy code', 'error'));
}

async function applyCustomMermaidCode() {
  if (!mermaidCodeInput) return;
  const newCode = mermaidCodeInput.value.trim();
  if (!newCode) return;

  try {
    await renderMermaidDiagram(newCode);
    closeMermaidCodeModal();
    showToast('Diagram updated successfully!', 'success');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function downloadMindmapSvg() {
  const svg = mindmapContainer ? mindmapContainer.querySelector('svg') : null;
  if (!svg) {
    showToast('No mind map to download', 'error');
    return;
  }
  const svgData = new XMLSerializer().serializeToString(svg);
  const blob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${state.activeDoc ? state.activeDoc.filename : 'mindmap'}_Diagram.svg`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  showToast('Mind Map SVG downloaded!', 'success');
}

// ==========================================
// Feature 3: Voice Input & Audio Listener
// ==========================================
function setupVoiceRecognition() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    if (voiceBtn) {
      voiceBtn.title = 'Voice input not supported in this browser';
      voiceBtn.classList.add('opacity-40');
    }
    return;
  }

  const recognition = new SpeechRecognition();
  recognition.continuous = false;
  recognition.interimResults = true;
  recognition.lang = 'en-US';

  recognition.onstart = () => {
    state.isListening = true;
    if (voiceBtn) voiceBtn.classList.add('mic-recording');
    showToast('Listening... Speak now', 'success');
  };

  recognition.onresult = (event) => {
    let transcript = '';
    for (let i = event.resultIndex; i < event.results.length; i++) {
      transcript += event.results[i][0].transcript;
    }
    if (chatInput) {
      chatInput.value = transcript;
      chatInput.style.height = 'auto';
      chatInput.style.height = Math.min(chatInput.scrollHeight, 150) + 'px';
    }
  };

  recognition.onerror = (e) => {
    console.warn('Speech error:', e.error);
    state.isListening = false;
    if (voiceBtn) voiceBtn.classList.remove('mic-recording');
    showToast(`Voice error: ${e.error}`, 'error');
  };

  recognition.onend = () => {
    state.isListening = false;
    if (voiceBtn) voiceBtn.classList.remove('mic-recording');
  };

  state.speechRecognition = recognition;

  if (voiceBtn) {
    voiceBtn.addEventListener('click', () => {
      if (state.isListening) {
        recognition.stop();
      } else {
        if (state.activeLanguage === 'hi') {
          recognition.lang = 'hi-IN';
        } else if (state.activeLanguage === 'mr') {
          recognition.lang = 'mr-IN';
        } else {
          recognition.lang = 'en-US';
        }
        try {
          recognition.start();
        } catch (e) {
          console.warn('Voice start warning:', e);
        }
      }
    });
  }
}

function playAudio(text, title = 'Document') {
  if (!('speechSynthesis' in window)) {
    showToast('Text-to-speech is not supported in your browser.', 'error');
    return;
  }

  window.speechSynthesis.cancel();

  // Strip Markdown markers for clean natural speech
  const cleanText = text
    .replace(/[#*`_~\[\]()>-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const utterance = new SpeechSynthesisUtterance(cleanText);
  utterance.rate = state.speechRate || 1.0;
  utterance.pitch = 1.0;

  // Regional voice selection for Devanagari text (Hindi / Marathi)
  const isDevanagari = /[\u0900-\u097F]/.test(cleanText);
  if (isDevanagari) {
    const voices = window.speechSynthesis.getVoices();
    const regionalVoice = voices.find(v => v.lang && (v.lang.startsWith('mr') || v.lang.startsWith('hi') || v.lang.includes('IN')));
    if (regionalVoice) {
      utterance.voice = regionalVoice;
    }
  }

  utterance.onstart = () => {
    state.isSpeechPaused = false;
    if (audioPlayerBar) audioPlayerBar.classList.remove('hidden');
    if (audioPlayerTitle) audioPlayerTitle.textContent = title;
    if (audioPlayerStatus) audioPlayerStatus.textContent = 'Reading aloud...';
    if (audioPauseIcon) audioPauseIcon.setAttribute('data-lucide', 'pause');
    initIcons();
  };

  utterance.onpause = () => {
    state.isSpeechPaused = true;
    if (audioPlayerStatus) audioPlayerStatus.textContent = 'Paused';
    if (audioPauseIcon) audioPauseIcon.setAttribute('data-lucide', 'play');
    initIcons();
  };

  utterance.onresume = () => {
    state.isSpeechPaused = false;
    if (audioPlayerStatus) audioPlayerStatus.textContent = 'Reading aloud...';
    if (audioPauseIcon) audioPauseIcon.setAttribute('data-lucide', 'pause');
    initIcons();
  };

  utterance.onend = () => {
    stopAudio();
  };

  utterance.onerror = () => {
    stopAudio();
  };

  state.currentUtterance = utterance;
  window.speechSynthesis.speak(utterance);
}

function toggleAudioPause() {
  if (!('speechSynthesis' in window)) return;

  if (window.speechSynthesis.paused) {
    window.speechSynthesis.resume();
  } else if (window.speechSynthesis.speaking) {
    window.speechSynthesis.pause();
  }
}

function stopAudio() {
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
  state.currentUtterance = null;
  state.isSpeechPaused = false;
  if (audioPlayerBar) audioPlayerBar.classList.add('hidden');
}

// ==========================================
// Feature 4: DOCX & PDF Exporters
// ==========================================
async function handleExportDocx(contentType = 'summary') {
  if (!state.activeDocId) {
    showToast('Please select a document first!', 'error');
    return;
  }

  showToast('Generating Microsoft Word document...', 'success');

  try {
    const res = await fetch('/api/export/docx', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        doc_id: state.activeDocId,
        content_type: contentType,
      }),
    });

    if (!res.ok) throw new Error('DOCX export failed');

    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${state.activeDoc ? state.activeDoc.filename : 'Document'}_${contentType.toUpperCase()}.docx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    showToast('DOCX file downloaded successfully!', 'success');

  } catch (err) {
    showToast(err.message, 'error');
  }
}

function handleExportPdf(contentType = 'summary') {
  if (!window.html2pdf) {
    showToast('PDF generator library loading...', 'error');
    return;
  }

  let elementToPdf = null;
  let filename = 'Document';

  if (contentType === 'summary') {
    elementToPdf = document.getElementById('summaryContent');
    filename = `${state.activeDoc ? state.activeDoc.filename : 'Doc'}_Summary.pdf`;
  } else {
    elementToPdf = document.getElementById('fullDocFormatted');
    filename = `${state.activeDoc ? state.activeDoc.filename : 'Doc'}_Notes.pdf`;
  }

  if (!elementToPdf || !elementToPdf.innerText.trim()) {
    showToast('No content available to export to PDF', 'error');
    return;
  }

  showToast('Generating crisp PDF...', 'success');

  const opt = {
    margin: [12, 12, 12, 12],
    filename: filename,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true, backgroundColor: '#0b0f17' },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
  };

  html2pdf().set(opt).from(elementToPdf).save().then(() => {
    showToast('PDF downloaded successfully!', 'success');
  });
}

// ==========================================
// Utility Functions
// ==========================================
function formatBytes(bytes, decimals = 1) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

function escapeHtml(string) {
  if (!string) return '';
  return String(string)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

let toastTimer = null;
function showToast(message, type = 'success') {
  if (toastTimer) clearTimeout(toastTimer);
  if (!toast || !toastMsg) return;

  toastMsg.textContent = message;

  if (type === 'success') {
    toast.className =
      'fixed bottom-6 right-6 z-50 transform translate-y-0 opacity-100 transition-all duration-300 px-4 py-3 rounded-xl border bg-dark-card border-emerald-500/40 text-emerald-300 text-xs font-medium shadow-2xl flex items-center space-x-2';
    if (toastIcon) toastIcon.setAttribute('data-lucide', 'check-circle');
  } else {
    toast.className =
      'fixed bottom-6 right-6 z-50 transform translate-y-0 opacity-100 transition-all duration-300 px-4 py-3 rounded-xl border bg-dark-card border-red-500/40 text-red-300 text-xs font-medium shadow-2xl flex items-center space-x-2';
    if (toastIcon) toastIcon.setAttribute('data-lucide', 'alert-circle');
  }

  initIcons();

  toastTimer = setTimeout(() => {
    toast.classList.remove('translate-y-0', 'opacity-100');
    toast.classList.add('translate-y-20', 'opacity-0');
  }, 3500);
}
