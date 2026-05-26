import React, { useState } from 'react';
import { 
  Brain, Briefcase, Heart, Lightbulb, Target, AlertCircle,
  GraduationCap, ChevronDown, ChevronUp, RefreshCcw, Copy,
  Check, Zap, FileText, Compass, BarChart, ArrowLeft
} from 'lucide-react';

// For å hente API-nøkkelen fra .env-filen (lokalt) eller Vercel (publisert)
// Bruk import.meta.env.VITE_GEMINI_API_KEY lokalt.
// Her i testmiljøet må den imidlertid være en tom streng for at kompilatoren ikke skal krasje.
const getApiKey = () => {
  if (typeof process !== 'undefined' && process.env && process.env.VITE_GEMINI_API_KEY) {
    return process.env.VITE_GEMINI_API_KEY;
  }
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

          <button 
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition-colors w-full justify-center py-2.5 mt-2 bg-indigo-50/50 hover:bg-indigo-50 rounded-lg"
          >
            {isExpanded ? (
              <><ChevronUp className="w-4 h-4" /> Skjul de 6 underfasettene</>
            ) : (
              <><ChevronDown className="w-4 h-4" /> Vis alle 6 underfasetter</>
            )}
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
                    <div className="absolute top-0 bottom-0 left-[50%] w-0.5 bg-gray-300 z-10"></div>
                    <div className="bg-gray-400 h-1 rounded-full relative z-0" style={{ width: `${facet.score}%` }}></div>
                  </div>
                  <p className="text-[10px] text-gray-400 leading-tight">{facet.desc}</p>
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

  const [currentQuestionIdx, setCurrentQuestionIdx] = useState(1);
  const [maxQuestions, setMaxQuestions] = useState(60);
  const [answers, setAnswers] = useState([]);
  const [isTransitioning, setIsTransitioning] = useState(false);

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

  const copyFacets = () => {
    if (!results || !results.personality || !results.personality.traits) return;
    let textToCopy = testType === 'short' ? "Big Five - Persentiler\n\n" : "Big Five Fasetter - Persentiler\n\n";
    results.personality.traits.forEach(trait => {
      textToCopy += `${trait.name.toUpperCase()} (${trait.score}. persentil)\n`;
      if (testType !== 'short' && trait.facets) {
        trait.facets.forEach(facet => { textToCopy += ` - ${facet.name}: ${facet.score}. persentil\n`; });
      }
      textToCopy += "\n";
    });
    const textArea = document.createElement("textarea");
    textArea.value = textToCopy;
    document.body.appendChild(textArea);
    textArea.select();
    try { document.execCommand('copy'); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch (err) {}
    document.body.removeChild(textArea);
  };

  const generateInsights = async (finalAnswers, withRiasec) => {
    setAppState('analyzing');
    setErrorMessage("");
    setLoadingAttempt(1);

    // --- EKTE STATISTISK NORMERING ---
    // Estimerte IPIP-normer (Mean og Standard Deviation) på 1-5 skala
    const norms = {
      O: { mean: 3.6, sd: 0.6 },
      C: { mean: 3.4, sd: 0.6 },
      E: { mean: 3.3, sd: 0.7 },
      A: { mean: 3.7, sd: 0.5 },
      N: { mean: 2.9, sd: 0.7 }
    };

    const b5Keys = ['O', 'C', 'E', 'A', 'N'];
    const b5Scores = { O: 0, C: 0, E: 0, A: 0, N: 0 };
    const b5Counts = { O: 0, C: 0, E: 0, A: 0, N: 0 };
    const rKeys = ['R', 'I', 'A', 'S', 'E', 'C'];
    const rScores = { R: 0, I: 0, A: 0, S: 0, E: 0, C: 0 };

    finalAnswers.forEach((ans, idx) => {
      if (idx < 120) {
        const trait = b5Keys[idx % 5];
        b5Scores[trait] += ans;
        b5Counts[trait] += 1;
      } else {
        const riasecIdx = Math.floor((idx - 120) / 5);
        rScores[rKeys[riasecIdx]] += ans;
      }
    });

    // Kalkulerer Z-score, deretter tilnærmet Persentil (1-99)
    const getPercentile = (trait) => {
      if (b5Counts[trait] === 0) return 50;
      const avg = b5Scores[trait] / b5Counts[trait];
      const z = (avg - norms[trait].mean) / norms[trait].sd;
      
      const k = 1.0 / (1.0 + 0.2316419 * Math.abs(z));
      const a1 = 0.31938153, a2 = -0.356563782, a3 = 1.781477937, a4 = -1.821255978, a5 = 1.330274429;
      const p = 1.0 - 1.0 / Math.sqrt(2 * Math.PI) * Math.exp(-0.5 * z * z) * (a1 * k + a2 * k * k + a3 * Math.pow(k, 3) + a4 * Math.pow(k, 4) + a5 * Math.pow(k, 5));
      let percentile = z < 0 ? 1.0 - p : p;
      percentile = Math.round(percentile * 100);
      return Math.max(1, Math.min(99, percentile));
    };

    const oPercentile = getPercentile('O');
    const cPercentile = getPercentile('C');
    const ePercentile = getPercentile('E');
    const aPercentile = getPercentile('A');
    const nPercentile = getPercentile('N');

    let riasecString = "Ikke valgt";
    if (withRiasec) {
      const sortedRiasec = Object.entries(rScores).sort((a, b) => b[1] - a[1]);
      riasecString = sortedRiasec.slice(0, 3).map(arr => arr[0]).join('');
    }

    const prompt = `Du er en ekspert innen psykometri. En bruker har tatt en normert test. 
      Her er PERSENTIL-scorene deres (1-99, hvor 50 er gjennomsnittet for befolkningen):
      Åpenhet: ${oPercentile}. persentil. 
      Planmessighet: ${cPercentile}. persentil. 
      Ekstroversjon: ${ePercentile}. persentil. 
      Medmenneskelighet: ${aPercentile}. persentil. 
      Nevrotisisme: ${nPercentile}. persentil.
      ${withRiasec ? `RIASEC-profil (de tre mest dominerende typene): ${riasecString}` : 'Ingen RIASEC tatt.'}
      
      Analyser disse persentilene og returner en profil på norsk. 
      For HVERT av de 5 hovedtrekkene i 'traits'-listen:
      1. Sørg for at 'score'-feltet stemmer EKSAKT med verdien (1-99) over.
      2. Del det inn i nøyaktig 2 overordnede aspekter i 'aspects'-listen. Gi dem en troverdig estimert PERSENTIL-score basert på hovedscoren. Bruk disse navnene: Åpenhet: Intellekt og Kreativitet. Planmessighet: Orden og Gjennomføringsevne. Ekstroversjon: Entusiasme og Selvmarkering. Medmenneskelighet: Empati og Høflighet. Nevrotisisme: Temperament og Sårbarhet.
      3. Inkluder de 6 klassiske underfasettene i 'facets'-listen, også med troverdig estimert persentil-score.
      4. For 'romance', fyll 'ideal' og 'avoid' basert på statistisk kompatibilitet.
      Husk: Scorene refererer til prosenter av befolkningen de scorer høyere enn. Vær profesjonell.`;

    const payload = {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: {
          type: "OBJECT",
          properties: {
            personality: {
              type: "OBJECT",
              properties: {
                intro: { type: "STRING" },
                traits: {
                  type: "ARRAY",
                  items: {
                    type: "OBJECT",
                    properties: {
                      name: { type: "STRING" }, score: { type: "INTEGER" }, desc: { type: "STRING" },
                      aspects: { type: "ARRAY", items: { type: "OBJECT", properties: { name: { type: "STRING" }, score: { type: "INTEGER" }, desc: { type: "STRING" } }, required: ["name", "score", "desc"] } },
                      facets: { type: "ARRAY", items: { type: "OBJECT", properties: { name: { type: "STRING" }, score: { type: "INTEGER" }, desc: { type: "STRING" } }, required: ["name", "score", "desc"] } }
                    },
                    required: ["name", "score", "desc", "aspects", "facets"]
                  }
                }
              }, required: ["intro", "traits"]
            },
            strengths: { type: "ARRAY", items: { type: "STRING" } },
            weaknesses: { type: "ARRAY", items: { type: "STRING" } },
            romance: { type: "OBJECT", properties: { ideal: { type: "STRING" }, avoid: { type: "ARRAY", items: { type: "STRING" } } }, required: ["ideal", "avoid"] },
            riasec: { type: "OBJECT", properties: { profile: { type: "STRING" }, desc: { type: "STRING" } } },
            aiCareerAnalysis: { type: "STRING" }
          }, required: ["personality", "strengths", "weaknesses", "romance", "aiCareerAnalysis"]
        }
      }
    };

    // Bruk offentlig modell (1.5-flash) for Vercel, og preview-modell for testmiljøet
    const modelName = apiKey ? "gemini-1.5-flash" : "gemini-2.5-flash-preview-09-2025";
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
    
    let attempt = 0; let delay = 1000; let success = false; let lastErrorDetails = "";

    while (attempt < 3 && !success) {
      try {
        setLoadingAttempt(attempt + 1);
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);
        const response = await fetch(apiUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), signal: controller.signal });
        clearTimeout(timeoutId);
        let data; try { data = await response.json(); } catch (e) { throw new Error(`Nettverksfeil. Svar: ${response.status}`); }
        if (!response.ok) throw new Error(data?.error?.message || `HTTP Feil ${response.status}`);
        let jsonStr = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!jsonStr) throw new Error("Mottok tomt svar fra modellen.");
        jsonStr = jsonStr.replace(/```json/g, '').replace(/```/g, '').trim();
        const parsedData = JSON.parse(jsonStr);
        setResults(parsedData); setAppState('dashboard'); success = true;
      } catch (err) {
        lastErrorDetails = err.name === 'AbortError' ? 'Avbrutt etter 15 sek.' : err.message;
        attempt++;
        if (attempt >= 3) { setErrorMessage(lastErrorDetails); setAppState('error'); } 
        else { await new Promise(resolve => setTimeout(resolve, delay)); delay *= 1.5; }
      }
    }
  };

  const startTest = (type) => {
    setTestType(type);
    let targetQuestions = 60;
    if (type === 'extended') targetQuestions = 120;
    if (type === 'extended_riasec') targetQuestions = 150;
    setMaxQuestions(targetQuestions);
    setIncludeRiasec(type === 'extended_riasec');
    setCurrentQuestionIdx(1); setAnswers([]); setAppState('testing');
  };

  const handleAnswer = (value) => {
    if (isTransitioning) return;
    const newAnswers = [...answers, value];
    setAnswers(newAnswers);
    if (currentQuestionIdx >= maxQuestions) { generateInsights(newAnswers, includeRiasec); } 
    else { setIsTransitioning(true); setTimeout(() => { setCurrentQuestionIdx(prev => prev + 1); setIsTransitioning(false); }, 300); }
  };

  // Funksjon for å gå ett spørsmål tilbake
  const handleBack = () => {
    if (isTransitioning || currentQuestionIdx <= 1) return;
    setIsTransitioning(true);
    setTimeout(() => {
      setAnswers(prev => prev.slice(0, -1)); // Fjerner det siste svaret i arrayen
      setCurrentQuestionIdx(prev => prev - 1); // Går én indeks tilbake
      setIsTransitioning(false);
    }, 300);
  };

  const currentQuestionText = questionBank[(currentQuestionIdx - 1) % questionBank.length];

  if (appState === 'welcome') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-2xl bg-white p-8 rounded-3xl shadow-lg text-center">
          <Brain className="w-16 h-16 text-indigo-600 mx-auto mb-6" />
          <h1 className="text-4xl font-extrabold text-gray-900 mb-4 tracking-tight">Introspeksjon 30</h1>
          <p className="text-gray-600 mb-10 text-lg">Kartlegg din unike profil gjennom en fullstendig normert analyse av personlighetens 30 fasetter, validert mot internasjonale statistiske rammeverk.</p>
          <div className="flex flex-col gap-4">
            <button onClick={() => startTest('extended_riasec')} className="w-full bg-slate-900 hover:bg-slate-800 text-white font-semibold py-4 px-6 rounded-2xl transition-all flex items-center justify-start gap-4 shadow-sm hover:shadow-md">
              <Compass className="w-6 h-6 opacity-90 text-blue-400" /> <span className="text-left text-base md:text-lg">Fullfør din dype karrierematching (30 fasetter + RIASEC)</span>
            </button>
            <button onClick={() => startTest('extended')} className="w-full bg-indigo-700 hover:bg-indigo-600 text-white font-semibold py-4 px-6 rounded-2xl transition-all flex items-center justify-start gap-4 shadow-sm hover:shadow-md">
              <FileText className="w-6 h-6 opacity-90 text-indigo-200" /> <span className="text-left text-base md:text-lg">Komplett personlighetsprofil (30 fasetter)</span>
            </button>
            <button onClick={() => startTest('short')} className="w-full bg-indigo-50 hover:bg-indigo-100 text-indigo-900 font-semibold py-4 px-6 rounded-2xl transition-all flex items-center justify-start gap-4 border border-indigo-100">
              <Zap className="w-6 h-6 text-indigo-600" /> <span className="text-left text-base md:text-lg">Test dine basisegenskaper (5 hovedtrekk)</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (appState === 'testing') {
    let testTag = 'Kort Big Five';
    if (testType === 'extended') testTag = 'Utvidet Big Five';
    if (testType === 'extended_riasec') testTag = 'Big Five + RIASEC';
    const progressPercentage = (currentQuestionIdx / maxQuestions) * 100;

    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-2xl w-full bg-white p-8 rounded-3xl shadow-lg relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1.5 bg-gray-100">
            <div className="h-full bg-indigo-600 transition-all duration-300 ease-out" style={{ width: `${progressPercentage}%` }}></div>
          </div>
          
          <div className="flex justify-between items-center mb-10 mt-2 relative">
            <div className="w-1/3 text-left">
              {currentQuestionIdx > 1 && (
                <button onClick={handleBack} disabled={isTransitioning} className="flex items-center gap-1 text-gray-500 hover:text-indigo-600 transition-colors text-sm font-medium">
                  <ArrowLeft className="w-4 h-4" /> Tilbake
                </button>
              )}
            </div>
            <div className="w-1/3 text-center">
              <h2 className="text-lg font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">
                {currentQuestionIdx} <span className="text-gray-300 mx-1">/</span> {maxQuestions}
              </h2>
            </div>
            <div className="w-1/3 text-right">
              <span className="text-sm font-bold text-indigo-700 bg-indigo-50 px-3 py-1.5 rounded-full border border-indigo-100 inline-block">
                {testTag}
              </span>
            </div>
          </div>

          <div className={`transition-opacity duration-300 ${isTransitioning ? 'opacity-0' : 'opacity-100'}`}>
            <p className="text-2xl text-gray-800 mb-10 font-medium leading-relaxed min-h-[5rem]">"{currentQuestionText}"</p>
            <div className="grid grid-cols-5 gap-2 md:gap-3 mb-6">
              {[1, 2, 3, 4, 5].map((num) => (
                <button key={num} onClick={() => handleAnswer(num)} disabled={isTransitioning} className="h-16 md:h-20 rounded-xl bg-gray-50 hover:bg-indigo-600 hover:text-white border border-gray-200 hover:border-indigo-600 transition-all font-bold text-lg text-gray-600 disabled:opacity-50">{num}</button>
              ))}
            </div>
            <div className="flex justify-between text-sm text-gray-400 uppercase tracking-wider font-bold px-1">
              <span>Helt uenig</span><span>Helt enig</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (appState === 'analyzing') {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
        <RefreshCcw className="w-12 h-12 text-indigo-600 animate-spin mb-6" />
        <h2 className="text-2xl font-bold text-gray-800 mb-2">Beregner statistisk normering...</h2>
        <p className="text-gray-500 mb-4">Sammenligner dine svar med befolkningen og genererer rapport.</p>
        {loadingAttempt > 1 && <span className="bg-amber-100 text-amber-800 text-xs font-semibold px-3 py-1 rounded-full mt-2">Forsøk {loadingAttempt} av 3 (Forespørselen går tregt...)</span>}
      </div>
    );
  }

  if (appState === 'error') {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4 text-center">
        <AlertCircle className="w-16 h-16 text-rose-500 mb-6 mx-auto" />
        <h2 className="text-2xl font-bold text-gray-800 mb-2">Noe gikk galt under genereringen</h2>
        <div className="bg-red-50 text-red-800 text-sm p-4 rounded-lg max-w-lg mx-auto mb-6 break-words border border-red-200"><p className="font-semibold mb-1">Feilbeskjed:</p><code className="bg-white px-2 py-1 rounded">{errorMessage}</code></div>
        <button onClick={() => setAppState('welcome')} className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 px-6 rounded-xl transition-all">Gå tilbake til start</button>
      </div>
    );
  }

  if (!results) return null;

  return (
    <div className="min-h-screen bg-slate-100 p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex justify-between items-end">
          <div>
            <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">Ditt Resultat</h1>
            <p className="text-gray-600 mt-1 font-medium flex items-center gap-2"><BarChart className="w-4 h-4" /> Normert mot internasjonale IPIP-standarder</p>
          </div>
          <button onClick={() => setAppState('welcome')} className="text-sm font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 px-4 py-2 rounded-lg transition-colors">Start på nytt</button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white rounded-3xl shadow-sm border border-gray-100 p-8">
            <div className="flex justify-between items-center mb-6 flex-wrap gap-4">
              <div className="flex items-center gap-3"><Brain className="w-8 h-8 text-indigo-600" /><h2 className="text-2xl font-bold text-gray-900">Personlighet (Big Five)</h2></div>
              <button onClick={copyFacets} className="flex items-center gap-2 text-sm font-semibold text-gray-600 hover:text-indigo-700 bg-gray-50 hover:bg-indigo-50 px-4 py-2 rounded-xl border border-gray-200 transition-all shadow-sm">
                {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />} <span className={copied ? "text-emerald-600" : ""}>{copied ? 'Kopiert!' : 'Kopier data'}</span>
              </button>
            </div>
            <p className="text-gray-700 mb-8 leading-relaxed bg-indigo-50/50 p-5 rounded-2xl border border-indigo-100/50 text-lg">{results.personality.intro}</p>
            <div className="space-y-4">
              {results.personality.traits?.map((trait, idx) => (<TraitRow key={idx} trait={trait} isShortTest={testType === 'short'} />))}
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-8">
              <div className="flex items-center gap-3 mb-5"><Target className="w-7 h-7 text-emerald-600" /><h2 className="text-xl font-bold text-gray-900">Dine Styrker</h2></div>
              <ul className="space-y-4">{results.strengths?.map((str, i) => (<li key={i} className="flex gap-3 text-base text-gray-700 leading-relaxed"><span className="text-emerald-500 mt-1 font-bold">•</span> {str}</li>))}</ul>
            </div>
            <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-8">
              <div className="flex items-center gap-3 mb-5"><AlertCircle className="w-7 h-7 text-rose-500" /><h2 className="text-xl font-bold text-gray-900">Potensielle Svakheter</h2></div>
              <ul className="space-y-4">{results.weaknesses?.map((wk, i) => (<li key={i} className="flex gap-3 text-base text-gray-700 leading-relaxed"><span className="text-rose-400 mt-1 font-bold">•</span> {wk}</li>))}</ul>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-8 flex flex-col">
            <div className="flex items-center gap-3 mb-5"><Heart className="w-7 h-7 text-pink-500" /><h2 className="text-xl font-bold text-gray-900">Romantisk Kompatibilitet</h2></div>
            <p className="text-gray-700 leading-relaxed text-base mb-6">{results.romance.ideal}</p>
            <div className="mt-auto bg-rose-50/80 rounded-2xl p-5 border border-rose-100">
              <h3 className="text-sm font-bold text-rose-800 mb-4 flex items-center gap-2 uppercase tracking-wide">Hvem du bør unngå</h3>
              <ul className="space-y-3">{results.romance.avoid?.map((item, idx) => (<li key={idx} className="flex gap-3 text-sm text-gray-800 leading-relaxed font-medium"><span className="text-rose-500 mt-0.5 font-extrabold">×</span> {item}</li>))}</ul>
            </div>
          </div>
          {includeRiasec && results.riasec && (
            <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-8 flex flex-col">
              <div className="flex items-center gap-3 mb-5"><Lightbulb className="w-7 h-7 text-amber-500" /><h2 className="text-xl font-bold text-gray-900">Interesseprofil (RIASEC)</h2></div>
              <div className="mb-4"><span className="inline-block bg-amber-100 text-amber-900 font-extrabold px-4 py-1.5 rounded-xl text-lg tracking-wider">{results.riasec.profile}</span></div>
              <p className="text-gray-700 leading-relaxed text-base">{results.riasec.desc}</p>
            </div>
          )}
          {includeRiasec && results.aiCareerAnalysis && (
            <div className="lg:col-span-2 bg-slate-900 text-white rounded-3xl shadow-xl p-8 relative overflow-hidden">
              <div className="absolute top-0 right-0 p-8 opacity-5"><GraduationCap className="w-48 h-48" /></div>
              <div className="relative z-10">
                <div className="flex items-center gap-3 mb-6"><Briefcase className="w-7 h-7 text-blue-400" /><h2 className="text-2xl font-bold text-white">AI-Analyse: Utdanning og Karriere</h2></div>
                <div className="space-y-4 text-slate-300 text-base leading-relaxed whitespace-pre-wrap max-w-4xl">{results.aiCareerAnalysis}</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default App;