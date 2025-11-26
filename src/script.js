// -------------------- Loading translated keywords async --------------------

let csvData = [];
let debug = false

async function loadCSVData() {
  csvData = []; 

  try {
    const url = "https://rag-proxy-worker.rag-proxy-worker.workers.dev/getKeywords";
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();
    let persisted;
    // persisted = parseCSV(text);

    try {
      persisted = JSON.parse(text); // might work directly
    } catch {
      // fallback: try to parse as CSV
    }

    if (!Array.isArray(persisted)) {
      console.warn("⚠️ Persisted data was not an array, wrapping:", persisted);
      persisted = [persisted];
    }

    csvData = [...csvData, ...persisted];
    console.log("csvData length now:", csvData.length);
  } catch (err) {
    console.error("Failed to fetch persisted keywords:", err);
  }

  if (!Array.isArray(csvData)) {
    console.warn("⚠️ csvData was not an array, resetting to []");
    csvData = [];
  }

  return csvData;
}
function parseCSVLine(line) {
  const defaultHeaders = [
    "mot","theme","qui","quoi","a_qui","par_quoi","quand","ou","pourquoi","comment"
  ];

  const stripQuotes = str => str.replace(/^['"]+|['"]+$/g, '').trim();

  let values = line.split(",").map(v => stripQuotes(v));

  // Pad with empty strings if fewer than 10 columns
  while (values.length < defaultHeaders.length) values.push("");

  // Truncate if more than 10
  if (values.length > defaultHeaders.length) values = values.slice(0, defaultHeaders.length);

  return Object.fromEntries(defaultHeaders.map((h, i) => [h, values[i]]));
}

// Parse full CSV text
function parseCSV(text) {
  const lines = text.trim().split("\n").filter(l => l.trim());
  return lines.map(parseCSVLine);
}



// -------------------- Initialize extension --------------------
async function initExtension() {
  // console.log("Extension init started");
  csvData = await loadCSVData();
  // console.log("CSV loaded with", csvData.length, "rows");
  // clean previous logs 
  state.log = [];
  injectUI();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initExtension);
} else {
  initExtension();
}


// -------------------- UI --------------------
function injectUI() {
  if (document.getElementById("keyword-panel-styles")) return;

  const style = document.createElement("style");
  style.id = "keyword-panel-styles";
  style.textContent = `
  .keyword-panel {
    position: fixed;
    top: 0;
    right: -350px; /* slightly wider if needed */
    width: 350px;
    height: 100%;
    background: #fff;
    box-shadow: -2px 0 8px rgba(0,0,0,0.2);
    padding: 1rem;
    transition: right 0.3s ease;
    z-index: 9999;
    display: flex;
    flex-direction: column;
  }

  .keyword-panel.open { right: 0; }

  /* Header and close button */
  .keyword-panel h3 {
    margin-top: 0;
    font-size: 1.2rem;
    flex-shrink: 0;
  }

  .keyword-panel .close-btn {
    position: absolute;
    top: 10px;
    right: 15px;
    font-size: 1.5rem;
    cursor: pointer;
    color: #666;
  }

  .keyword-panel .close-btn:hover { color: #000; }

  /* Scrollable content wrapper */
  .keyword-panel .panel-content {
    overflow-y: auto;
    flex-grow: 1;
    margin-top: 1rem;
  }

  .keyword-panel ul {
    list-style: none;
    padding: 0;
    margin: 0;
  }

  .keyword-panel li {
    margin: 0.5rem 0;
    cursor: pointer;
    color: #0077cc;
  }

  .keyword-panel li:hover { text-decoration: underline; }
.keyword-panel .panel-content {
  overflow-y: auto;
  flex-grow: 1;
  max-height: 100%;   /* 👈 ensures content scrolls instead of stretching panel */
}
  .recherche-btn {
    position: fixed;
    bottom: 20px;
    left: 20px;
    background: #0077cc;
    color: white;
    border: none;
    padding: 10px 16px;
    font-size: 14px;
    border-radius: 6px;
    cursor: pointer;
    z-index: 10000;
    box-shadow: 0 2px 6px rgba(0,0,0,0.3);
  }
  .recherche-btn:hover { background: #005fa3; }
  #user-log-container li {
  cursor: default;
  color: #333;
  text-decoration: none;
}
#user-log-container li:hover {
  text-decoration: none;
}
`;

  document.head.appendChild(style);

  // Panel
  if (!document.getElementById("keyword-panel")) {
    const panel = document.createElement("div");
    panel.id = "keyword-panel";
    panel.className = "keyword-panel";
    panel.innerHTML = `
    <span class="close-btn">&times;</span>
    <h3 id="keyword-header">Sélectionner un mot-clé</h3>
    <div class="panel-content">
      <ul id="keyword-list"></ul>
      <div id="keyword-selection"></div>
      <div id="board-container"></div>
      <div id="user-log-container">
        <button id="toggle-log-btn" style="margin-top:10px;">
          Chercher des articles associés ▼
          </button>
        <div id="log-content" style="display:none; margin-top:5px;"></div>
      </div>

      <div id="microconcepts-container"></div>
      <div id="associated-keywords-container"></div>
    </div>
  `;
  
  // Create the info box
  const infoBox = document.createElement("div");
  infoBox.textContent =
    "bleu : mot-clé présent dans l'ontologie IEML\norange : le mot-clé sera traduit en IEML par un LLM";
  Object.assign(infoBox.style, {
    display: "none",
    marginBottom: "4px",
    padding: "6px 10px",
    borderRadius: "6px",
    background: "#f0f0f0",
    color: "#333",
    whiteSpace: "pre-wrap",
    fontSize: "12px",
  });

  // Get the header and insert info box right after it
  const header = panel.querySelector("#keyword-header");
  header.style.margin = "0 0 6px 0";
  header.style.color = "#333";
  header.style.cursor = "pointer";
  header.insertAdjacentElement("afterend", infoBox);

  // Toggle info box on header click
  header.addEventListener("click", () => {
    infoBox.style.display = infoBox.style.display === "none" ? "block" : "none";
  });

  document.body.appendChild(panel);
      document.body.appendChild(panel);
  panel.querySelector(".close-btn").addEventListener("click", () => {
  
  // Close keyword panel
  panel.classList.remove("open");

  // Remove related panels if they exist
  ["related-panel", "related-panel-llm"].forEach(id => {
    const p = document.getElementById(id);
    if (p) p.remove();
  });
});

  }

  // Init Button
  if (!document.getElementById("recherche-btn")) {
    const btn = document.createElement("button");
    btn.id = "recherche-btn";
    btn.className = "recherche-btn";
    btn.textContent = "IEML-RS";
    btn.addEventListener("click", () => showKeywordPanel("fr"));
    document.body.appendChild(btn);
  }

// Log Collapsible
const panelEl = document.getElementById("keyword-panel");
if (panelEl) {
  const logBtn = panelEl.querySelector("#toggle-log-btn");
  const logContent = panelEl.querySelector("#log-content");

  if (logBtn && logContent && !logBtn.dataset.bound) {
    logBtn.addEventListener("click", () => {
      const isHidden = logContent.style.display === "none";
      logContent.style.display = isHidden ? "block" : "none";
      logBtn.textContent = isHidden ? "Masquer l’historique ▲" : "Afficher l’historique ▼";
    });
    logBtn.dataset.bound = "true"; 
  }
}

}

// -------------------- Show panel --------------------
async function showKeywordPanel(lang = "fr") {
  injectUI();

  // Init csvData
  window.csvData = window.csvData || [];
  const csvData = window.csvData;

  const keywords = getKeywords();
  const list = document.getElementById("keyword-list");
  if (!list) return;

  list.innerHTML = "";

  // Clear previous UI areas
  ["board-container", "microconcepts-container", "associated-keywords-container", "keyword-selection"]
    .forEach(id => {
      const el = document.getElementById(id);
      if (el) el.innerHTML = "";
    });

  for (const kw of keywords) {
    const li = document.createElement("li");
    li.textContent = kw;
    list.appendChild(li);

    const matches = findKeywordInCSVAll(kw);
    const isActive = matches.length > 0;

    if (isActive) {
      // ------------------------------
      // Case 1: keyword exists in CSV
      // ------------------------------
      li.style.color = "#0077cc";
      li.style.cursor = "pointer";
      li.addEventListener("click", () => {
        state.activeKeyword = kw;
        state.selected_cells.clear();
        getActiveEntryInteractive(kw);
      });

    } else {
      // ----------------------------------------
      // Case 2: keyword NOT in CSV → generate it
      // ----------------------------------------
      li.style.color = "#e67e22";
      li.style.cursor = "pointer";
      li.title = "Ce mot-clé n’est pas dans la base, cliquez pour générer une traduction.";

      li.addEventListener("click", async () => {
        li.style.opacity = "0.6";

        // Re-check if it's now in CSV
        let matches = findKeywordInCSVAll(kw);
        if (matches.length > 0) {
          state.activeKeyword = kw;
          state.selected_cells.clear();
          getActiveEntryInteractive(kw);
          li.style.opacity = "1";
          return;
        }

        li.textContent = `${kw} (analyse en cours...)`;

        try {
          // Generate IEML row
          const newEntryText = await generateIEMLAnalysis(kw);
          const parsed = parseCSV(newEntryText);

          if (!parsed || parsed.length === 0) {
            li.style.color = "#999";
            li.textContent = `${kw} (échec de génération)`;
            li.style.opacity = "1";
            return;
          }
          // ensure the first value of the translation is always the keyword 
          const newRow = correctCSVLine(parsed[0], kw);

          // const newRow = parsed[0];

          // Update UI
          li.style.color = "#0077cc";
          li.textContent = kw;
          state.activeKeyword = kw;
          state.selected_cells.clear();

          const boardContainer = document.getElementById("board-container");
          if (boardContainer) {
            displayBoard(newRow, true);
            addEditAndValidateButtons(newRow, kw);
          }

          // Update memory
          csvData.push(newRow);
          console.log("Nouvelle entrée générée:", newRow);
          addToLog("Mot-clé généré", kw);
        } catch (err) {
          console.error("Erreur API:", err);
          li.style.color = "red";
          li.textContent = `${kw} (erreur API)`;
        } finally {
          li.style.opacity = "1";
        }
      });
    }
  }

  const panel = document.getElementById("keyword-panel");
  if (panel) panel.classList.add("open");
}

// ensure the first column of the translation is always the keyword 
function correctCSVLine(line, keyword) {
  if (line.mot && line.mot !== keyword) {
    return { ...line, mot: keyword };
  }
  return line;
}

// ----------- Edit Translation -------------- 
function addEditAndValidateButtons(entry, keyword) {
  const container = document.getElementById("board-container");
  if (!container) return;

  // Remove old buttons if they exist
  const oldBtns = container.querySelectorAll(".edit-validate-btn");
  oldBtns.forEach(btn => btn.remove());

  const validateBtn = document.createElement("button");
  validateBtn.textContent = "Valider les modifications";
  validateBtn.classList.add("edit-validate-btn");
  styleActionButton(validateBtn, "#0077cc");

  validateBtn.addEventListener("click", async () => {
    const updatedEntry = extractEditedBoardData(keyword);
    // add to csvData for duration of the session
    csvData.push(updatedEntry);
    console.log("Saving edited entry:", updatedEntry);

    try {
      const res = await fetch("https://rag-proxy-worker.rag-proxy-worker.workers.dev/saveKeyword", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatedEntry),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const result = await res.json();
      console.log("Sauvegarde réussie:", result);

      validateBtn.textContent = "✅ Enregistré !";
      validateBtn.style.backgroundColor = "#28a745";

      // Mettre à jour le board avec les nouvelles valeurs
      displayBoard(updatedEntry, false);

      setTimeout(() => {
        validateBtn.textContent = "Valider les modifications";
        validateBtn.style.backgroundColor = "#0077cc";
      }, 2000);

    } catch (err) {
      console.error("❌ Erreur API :", err);
      validateBtn.textContent = "❌ Erreur de sauvegarde";
      validateBtn.style.backgroundColor = "red";
    }
  });

  container.appendChild(validateBtn);
}

function styleActionButton(btn, bgColor) {
  btn.style.margin = "8px 6px";
  btn.style.padding = "8px 16px";
  btn.style.border = "none";
  btn.style.borderRadius = "8px";
  btn.style.cursor = "pointer";
  btn.style.backgroundColor = bgColor;
  btn.style.color = "#fff";
  btn.style.fontWeight = "bold";
}

function makeBoardEditable() {
  const board = document.getElementById("board-container");
  if (!board) return;

  const cells = board.querySelectorAll("div[style*='font-size:14px']");
  cells.forEach(cell => {
    cell.contentEditable = "true";
    cell.style.border = "1px dashed #aaa";
    cell.style.backgroundColor = "#fff";
  });
}
function extractEditedBoardData(keyword) {
  const board = document.getElementById("board-container");

  // Get original full row (important)
  const original = csvData.find(
    r => r.mot.toLowerCase() === keyword.toLowerCase()
  ) || {};

  // Start from the original row, not an empty partial row
  const entry = { ...original, mot: keyword };

  let i = 0;
  layout.forEach(row => {
    row.forEach(pos => {
      const field = reverse_map[pos];
      if (!field) return; // ignore unknown

      const valEl = board.querySelectorAll(
        "div[style*='font-size:14px'], textarea"
      )[i];

      let newVal = "";
      if (!valEl) newVal = "";
      else if (valEl.tagName === "TEXTAREA") newVal = valEl.value.trim();
      else newVal = valEl.innerText.trim();

      entry[field] = newVal;
      i++;
    });
  });

  return entry;
}



// -------------------- Keyboard shortcut --------------------
document.addEventListener("keydown", e => {
  if (e.ctrlKey && e.key.toLowerCase() === "k") {
    showKeywordPanel("fr");
  }
});


// -------------------- Keyword extraction from article page --------------------

function getKeywords() {
  const lang = document.documentElement.lang || "fr";
  let keywords = [];

  // Extracting keywords from meta
  const metaSubjects = document.querySelectorAll(`meta[property="dc:subject"][lang="${lang}"]`);
  metaSubjects.forEach(subject => {
    const text = subject.content?.trim();
    if (text) keywords.push(text.toLowerCase());
  });

  // If no meta keywords, try “Sujets proches”
  if (keywords.length === 0) {
    const sujetsProchesSection = document.querySelector(`.multilang span[data-lang="${lang}"]`);
    if (sujetsProchesSection) {
      const links = sujetsProchesSection.querySelectorAll("a.isi-badge.main-subject");
      links.forEach(link => {
        const text = link.textContent?.trim();
        if (text) keywords.push(text.toLowerCase());
      });
    }
  }

  return keywords;
}

const state = {
  keyword: "",
  selected_cells: new Set(),
  activeKeyword: "",
  log: []
};



// ---------------------- Look for keyword in translated data  --------------------------


const antidict = [
  "singulier",
  "deux",
  "paire",
  "couple",
  "trois",
  "trio",
  "triplet",
  "pluriel",
  "plusieurs",
  "quelques",
  "peu de",
  "beaucoup",
  "très",
  "combien",
  "assez",
  "suffisamment",
  "aucun",
  "tous",
  "tout",
  "moins",
  "plus",
  "pas assez",
  "trop",
  "presque",
  "complètement",
  "chaque",
  "un par un",
  "deux par deux",
  "par paires",
  "trois par trois",
  "en triplets",
  "quatre par quatre",
  "par groupes de quatre",
  "cinq par cinq",
  "par groupes de cinq",
  "six par six",
  "par demi-douzaines",
  "sept par sept",
  "par groupes de sept",
  "huit par huit",
  "par groupes de huit",
  "neuf par neuf",
  "par groupes de neuf",
  "par dizaines",
  "par groupes de onze",
  "par douzaines",
  "par douze",
  "continu",
  "matière ou masse ou fluidité",
  "discontinu",
  "discret",
  "granulaire",
  "autre",
  "un autre",
  "même",
  "le même",
  "la même",
  "indéfini",
  "un",
  "une",
  "des",
  "défini",
  "le",
  "la",
  "les",
  "démonstratif",
  "ce",
  "cette",
  "ces",
  "ceci",
  "cela",
  "féminin",
  "femelle",
  "masculin",
  "mâle",
  "immatériel",
  "humain",
  "animé",
  "vivant",
  "inanimé",
  "interrogation",
  "négation",
  "citation",
  "affirmation",
  "possiblement",
  "si",
  "conditionnellement",
  "probablement",
  "par autorité",
  "par déduction",
  "par induction",
  "savoir",
  "vouloir",
  "pouvoir",
  "faire savoir",
  "annoncer",
  "s'engager à",
  "causatif",
  "faire",
  "laisser - avec verbe",
  "voix passive",
  "passif",
  "voix active",
  "actif",
  "voix réflexive",
  "réflexif",
  "voix réciproque",
  "reciproque",
  "processus défait",
  "défait",
  "processus achevé",
  "achevé",
  "processus habituel",
  "habituel",
  "continuellement",
  "processus commençant",
  "commençant",
  "processus en cours",
  "en cours",
  "processus finissant",
  "finissant",
  "futur",
  "présent",
  "passé",
  "hypothétique",
  "croire que",
  "croyance",
  "conditionnel",
  "subjonctif",
  "énoncer comme irréel",
  "oblique",
  "re-narratif",
  "rapporter d'un autre locuteur",
  "mode indicatif",
  "énoncer comme une réalité",
  "optatif",
  "désirer",
  "déontique",
  "devoir",
  "impératif",
  "jussif",
  "infinitif",
  "rôle de plusieurs parties du discours",
  "gérondif",
  "quasi-adverbe",
  "quasi-nom",
  "participe",
  "quasi-adjectif",
  "adverbe",
  "verbe",
  "adjectif",
  "nom",
  "contenu dans l'ensemble",
  "contient l'élément",
  "contenu dans le tout",
  "contient la partie",
  "indépendant de",
  "en relation avec",
  "en rapport avec",
  "au sujet de",
  "a pour condition",
  "en échange de",
  "a pour effet",
  "a pour conséquence",
  "a pour résultat",
  "a pour forme",
  "a pour structure",
  "a pour propriété",
  "fait de la matière",
  "par le moyen de",
  "par l'intermédiaire de",
  "grâce à l'instrument",
  "a pour cause efficiente",
  "parce que",
  "est une espèce de",
  "est un type de",
  "a pour différence spécifique",
  "en retour",
  "subit la mutation",
  "est sélectionné par",
  "évolue vers",
  "a pour opération",
  "est un instrument pour",
  "a pour opérateur",
  "a pour opérande",
  "a pour variable",
  "a pour constante",
  "après la date de référence",
  "plus tard",
  "futur absolu",
  "dans l'avenir",
  "plus tard",
  "demain",
  "futur relatif",
  "à la même date",
  "en même temps que",
  "pendant la date ou période de référence",
  "simultanément",
  "maintenant",
  "aujourd'hui",
  "de nos jours",
  "au présent",
  "avant la date de référence",
  "plus tôt",
  "tôt",
  "dans un passé absolu",
  "à une date passée",
  "plus tôt",
  "hier",
  "avant",
  "passé relatif",
  "avant - dans le temps",
  "après - dans le temps",
  "depuis - dans le temps",
  "jusqu'à - dans le temps",
  "à l'instant",
  "au moment",
  "à la date",
  "pendant",
  "dans l'intervalle",
  "bientôt",
  "brièvement",
  "pour un temps court",
  "longtemps",
  "vers le milieu",
  "vers l'avant",
  "vers l'arrière",
  "vers la droite",
  "vers la gauche",
  "entre",
  "au centre",
  "devant",
  "derrière",
  "à droite",
  "à gauche",
  "vers le sommet",
  "vers le haut",
  "au sommet",
  "en haut",
  "sur",
  "vers la mi-hauteur",
  "à mi-hauteur",
  "vers le fond",
  "sous",
  "au-dessous",
  "sous",
  "au fond",
  "entrant dans",
  "à travers",
  "traversant",
  "sortant de",
  "hors de",
  "dans",
  "dedans",
  "à la limite",
  "à la fontière",
  "dehors",
  "avec un mouvement centripète",
  "avec un mouvement circulaire",
  "autour de",
  "avec un mouvement centrifuge",
  "de",
  "venant de",
  "par",
  "passant par",
  "vers",
  "allant vers",
  "au départ",
  "en chemin",
  "à l'arrivée",
  "à la source",
  "par le canal",
  "au puits",
  "pour",
  "a pour but",
  "a pour objectif",
  "destiné à",
  "conçu pour",
  "inspiré par",
  "justifié par",
  "coloré par le sentiment",
  "se référant à",
  "dans le contexte de",
  "relation jeu vers jeu - contexte vers contexte",
  "relation jeu vers rôle",
  "relation jeu vers partie",
  "relation jeu vers règle",
  "relation jeu vers joueur",
  "relation jeu vers coup",
  "relation rôle vers jeu",
  "relation rôle-rôle",
  "relation rôle vers partie",
  "relation rôle vers règle",
  "relation rôle vers joueur",
  "relation rôle vers coup",
  "relation partie vers jeu",
  "relation partie vers rôle",
  "relation partie-partie",
  "relation partie vers règle",
  "relation partie vers joueur",
  "relation jeu vers partie",
  "relation règle vers jeu",
  "relation règle vers rôle",
  "relation règle vers partie",
  "relation règle-règle",
  "relation règle vers joueur",
  "relation règle vers coup",
  "relation joueur vers jeu",
  "relation joueur vers rôle",
  "relation joueur vers partie",
  "relation joueur vers règle",
  "relation joueur-joueur",
  "relation joueur vers coup",
  "relation coup vers jeu",
  "relation coup vers rôle",
  "relation coup vers partie",
  "relation coup vers règle",
  "relation coup vers joueur",
  "relation coup-coup",
  "de - idéal",
  "possessif - pour idées - connaissances - compétences",
  "de - moral",
  "possessif - pour un caractère abstrait ou une propriété morale",
  "possessif abstrait",
  "partie de",
  "possessif - pour les propriétés concrètes ou la partie d'un corps ou d'une chose",
  "possessif concret",
  "possessif pour le nom",
  "de - message",
  "possessif - pour l'attribution d'un message ou discours",
  "de - humain",
  "possessif pour les relations humaines - amis famille clients",
  "de-matériel",
  "possessif - pour propriété de biens ou avantages matériels",
  "contraire",
  "autre",
  "autrement",
  "différemment",
  "tropisme négatif",
  "en évitant",
  "en tournant le dos à",
  "au détriment de",
  "anti",
  "contre",
  "opposition",
  "restriction",
  "bien que",
  "malgré",
  "pourtant",
  "sans",
  "même",
  "identiquement",
  "comme",
  "d'une manière semblable à",
  "tropisme positif",
  "en cherchant",
  "vers",
  "motivé par",
  "au profit de",
  "pro",
  "pour",
  "adhésion à",
  "redoublement",
  "encore",
  "avec"
]


// Function to search CSV
  function findKeywordInCSVAll(keyword) {
    if (!csvData.length) return [];
  
    const normalizedKeyword = keyword.trim().toLowerCase();
  
    return csvData.filter(row => {
      return Object.values(row).some(value => {
        if (!value) return false;
  
        const parts = value
          .toString()
          .split(',')
          .map(part => part.trim())
          .filter(
            part => part && !part.startsWith('~') && !part.startsWith('*') && !antidict.includes(part.toLowerCase())
          );
  
        return parts.some(part => part.toLowerCase() === normalizedKeyword);
      });
    });
  }
  
  // Function to handle 
  function getActiveEntryInteractive(keyword) {
    const matches = findKeywordInCSVAll(keyword);
    if (!matches.length) return null;
  
    if (matches.length === 1) {
      displayBoard(matches[0], false);
      displayMicroconcepts();
      state.activeKeyword = matches[0].mot;
      addToLog("Mot-clé", matches[0].mot);
      return matches[0];
    }
  
    // Multiple matches → create selection UI
    const container = document.getElementById('keyword-selection');
    if (!container) return null;
    container.innerHTML = ''; // clear previous
  
    const msg = document.createElement('p');
    msg.textContent = `Ce mot-clé apparaît dans ${matches.length} entrées, voici le thème pour chacun. Veuillez sélectionner :`;
    container.appendChild(msg);
  
    matches.forEach(row => {
      const theme = row.theme || 'Sans thème';
      const btn = document.createElement('button');
      btn.textContent = theme;
      btn.addEventListener('click', () => {
        displayBoard(row, false);
        displayMicroconcepts();
        container.innerHTML = ''; // remove selection UI
        state.activeKeyword = row.mot;
        addToLog("Mot-clé", row.mot);
      });
      container.appendChild(btn);
    });
  }



// -------------- Display and Look for related Micro-concepts ------------


function displayMicroconcepts() {
  const container = document.getElementById("microconcepts-container");
  container.innerHTML = "";

  const selected = Array.from(state.selected_cells);
  if (!selected.length) {
    container.innerHTML = "<p>Choisir une cellule pour voir les mots-clés associés.</p>";
    document.getElementById("associated-keywords-container").innerHTML = "";
    return;
  }

  // --- Display selected micro-concepts ---
  const microList = document.createElement("div");
  microList.innerHTML = "<strong>Micro-concepts sélectionnés:</strong> ";
  selected.forEach(mc => {
    const btn = document.createElement("button");
    btn.textContent = mc;
    btn.style.margin = "2px";
    btn.addEventListener("click", () => {
      state.selected_cells.delete(mc);
      displayMicroconcepts(); // re-render micro-concepts and associated keywords
    });
    microList.appendChild(btn);
  });
  container.appendChild(microList);

  // --- Display associated keywords ---
  const assocDiv = document.getElementById("associated-keywords-container");
  assocDiv.innerHTML = "<strong>Mots-clés associés:</strong> ";

  const associated = getAssociatedKeywords();
  if (associated.length) {
    associated.forEach(kw => {
      const btn = document.createElement("button");
      btn.textContent = kw;
      btn.style.margin = "2px";

      btn.addEventListener("click", () => {
        // Set the clicked keyword as active
        state.activeKeyword = kw;

        // Reset micro-concept selection
        state.selected_cells.clear();

        // Find the CSV row for this keyword
        const row = csvData.find(r => r.mot.toLowerCase() === kw.toLowerCase());
        if (row) {
          // Render the board for the selected keyword
          displayBoard(row, false);

          // Clear and re-render micro-concepts for this new board
          displayMicroconcepts();
          addToLog("Mot-clé associé", kw);
        }
      });

      assocDiv.appendChild(btn);
    });
  } else {
    assocDiv.innerHTML += "<p>Pas de mot-clé associé.</p>";
  }
}
//  change main keyword displayed on selection of a concept or related keyword
function onKeywordSelected(keyword) {
  state.keyword = keyword;
  state.selected_cells.clear();

  const entry = getActiveEntryInteractive(keyword);
  displayBoard(entry, false);
  displayMicroconcepts();
}

function getAssociatedKeywords() {
  if (!csvData.length) return [];

  const selected = Array.from(state.selected_cells);
  if (!selected.length) return [];

  // Filter CSV rows where **any field matches** a selected micro-concept
  const matchingRows = csvData.filter(row => {
    return Object.values(row).some(cell => {
      if (!cell) return false;
      return selected.some(sel => cell.toLowerCase().includes(sel.toLowerCase()));
    });
  });

  // Collect unique 'mot' values, excluding the currently active keyword
  const associated = [...new Set(
    matchingRows.map(r => r.mot).filter(m => m.toLowerCase() !== state.activeKeyword.toLowerCase())
  )];

  return associated.sort();
}

  

// -------------- Generation of IEML translation : RAG ----------------
async function generateIEMLAnalysis(keyword) {
  const url = `https://rag-proxy-worker.rag-proxy-worker.workers.dev/retrieval?keyword=${encodeURIComponent(keyword)}`;
  
  const response = await fetch(url, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });

  if (!response.ok) {
    // Try to parse the body as JSON
    let errorBody;
    try {
      errorBody = await response.json();
    } catch {
      // fallback to text if JSON parsing fails
      errorBody = await response.text();
    }
    throw new Error(`API error ${response.status}: ${JSON.stringify(errorBody)}`);
  }

  const data = await response.json();
  return data.translation;
}

    // curl "https://rag-proxy-worker.rag-proxy-worker.workers.dev/retrieval?keyword=pédagogie" | jq 


