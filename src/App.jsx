import React, { useState, useEffect } from 'react';
import { 
  Brain, Briefcase, Heart, Lightbulb, Target, AlertCircle,
  GraduationCap, ChevronDown, ChevronUp, RefreshCcw, Copy,
  Check, Zap, FileText, Compass, BarChart, ArrowLeft, Loader2,
  Users, X, Download, Link as LinkIcon
} from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, setDoc, getDoc } from 'firebase/firestore';

// Initialiser Firebase
let auth = null;
let db = null;
try {
  if (typeof __firebase_config !== 'undefined') {
    const firebaseConfig = JSON.parse(__firebase_config);
    const app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
  }
} catch (error) {
  console.warn("Firebase-konfigurasjon mangler:", error);
}
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

const getApiKey = () => {
  if (typeof process !== 'undefined' && process.env && process.env.VITE_GEMINI_API_KEY) return process.env.VITE_GEMINI_API_KEY;
  try { return import.meta.env ? import.meta.env.VITE_GEMINI_API_KEY : ""; } catch (e) { return ""; }
};
const apiKey = getApiKey();

const TraitRow = ({ trait, isShortTest }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  return (
    <div className="border-b border-gray-100 pb-5 mb-5 last:border-0 last:mb-0 last:pb-0 page-break-inside-avoid">
      <div className="flex justify-between items-end mb-2">
        <div>
          <span className="font-bold text-gray-800 text-lg block">{trait.name}</span>
          <span className="text-xs font-medium text-gray-500">Høyere enn {trait.score} % av befolkningen</span>
        </div>
        <div className="text-right">
          <span className="text-sm font-extrabold text-indigo-700 bg-indigo-50 px-3 py-1.5 rounded-lg border border-indigo-100">
            {trait.score}. Persentil
          </span>
        </div>
      </div>
      <div className="w-full bg-gray-100 rounded-full h-3 mb-3 relative">
        <div className="absolute top-0 bottom-0 left-[50%] w-0.5 bg-gray-300 z-10" title="Gjennomsnittet"></div>
        <div className="bg-indigo-500 h-3 rounded-full relative z-0 transition-all duration-1000" style={{ width: `${trait.score}%` }}></div>
      </div>
      <p className="text-gray-600 text-sm mb-5 leading-relaxed">{trait.desc}</p>
      
      {!isShortTest && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3">
            {trait.aspects?.map((aspect, idx) => (
              <div key={idx} className="bg-gray-50 p-3 rounded-xl border border-gray-200">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-sm font-semibold text-gray-800">{aspect.name}</span>
                  <span className="text-xs font-bold text-indigo-500">{aspect.score}. persentil</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-1.5 mb-2 relative">
                  <div className="absolute top-0 bottom-0 left-[50%] w-0.5 bg-gray-300 z-10"></div>
                  <div className="bg-indigo-400 h-1.5 rounded-full relative z-0" style={{ width: `${aspect.score}%` }}></div>
                </div>
                <p className="text-xs text-gray-500 leading-relaxed">{aspect.desc}</p>
              </div>
            ))}
          </div>
          <button onClick={() => setIsExpanded(!isExpanded)} className="html2pdf-ignore flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition-colors w-full justify-center py-2.5 mt-2 bg-indigo-50/50 hover:bg-indigo-50 rounded-lg">
            {isExpanded ? <><ChevronUp className="w-4 h-4" /> Skjul underfasetter</> : <><ChevronDown className="w-4 h-4" /> Vis underfasetter</>}
          </button>
          {isExpanded && (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-4 pt-4 border-t border-gray-100">
              {trait.facets?.map((facet, idx) => (
                <div key={idx}>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-xs font-medium text-gray-700">{facet.name}</span>
                    <span className="text-[10px] text-gray-500 font-bold">{facet.score}%</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-1 mb-1.5 relative">
                    <div className="bg-gray-400 h-1 rounded-full relative z-0" style={{ width: `${facet.score}%` }}></div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};

const App = () => {
  const [appState, setAppState] = useState('welcome');
  const [testType, setTestType] = useState('extended');
  const [includeRiasec, setIncludeRiasec] = useState(false);
  const [results, setResults] = useState(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [loadingAttempt, setLoadingAttempt] = useState(1);
  const [copied, setCopied] = useState(false);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);

  const [currentQuestionIdx, setCurrentQuestionIdx] = useState(1);
  const [maxQuestions, setMaxQuestions] = useState(60);
  const [answers, setAnswers] = useState([]);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [savedProgress, setSavedProgress] = useState(null);

  // Autentisering & Databaser
  const [user, setUser] = useState(null);
  const [loadingCache, setLoadingCache] = useState(true);

  // Kompatibilitet Dele-lenke funksjonalitet
  const [matchId, setMatchId] = useState(null);
  const [matchData, setMatchData] = useState(null); // Den andres data
  const [isCompatModalOpen, setIsCompatModalOpen] = useState(false);
  const [compatAnalysis, setCompatAnalysis] = useState(null);
  const [isAnalyzingCompat, setIsAnalyzingCompat] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

// 1. Initialisering (URL Params, Lokal Cache)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const mId = params.get('match');
    if (mId) setMatchId(mId);

    // Hent påbegynt test
    const saved = localStorage.getItem('introspectionProgress');
    if (saved) setSavedProgress(JSON.parse(saved));

    // Hent ferdig testresultat
    const savedResults = localStorage.getItem('introspectionResults');
    if (savedResults && !mId) {
      const data = JSON.parse(savedResults);
      setResults(data.results);
      setTestType(data.testType);
      setIncludeRiasec(data.includeRiasec);
      setAppState('dashboard');
    }
    
    setLoadingCache(false);
  }, []);

  // Tastaturstøtte for testing
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (appState !== 'testing' || isTransitioning) return;
      const key = parseInt(e.key);
      if (key >= 1 && key <= 5) handleAnswer(key);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [appState, isTransitioning, answers, currentQuestionIdx]);

  // Automatisk trigger kompatibilitetsanalyse hvis matchData er lastet og test er ferdig
  useEffect(() => {
    if (appState === 'dashboard' && matchData && results && !compatAnalysis && !isAnalyzingCompat) {
      setIsCompatModalOpen(true);
      runCompatibilityAnalysis(matchData);
    }
  }, [appState, matchData, results]);


  const questionBank = [
    "Jeg har en livlig fantasi og drømmer meg ofte bort.", "Jeg planlegger ting i god tid og unngår å utsette oppgaver.", "Jeg får energi av å være rundt mange mennesker.", "Jeg stoler på at andre mennesker har gode intensjoner.", "Jeg blir ofte bekymret for ting som kan gå galt.",
    "Jeg forstår abstrakte ideer og teorier lett.", "Jeg holder alltid orden på sakene mine og har det ryddig.", "Jeg starter ofte samtaler med folk jeg ikke kjenner.", "Jeg er rett frem og ærlig i mine hensikter med andre.", "Jeg blir lett stresset og anspent i krevende situasjoner.",
    "Jeg setter stor pris på kunst, design og estetikk.", "Jeg fullfører alltid det jeg begynner på, selv om det er kjedelig.", "Jeg er ofte festens midtpunkt og trives med oppmerksomhet.", "Jeg stiller ofte opp for å hjelpe andre som trenger det.", "Jeg opplever ofte humørsvingninger uten tydelig grunn.",
    "Jeg foretrekker variasjon og nye opplevelser fremfor strenge rutiner.", "Jeg er nøyaktig, grundig og detaljorientert i arbeidet mitt.", "Jeg tar ofte styringen og leder an i sosiale situasjoner.", "Jeg unngår konflikter og diskusjoner så mye som mulig.", "Jeg kan bli lett irritert eller frustrert over småting.",
    "Jeg opplever dype og komplekse følelser i hverdagen.", "Jeg følger regler og forpliktelser nøye.", "Jeg har et høyt aktivitetsnivå og er alltid på farten.", "Jeg er beskjeden og liker ikke å skryte av meg selv.", "Jeg føler meg ofte usikker på meg selv i nye situasjoner.",
    "Jeg liker å diskutere filosofiske og intellektuelle problemstillinger.", "Jeg jobber systematisk for å nå mine langsiktige mål.", "Jeg liker spenning og oppsøker ofte fartsfylte opplevelser.", "Jeg har stor medfølelse for andres problemer.", "Jeg har vanskelig for å takle kritikk fra andre.",
    "Jeg har et bredt spekter av interesser.", "Jeg unngår å gjøre feil ved å dobbeltsjekke arbeidet mitt.", "Jeg er full av entusiasme og viser mye glede.", "Jeg får andre til å føle seg velkomne og komfortable.", "Jeg føler meg ofte overveldet av alt jeg må gjøre.",
    "Jeg er åpen for verdier og levemåter som er annerledes enn mine egne.", "Jeg krever mye av meg selv og setter høye standarder.", "Jeg foretrekker å jobbe i team fremfor å jobbe alene.", "Jeg tilgir lett folk som har gjort feil mot meg.", "Jeg kan av og til føle meg trist eller nedfor.",
    "Jeg liker å prøve ut nye hobbyer og aktiviteter.", "Jeg tenker meg alltid nøye om før jeg handler.", "Jeg snakker mye og uttrykker meg tydelig.", "Jeg setter andres behov foran mine egne.", "Jeg har lett for å få panikk i nødssituasjoner.",
    "Jeg ser ofte etter dypere mening i ting rundt meg.", "Jeg er kjent for å være svært pålitelig og ansvarsfull.", "Jeg er god til å overtale og motivere andre.", "Jeg samarbeider heller enn å konkurrere med andre.", "Jeg sliter med å legge fra meg negative tanker.",
    "Jeg unngår å snakke om mine egne prestasjoner.", "Jeg føler meg komfortabel med å utfordre tradisjoner.", "Jeg trives dårlig med uforutsigbare endringer.", "Jeg foretrekker å holde meg i bakgrunnen i store grupper.", "Jeg tror de fleste vil utnytte meg hvis de får sjansen.",
    "Jeg føler ofte at jeg ikke er god nok.", "Jeg liker å løse komplekse gåter og tankenøtter.", "Jeg møter alltid opp presis til avtaler.", "Jeg ler ofte høyt og smiler mye i hverdagen.", "Jeg gir ofte penger eller tid til veldedige formål.",
    "Jeg har lett for å la meg oppsluke av musikk.", "Jeg er stolt av å være en strukturert person.", "Jeg trives best når det skjer mye rundt meg hele tiden.", "Jeg prøver alltid å se saken fra den andres side.", "Jeg blir fort urolig hvis jeg ikke har kontroll på situasjonen.",
    "Jeg elsker å lære nye ting, selv om jeg ikke har bruk for det.", "Jeg lager ofte lister for å holde oversikt over hva som må gjøres.", "Jeg har lett for å knytte nye kontakter.", "Jeg skjuler sjelden mine egentlige intensjoner.", "Jeg frykter ofte at det verste vil skje.",
    "Jeg liker å lese skjønnlitteratur eller poesi.", "Jeg jobber hardere enn de fleste for å oppnå det jeg vil.", "Jeg blir rastløs hvis jeg må sitte stille over lengre tid.", "Jeg unngår bevisst å fornærme andre.", "Jeg kan føle meg skamfull over små tabber i lang tid.",
    "Jeg liker å reise til steder jeg aldri har vært før.", "Jeg rydder alltid opp etter meg med én gang.", "Jeg tar raskt ordet når en gruppe skal diskutere noe.", "Jeg tror grunnleggende at mennesker er gode på bunnen.", "Jeg har dager hvor jeg føler meg helt energiløs uten grunn.",
    "Jeg er fascinert av hvordan samfunnet og mennesker fungerer.", "Jeg er flink til å motstå fristelser.", "Jeg liker å ha bakgrunnsstøy når jeg jobber.", "Jeg er rask til å be om unnskyldning hvis jeg har tatt feil.", "Jeg blir veldig nervøs når jeg må snakke foran forsamlinger.",
    "Jeg utfordrer ofte mine egne holdninger og synspunkter.", "Jeg gir aldri opp før problemet er løst.", "Jeg oppsøker aktiviteter som gir meg et adrenalin-kick.", "Jeg føler sterk empati med de som har det vanskelig.", "Jeg blir fort sint hvis ting ikke går min vei.",
    "Jeg trives best i omgivelser som er estetisk vakre.", "Jeg handler sjelden på impuls.", "Jeg viser lett hengivenhet overfor venner og familie.", "Jeg mener at ærlighet er viktigere enn å være høflig.", "Jeg har ofte vanskelig for å sove på grunn av bekymringer.",
    "Jeg liker å utforske ulike typer mat og fremmede kulturer.", "Jeg forbereder meg alltid grundig til viktige møter.", "Jeg snakker høyere enn de fleste i rommet.", "Jeg gir alltid andre gleden av tvilen.", "Jeg føler meg ofte ensom, selv med andre rundt meg.",
    "Jeg foretrekker dokumentarer fremfor lett underholdning.", "Jeg er den første til å ta ansvar når noe går galt.", "Jeg kjeder meg raskt hvis jeg må være alene en hel helg.", "Jeg hater å presse andre til å gjøre noe de ikke vil.", "Jeg mister ofte besinnelsen.",
    "Jeg ser skjønnhet i ting som andre kanskje synes er rart.", "Jeg holder meg alltid strengt til dietter eller treningsplaner.", "Jeg elsker å underholde andre mennesker.", "Jeg ser på meg selv som en veldig tilgivende person.", "Jeg føler meg ofte hjelpeløs når jeg møter motgang.",
    "Jeg tenker ofte på meningen med livet.", "Jeg har alltid skrivebordet og datamaskinen min godt organisert.", "Jeg trives i rampelyset.", "Jeg kan lett tilpasse meg for å gjøre andre til lags.", "Jeg blir ofte stresset når jeg har for mye på timeplanen.",
    "Jeg føler et stort behov for å uttrykke meg kreativt.", "Jeg har klare mål for hvor jeg vil være om fem år.", "Jeg elsker å delta på store arrangementer eller festivaler.", "Jeg liker ikke å stikke meg frem på bekostning av andre.", "Jeg føler ofte et ubehag i brystet når jeg er stresset.",
    "Jeg liker å reparere ting og jobbe praktisk med hendene.", "Jeg trives med å bruke verktøy, maskiner eller utstyr.", "Jeg foretrekker fysisk arbeid utendørs fremfor å sitte på et kontor.", "Jeg er interessert i hvordan motorer eller elektronikk fungerer.", "Jeg liker å bygge ting fra bunnen av.",
    "Jeg trives med å analysere data for å finne logiske mønstre.", "Jeg liker å lese vitenskapelige artikler eller løse komplekse gåter.", "Jeg foretrekker å utføre eksperimenter for å teste ut hypoteser.", "Jeg trives med å programmere eller lære om ny teknologi.", "Jeg liker å fordype meg i kompliserte tekniske eller matematiske problemer.",
    "Jeg uttrykker meg gjerne gjennom kunst, musikk eller skriving.", "Jeg trives med å designe visuelle elementer, som grafikk eller interiør.", "Jeg liker å opptre foran et publikum (teater, musikk, tale).", "Jeg setter pris på arbeidsoppgaver hvor jeg kan bruke min kreativitet og fantasi.", "Jeg unngår yrker som har strenge, rigide regler for hvordan ting skal gjøres.",
    "Jeg liker å hjelpe, undervise eller veilede andre mennesker.", "Jeg trives med å lytte til andres problemer og gi råd.", "Jeg vil gjerne ha en jobb der jeg kan utgjøre en forskjell i andres liv.", "Jeg foretrekker å jobbe tett sammen med mennesker i stedet for maskiner.", "Jeg liker å ta vare på barn, pasienter eller eldre.",
    "Jeg trives i lederroller og med å drive prosjekter fremover.", "Jeg liker å overtale andre og selge inn mine egne ideer.", "Jeg har et ønske om å starte og drive min egen bedrift.", "Jeg trives med å forhandle og ta strategiske beslutninger.", "Jeg motiveres av status, innflytelse og økonomisk vekst.",
    "Jeg foretrekker arbeid som krever nøyaktighet og strukturert organisering.", "Jeg liker å administrere budsjetter og holde system i dokumenter.", "Jeg trives best når jeg har tydelige instrukser og faste rutiner å følge.", "Jeg liker å jobbe med regneark (Excel) og arkiveringssystemer.", "Jeg er flink til å oppdage skrivefeil og detaljfeil i tekster eller tall."
  ];

  async function handlePdfExport() {
    setIsGeneratingPDF(true);

    if (typeof window.html2pdf === 'undefined') {
      try {
        await new Promise((resolve, reject) => {
          const script = document.createElement('script');
          script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
          script.onload = resolve;
          script.onerror = reject;
          document.head.appendChild(script);
        });
      } catch (e) {
        console.error("Kunne ikke laste inn PDF-biblioteket:", e);
        setIsGeneratingPDF(false);
        return;
      }
    }

    const element = document.getElementById('pdf-content');

    const ignoreElements = element.querySelectorAll('.html2pdf-ignore');
    ignoreElements.forEach(el => el.style.display = 'none');

    const opt = {
      margin: 0.3,
      filename: 'Introspeksjon_Resultat.pdf',
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true, windowWidth: 1000 },
      jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' }
    };

    try {
      await window.html2pdf().set(opt).from(element).save();
    } catch (error) {
      console.error("Kunne ikke generere PDF:", error);
    } finally {
      ignoreElements.forEach(el => el.style.display = '');
      setIsGeneratingPDF(false);
    }
  }

  const generateShareLink = async () => {
    if (!user || !db || !results) return;
    try {
      // Lagrer personlighetstrekkene i en offentlig sti for deling
      const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'profiles', user.uid);
      await setDoc(docRef, { traits: results.personality.traits });
      
      const url = `${window.location.origin}${window.location.pathname}?match=${user.uid}`;
      navigator.clipboard.writeText(url);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 3000);
    } catch (e) { console.error("Kunne ikke lage delelenke", e); }
  };

  const generateInsights = async (finalAnswers, withRiasec) => {
    setAppState('analyzing'); setErrorMessage(""); setLoadingAttempt(1);
    
    // Fjern pågående lagring når testen er ferdig
    localStorage.removeItem('introspectionProgress');

    const norms = { O: { mean: 3.6, sd: 0.6 }, C: { mean: 3.4, sd: 0.6 }, E: { mean: 3.3, sd: 0.7 }, A: { mean: 3.7, sd: 0.5 }, N: { mean: 2.9, sd: 0.7 } };
    const b5Keys = ['O', 'C', 'E', 'A', 'N'];
    const b5Scores = { O: 0, C: 0, E: 0, A: 0, N: 0 };
    const b5Counts = { O: 0, C: 0, E: 0, A: 0, N: 0 };
    const rKeys = ['R', 'I', 'A', 'S', 'E', 'C'];
    const rScores = { R: 0, I: 0, A: 0, S: 0, E: 0, C: 0 };

    finalAnswers.forEach((ans, idx) => {
      if (idx < 120) { b5Scores[b5Keys[idx % 5]] += ans; b5Counts[b5Keys[idx % 5]] += 1; } 
      else { rScores[rKeys[Math.floor((idx - 120) / 5)]] += ans; }
    });

    const getPercentile = (trait) => {
      if (b5Counts[trait] === 0) return 50;
      const z = ((b5Scores[trait] / b5Counts[trait]) - norms[trait].mean) / norms[trait].sd;
      const k = 1.0 / (1.0 + 0.2316419 * Math.abs(z));
      const p = 1.0 - 1.0 / Math.sqrt(2 * Math.PI) * Math.exp(-0.5 * z * z) * (0.31938153 * k + -0.356563782 * k * k + 1.781477937 * Math.pow(k, 3) + -1.821255978 * Math.pow(k, 4) + 1.330274429 * Math.pow(k, 5));
      return Math.max(1, Math.min(99, Math.round((z < 0 ? 1.0 - p : p) * 100)));
    };

    let riasecString = "Ikke valgt";
    if (withRiasec) {
      const sortedRiasec = Object.entries(rScores).sort((a, b) => b[1] - a[1]);
      riasecString = sortedRiasec.slice(0, 3).map(arr => arr[0]).join('');
    }

    const prompt = `Du er en ekspert innen psykometri. Brukeren har følgende PERSENTIL-score (1-99):
      Åpenhet: ${getPercentile('O')}. Planmessighet: ${getPercentile('C')}. Ekstroversjon: ${getPercentile('E')}. Medmenneskelighet: ${getPercentile('A')}. Nevrotisisme: ${getPercentile('N')}. ${withRiasec ? `RIASEC: ${riasecString}` : ''}
      Analyser og returner profil. For HVERT hovedtrekk:
      1. Score må stemme EKSAKT.
      2. Del inn i 2 aspekter med estimert persentil: (Åpenhet: Intellekt/Kreativitet. Planmessighet: Orden/Gjennomføringsevne. Ekstroversjon: Entusiasme/Selvmarkering. Medmenneskelighet: Empati/Høflighet. Nevrotisisme: Temperament/Sårbarhet).
      3. Inkluder 6 fasetter per trekk med estimert persentil.
      4. For 'romance', fyll 'ideal' og 'avoid' basert på kompatibilitet.`;

    const payload = {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: {
          type: "OBJECT", properties: {
            personality: {
              type: "OBJECT", properties: {
                intro: { type: "STRING" },
                traits: {
                  type: "ARRAY", items: {
                    type: "OBJECT", properties: {
                      name: { type: "STRING" }, score: { type: "INTEGER" }, desc: { type: "STRING" },
                      aspects: { type: "ARRAY", items: { type: "OBJECT", properties: { name: { type: "STRING" }, score: { type: "INTEGER" }, desc: { type: "STRING" } }, required: ["name", "score", "desc"] } },
                      facets: { type: "ARRAY", items: { type: "OBJECT", properties: { name: { type: "STRING" }, score: { type: "INTEGER" }, desc: { type: "STRING" } }, required: ["name", "score", "desc"] } }
                    }, required: ["name", "score", "desc", "aspects", "facets"]
                  }
                }
              }, required: ["intro", "traits"]
            }, strengths: { type: "ARRAY", items: { type: "STRING" } }, weaknesses: { type: "ARRAY", items: { type: "STRING" } },
            romance: { type: "OBJECT", properties: { ideal: { type: "STRING" }, avoid: { type: "ARRAY", items: { type: "STRING" } } }, required: ["ideal", "avoid"] },
            riasec: { type: "OBJECT", properties: { profile: { type: "STRING" }, desc: { type: "STRING" } } }, aiCareerAnalysis: { type: "STRING" }
          }, required: ["personality", "strengths", "weaknesses", "romance", "aiCareerAnalysis"]
        }
      }
    };

    let attempt = 0, delay = 1000, success = false;
    while (attempt < 3 && !success) {
      try {
        setLoadingAttempt(attempt + 1);
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 60000);
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), signal: controller.signal });
        clearTimeout(timeoutId);
        const data = await response.json();
        if (!response.ok) throw new Error(data?.error?.message || `HTTP Feil ${response.status}`);
        const parsedData = JSON.parse(data.candidates[0].content.parts[0].text.replace(/```json/g, '').replace(/```/g, '').trim());
        
        setResults(parsedData); setAppState('dashboard'); success = true;
        // Lagre resultatet i nettleseren
        localStorage.setItem('introspectionResults', JSON.stringify({
          results: parsedData,
          testType: testType,
          includeRiasec: withRiasec
        }));
      } catch (err) {
        attempt++; if (attempt >= 3) { setErrorMessage(err.message); setAppState('error'); } else { await new Promise(r => setTimeout(r, delay)); delay *= 1.5; }
      }
    }
  };
  
  function generateRandomTest() {
    const randomAnswers = Array.from({ length: 150 }, () => Math.floor(Math.random() * 5) + 1);
    setTestType('extended_riasec');
    setMaxQuestions(150);
    setIncludeRiasec(true);
    generateInsights(randomAnswers, true);
  }

  function startTest(type, resume = false) {
    if (resume && savedProgress) {
      setTestType(savedProgress.type); setMaxQuestions(savedProgress.maxQuestions); setIncludeRiasec(savedProgress.includeRiasec);
      setAnswers(savedProgress.answers); setCurrentQuestionIdx(savedProgress.currentQuestionIdx);
    } else {
      setTestType(type);
      const target = type === 'extended' ? 120 : (type === 'extended_riasec' ? 150 : 60);
      setMaxQuestions(target); setIncludeRiasec(type === 'extended_riasec');
      setCurrentQuestionIdx(1); setAnswers([]);
    }
    setAppState('testing');
  }

  const handleAnswer = (value) => {
    if (isTransitioning) return;
    const newAnswers = [...answers, value];
    setAnswers(newAnswers);
    
    // Lagre progress lokalt for hver handling
    localStorage.setItem('introspectionProgress', JSON.stringify({
      type: testType, answers: newAnswers, currentQuestionIdx: currentQuestionIdx + 1, maxQuestions, includeRiasec
    }));

    if (currentQuestionIdx >= maxQuestions) { generateInsights(newAnswers, includeRiasec); } 
    else { setIsTransitioning(true); setTimeout(() => { setCurrentQuestionIdx(prev => prev + 1); setIsTransitioning(false); }, 300); }
  };

  const handleBack = () => {
    if (isTransitioning || currentQuestionIdx <= 1) return;
    setIsTransitioning(true);
    setTimeout(() => {
      const newAnswers = answers.slice(0, -1);
      setAnswers(newAnswers);
      setCurrentQuestionIdx(prev => prev - 1);
      localStorage.setItem('introspectionProgress', JSON.stringify({ type: testType, answers: newAnswers, currentQuestionIdx: currentQuestionIdx - 1, maxQuestions, includeRiasec }));
      setIsTransitioning(false);
    }, 300);
  };

  const runCompatibilityAnalysis = async (partnerTraits) => {
    setIsAnalyzingCompat(true);
    const myTraits = results.personality.traits.map(t => `${t.name}: ${t.score}. persentil`).join(', ');
    const partnerString = typeof partnerTraits === 'string' ? partnerTraits : partnerTraits.map(t => `${t.name}: ${t.score}. persentil`).join(', ');
    
    const prompt = `Du er ekspert på parterapi. Person 1 (Meg): ${myTraits}. Person 2 (Partner): "${partnerString}".
    Analyser kompatibilitet. Returner KUN JSON strukturert nøyaktig slik (ingen markdown, ingen tekst utenfor):
    {"score": <tall 1-100>, "summary": "<Oppsummering>", "strengths": ["<styrke 1>"], "challenges": ["<utfordring 1>"]}`;

    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseMimeType: "application/json" } })
      });
      const data = await response.json();
      setCompatAnalysis(JSON.parse(data.candidates[0].content.parts[0].text.replace(/```json/g, '').replace(/```/g, '').trim()));
    } catch (err) { console.error("Feil ved kompatibilitet:", err); } 
    finally { setIsAnalyzingCompat(false); }
  };

  if (loadingCache) return <div className="min-h-screen flex flex-col items-center justify-center"><Loader2 className="w-12 h-12 text-indigo-600 animate-spin" /></div>;

  if (appState === 'welcome') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-2xl bg-white p-8 rounded-3xl shadow-lg text-center w-full border-t-8 border-indigo-600">
          <Brain className="w-16 h-16 text-indigo-600 mx-auto mb-6" />
          <h1 className="text-4xl font-extrabold text-gray-900 mb-4 tracking-tight">Introspeksjon 30</h1>
          
          {matchId && !results ? (
            <div className="bg-pink-50 text-pink-800 p-5 rounded-2xl mb-8 border border-pink-200">
              <Users className="w-8 h-8 text-pink-500 mx-auto mb-2" />
              <h3 className="font-bold text-lg mb-1">Du har blitt invitert til å sjekke match!</h3>
              <p className="text-sm">For å se hvor godt dere passer sammen, må du først fullføre din egen personlighetsprofil.</p>
            </div>
          ) : (
            <p className="text-gray-600 mb-10 text-lg">Kartlegg din unike profil gjennom en fullstendig normert analyse av personlighetens 30 fasetter.</p>
          )}

          <div className="flex flex-col gap-4">
            {savedProgress && (
              <button onClick={() => startTest('resume', true)} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-4 px-6 rounded-2xl transition-all shadow-sm flex justify-between items-center group">
                <span className="flex items-center gap-3"><RefreshCcw className="w-6 h-6" /> Fortsett påbegynt test ({savedProgress.currentQuestionIdx}/{savedProgress.maxQuestions})</span>
              </button>
            )}
            <button onClick={() => startTest('extended_riasec')} className="w-full bg-slate-900 hover:bg-slate-800 text-white font-semibold py-4 px-6 rounded-2xl transition-all flex items-center gap-4 shadow-sm">
              <Compass className="w-6 h-6 text-blue-400" /> <span className="text-left text-base md:text-lg">Dyp karrierematching (30 fasetter + RIASEC)</span>
            </button>
            <button onClick={() => startTest('extended')} className="w-full bg-indigo-700 hover:bg-indigo-600 text-white font-semibold py-4 px-6 rounded-2xl transition-all flex items-center gap-4 shadow-sm">
              <FileText className="w-6 h-6 text-indigo-200" /> <span className="text-left text-base md:text-lg">Komplett personlighetsprofil (30 fasetter)</span>
            </button>
          </div>
          <button 
        onClick={generateRandomTest} 
        className="mt-8 text-xs font-mono text-gray-400 hover:text-indigo-600 transition-colors w-full text-center"
      >
        [ DEV: Generer tilfeldig test (150 svar) ]
      </button>
        </div>
      </div>
    );
  }

  if (appState === 'testing') {
    const progress = (currentQuestionIdx / maxQuestions) * 100;
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-2xl w-full bg-white p-8 rounded-3xl shadow-lg relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1.5 bg-gray-100">
            <div className="h-full bg-indigo-600 transition-all duration-300" style={{ width: `${progress}%` }}></div>
          </div>
          
          <div className="flex justify-between items-center mb-10 mt-2">
            <div className="w-1/3">
              {currentQuestionIdx > 1 && <button onClick={handleBack} className="flex items-center gap-1 text-gray-500 hover:text-indigo-600 text-sm font-medium"><ArrowLeft className="w-4 h-4"/> Tilbake</button>}
            </div>
            <div className="w-1/3 text-center font-semibold text-gray-500">{currentQuestionIdx} / {maxQuestions}</div>
            <div className="w-1/3 text-right"><span className="text-xs font-bold text-indigo-700 bg-indigo-50 px-3 py-1.5 rounded-full">{testType === 'short' ? 'Kort' : 'Utvidet'}</span></div>
          </div>

          <div className={`transition-opacity duration-300 ${isTransitioning ? 'opacity-0' : 'opacity-100'}`}>
            <p className="text-2xl text-gray-800 mb-10 font-medium leading-relaxed min-h-[5rem]">"{questionBank[(currentQuestionIdx - 1) % questionBank.length]}"</p>
            <div className="grid grid-cols-5 gap-2 md:gap-3 mb-2">
              {[1, 2, 3, 4, 5].map(num => (
                <button key={num} onClick={() => handleAnswer(num)} disabled={isTransitioning} className="h-16 md:h-20 rounded-xl bg-gray-50 hover:bg-indigo-600 hover:text-white border border-gray-200 transition-all font-bold text-lg text-gray-600 flex flex-col items-center justify-center gap-1 relative group">
                  <span>{num}</span>
                  <span className="text-[10px] opacity-0 group-hover:opacity-100 text-indigo-200 absolute bottom-2 hidden md:block">[Tast {num}]</span>
                </button>
              ))}
            </div>
            <div className="flex justify-between text-xs text-gray-400 uppercase tracking-wider font-bold px-1 mt-4">
              <span>Helt uenig</span><span>Helt enig</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (appState === 'analyzing') return <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4"><RefreshCcw className="w-12 h-12 text-indigo-600 animate-spin mb-6" /><h2 className="text-2xl font-bold text-gray-800 mb-2">Beregner normering...</h2><p className="text-gray-500">Trekker slutninger fra {maxQuestions} datapunkter.</p></div>;

  if (appState === 'error') return <div className="min-h-screen flex flex-col items-center justify-center"><AlertCircle className="w-16 h-16 text-rose-500 mb-6" /><h2 className="text-2xl font-bold mb-2">Noe gikk galt</h2><button onClick={() => setAppState('welcome')} className="bg-indigo-600 text-white py-3 px-6 rounded-xl mt-4">Prøv igjen</button></div>;

  if (!results) return null;

  return (
    <div className="min-h-screen bg-slate-100 p-4 md:p-8">
      {/* ACTION BAR: Holdes utenfor PDF'en */}
      <div className="max-w-6xl mx-auto mb-6 flex flex-wrap justify-between items-center gap-4 bg-white p-4 rounded-2xl shadow-sm border border-gray-200">
        <button onClick={() => { 
          setAppState('welcome'); 
          setMatchId(null); 
          setMatchData(null); 
          localStorage.removeItem('introspectionResults'); 
        }} className="text-sm font-bold text-indigo-600 hover:bg-indigo-50 px-4 py-2 rounded-lg transition-colors flex items-center gap-2"><ArrowLeft className="w-4 h-4"/> Tilbake til start</button>
        <div className="flex flex-wrap gap-2">
          <button onClick={generateShareLink} className="flex items-center gap-2 text-sm font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 px-4 py-2 rounded-xl transition-all">
            {copiedLink ? <Check className="w-4 h-4 text-emerald-500" /> : <LinkIcon className="w-4 h-4" />} {copiedLink ? 'Lenke kopiert!' : 'Del kompatibilitets-lenke'}
          </button>
          <button onClick={handlePdfExport} disabled={isGeneratingPDF} className="flex items-center gap-2 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 px-5 py-2 rounded-xl transition-all shadow-sm disabled:opacity-50">
            {isGeneratingPDF ? <RefreshCcw className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />} PDF-Rapport
          </button>
        </div>
      </div>

      {/* SELVE RAPPORTEN (Dette skrives ut i PDF) */}
      <div id="pdf-content" className="max-w-6xl mx-auto space-y-6 bg-slate-100">
        
        <div className="text-center mb-8 html2pdf-ignore">
          <h1 className="text-4xl font-extrabold text-gray-900 tracking-tight">Ditt Resultat</h1>
          <p className="text-gray-600 mt-2 font-medium flex items-center justify-center gap-2"><BarChart className="w-4 h-4" /> Normert mot internasjonale IPIP-standarder</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white rounded-3xl shadow-sm border border-gray-200 p-8">
            <div className="flex items-center gap-3 mb-6"><Brain className="w-8 h-8 text-indigo-600" /><h2 className="text-2xl font-bold text-gray-900">Personlighet (Big Five)</h2></div>
            <p className="text-gray-700 mb-8 leading-relaxed bg-indigo-50/50 p-5 rounded-2xl border border-indigo-100/50 text-lg">{results.personality.intro}</p>
            <div className="space-y-4">
              {results.personality.traits?.map((trait, idx) => (<TraitRow key={idx} trait={trait} isShortTest={testType === 'short'} />))}
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-white rounded-3xl shadow-sm border border-gray-200 p-8 page-break-inside-avoid">
              <div className="flex items-center gap-3 mb-5"><Target className="w-7 h-7 text-emerald-600" /><h2 className="text-xl font-bold text-gray-900">Dine Styrker</h2></div>
              <ul className="space-y-4">{results.strengths?.map((str, i) => (<li key={i} className="flex gap-3 text-sm text-gray-700 leading-relaxed"><span className="text-emerald-500 mt-1 font-bold">•</span> {str}</li>))}</ul>
            </div>
            <div className="bg-white rounded-3xl shadow-sm border border-gray-200 p-8 page-break-inside-avoid">
              <div className="flex items-center gap-3 mb-5"><AlertCircle className="w-7 h-7 text-rose-500" /><h2 className="text-xl font-bold text-gray-900">Potensielle Svakheter</h2></div>
              <ul className="space-y-4">{results.weaknesses?.map((wk, i) => (<li key={i} className="flex gap-3 text-sm text-gray-700 leading-relaxed"><span className="text-rose-400 mt-1 font-bold">•</span> {wk}</li>))}</ul>
            </div>
            <div className="bg-white rounded-3xl shadow-sm border border-gray-200 p-8 flex flex-col page-break-inside-avoid">
              <div className="flex items-center gap-3 mb-5"><Heart className="w-7 h-7 text-pink-500" /><h2 className="text-xl font-bold text-gray-900">Romantisk Profil</h2></div>
              <p className="text-gray-700 leading-relaxed text-sm mb-6">{results.romance.ideal}</p>
              <div className="bg-rose-50/80 rounded-2xl p-5 border border-rose-100">
                <h3 className="text-xs font-bold text-rose-800 mb-3 uppercase tracking-wide">Potensielle konflikter</h3>
                <ul className="space-y-2">{results.romance.avoid?.map((item, idx) => (<li key={idx} className="flex gap-2 text-xs text-gray-800 leading-relaxed"><span className="text-rose-500 font-extrabold">×</span> {item}</li>))}</ul>
              </div>
            </div>
          </div>
        </div>

        {includeRiasec && results.aiCareerAnalysis && results.riasec && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 page-break-inside-avoid mt-6">
            <div className="bg-white rounded-3xl shadow-sm border border-gray-200 p-8 flex flex-col">
              <div className="flex items-center gap-3 mb-5"><Lightbulb className="w-7 h-7 text-amber-500" /><h2 className="text-xl font-bold text-gray-900">RIASEC</h2></div>
              <span className="inline-block bg-amber-100 text-amber-900 font-extrabold px-4 py-1.5 rounded-xl text-lg tracking-wider mb-4 w-max">{results.riasec.profile}</span>
              <p className="text-gray-700 leading-relaxed text-sm">{results.riasec.desc}</p>
            </div>
            <div className="lg:col-span-2 bg-slate-900 text-white rounded-3xl shadow-xl p-8 relative overflow-hidden">
              <div className="absolute top-0 right-0 p-8 opacity-5"><GraduationCap className="w-48 h-48" /></div>
              <div className="relative z-10">
                <div className="flex items-center gap-3 mb-6"><Briefcase className="w-7 h-7 text-blue-400" /><h2 className="text-2xl font-bold text-white">Karriereanalyse</h2></div>
                <div className="space-y-4 text-slate-300 text-sm leading-relaxed whitespace-pre-wrap">{results.aiCareerAnalysis}</div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* MODAL FOR KOMPATIBILITET */}
      {(isCompatModalOpen || matchData) && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full p-8 relative">
            <button onClick={() => { setIsCompatModalOpen(false); setMatchData(null); setMatchId(null); window.history.replaceState({}, document.title, window.location.pathname); }} className="absolute top-6 right-6 text-gray-400 hover:text-gray-800"><X className="w-6 h-6" /></button>
            <div className="flex items-center gap-3 mb-6"><div className="bg-pink-100 p-3 rounded-full"><Users className="w-6 h-6 text-pink-600" /></div><h2 className="text-2xl font-bold text-gray-900">Relasjonsanalyse</h2></div>

            {!compatAnalysis ? (
              <div className="text-center py-8">
                <RefreshCcw className="w-12 h-12 text-pink-500 animate-spin mx-auto mb-4" />
                <h3 className="font-bold text-lg text-gray-800">Analyserer match...</h3>
                <p className="text-gray-500 text-sm mt-2">AI-en sammenligner nå deres to 30-fasett profiler.</p>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="flex flex-col items-center justify-center bg-gray-50 rounded-2xl p-6 border border-gray-100">
                  <span className="text-sm font-bold text-gray-500 uppercase tracking-widest mb-1">Match-score</span>
                  <span className="text-6xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-pink-500 to-indigo-500">{compatAnalysis.score}%</span>
                </div>
                <div><h3 className="font-bold text-gray-900 mb-2">Dynamikk</h3><p className="text-gray-700 text-sm leading-relaxed bg-indigo-50 p-4 rounded-xl">{compatAnalysis.summary}</p></div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-emerald-50 rounded-xl p-4"><h3 className="font-bold text-emerald-800 mb-2 flex items-center gap-2"><Check className="w-4 h-4" /> Felles Styrker</h3><ul className="space-y-1">{compatAnalysis.strengths?.map((s, i) => <li key={i} className="text-xs text-emerald-900">• {s}</li>)}</ul></div>
                  <div className="bg-amber-50 rounded-xl p-4"><h3 className="font-bold text-amber-800 mb-2 flex items-center gap-2"><AlertCircle className="w-4 h-4" /> Utfordringer</h3><ul className="space-y-1">{compatAnalysis.challenges?.map((c, i) => <li key={i} className="text-xs text-amber-900">• {c}</li>)}</ul></div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default App;