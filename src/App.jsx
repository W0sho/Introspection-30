import React, { useState } from 'react';
import { 
  Brain, Briefcase, Heart, Lightbulb, Target, AlertCircle,
  GraduationCap, ChevronDown, ChevronUp, RefreshCcw, Copy,
  Check, Zap, FileText, Compass, BarChart, ArrowLeft
} from 'lucide-react';

// API-nøkkelen hentes nå på en tryggere måte for å unngå kompileringfeil i ulike miljøer.
const getApiKey = () => {
  if (typeof process !== 'undefined' && process.env && process.env.VITE_GEMINI_API_KEY) {
    return process.env.VITE_GEMINI_API_KEY;
  }
  // Fallback for Vite-miljøer
  try {
    return import.meta.env ? import.meta.env.VITE_GEMINI_API_KEY : "";
  } catch (e) {
    return "";
  }
};

const apiKey = getApiKey();

const TraitRow = ({ trait, isShortTest }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  
  return (
    <div className="border-b border-gray-100 pb-5 mb-5 last:border-0 last:mb-0 last:pb-0">
      <div className="flex justify-between items-end mb-2">
        <div>
          <span className="font-bold text-gray-800 text-lg block">{trait.name}</span>
          <span className="text-xs font-medium text-gray-500">Persentil: {trait.score}</span>
        </div>
      </div>
      <div className="w-full bg-gray-100 rounded-full h-3 mb-3">
        <div className="bg-indigo-500 h-3 rounded-full transition-all duration-1000" style={{ width: `${trait.score}%` }}></div>
      </div>
      <p className="text-gray-600 text-sm mb-5 leading-relaxed">{trait.desc}</p>
      
      {!isShortTest && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3">
            {trait.aspects?.map((aspect, idx) => (
              <div key={idx} className="bg-gray-50 p-3 rounded-xl border border-gray-200">
                <span className="text-sm font-semibold text-gray-800">{aspect.name}</span>
                <p className="text-xs text-gray-500">{aspect.desc}</p>
              </div>
            ))}
          </div>

          <button 
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center gap-1 text-xs font-semibold text-indigo-600 w-full justify-center py-2 bg-indigo-50 rounded-lg"
          >
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            {isExpanded ? "Skjul fasetter" : "Vis 6 underfasetter"}
          </button>
        </>
      )}
    </div>
  );
};

const App = () => {
  const [appState, setAppState] = useState('welcome');
  const [results, setResults] = useState(null);
  const [errorMessage, setErrorMessage] = useState("");

  const generateInsights = async (finalAnswers, withRiasec) => {
    setAppState('analyzing');
    
    const modelName = "gemini-1.5-flash";
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

    const prompt = `Analyser personlighet basert på svar. Returner JSON med: personality{intro, traits[{name, score, desc, aspects, facets}]}, strengths, weaknesses, romance{ideal, avoid}, riasec, aiCareerAnalysis.`;

    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
      });

      if (!response.ok) throw new Error(`API feilet med status ${response.status}`);
      
      const data = await response.json();
      const text = data.candidates[0].content.parts[0].text.replace(/```json|```/g, '');
      setResults(JSON.parse(text));
      setAppState('dashboard');
    } catch (err) {
      setErrorMessage(err.message);
      setAppState('error');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      {appState === 'welcome' && (
        <div className="max-w-md mx-auto bg-white p-8 rounded-2xl shadow text-center">
          <h1 className="text-2xl font-bold mb-4">Introspeksjon 30</h1>
          <button onClick={() => setAppState('testing')} className="bg-indigo-600 text-white px-6 py-3 rounded-xl w-full">Start Test</button>
        </div>
      )}
      {appState === 'error' && (
        <div className="text-center p-8 text-red-600">
          <p>En feil oppstod: {errorMessage}</p>
          <button onClick={() => setAppState('welcome')} className="mt-4 underline">Gå tilbake</button>
        </div>
      )}
    </div>
  );
};

export default App;