// --------------------- Grid/Board display --------------

const layout = [
  ["cell1","cell2","cell3"],
  ["cell4","cell5","cell6"],
  ["cell7","cell8","cell9"]
];

const reverse_map = {
  cell5: "theme",
  cell4: "qui",
  cell2: "quoi",
  cell6: "a_qui",
  cell8: "par_quoi",
  cell1: "quand",
  cell3: "ou",
  cell7: "pourquoi",
  cell9: "comment"
};

const true_names = {
  cell5: "thème",
  cell4: "qui",
  cell2: "quoi",
  cell6: "à qui",
  cell8: "par quoi",
  cell1: "quand",
  cell3: "où",
  cell7: "pourquoi",
  cell9: "comment"
};


function displayBoard(entry, editable = false) {
  const container = document.getElementById("board-container");
  container.innerHTML = `<h3>Mot-clé : ${entry.mot}</h3>`;

  layout.forEach(row => {
    const rowDiv = document.createElement("div");
    rowDiv.style.display = "flex";
    rowDiv.style.marginBottom = "6px";

    row.forEach(pos => {
      const field = reverse_map[pos] || "?"; // e.g., "thème"
      let val = (entry[field] || "").trim();

      const cellDiv = document.createElement("div");
      cellDiv.style.flex = "1";
      cellDiv.style.padding = "6px";
      cellDiv.style.margin = "2px";
      cellDiv.style.border = "1px solid #ccc";
      cellDiv.style.borderRadius = "6px";
      cellDiv.style.textAlign = "center";
      cellDiv.style.backgroundColor = state.selected_cells.has(val) ? "#0077cc" : "#f9f9f9";

      // Editable cells get an <input>
      if (editable) {
        const label = document.createElement("div");
        label.textContent = true_names[pos];
        label.style.fontSize = "12px";
        label.style.fontWeight = "bold";
        label.style.color = "#555";
      
        const textarea = document.createElement("textarea");
        textarea.classList.add("board-value");
        textarea.value = val || "";
        textarea.style.width = "100%";
        textarea.style.boxSizing = "border-box";
        textarea.style.fontSize = "14px";
        textarea.style.fontFamily = "helvetica";
        textarea.style.lineHeight = "1.3";
        textarea.style.padding = "4px 6px";
        textarea.style.border = "1px solid #ccc";
        textarea.style.borderRadius = "4px";
        textarea.style.resize = "none";       // prevent manual resize
        textarea.style.overflow = "hidden";   // avoid scrollbar
      
        // Auto-height
        const autoResize = () => {
          textarea.style.height = "auto";                 // reset
          textarea.style.height = textarea.scrollHeight + "px";
        };
      
        textarea.addEventListener("input", e => {
          entry[field] = e.target.value;
          autoResize();
        });
      
        // Fit initial content
        setTimeout(autoResize, 0);
      
        cellDiv.appendChild(label);
        cellDiv.appendChild(textarea);
      }
      else {
        // Non-editable: just display value
        cellDiv.innerHTML = `
          <div style="font-size:12px; font-weight:bold; color:#555;">${true_names[pos]}</div>
          <div style="font-size:14px; font-family:helvetica;">${val || "–"}</div>
        `;

        // Add click handler for selection
        if (val) {
          cellDiv.style.cursor = "pointer";
          cellDiv.addEventListener("click", () => {
            if (state.selected_cells.has(val)) state.selected_cells.delete(val);
            else {
              state.selected_cells.add(val);
              addToLog("Micro-concept", val);
            }
            displayBoard(entry, false);
            displayMicroconcepts();
          });
        }
      }

      rowDiv.appendChild(cellDiv);
    });

    container.appendChild(rowDiv);
  });
}


// ------------ Article search -------------


// https://api.isidore.science/resource/search?q=humanité+numérique+ET+philosophie&replies=100&output=json

// isidore API call 
async function findRelatedArticles(terms, batchSize = 3) {
  const allArticles = [];
  const citationCache = {};
  try {
    const termArray = Array.isArray(terms) ? terms : [terms];
    // console.log(termArray);

    // batches for Query Augmented
    for (let i = 0; i < termArray.length; i += batchSize) {
      const batch = termArray.slice(i, i + batchSize);
      const query = batch
        .map(term => term.trim().split(/\s+/).join('+'))
        .join('+OU+');

      const url = `https://rag-proxy-worker.rag-proxy-worker.workers.dev/isidore?terms=${query}`;

      console.log("Fetching batch:", url);

      let content = null;
      try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP error: ${response.status}`);

        const text = await response.text();

        // Guard against empty or invalid JSON
        if (text && text.trim().startsWith("{")) {
          try {
            content = JSON.parse(text);
          } catch (parseErr) {
            console.warn("⚠️ JSON parsing failed for batch:", query, parseErr);
            content = null;
          }
        } else {
          console.warn("⚠️ Empty or invalid JSON body for batch:", query);
          content = null;
        }
      } catch (err) {
        console.error("❌ Error fetching batch:", query, err);
        content = null;
      }
        let replies = content?.response?.replies?.content?.reply;
        if (!replies) replies = [];
        else if (!Array.isArray(replies)) replies = [replies];
        const articles = [];

      for (const r of replies) {
        const titles = r?.isidore?.title || [];
        const firstTitleObj = titles.find(t => t['@xml:lang'] === 'fr') || titles[0];

        let creators = r?.isidore?.enrichedCreators?.creator;
        if (!creators) creators = [];
        else if (!Array.isArray(creators)) creators = [creators];
        const authors = creators.map(c => c['@normalizedAuthor'] || c['@origin']).filter(Boolean);

        // Normalize DOI/URL
        let doiUrl = null;
        if (Array.isArray(r?.isidore?.url)) {
          doiUrl = r.isidore.url[0]?.['$'] || null;
        } else if (typeof r?.isidore?.url === "string") {
          doiUrl = r.isidore.url;
        }

        // Crossref citation count
        let citation_count = null;
        if (doiUrl && doiUrl.startsWith('https://doi.org/')) {
          const doi = doiUrl.replace('https://doi.org/', '').trim();

          // ✅ Use cached count if already fetched
          if (citationCache[doi]) {
            citation_count = citationCache[doi];
          } else {
            try {
              // console.log(`Fetching Citation count for https://api.crossref.org/works/${doi}`);
              const crossref_response = await fetch(`https://rag-proxy-worker.rag-proxy-worker.workers.dev/crossref?doi=${encodeURIComponent(doi)}`);
              if (crossref_response.ok) {
                const data = await crossref_response.json();
                citation_count = data?.message?.['is-referenced-by-count'] ?? null;
                citationCache[doi] = citation_count;
              } else {
                console.error(`Crossref error for ${doi}: ${crossref_response.status}`);
              }
            } catch (err) {
              console.error(`Fetch error for ${doi}:`, err);
            }

            // Avoid rate limits
            await new Promise(resolve => setTimeout(resolve, 200));
          }
        }

        articles.push({
          title: firstTitleObj?.['$'] || "(no title)",
          authors: authors.join(", "),
          url: doiUrl,
          citation_count,
          abstract: r?.isidore?.abstract?.[0]?.['$'] || "(no abstract)"
        });
      }

      if (articles.length > 0) {
        allArticles.push(...articles);
      } else {
        console.log("ℹ️ No articles found in batch:", query);
      }

      // Wait 1s between each batch to be gentle with the APIs
      await new Promise(r => setTimeout(r, 1000));
    }

        return allArticles.length > 0 ? allArticles : [{}];

      } catch (err) {
        console.error("🔥 Fatal error in findRelatedArticles:", err);
        return [{}];
      }
    }


// query augmentation for 3rd panel

  async function queryAugmentation(keywords) {
    const context = Array.isArray(keywords) ? keywords.join(", ") : keywords;
    try {
      const response = await fetch("https://rag-proxy-worker.rag-proxy-worker.workers.dev/queryAugmentation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keywords}),
      });
  
      if (!response.ok) {
        const text = await response.text();
        console.error("Erreur API:", text);
        return null;
      }
  
      const t = await response.json();
      console.log(keywords, "→", t.text);
      return t.text;
  
    } catch (err) {
      console.error("Fetch failed:", err);
      return null;
    }
  
  // return "(technique numérique ET art numérique) OU (art numérique et techniques numériques) OU (création numérique ET art digital) OU (techniques d'art numérique) OU (art digital ET médias numériques) OU (numérique ET art contemporain) OU (technologie numérique ET création artistique) OU (art numérique ET design digital) OU (médias numériques ET art visuel) OU (techniques numériques ET art multimédia)"
  }
  

// -------------- Historique/Log  ----------

async function addToLog(action, value) {
  const entry = { action, value, time: new Date().toLocaleTimeString() };
  state.log.push(entry);
  displayLog();

  // Send log to backend (append mode)
  try {
    const userId = localStorage.getItem("userId") || crypto.randomUUID();
    localStorage.setItem("userId", userId);

    await fetch("https://rag-proxy-worker.rag-proxy-worker.workers.dev/saveKeptLogs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId,
        logs: [entry],
      }),
    });
  } catch (err) {
    console.error("❌ Failed to save log to backend:", err);
  }
}


function displayLog() {
  // clear lingering logs
  localStorage.removeItem("keptLogs");
  const container = document.getElementById("log-content");
  if (!container) {
    console.error("displayLog: element #log-content introuvable");
    return;
  }

  container.innerHTML = "";

  state.log.forEach((item, index) => {
    const div = document.createElement("div");
    div.textContent = `${item.value}`;
    div.className = "log-entry";
    div.style.margin = "4px 0";
    div.style.cursor = "pointer";
    div.style.padding = "4px 6px";
    div.style.borderRadius = "4px";
    div.style.transition = "background 0.2s";

    div.addEventListener("mouseover", () => (div.style.background = "#f0f0f0"));
    div.addEventListener("mouseout", () => {
      if (!div.classList.contains("selected")) div.style.background = "transparent";
    });

    div.addEventListener("click", () => handleLogClick(item, index, div, true));

    // try appendChild, fallback and debug on error
    try {
      container.appendChild(div);
    } catch (err) {
      console.error("displayLog: appendChild failed", err, { container, div });
      try {
        // fallback: insert as HTML (loses listeners unless re-attached)
        container.insertAdjacentHTML('beforeend', `<div class="log-entry">${div.textContent}</div>`);
      } catch (err2) {
        console.error("displayLog: fallback insertAdjacentHTML also failed", err2);
      }
    }
  });

  markKeptLogs();
}
async function handleLogClick(item, index, div, fromHistory = false) {
  let kept = JSON.parse(localStorage.getItem("keptLogs") || "[]");

  const exists = kept.find(log => log.time === item.time && log.action === item.action);
  if (exists) {
    kept = kept.filter(log => !(log.time === item.time && log.action === item.action));
    div.classList.remove("selected");
    div.style.background = "transparent";
  } else {
    kept.push({ ...item, fromHistory }); // <-- on marque la source
    div.classList.add("selected");
    div.style.background = "#d0f0d0";
  }

  localStorage.setItem("keptLogs", JSON.stringify(kept));

  // On montre le bouton seulement si au moins un kept est historique
  showRelatedButton(kept.filter(k => k.fromHistory));
}

function markKeptLogs() {
  const kept = JSON.parse(localStorage.getItem("keptLogs") || "[]");
  const container = document.getElementById("log-content");
  if (!container) return;

  [...container.children].forEach(div => {
    const text = div.textContent;
    const keptItem = kept.find(k => text.includes(k.action) && text.includes(k.value));
    if (keptItem) {
      div.classList.add("selected");
      div.style.background = "#d0f0d0";
      div.style.fontWeight = "bold";
    } else {
      div.classList.remove("selected");
      div.style.background = "transparent";
      div.style.fontWeight = "normal";
    }
  });

  // Affiche seulement si au moins un kept est de l'historique
  showRelatedButton(kept.filter(k => k.fromHistory));
}


// ----------- Related Articles Display ---------

// Button 'Chercher des articles associés'
async function showRelatedButton(kept) {
  // Ne garder que les éléments historiques
  const historicalKept = kept.filter(k => k.fromHistory);
  let existingBtn = document.getElementById("related-btn");
  const container = document.getElementById("log-content")?.parentElement;

  if (historicalKept.length > 0) {
    if (!existingBtn) {
      existingBtn = document.createElement("button");
      existingBtn.id = "related-btn";
      existingBtn.textContent = "Chercher des articles associés";
      Object.assign(existingBtn.style, {
        marginTop: "10px",
        padding: "6px 12px",
        borderRadius: "6px",
        background: "#0077cc",
        color: "white",
        cursor: "pointer",
        border: "none"
      });
      container?.appendChild(existingBtn);
    }

    // ⚡ On évite les multiples bindings
    existingBtn.onclick = async () => {
      // Re-filtrage historique pour être sûr
      const keptLogs = JSON.parse(localStorage.getItem("keptLogs") || "[]")
        .filter(k => k.fromHistory);

      if (keptLogs.length === 0) return;

      const keywordsSearched = keptLogs.map(k => k.value).join(" +ET+ ");

      // --- Assurer que les panneaux existent ---
      ensureRelatedPanels();

      // --- 1️⃣ Direct query ---
      const articles = await findRelatedArticles(keywordsSearched);
      displayRelatedArticles(articles, "related-panel", null, keywordsSearched);
      document.getElementById("related-panel").style.display = "block";

      // --- 2️⃣ LLM-augmented query ---
      const llmQuery = await queryAugmentation(keywordsSearched);
      if (llmQuery) {
        const terms = llmQuery.split(' OU ').map(t => t.replace(/[()]+/g, '').trim());
        const llmArticles = await findRelatedArticles(terms);
        displayRelatedArticles(llmArticles, "related-panel-llm", null, llmQuery);
        document.getElementById("related-panel-llm").style.display = "block";
      }

      // ✅ Cleanup UI
      localStorage.removeItem("keptLogs");
      document.querySelectorAll(".log-entry.selected").forEach(div => {
        div.classList.remove("selected");
        div.style.background = "transparent";
        div.style.fontWeight = "normal";
      });

      existingBtn.remove();
    };
  } else {
    // Aucun élément historique : on supprime le bouton s'il existe
    existingBtn?.remove();
  }
}


// --- Build the related articles panel dynamically ---

function ensureRelatedPanels() {
  // Panel 2: straightforward query
  if (!document.getElementById("related-panel")) {
    const p1 = document.createElement("div");
    p1.id = "related-panel";
    Object.assign(p1.style, {
      position: "fixed",
      top: "0",
      right: "350px", // attach beside keyword panel
      width: "400px",
      height: "100%",
      background: "#f9f9f9",
      borderLeft: "1px solid #ccc",
      boxShadow: "-2px 0 6px rgba(0,0,0,0.1)",
      overflowY: "auto",
      zIndex: "9999",
      padding: "10px",
      display: "none"
    });
    p1.innerHTML = `
      <h3>Articles liés (recherche directe) ℹ️ </h3>
      <div id="related-content"></div>
    `;
    document.body.appendChild(p1);

 // Panel 3: LLM-augmented query
if (!document.getElementById("related-panel-llm")) {
  const p2 = document.createElement("div");
  p2.id = "related-panel-llm";
  Object.assign(p2.style, {
    position: "fixed",
    top: "0",
    right: "750px",
    width: "400px",
    height: "100%",
    background: "#eef7ff",
    borderLeft: "1px solid #99c",
    boxShadow: "-2px 0 6px rgba(0,0,0,0.1)",
    overflowY: "auto",
    zIndex: "9998",
    padding: "10px",
    display: "none"
  });

  p2.innerHTML = `
  <h3>Articles liés (LLM augmented) ℹ️ </h3>
  <div id="related-content-llm"></div>
`;
document.body.appendChild(p2);

}
}
}

function displayRelatedArticles(articles, containerId, errorMsg = null, queryText = "") {
  const container = document.getElementById(containerId);
  if (!container) return;

  // Clear previous content
  container.innerHTML = "";

  // --- Query info box (hidden by default) ---
  const queryBox = document.createElement("div");
  queryBox.textContent = queryText || "(aucune requête)";
  Object.assign(queryBox.style, {
    display: "none",
    marginBottom: "4px",
    padding: "6px 10px",
    borderRadius: "6px",
    background: "#f0f0f0",
    color: "#333",
    whiteSpace: "pre-wrap",
    fontSize: "12px",
  });
  container.appendChild(queryBox);

  // --- Header ---
  const header = document.createElement("h4");
  header.textContent =
    containerId === "related-panel"
      ? "Articles liés (requête directe)"
      : "Articles liés (requête augmentée par LLM)";
  header.style.margin = "0 0 6px 0";
  header.style.color = "#333";
  header.style.cursor = "pointer";

  header.addEventListener("click", () => {
    queryBox.style.display = queryBox.style.display === "none" ? "block" : "none";
  });

  container.appendChild(header);

  // --- Error / Empty handling ---
  if (errorMsg) {
    const p = document.createElement("p");
    p.style.color = "red";
    p.textContent = errorMsg;
    container.appendChild(p);
    return;
  }

  if (!articles || !articles.length) {
    container.innerHTML += "<p>Aucun article trouvé.</p>";
    return;
  }

  // --- List of articles ---
  const list = document.createElement("ul");
  list.style.padding = "0";
  list.style.listStyle = "none";

  for (const a of articles) {
    const li = document.createElement("li");
    li.style.margin = "10px 0";
    li.style.cursor = "pointer";
    li.style.transition = "all 0.2s ease";

    // --- Title Row ---
    const titleRow = document.createElement("div");
    titleRow.style.display = "flex";
    titleRow.style.alignItems = "center";
    titleRow.style.gap = "6px";

    // Arrow icon
    const arrow = document.createElement("span");
    arrow.textContent = "▶"; // right arrow
    arrow.style.transition = "transform 0.2s ease";
    arrow.style.fontSize = "12px";
    arrow.style.color = "#0073aa";

    // Title
    const titleEl = document.createElement("strong");
    titleEl.textContent = a.title;
    titleEl.style.color = "#0073aa";
    titleEl.style.textDecoration = "underline";
    titleEl.style.flex = "1";

    titleRow.appendChild(arrow);
    titleRow.appendChild(titleEl);

    // --- Hidden Information about the article (DOI, Abstract, crossref) ---
    const details = document.createElement("div");
    details.style.display = "none";
    details.style.opacity = "0";
    details.style.marginTop = "4px";
    details.style.transition = "opacity 0.25s ease";
    details.innerHTML = `
        ${a.url != null ? `<div><strong>DOI :</strong> <a href="${a.url}" target="_blank">${a.url}</a></div>` : ""}
        <div style="margin-top: 4px;"><strong>${a.authors}</strong></div>
        ${a.citation_count != null ? `<div style="margin-top: 4px;">Citations: <strong>${a.citation_count}</strong></div>` : ""}
        ${a.abstract && a.abstract !== "(no abstract)" ? `<div style="margin-top: 4px;"><em>${a.abstract}</em></div>` : ""}
      `;


    // --- Toggle ---
    const toggleDetails = () => {
      const isHidden = details.style.display === "none";
      if (isHidden) {
        details.style.display = "block";
        requestAnimationFrame(() => (details.style.opacity = "1"));
        arrow.style.transform = "rotate(90deg)";
      } else {
        details.style.opacity = "0";
        arrow.style.transform = "rotate(0deg)";
        setTimeout(() => (details.style.display = "none"), 200);
      }
    };

    titleRow.addEventListener("click", toggleDetails);

    li.appendChild(titleRow);
    li.appendChild(details);
    list.appendChild(li);
  }

  container.appendChild(list);
}


